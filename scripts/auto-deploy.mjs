/**
 * Auto deploy script for Cloudflare Workers
 * Usage: node scripts/auto-deploy.mjs "commit message"
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const commitMsg = process.argv[2] || 'auto deploy';

try {
  // Add all changes
  execSync('git add .', { stdio: 'inherit' });

  // Commit
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

  // Push
  execSync('git push origin main', { stdio: 'inherit' });

  // Deploy to Cloudflare
  execSync('opennextjs-cloudflare build && wrangler deploy', { stdio: 'inherit' });

  console.log('✅ Auto-commit, push, and deploy completed successfully!');
} catch (error) {
  console.error('❌ Automation failed:', error.message);
  process.exit(1);
}