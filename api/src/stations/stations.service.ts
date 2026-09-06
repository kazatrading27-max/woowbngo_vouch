import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto, UpdateStationDto } from './stations.dto';

export function cleanUuidStr(uuid: string): string {
  return uuid.replace(/-/g, '').trim().toUpperCase();
}

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const stations = await this.prisma.station.findMany({
      include: { _count: { select: { vouchers: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return stations.map(({ _count, ...s }) => ({ ...s, voucherCount: _count.vouchers }));
  }

  async create(dto: CreateStationDto, actor: { id: string }) {
    const uuidClean = cleanUuidStr(dto.uuid);
    const dup = await this.prisma.station.findUnique({ where: { uuidClean } });
    if (dup) throw new ConflictException('A station with this UUID already exists');

    const station = await this.prisma.station.create({
      data: {
        uuid: dto.uuid.trim(),
        uuidClean,
        label: dto.label.trim(),
        ownerName: dto.ownerName.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: actor.id,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'STATION_CREATED', entity: 'Station', entityId: station.id, meta: { label: station.label, uuidClean } },
    });
    return station;
  }

  async update(id: string, dto: UpdateStationDto, actor: { id: string }) {
    const station = await this.prisma.station.findUnique({ where: { id } });
    if (!station) throw new NotFoundException('Station not found');

    const data: any = {};
    if (dto.uuid) {
      const uuidClean = cleanUuidStr(dto.uuid);
      if (uuidClean !== station.uuidClean) {
        const dup = await this.prisma.station.findUnique({ where: { uuidClean } });
        if (dup) throw new ConflictException('A station with this UUID already exists');
        data.uuid = dto.uuid.trim();
        data.uuidClean = uuidClean;
      }
    }
    if (dto.label) data.label = dto.label.trim();
    if (dto.ownerName) data.ownerName = dto.ownerName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    const updated = await this.prisma.station.update({ where: { id }, data });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'STATION_UPDATED', entity: 'Station', entityId: id, meta: { label: updated.label } },
    });
    return updated;
  }

  async remove(id: string, actor: { id: string }) {
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: { _count: { select: { vouchers: true } } },
    });
    if (!station) throw new NotFoundException('Station not found');
    if (station._count.vouchers > 0) {
      throw new ConflictException('This station has vouchers attached and cannot be deleted. Revoke them instead.');
    }
    await this.prisma.station.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'STATION_DELETED', entity: 'Station', entityId: id, meta: { label: station.label } },
    });
    return { deleted: true };
  }
}
