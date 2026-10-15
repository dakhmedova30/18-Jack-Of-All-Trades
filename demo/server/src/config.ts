import path from 'node:path';
import type { SslMode } from './db/database.js';
import { SERVER_ROOT } from './env.js';

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in, ' +
        'or set DATABASE_URL in your host’s environment variables.',
    );
  }
  return url;
}

function readSslMode(value: string | undefined): SslMode | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'disable' || value === 'require' || value === 'verify') return value;
  throw new Error(`Invalid DATABASE_SSL "${value}". Use disable, require or verify.`);
}

export type Config = ReturnType<typeof loadConfig>;

/** Reads settings from the environment. Throws a readable error if one is invalid. */
export function loadConfig() {
  return {
    port: readPort(process.env.PORT, 4000),
    databaseUrl: readDatabaseUrl(),
    databaseSsl: readSslMode(process.env.DATABASE_SSL),
    /** When "true", the server fills an empty database with sample items on startup. */
    seedIfEmpty: process.env.SEED_IF_EMPTY === 'true',
    /** Built React app. Served by Express when it exists (i.e. after `npm run build`). */
    clientDistPath: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  };
}
