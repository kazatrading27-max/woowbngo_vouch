import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { WebAuthnService } from './webauthn.service';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private webauthn: WebAuthnService) {}

  @Get('register/options')
  registrationOptions(@CurrentUser() user: AuthUser) {
    return this.webauthn.registrationOptions({ id: user.id, email: user.email, name: user.name });
  }

  @Post('register')
  register(@Body() body: RegistrationResponseJSON, @CurrentUser() user: AuthUser) {
    return this.webauthn.register({ id: user.id, role: user.role }, body);
  }

  @Public()
  @Get('login/options')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  loginOptions() {
    return this.webauthn.loginOptions();
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() body: AuthenticationResponseJSON) {
    return this.webauthn.login(body);
  }

  @Get('credentials')
  credentials(@CurrentUser() user: AuthUser) {
    return this.webauthn.listCredentials(user.id);
  }

  @Delete('credentials/:id')
  removeCredential(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.webauthn.deleteCredential(user.id, user.role, id);
  }
}
