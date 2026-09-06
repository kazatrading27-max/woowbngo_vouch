import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VoucherStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { makeVoucherBytes, validateVoucherCode } from '../voucher/voucher-codec';
import { CreateVouchersDto, ValidateVoucherDto, ListVouchersQueryDto } from './vouchers.dto';

const DEFAULT_DAYS = 30;
const DEFAULT_SHARE = 80;
const DEFAULT_COUNT = 1;

@Injectable()
export class VouchersService {
  constructor(private prisma: PrismaService) {}

  effectiveStatus(v: { status: VoucherStatus; expiresAt: Date | null }): VoucherStatus | 'EXPIRED' {
    if (v.status === 'ACTIVE' && v.expiresAt && v.expiresAt.getTime() < Date.now()) return 'EXPIRED';
    return v.status;
  }

  // Standard admins must not see voucher histories/info issued by other admins —
  // they see their own vouchers plus everything issued by agents. Super admin sees all.
  private visibilityScope(actor: { id: string; role: string }): Prisma.VoucherWhereInput {
    if (actor.role === 'SUPER_ADMIN') return {};
    if (actor.role === 'ADMIN') {
      return { issuedBy: { OR: [{ id: actor.id }, { role: 'AGENT' as const }] } };
    }
    return {};
  }

  private toDto(v: any) {
    const { station, issuedBy, ...rest } = v;
    return {
      ...rest,
      effectiveStatus: this.effectiveStatus(rest),
      station: station
        ? { id: station.id, uuid: station.uuid, label: station.label, ownerName: station.ownerName, phone: station.phone, address: station.address }
        : undefined,
      issuedBy: issuedBy ? { id: issuedBy.id, name: issuedBy.name } : undefined,
    };
  }

