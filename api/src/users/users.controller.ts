import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.users.list({ id: actor.id, role: actor.role });
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, { id: actor.id, role: actor.role });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, { id: actor.id, role: actor.role });
  }
}
