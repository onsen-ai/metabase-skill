#!/usr/bin/env node

/**
 * End-to-end smoke test for the Metabase CLI.
 * Requires a configured instance with a Sample Database (database ID 1).
 *
 * Usage: node scripts/test-e2e.mjs [--instance <name>]
 *
 * Creates temporary test objects, verifies all commands, then cleans up.
 */

import { parseGlobalArgs, loadConfig, resolveInstance, apiRequest } from './lib/client.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const { instance: instanceName } = parseGlobalArgs(process.argv.slice(2));
const config = loadConfig();
const instance = resolveInstance(config, instanceName);

const CLI = `node ${new URL('./metabase.mjs', import.meta.url).pathname}`;
const INST = instanceName ? `--instance ${instanceName}` : '';
const tmpFiles = [];
let passed = 0;
let failed = 0;
const cleanupIds = { cards: [], dashboards: [], snippets: [] };

function run(cmd) {
  const full = `${CLI} ${INST} ${cmd} 2>&1`;
  try {
    return execSync(full, { encoding: 'utf8', timeout: 30000, shell: '/bin/sh' });
  } catch (err) {
    // execSync throws on non-zero exit — stdout still contains the merged output
    return String(err.stdout || '');
  }
}

function runJson(cmd) {
  const out = run(cmd);
  try { return JSON.parse(out); } catch { return null; }
}

