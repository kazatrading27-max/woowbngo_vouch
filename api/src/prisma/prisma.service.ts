import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // No eager $connect(): serverless functions should connect lazily on first query.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
