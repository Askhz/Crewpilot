/**
 * hooks/stop.mjs — Crewpilot Stop hook
 * Persists learnings to .crewpilot/index.json on session stop.
 * Trims learnings to 20, archives active workflow.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

async function main() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) input += chunk;

  let projectRoot = '';
  try {
    projectRoot = execSync('git rev-parse --show-toplevel 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
  } catch (_) { process.exit(0); }

  if (!projectRoot) process.exit(0);

  const indexPath = join(projectRoot, '.crewpilot', 'index.json');
  if (!existsSync(indexPath)) process.exit(0);

  let index;
  try { index = JSON.parse(readFileSync(indexPath, 'utf-8')); } catch (_) { process.exit(0); }

  if (index.activeWorkflow) {
    if (!index.workflowHistory) index.workflowHistory = [];
    index.workflowHistory.unshift(Object.assign({}, index.activeWorkflow, { completedAt: new Date().toISOString() }));
    index.workflowHistory = index.workflowHistory.slice(0, 5);
    delete index.activeWorkflow;
  }

  if (index.learnings && index.learnings.length > 20) {
    index.learnings = index.learnings.slice(-20);
  }

  index.updatedAt = new Date().toISOString();

  const tmp = indexPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf-8');
  renameSync(tmp, indexPath);
}

main().catch(() => process.exit(0));
