/**
 * scripts/init-project.mjs
 * npx crewpilot init
 * Idempotently creates .crewpilot/ runtime directory structure in the current project.
 * Never overwrites existing user data (workflows, agents, tasks).
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PROJECT_ROOT = process.cwd();
const DATA_DIR = join(PROJECT_ROOT, '.crewpilot');

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`  Created: ${dir.replace(PROJECT_ROOT, '.')}`);
  }
}

function copyIfMissing(src, dest) {
  if (!existsSync(dest) && existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  Copied:  ${dest.replace(PROJECT_ROOT, '.')}`);
  }
}

function writeIfMissing(filePath, content) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  Created: ${filePath.replace(PROJECT_ROOT, '.')}`);
  }
}

async function main() {
  console.log('\n🚀 Crewpilot init — setting up .crewpilot/ in current project...\n');

  // 1. Create directory structure (minimal — only what's needed for TeamCreate mode)
  const dirs = [
    DATA_DIR,
    join(DATA_DIR, 'workflows'),
  ];
  for (const dir of dirs) ensureDir(dir);

  // 2. Write index.json (if not exists)
  const indexPath = join(DATA_DIR, 'index.json');
  writeIfMissing(indexPath, JSON.stringify({
    version: 2,
    updatedAt: new Date().toISOString(),
    workflows: [],
    agents: [],
    recentTasks: [],
  }, null, 2));

  console.log('\n✅ Crewpilot initialized successfully!');
  console.log(`   Data directory: ${DATA_DIR.replace(PROJECT_ROOT, '.')}`);
  console.log('\nNext: use "crewpilot <task>" in Claude Code to start orchestrating.\n');
}

main().catch(err => {
  console.error('Init failed:', err.message);
  process.exit(1);
});