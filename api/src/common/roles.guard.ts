import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 2,
  ADMIN: 1,
  AGENT: 0,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    // Hierarchy: SUPER_ADMIN > ADMIN > AGENT — a higher role satisfies a lower requirement.
    const level = ROLE_LEVEL[user.role as Role] ?? 0;
    return required.some((role) => level >= ROLE_LEVEL[role]);
  }
}
