import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

const { Pool } = pg;

function cleanDatabaseUrl(url: string | undefined): string {
  if (!url) return '';
  let cleaned = url
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '');
  if (!cleaned.includes('connect_timeout')) {
    cleaned += (cleaned.includes('?') ? '&' : '?') + 'connect_timeout=30';
  }
  return cleaned;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = cleanDatabaseUrl(process.env.DATABASE_URL);
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 10_000,
      maxLifetimeSeconds: 60,
      max: 10,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5_000,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    pool.on('error', (err: Error) => {
      new Logger(PrismaService.name).warn(
        `Database pool idle client error: ${err.message}`,
      );
    });

    super({
      adapter: new PrismaPg(pool),
      transactionOptions: {
        maxWait: 10_000,
        timeout: 30_000,
      },
    });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } finally {
      await this.pool.end();
      this.logger.log('Disconnected from database');
    }
  }
}
