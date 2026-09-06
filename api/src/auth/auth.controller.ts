import { Controller, Get, Post, Body, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, BootstrapDto } from './auth.dto';
import { Public } from '../common/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Get('has-users')
  hasUsers() {
    return this.auth.hasUsers();
  }

  @Public()
  @Post('bootstrap')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  bootstrap(@Body() dto: BootstrapDto) {
    return this.auth.bootstrap(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Request() req: { user: { id: string } }) {
    return this.auth.me(req.user.id);
  }
}
