import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `server/` folder, whether running from src/ (dev) or dist/ (production). */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load server/.env if it exists, using Node's built-in loader. Variables that are
// already set (e.g. on Render) take precedence over the file.
const envFile = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
