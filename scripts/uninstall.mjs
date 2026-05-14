/**
 * scripts/uninstall.mjs
 * npx crewpilot uninstall
 * Removes the Crewpilot plugin from ~/.claude/.
 * Steps:
 *   1. Remove plugin files from ~/.claude/plugins/marketplaces/Askhz/
 *   2. Remove entry from ~/.claude/plugins/known_marketplaces.json
 *   3. Remove entry from ~/.claude/plugins/installed_plugins.json
 *   4. Remove entry from ~/.claude/settings.json (enabledPlugins)
 */

import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const PLUGIN_NAME = 'crewpilot';
const MARKETPLACE = 'Askhz';
const PLUGIN_KEY = `${PLUGIN_NAME}@${MARKETPLACE}`;

function readJSONSafe(filePath) {
  try { return JSON.parse(readFileSync(filePath, 'utf-8')); }
  catch (_) { return null; }
}

function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, filePath);
}

async function main() {
  console.log('\n🗑️  Crewpilot uninstall — removing plugin from ~/.claude/...\n');

  // Step 1: Remove marketplace and cache directories
  console.log('Step 1/4: Removing plugin files...');
  const marketplaceDir = join(PLUGINS_DIR, 'marketplaces', MARKETPLACE);
  const cacheDir = join(PLUGINS_DIR, 'cache', MARKETPLACE);
  for (const dir of [marketplaceDir, cacheDir]) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`   Removed: ${dir}`);
    }
  }
  console.log('');

  // Step 2: Remove from known_marketplaces.json
  console.log('Step 2/4: Updating marketplace registry...');
  const marketplacesPath = join(PLUGINS_DIR, 'known_marketplaces.json');
  const marketplaces = readJSONSafe(marketplacesPath);
  if (marketplaces && marketplaces[MARKETPLACE]) {
    delete marketplaces[MARKETPLACE];
    writeJSON(marketplacesPath, marketplaces);
    console.log(`   Removed "${MARKETPLACE}" from known_marketplaces.json`);
  } else {
    console.log('   (no entry found)');
  }
  console.log('');

  // Step 3: Remove from installed_plugins.json
  console.log('Step 3/4: Updating installed plugins registry...');
  const installedPath = join(PLUGINS_DIR, 'installed_plugins.json');
  const installed = readJSONSafe(installedPath);
  if (installed?.plugins?.[PLUGIN_KEY]) {
    delete installed.plugins[PLUGIN_KEY];
    writeJSON(installedPath, installed);
    console.log(`   Removed "${PLUGIN_KEY}" from installed_plugins.json`);
  } else {
    console.log('   (no entry found)');
  }
  console.log('');

  // Step 4: Remove from settings.json
  console.log('Step 4/4: Updating Claude Code settings...');
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  const settings = readJSONSafe(settingsPath);
  if (settings?.enabledPlugins?.[PLUGIN_KEY] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_KEY];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log(`   Removed "${PLUGIN_KEY}" from settings.json`);
  } else {
    console.log('   (no entry found)');
  }
  console.log('');

  console.log('✅ Crewpilot uninstalled successfully!');
  console.log('   Restart Claude Code to apply changes.\n');
}

main().catch(err => {
  console.error('\n❌ Uninstall failed:', err.message);
  process.exit(1);
});
