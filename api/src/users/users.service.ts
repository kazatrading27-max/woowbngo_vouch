import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  async create(dto: CreateUserDto, actorId: string) {
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
      data: { userId: actorId, action: 'USER_CREATED', entity: 'User', entityId: user.id, meta: { email: user.email, role: user.role } },
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
  }

  async update(id: string, dto: UpdateUserDto, actor: { id: string; role: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.id === actor.id && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new BadRequestException('You cannot demote or deactivate your own admin account.');
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
