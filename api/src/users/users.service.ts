import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private canSeeAll(actorRole: string) {
    return actorRole === 'SUPER_ADMIN';
  }

  async list(actor: { id: string; role: string }) {
    const where = this.canSeeAll(actor.role)
      ? {}
      // Standard admins only see themselves and agents — never other admins.
      : { OR: [{ id: actor.id }, { role: 'AGENT' as const }] };
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'asc' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  async create(dto: CreateUserDto, actor: { id: string; role: string }) {
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Only the system itself can create another super admin.');
    }
    if (dto.role === 'ADMIN' && !this.canSeeAll(actor.role)) {
      throw new ForbiddenException('Only the super admin can create admin accounts.');
    }
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new ConflictException('A user with that email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: dto.role,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'USER_CREATED', entity: 'User', entityId: user.id, meta: { email: user.email, role: user.role } },
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
  }

  async update(id: string, dto: UpdateUserDto, actor: { id: string; role: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.id === actor.id && (dto.isActive === false || (dto.role && dto.role !== user.role))) {
      throw new BadRequestException('You cannot demote or deactivate your own account.');
    }

    if (!this.canSeeAll(actor.role)) {
      // Standard admins manage agents (and only their own profile fields) — never other admins.
      if (user.role === 'SUPER_ADMIN' || (user.role === 'ADMIN' && user.id !== actor.id)) {
        throw new ForbiddenException('Standard admins cannot manage other admin accounts.');
      }
      if (dto.role === 'ADMIN' || dto.role === 'SUPER_ADMIN') {
        throw new ForbiddenException('Only the super admin can grant admin roles.');
      }
    }
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Only the system itself can create another super admin.');
    }

    const data: any = {};
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.name) data.name = dto.name;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'USER_UPDATED',
        entity: 'User',
        entityId: id,
        meta: { role: updated.role, isActive: updated.isActive, passwordReset: !!dto.password },
      },
    });
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, isActive: updated.isActive, createdAt: updated.createdAt };
  }
}
