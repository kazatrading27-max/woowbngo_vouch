import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, BootstrapDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private tokenFor(user: { id: string; email: string; role: string; name: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name });
  }

  private publicUser(user: { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date }) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
  }

  async hasUsers(): Promise<boolean> {
    return (await this.prisma.user.count()) > 0;
  }

  async bootstrap(dto: BootstrapDto) {
    if (await this.hasUsers()) {
      throw new ConflictException('An account already exists. Use the login form instead.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email.toLowerCase(), passwordHash, name: dto.name, role: 'ADMIN' },
    });
    const accessToken = this.tokenFor(user);
    return { accessToken, user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    const accessToken = this.tokenFor(user);
    return { accessToken, user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }
}