  async create(dto: CreateVouchersDto, actor: { id: string }) {
    const station = await this.prisma.station.findUnique({ where: { id: dto.stationId } });
    if (!station) throw new NotFoundException('Station not found');

    const amount = Math.floor(dto.amount);
    const daysValid = dto.daysValid ?? DEFAULT_DAYS;
    const share = dto.share ?? DEFAULT_SHARE;
    const count = dto.count ?? DEFAULT_COUNT;

    const nowDays = Math.floor(Date.now() / 1000 / 86400);
    if (daysValid > 0 && nowDays + daysValid > 65535) {
      throw new ConflictException('daysValid is too large — expiry exceeds the maximum encodable date.');
    }

    const created: any[] = [];
    for (let i = 0; i < count; i++) {
      let attempt = 0;
      let record: any = null;
      while (!record) {
        attempt += 1;
        if (attempt > 5) throw new ConflictException('Voucher code collision after multiple attempts, please retry.');
        const { code, formattedCode, expDays } = makeVoucherBytes({
          uuid: station.uuid,
          amount,
          daysValid,
          share,
        });
        try {
          record = await this.prisma.voucher.create({
            data: {
              code,
              formattedCode,
              amount,
              share,
              daysValid,
              expiresAt: expDays > 0 ? new Date(expDays * 86400 * 1000) : null,
              status: 'ACTIVE',
              stationId: station.id,
              issuedById: actor.id,
              note: dto.note?.trim() || null,
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
          throw e;
        }
      }
      created.push(record);
    }

    const full = await this.prisma.voucher.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      include: { station: true, issuedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'VOUCHERS_GENERATED',
        entity: 'Voucher',
        entityId: null,
        meta: { stationId: station.id, stationLabel: station.label, count, amount, daysValid, share, codes: full.map((v) => v.formattedCode) },
      },
    });

    return full.map((v) => this.toDto(v));
  }

  async list(query: ListVouchersQueryDto, actor: { id: string; role: string }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.VoucherWhereInput = { ...this.visibilityScope(actor) };

    if (query.stationId) where.stationId = query.stationId;
    if (query.issuedById) where.issuedById = query.issuedById;
    if (query.from || query.to) {
      const range: Prisma.DateTimeFilter = {};
      const fromDate = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
      const toDate = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
      if (fromDate && !isNaN(fromDate.getTime())) range.gte = fromDate;
      if (toDate && !isNaN(toDate.getTime())) range.lte = toDate;
      if (range.gte || range.lte) where.createdAt = range;
    }
    const q = query.q?.trim();
    if (q) {
      where.AND = [
        {
          OR: [
            { formattedCode: { contains: q, mode: 'insensitive' } },
            { station: { label: { contains: q, mode: 'insensitive' } } },
            { station: { ownerName: { contains: q, mode: 'insensitive' } } },
            { note: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (query.status) {
      if (query.status === 'EXPIRED') {
        where.status = 'ACTIVE';
        where.expiresAt = { lt: new Date() };
      } else if (query.status === 'ACTIVE') {
        where.status = 'ACTIVE';
        where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
      } else {
        where.status = query.status as VoucherStatus;
      }
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.voucher.count({ where }),
      this.prisma.voucher.findMany({
        where,
        include: { station: true, issuedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((v) => this.toDto(v)),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async stats(stationId: string | undefined, actor: { id: string; role: string }) {
    const now = new Date();
    const scope: Prisma.VoucherWhereInput = {
      ...(stationId ? { stationId } : {}),
      ...this.visibilityScope(actor),
    };
    const [stations, total, active, expired, redeemed, revoked, creditsIssued, creditsActive] = await Promise.all([
      stationId ? this.prisma.station.count({ where: { id: stationId } }) : this.prisma.station.count(),
      this.prisma.voucher.count({ where: scope }),
      this.prisma.voucher.count({ where: { ...scope, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      this.prisma.voucher.count({ where: { ...scope, status: 'ACTIVE', expiresAt: { lt: now } } }),
      this.prisma.voucher.count({ where: { ...scope, status: 'REDEEMED' } }),
      this.prisma.voucher.count({ where: { ...scope, status: 'REVOKED' } }),
      this.prisma.voucher.aggregate({ _sum: { amount: true }, where: scope }),
      this.prisma.voucher.aggregate({ _sum: { amount: true }, where: { ...scope, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    ]);
    return {
      stations,
      vouchersTotal: total,
      vouchersActive: active,
      vouchersExpired: expired,
      vouchersRedeemed: redeemed,
      vouchersRevoked: revoked,
      creditsIssued: creditsIssued._sum.amount ?? 0,
      creditsActive: creditsActive._sum.amount ?? 0,
    };
  }

  async validate(dto: ValidateVoucherDto, actor: { id: string; role: string }) {
    const result = validateVoucherCode(dto.code, dto.uuid ?? undefined);
    let dbRecord = null;
    if (result.valid) {
      const found = await this.prisma.voucher.findUnique({
        where: { code: dto.code.trim().toUpperCase().replace(/-/g, '').replace(/ /g, '') },
        include: { station: true, issuedBy: { select: { id: true, name: true, role: true } } },
      });
      if (found) {
        const issuedByOtherAdmin =
          actor.role !== 'SUPER_ADMIN' &&
          found.issuedBy &&
          found.issuedBy.role !== 'AGENT' &&
          found.issuedBy.id !== actor.id;
        dbRecord = {
          id: found.id,
          status: this.effectiveStatus(found),
          note: found.note,
          createdAt: found.createdAt,
          station: { id: found.station.id, label: found.station.label, ownerName: found.station.ownerName, uuid: found.station.uuid },
          issuedBy: issuedByOtherAdmin ? null : found.issuedBy?.name ?? null,
        };
      }
    }
    return { ...result, dbRecord };
  }

  async markRedeemed(id: string, actor: { id: string }) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== 'ACTIVE') throw new ConflictException('Only ACTIVE vouchers can be marked redeemed.');
    const updated = await this.prisma.voucher.update({
      where: { id },
      data: { status: 'REDEEMED', redeemedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'VOUCHER_MARKED_REDEEMED', entity: 'Voucher', entityId: id, meta: { code: voucher.formattedCode } },
    });
    return this.toDto({ ...updated, station: undefined, issuedBy: undefined });
  }

  async revoke(id: string, actor: { id: string }) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status === 'REVOKED') throw new ConflictException('Voucher is already revoked.');
    const updated = await this.prisma.voucher.update({ where: { id }, data: { status: 'REVOKED' } });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'VOUCHER_REVOKED', entity: 'Voucher', entityId: id, meta: { code: voucher.formattedCode } },
    });
    return this.toDto({ ...updated, station: undefined, issuedBy: undefined });
  }
}
