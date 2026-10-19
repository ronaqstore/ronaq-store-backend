import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
loadEnv({ path: '.env' });

function cleanUrl(url: string): string {
  let cleaned = url
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '')
    .replace('sslmode=verify-full', 'sslmode=require');
  if (cleaned && !cleaned.includes('connect_timeout')) {
    cleaned += (cleaned.includes('?') ? '&' : '?') + 'connect_timeout=60';
  }
  return cleaned;
}

function toDirectUrl(pooledOrDirect: string): string {
  return cleanUrl(pooledOrDirect.replace('-pooler.', '.'));
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const directUrl = cleanUrl(
  process.env.DIRECT_URL?.trim()
    ? process.env.DIRECT_URL
    : toDirectUrl(databaseUrl),
);

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: directUrl,
  },
});
