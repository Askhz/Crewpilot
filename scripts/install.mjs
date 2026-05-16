/**
 * scripts/install.mjs
 * npx crewpilot install
 * Installs the Crewpilot plugin to ~/.claude/ for use in Claude Code.
 * Steps:
 *   1. Copy plugin files to ~/.claude/plugins/marketplaces/Askhz/crewpilot/
 *   2. Update ~/.claude/plugins/known_marketplaces.json
 *   3. Update ~/.claude/plugins/installed_plugins.json
 *   4. Update ~/.claude/settings.json (enabledPlugins)
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, renameSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const PLUGIN_NAME = 'crewpilot';
const MARKETPLACE = 'Askhz';
const PLUGIN_KEY = `${PLUGIN_NAME}@${MARKETPLACE}`;

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJSONSafe(filePath) {
  try { return JSON.parse(readFileSync(filePath, 'utf-8')); }
  catch (_) { return null; }
}

function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, filePath);
}

function copyPluginContent(destDir) {
  ensureDir(destDir);

  const DIRS_TO_COPY = ['.claude-plugin', 'skills'];
  const FILES_TO_COPY = ['CLAUDE.md'];

  for (const dirName of DIRS_TO_COPY) {
    const src = join(REPO_ROOT, dirName);
    if (existsSync(src)) {
      const dest = join(destDir, dirName);
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }
  }
  for (const fileName of FILES_TO_COPY) {
    const src = join(REPO_ROOT, fileName);
    if (existsSync(src)) {
      copyFileSync(src, join(destDir, fileName));
    }
  }
}

async function main() {
  console.log('\n🔧 Crewpilot install — installing plugin to ~/.claude/...\n');

  // Step 1: Copy plugin files
  console.log('Step 1/4: Copying plugin files...');
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
  const VERSION = pkg.version;
  const marketplaceDir = join(PLUGINS_DIR, 'marketplaces', MARKETPLACE);
  const cacheDir = join(PLUGINS_DIR, 'cache', MARKETPLACE, PLUGIN_NAME, VERSION);
  ensureDir(marketplaceDir);
  ensureDir(cacheDir);

  // Copy .claude-plugin/ to the marketplace root so Claude Code can find marketplace.json
  const claudePluginSrc = join(REPO_ROOT, '.claude-plugin');
  const claudePluginDest = join(marketplaceDir, '.claude-plugin');
  if (existsSync(claudePluginDest)) rmSync(claudePluginDest, { recursive: true, force: true });
  cpSync(claudePluginSrc, claudePluginDest, { recursive: true });
  console.log(`   Copied: .claude-plugin/ → marketplaces/${MARKETPLACE}/.claude-plugin/`);

  // Copy plugin contents into both locations
  copyPluginContent(join(marketplaceDir, PLUGIN_NAME));
  copyPluginContent(cacheDir);
  console.log('   ✅ Plugin files copied\n');

  // Step 2: Update known_marketplaces.json
  console.log('Step 2/4: Updating marketplace registry...');
  ensureDir(PLUGINS_DIR);
  const marketplacesPath = join(PLUGINS_DIR, 'known_marketplaces.json');
  const marketplaces = readJSONSafe(marketplacesPath) ?? {};
  if (Array.isArray(marketplaces.marketplaces)) delete marketplaces.marketplaces;

  if (!marketplaces[MARKETPLACE]) {
    marketplaces[MARKETPLACE] = {
      source: { source: 'github', repo: `${MARKETPLACE}/${PLUGIN_NAME}` },
      installLocation: join(PLUGINS_DIR, 'marketplaces', MARKETPLACE),
      lastUpdated: new Date().toISOString(),
    };
  } else {
    marketplaces[MARKETPLACE].lastUpdated = new Date().toISOString();
  }
  writeJSON(marketplacesPath, marketplaces);
  console.log('   ✅ known_marketplaces.json updated\n');

  // Step 3: Update installed_plugins.json
  console.log('Step 3/4: Updating installed plugins registry...');
  const installedPath = join(PLUGINS_DIR, 'installed_plugins.json');
  const installed = readJSONSafe(installedPath) ?? { version: 2, plugins: {} };
  if (!installed.version) installed.version = 2;
  if (!installed.plugins || Array.isArray(installed.plugins)) installed.plugins = {};

  const now = new Date().toISOString();
  const existingEntries = installed.plugins[PLUGIN_KEY] ?? [];
  const existingEntry = existingEntries.find(e => e.scope === 'user');
  const pluginEntry = {
    scope: 'user',
    installPath: cacheDir,
    version: VERSION,
    installedAt: existingEntry?.installedAt ?? now,
    lastUpdated: now,
  };

  if (existingEntry) {
    Object.assign(existingEntry, pluginEntry);
  } else {
    installed.plugins[PLUGIN_KEY] = [pluginEntry];
  }
  writeJSON(installedPath, installed);
  console.log('   ✅ installed_plugins.json updated\n');

  // Step 4: Update ~/.claude/settings.json
  console.log('Step 4/4: Enabling plugin in Claude Code settings...');
  ensureDir(CLAUDE_DIR);
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  const settings = readJSONSafe(settingsPath) ?? {};
  if (!settings.enabledPlugins) settings.enabledPlugins = {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  console.log('   ✅ ~/.claude/settings.json updated\n');

  console.log('✅ Crewpilot installed successfully!');
  console.log('\nNext steps:');
  console.log('  1. In your project directory, run: npx crewpilot init');
  console.log('  2. Restart Claude Code to load the plugin');
  console.log('  3. Use "crewpilot <task>" to start orchestrating\n');
}

main().catch(err => {
  console.error('\n❌ Install failed:', err.message);
  process.exit(1);
});