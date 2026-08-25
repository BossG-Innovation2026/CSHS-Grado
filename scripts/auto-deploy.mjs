/**
 * Auto deploy script for Cloudflare Workers
 * Usage: node scripts/auto-deploy.mjs "commit message"
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim();
}

const commitMsg = process.argv[2] || 'auto deploy';

try {
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  execSync('npx opennextjs-cloudflare build && npx wrangler deploy', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('\n✅ Auto-commit, push, and deploy completed successfully!');
} catch (error) {
  console.error('\n❌ Automation failed:', error.message);
  process.exit(1);
}