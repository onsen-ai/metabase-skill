import { apiRequest, readJsonFile } from '../client.mjs';

const ANALYTICS_DB = 13371337;

export async function run(instance, args) {
  const sub = args[0];

  if (sub === 'models') return listModels(instance, args.slice(1));
  if (sub === 'model') return inspectModel(instance, args.slice(1));
  if (sub === 'query') return runQuery(instance, args.slice(1));

  return overview(instance, args);
}

async function discoverCollection(instance) {
  let data;
  try {
    ({ data } = await apiRequest(instance, 'GET', '/api/collection/tree?namespace=analytics'));
  } catch (err) {
    process.stderr.write('Usage Analytics requires Metabase Enterprise. This instance does not have it enabled.\n');
    process.exit(1);
  }
  const col = (data || []).find(c => c.type === 'instance-analytics');
  if (!col) {
    process.stderr.write('Usage Analytics requires Metabase Enterprise. This instance does not have it enabled.\n');
    process.exit(1);
  }
  return col;
}

async function getItems(instance, collectionId) {
  const { data } = await apiRequest(instance, 'GET', `/api/collection/${collectionId}/items`);
  const items = data.data || data;
  const models = items.filter(i => i.model === 'dataset');
  const dashboards = items.filter(i => i.model === 'dashboard');
  return { models, dashboards };
}

async function overview(instance, args) {
  const col = await discoverCollection(instance);
  const { models, dashboards } = await getItems(instance, col.id);

  if (wantJson(args)) {
    console.log(JSON.stringify({ collection_id: col.id, database_id: ANALYTICS_DB, models: models.map(m => ({ id: m.id, name: m.name })), dashboards: dashboards.map(d => ({ id: d.id, name: d.name })) }));
    return;
  }

  console.log(`Usage Analytics (collection ${col.id}, database ${ANALYTICS_DB})\n`);
  console.log('Models:');
  for (const m of models) {
    console.log(`  ${String(m.id).padStart(6)}  ${m.name}`);
  }
  console.log(`\nBuilt-in Dashboards:`);
  for (const d of dashboards) {
    console.log(`  ${String(d.id).padStart(6)}  ${d.name}`);
  }
  console.log(`\n${models.length} models, ${dashboards.length} dashboards`);
}

async function listModels(instance, args) {
  const col = await discoverCollection(instance);
  const { models } = await getItems(instance, col.id);

  const details = await Promise.all(models.map(async m => {
    const { data } = await apiRequest(instance, 'GET', `/api/card/${m.id}`);
    const colCount = (data.result_metadata || []).length;
    return { id: m.id, name: m.name, description: data.description || '', columns: colCount };
  }));

  if (wantJson(args)) {
    console.log(JSON.stringify(details));
    return;
  }

  console.log('Usage Analytics Models:\n');
  console.log('    ID  Cols  Name');
  for (const m of details) {
    console.log(`  ${String(m.id).padStart(5)}  ${String(m.columns).padStart(4)}  ${m.name}`);
  }
  console.log(`\n${details.length} models`);
}

async function inspectModel(instance, args) {
  const nameOrId = args.filter(a => !a.startsWith('--')).join(' ');
  if (!nameOrId) {
    process.stderr.write('Usage: usage-analytics model <name or id>\n');
    process.exit(1);
  }

  const col = await discoverCollection(instance);
  const { models } = await getItems(instance, col.id);

  const match = models.find(m =>
    String(m.id) === nameOrId ||
    m.name.toLowerCase() === nameOrId.toLowerCase() ||
    m.name.toLowerCase().includes(nameOrId.toLowerCase())
  );

  if (!match) {
    process.stderr.write(`Model not found: "${nameOrId}". Run: usage-analytics models\n`);
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'GET', `/api/card/${match.id}`);
  const cols = data.result_metadata || [];

  if (wantJson(args)) {
    console.log(JSON.stringify({ id: match.id, name: data.name, description: data.description, columns: cols.map(c => ({ name: c.name, base_type: c.base_type, display_name: c.display_name })) }));
    return;
  }

  console.log(`${data.name} (card ${match.id})`);
  if (data.description) console.log(`${data.description}\n`);
  console.log('Columns:');
  const maxName = Math.max(...cols.map(c => c.name.length), 4);
  for (const c of cols) {
    const type = (c.base_type || '').replace('type/', '');
    console.log(`  ${c.name.padEnd(maxName + 2)}${type.padEnd(22)}${c.display_name || ''}`);
  }
  console.log(`\n${cols.length} columns`);
}