function tmpFile(name, data) {
  const path = `/tmp/metabase-e2e-${name}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  tmpFiles.push(path);
  return path;
}

function assert(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

console.log(`\nMetabase CLI E2E Test (instance: ${instance.name})\n${'='.repeat(50)}\n`);

// --- DISCOVER ---
console.log('DISCOVER');

const dbs = runJson('databases --json');
assert('databases', Array.isArray(dbs) && dbs.length > 0, `got ${dbs?.length}`);

const dbsText = run('databases');
assert('databases (text)', dbsText.includes('Databases:') && dbsText.includes('databases'));

const sampleDb = dbs?.find(d => d.name === 'Sample Database');
assert('sample database exists', !!sampleDb, 'needed for tests');
if (!sampleDb) { console.log('\nCannot continue without Sample Database.\n'); process.exit(1); }

const tablesText = run(`tables ${sampleDb.id}`);
assert('tables (text)', tablesText.includes('ORDERS') && tablesText.includes('fields'));

const colls = run('collections --tree');
assert('collections --tree', colls.includes('Collection Tree:'));

const search = run('search orders --models card');
assert('search', search.includes('Search results') && search.includes('results'));

console.log('');

// --- SNIPPETS ---
console.log('SNIPPETS');

const snippetsText = run('snippets');
assert('snippets list', snippetsText.includes('Snippets:') || snippetsText.includes('snippets'));

const snipName = `e2e_test_${Date.now()}`;
const snipResult = runJson(`snippet create --name ${snipName} --content "SELECT 1 AS test"`);
assert('snippet create', snipResult?.id > 0, JSON.stringify(snipResult));
if (snipResult?.id) cleanupIds.snippets.push(snipResult.id);

const snipGet = runJson(`snippet ${snipResult?.id}`);
assert('snippet get', snipGet?.content === 'SELECT 1 AS test');

const snipUpdate = runJson(`snippet update ${snipResult?.id} --content "SELECT 2 AS updated"`);
assert('snippet update', snipUpdate?.id === snipResult?.id);

console.log('');

// --- CARDS ---
console.log('CARDS');

const cardFile = tmpFile('card', {
  name: 'E2E Test Card',
  collection_id: null,
  display: 'scalar',
  visualization_settings: {},
  dataset_query: { database: sampleDb.id, type: 'query', query: { 'source-table': 5, aggregation: [['count']] } },
});
const cardResult = runJson(`card create --from ${cardFile}`);
assert('card create', cardResult?.id > 0, JSON.stringify(cardResult));
if (cardResult?.id) cleanupIds.cards.push(cardResult.id);

const cardSummary = runJson(`card ${cardResult?.id}`);
assert('card summary', cardSummary?.name === 'E2E Test Card' && cardSummary?.display === 'scalar');

const queryResult = runJson(`card query ${cardResult?.id}`);
assert('card query', queryResult?.row_count === 1 && queryResult?.rows?.[0]?.[0] > 0);

const fullOut = run(`card ${cardResult?.id} --full --out /tmp/metabase-e2e-card-full.json`);
tmpFiles.push('/tmp/metabase-e2e-card-full.json');
assert('card --full --out', fullOut.includes('Saved to'));

const patchFile = tmpFile('card-patch', { description: 'Updated by E2E test' });
const patchResult = runJson(`card update ${cardResult?.id} --patch ${patchFile}`);
assert('card update', patchResult?.description === 'Updated by E2E test');

const copyResult = runJson(`card copy ${cardResult?.id}`);
assert('card copy', copyResult?.id > 0 && copyResult?.id !== cardResult?.id);
if (copyResult?.id) cleanupIds.cards.push(copyResult.id);

console.log('');

// --- DASHBOARDS ---
console.log('DASHBOARDS');

const dashFile = tmpFile('dash', { name: 'E2E Test Dashboard', collection_id: null });
const dashResult = runJson(`dashboard create --from ${dashFile}`);
assert('dashboard create', dashResult?.id > 0, JSON.stringify(dashResult));
if (dashResult?.id) cleanupIds.dashboards.push(dashResult.id);

const dashSummary = runJson(`dashboard ${dashResult?.id}`);
assert('dashboard summary', dashSummary?.name === 'E2E Test Dashboard' && dashSummary?.card_count === 0);

const putFile = tmpFile('dash-put', {
  dashcards: [
    { id: -1, card_id: cardResult?.id, row: 0, col: 0, size_x: 12, size_y: 4,
      visualization_settings: { 'card.title': 'Test KPI' }, parameter_mappings: [], series: [] },
  ],
});
const putResult = runJson(`dashboard put ${dashResult?.id} --from ${putFile}`);
assert('dashboard put', putResult?.card_count === 1);

const layoutOut = run(`dashboard ${dashResult?.id} --layout --out /tmp/metabase-e2e-layout.json`);
tmpFiles.push('/tmp/metabase-e2e-layout.json');
assert('dashboard --layout --out', layoutOut.includes('Saved to'));

const namePatch = tmpFile('dash-name', { name: 'E2E Updated Name' });
const updateResult = runJson(`dashboard update ${dashResult?.id} --patch ${namePatch}`);
assert('dashboard update (preserves cards)', updateResult?.name === 'E2E Updated Name' && updateResult?.card_count === 1);

const dashcardOut = run(`dashcard ${dashResult?.id} 0`);
assert('dashcard extract', dashcardOut.includes('card_id') && dashcardOut.includes('visualization_settings'));

const copyDash = runJson(`dashboard copy ${dashResult?.id}`);
assert('dashboard copy', copyDash?.id > 0);
if (copyDash?.id) cleanupIds.dashboards.push(copyDash.id);

console.log('');

// --- COLLECTIONS ---
console.log('COLLECTIONS');

const collResult = runJson('collection create --name "E2E Test Collection"');
assert('collection create', collResult?.id > 0);

if (collResult?.id) {
  const collUpdate = runJson(`collection update ${collResult.id} --name "E2E Renamed"`);
  assert('collection update', collUpdate?.name === 'E2E Renamed');

  const archiveResult = runJson(`collection update ${collResult.id} --archived true`);
  assert('collection archive', archiveResult?.archived === true);
}

console.log('');

// --- ERROR HANDLING ---
console.log('ERROR HANDLING');

const err404 = run('card 999999');
assert('404 handled', err404.includes('404') || err404.includes('Not found'));

const badJson = '/tmp/metabase-e2e-bad.json';
writeFileSync(badJson, '{bad json}');
tmpFiles.push(badJson);
const errJson = run(`card create --from ${badJson}`);
assert('malformed JSON handled', errJson.includes('Invalid JSON'));

const missingFile = run('card create --from /tmp/nonexistent-file.json');
assert('missing file handled', missingFile.includes('not found') || missingFile.includes('Not found'));

console.log('');

// --- CLEANUP ---
console.log('CLEANUP');

for (const id of cleanupIds.dashboards) {
  try { run(`dashboard delete ${id}`); } catch {}
}
for (const id of cleanupIds.cards) {
  try { run(`card delete ${id}`); } catch {}
}
for (const id of cleanupIds.snippets) {
  try {
    await apiRequest(instance, 'PUT', `/api/native-query-snippet/${id}`, { archived: true });
  } catch {}
}
for (const f of tmpFiles) {
  try { unlinkSync(f); } catch {}
}
console.log('  Cleaned up test objects and temp files.');

console.log(`\n${'='.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
