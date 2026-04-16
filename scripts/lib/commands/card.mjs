import { apiRequest, writeJsonFile, readJsonFile } from '../client.mjs';
import { summarizeCard } from '../summary.mjs';
import { deepMerge, stripReadOnlyCardFields } from '../merge.mjs';

export async function run(instance, args) {
  const sub = args[0];

  if (sub === 'create') return create(instance, args.slice(1));
  if (sub === 'update') return update(instance, args.slice(1));
  if (sub === 'delete') return del(instance, args.slice(1));
  if (sub === 'copy') return copy(instance, args.slice(1));
  if (sub === 'query') return query(instance, args.slice(1));

  const id = parseInt(sub);
  if (isNaN(id)) {
    process.stderr.write('Usage: card <id> | card create | card update | card delete | card copy | card query\n');
    process.exit(1);
  }

  return get(instance, id, args.slice(1));
}

async function get(instance, id, args) {
  const isFull = args.includes('--full');
  const isLayout = args.includes('--layout');
  const outFile = getArg(args, '--out');

  const { data } = await apiRequest(instance, 'GET', `/api/card/${id}`);

  if (isFull || isLayout) {
    if (!outFile) {
      process.stderr.write('Error: --full and --layout require --out <file>\n');
      process.exit(1);
    }
    const output = isLayout ? stripReadOnlyCardFields(data) : data;
    const msg = writeJsonFile(outFile, output);
    process.stderr.write(msg + '\n');
  } else {
    console.log(JSON.stringify(summarizeCard(data)));
  }
}

async function create(instance, args) {
  const file = getArg(args, '--from');
  if (!file) {
    process.stderr.write('Usage: card create --from <file>\n');
    process.exit(1);
  }
  const body = readJsonFile(file);
  const { data } = await apiRequest(instance, 'POST', '/api/card', body);
  console.log(JSON.stringify({ id: data.id, name: data.name, display: data.display, type: data.type }));
}

async function update(instance, args) {
  const id = parseInt(args[0]);
  const patchFile = getArg(args, '--patch');

  if (isNaN(id) || !patchFile) {
    process.stderr.write('Usage: card update <id> --patch <file>\n');
    process.exit(1);
  }

  const patch = readJsonFile(patchFile);
  const { data: current } = await apiRequest(instance, 'GET', `/api/card/${id}`);
  const writable = stripReadOnlyCardFields(current);
  const merged = deepMerge(writable, patch);
  const { data } = await apiRequest(instance, 'PUT', `/api/card/${id}`, merged);
  console.log(JSON.stringify(summarizeCard(data)));
}

async function del(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: card delete <id>\n');
    process.exit(1);
  }
  await apiRequest(instance, 'DELETE', `/api/card/${id}`);
  process.stderr.write(`Card ${id} deleted.\n`);
}

async function copy(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: card copy <id> [--collection <id>]\n');
    process.exit(1);
  }
  const collectionId = getArg(args, '--collection');
  const body = collectionId ? { collection_id: parseInt(collectionId) } : {};
  const { data } = await apiRequest(instance, 'POST', `/api/card/${id}/copy`, body);
  console.log(JSON.stringify({ id: data.id, name: data.name }));
}

async function query(instance, args) {
  const id = parseInt(args[0]);
  const outFile = getArg(args, '--out');

  if (isNaN(id)) {
    process.stderr.write('Usage: card query <id> [--out <file>]\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'POST', `/api/card/${id}/query`, {});

  if (data.error) {
    process.stderr.write(`Query error: ${data.error}\n`);
    process.exit(1);
  }

  const rows = data.data?.rows || [];
  const cols = data.data?.cols?.map(c => c.name) || [];
  const result = { columns: cols, row_count: rows.length, rows: rows.slice(0, 20) };

  if (outFile) {
    const fullResult = { columns: cols, row_count: rows.length, rows };
    const msg = writeJsonFile(outFile, fullResult);
    process.stderr.write(msg + '\n');
    console.log(JSON.stringify({ columns: cols, row_count: rows.length }));
  } else {
    console.log(JSON.stringify(result));
  }
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