async function runQuery(instance, args) {
  const fromFile = getArg(args, '--from');
  const cardId = getArg(args, '--card');
  const limit = parseInt(getArg(args, '--limit') || '0', 10);

  if (fromFile) {
    return runMbqlQuery(instance, fromFile, limit, args);
  }
  if (cardId) {
    return runCardQuery(instance, cardId, limit, args);
  }

  process.stderr.write('Usage: usage-analytics query --from <mbql.json> | --card <id> [--limit N] [--json]\n');
  process.exit(1);
}

async function runMbqlQuery(instance, filePath, limit, args) {
  const mbql = readJsonFile(filePath);
  mbql.database = ANALYTICS_DB;
  if (!mbql.type) mbql.type = 'query';

  const { data } = await apiRequest(instance, 'POST', '/api/dataset', mbql);

  if (data.status === 'failed') {
    process.stderr.write(`Query failed: ${data.error}\n`);
    process.exit(1);
  }

  const cols = data.data?.cols || [];
  const rows = data.data?.rows || [];
  const displayRows = limit > 0 ? rows.slice(0, limit) : rows;

  if (wantJson(args)) {
    console.log(JSON.stringify({ columns: cols.map(c => c.name), rows: displayRows, row_count: rows.length, status: data.status }));
    return;
  }

  printTable(cols, displayRows);
  if (limit > 0 && rows.length > limit) {
    console.log(`\nShowing ${displayRows.length} of ${rows.length} rows`);
  } else {
    console.log(`\n${displayRows.length} rows`);
  }
}

async function runCardQuery(instance, cardId, limit, args) {
  const { data } = await apiRequest(instance, 'POST', `/api/card/${cardId}/query`);

  if (data.status === 'failed') {
    process.stderr.write(`Query failed: ${data.error}\n`);
    process.exit(1);
  }

  const cols = data.data?.cols || [];
  const rows = data.data?.rows || [];
  const maxRows = limit > 0 ? limit : 100;
  const displayRows = rows.slice(0, maxRows);

  if (wantJson(args)) {
    console.log(JSON.stringify({ columns: cols.map(c => c.name), rows: displayRows, row_count: rows.length, status: data.status }));
    return;
  }

  printTable(cols, displayRows);
  if (rows.length > displayRows.length) {
    console.log(`\nShowing ${displayRows.length} of ${rows.length} rows`);
  } else {
    console.log(`\n${displayRows.length} rows`);
  }
}

function printTable(cols, rows) {
  if (!cols.length) return;

  const headers = cols.map(c => c.name);
  const widths = headers.map(h => h.length);

  const formatted = rows.map(row =>
    row.map((val, i) => {
      const str = formatValue(val, cols[i]);
      if (str.length > widths[i]) widths[i] = Math.min(str.length, 50);
      return str;
    })
  );

  console.log(headers.map((h, i) => h.padEnd(widths[i])).join('  '));
  console.log(headers.map((_, i) => '─'.repeat(widths[i])).join('  '));
  for (const row of formatted) {
    console.log(row.map((v, i) => {
      const truncated = v.length > 50 ? v.slice(0, 47) + '...' : v;
      return truncated.padEnd(widths[i]);
    }).join('  '));
  }
}

function formatValue(val, col) {
  if (val === null || val === undefined) return '';
  const type = col?.base_type || '';
  if (type.includes('DateTime') || type.includes('Date')) {
    const s = String(val);
    return s.length > 19 ? s.slice(0, 19).replace('T', ' ') : s;
  }
  if (type.includes('Float')) {
    return typeof val === 'number' ? val.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(val);
  }
  if (type.includes('Integer') || type.includes('BigInteger')) {
    return typeof val === 'number' ? val.toLocaleString('en-US') : String(val);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function wantJson(args) {
  return args.includes('--json');
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
