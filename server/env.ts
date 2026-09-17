import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads `.env` (gitignored) into `process.env` using Node's built-in
 * support — no extra dependency needed. Import this module first, before
 * anything that reads `process.env.GEMINI_API_KEY`, etc.
 */
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
