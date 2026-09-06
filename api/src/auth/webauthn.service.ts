import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// RP ID / origin are derived from CORS_ORIGIN (the web app URL) so local dev
// (http://localhost:3000) and production (https://…vercel.app) both work.
function rpConfig() {
  const first = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  const origin = process.env.WEBAUTHN_EXPECTED_ORIGIN || first || 'http://localhost:3000';
  const url = new URL(origin);
  return { rpID: process.env.WEBAUTHN_RP_ID || url.hostname, origin };
}

@Injectable()
export class WebAuthnService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  private async saveChallenge(challenge: string, type: 'registration' | 'authentication', userId?: string) {
    await this.prisma.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.webAuthnChallenge.create({
      data: { challenge, userId, type, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
  }

  async registrationOptions(user: { id: string; email: string; name: string }) {
    const { rpID } = rpConfig();
    const existing = await this.prisma.passkey.findMany({ where: { userId: user.id } });
    const options = await generateRegistrationOptions({
      rpName: 'WowBingo Vouchers',
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports as any[] })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });
    await this.saveChallenge(options.challenge, 'registration', user.id);
    return options;
  }

  async register(user: { id: string; role: string }, response: RegistrationResponseJSON) {
    const { rpID, origin } = rpConfig();
    const challengeRow = await this.prisma.webAuthnChallenge.findFirst({
      where: { type: 'registration', userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
    });
    if (!challengeRow) {
      throw new UnauthorizedException('No pending biometric registration — start again.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (e: any) {
      throw new UnauthorizedException(`Biometric registration failed: ${e?.message || 'invalid response'}`);
    } finally {
      await this.prisma.webAuthnChallenge.delete({ where: { id: challengeRow.id } }).catch(() => {});
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo!;
    const passkey = await this.prisma.passkey.upsert({
      where: { id: credential.id },
      create: {
        id: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.transports ?? []) as string[],
      },
      update: {
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.transports ?? []) as string[],
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'PASSKEY_REGISTERED', entity: 'Passkey', entityId: passkey.id, meta: { deviceType: credentialDeviceType } },
    });
    return this.publicPasskey(passkey);
  }

  async loginOptions() {
    const { rpID } = rpConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      // Allow any discoverable credential (passkey) stored on this device.
      allowCredentials: [],
    });
    await this.saveChallenge(options.challenge, 'authentication');
    return options;
  }

  async login(response: AuthenticationResponseJSON) {
    const { rpID, origin } = rpConfig();
    const credentialId = response?.id;
    if (!credentialId) throw new UnauthorizedException('Missing credential');
    const passkey = await this.prisma.passkey.findUnique({ where: { id: credentialId }, include: { user: true } });
    if (!passkey) throw new UnauthorizedException('Unknown device credential');
    if (!passkey.user.isActive) throw new UnauthorizedException('Account is inactive');

    const challengeRow = await this.prisma.webAuthnChallenge.findFirst({
      where: { type: 'authentication', userId: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
    });
    if (!challengeRow) throw new UnauthorizedException('Challenge expired — try the biometric prompt again.');

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports as any[],
        },
      });
    } catch (e: any) {
      throw new UnauthorizedException(`Biometric sign-in failed: ${e?.message || 'invalid assertion'}`);
    } finally {
      await this.prisma.webAuthnChallenge.delete({ where: { id: challengeRow.id } }).catch(() => {});
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId: passkey.userId, action: 'PASSKEY_LOGIN', entity: 'User', entityId: passkey.userId },
    });
    const accessToken = this.auth.tokenFor(passkey.user);
    return { accessToken, user: this.auth.publicUser(passkey.user) };
  }

  async listCredentials(userId: string) {
    const passkeys = await this.prisma.passkey.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return passkeys.map((p) => this.publicPasskey(p));
  }

  async deleteCredential(userId: string, role: string, id: string) {
    const passkey = await this.prisma.passkey.findUnique({ where: { id } });
    if (!passkey) throw new NotFoundException('Passkey not found');
    if (passkey.userId !== userId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('You can only remove your own passkeys.');
    }
    await this.prisma.passkey.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { userId, action: 'PASSKEY_DELETED', entity: 'Passkey', entityId: id },
    });
    return { deleted: true };
  }

  private publicPasskey(p: {
    id: string;
    deviceType: string;
    backedUp: boolean;
    transports: string[];
    createdAt: Date;
    lastUsedAt: Date | null;
  }) {
    return {
      id: p.id,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      transports: p.transports,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    };
  }
}
