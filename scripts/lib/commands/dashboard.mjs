import { apiRequest, writeJsonFile, readJsonFile } from '../client.mjs';
import { summarizeDashboard, layoutDashboard } from '../summary.mjs';
import { deepMerge, stripReadOnlyDashboardFields, prepareDashcardsForPut, prepareTabsForPut } from '../merge.mjs';

export async function run(instance, command, args) {
  if (command === 'dashcard') return dashcard(instance, args);

  const sub = args[0];
  if (sub === 'create') return create(instance, args.slice(1));
  if (sub === 'put') return put(instance, args.slice(1));
  if (sub === 'update') return update(instance, args.slice(1));
  if (sub === 'delete') return del(instance, args.slice(1));
  if (sub === 'copy') return copy(instance, args.slice(1));

  const id = parseInt(sub);
  if (isNaN(id)) {
    process.stderr.write('Usage: dashboard <id> | dashboard create | dashboard put | dashboard update | dashboard delete | dashboard copy\n');
    process.exit(1);
  }
  return get(instance, id, args.slice(1));
}

async function get(instance, id, args) {
  const isFull = args.includes('--full');
  const isLayout = args.includes('--layout');
  const outFile = getArg(args, '--out');

  const { data } = await apiRequest(instance, 'GET', `/api/dashboard/${id}`);

  if (isFull || isLayout) {
    if (!outFile) {
      process.stderr.write('Error: --full and --layout require --out <file>\n');
      process.exit(1);
    }
    const output = isLayout ? layoutDashboard(data) : data;
    const msg = writeJsonFile(outFile, output);
    process.stderr.write(msg + '\n');
  } else {
    console.log(JSON.stringify(summarizeDashboard(data)));
  }
}

async function create(instance, args) {
  const file = getArg(args, '--from');
  if (!file) {
    process.stderr.write('Usage: dashboard create --from <file>\n');
    process.exit(1);
  }
  const body = readJsonFile(file);
  const { data } = await apiRequest(instance, 'POST', '/api/dashboard', body);
  console.log(JSON.stringify({ id: data.id, name: data.name, collection_id: data.collection_id }));
}

async function put(instance, args) {
  const id = parseInt(args[0]);
  const file = getArg(args, '--from');

  if (isNaN(id) || !file) {
    process.stderr.write('Usage: dashboard put <id> --from <file>\n');
    process.exit(1);
  }

  const body = readJsonFile(file);
  const { data } = await apiRequest(instance, 'PUT', `/api/dashboard/${id}`, body);
  console.log(JSON.stringify(summarizeDashboard(data)));
}

async function update(instance, args) {
  const id = parseInt(args[0], 10);
  const patchFile = getArg(args, '--patch');

  if (isNaN(id) || !patchFile) {
    process.stderr.write('Usage: dashboard update <id> --patch <file>\n');
    process.exit(1);
  }

  const patch = readJsonFile(patchFile);
  const { data: current } = await apiRequest(instance, 'GET', `/api/dashboard/${id}`);
  const writable = stripReadOnlyDashboardFields(current);
  const merged = deepMerge(writable, patch);

  if (patch.dashcards) {
    merged.tabs = prepareTabsForPut(patch.tabs || current.tabs);
    merged.dashcards = prepareDashcardsForPut(patch.dashcards);
  } else if (patch.tabs) {
    merged.tabs = prepareTabsForPut(patch.tabs);
    merged.dashcards = prepareDashcardsForPut(current.dashcards);
  } else {
    merged.tabs = prepareTabsForPut(current.tabs);
    merged.dashcards = prepareDashcardsForPut(current.dashcards);
  }

  const { data } = await apiRequest(instance, 'PUT', `/api/dashboard/${id}`, merged);
  console.log(JSON.stringify(summarizeDashboard(data)));
}

async function del(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: dashboard delete <id>\n');
    process.exit(1);
  }
  await apiRequest(instance, 'DELETE', `/api/dashboard/${id}`);
  process.stderr.write(`Dashboard ${id} deleted.\n`);
}

async function copy(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: dashboard copy <id> [--collection <id>]\n');
    process.exit(1);
  }
  const collectionId = getArg(args, '--collection');
  const body = {};
  if (collectionId) body.collection_id = parseInt(collectionId);
  const { data } = await apiRequest(instance, 'POST', `/api/dashboard/${id}/copy`, body);
  console.log(JSON.stringify({ id: data.id, name: data.name, collection_id: data.collection_id }));
}

async function dashcard(instance, args) {
  const dashId = parseInt(args[0]);
  const selector = args[1];

  if (isNaN(dashId) || !selector) {
    process.stderr.write('Usage: dashcard <dashboard-id> <index|card-name>\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'GET', `/api/dashboard/${dashId}`);
  const dashcards = data.dashcards || [];

  let dc;
  const idx = parseInt(selector);
  if (!isNaN(idx) && idx >= 0 && idx < dashcards.length) {
    dc = dashcards[idx];
  } else {
    dc = dashcards.find(d => d.card?.name?.toLowerCase().includes(selector.toLowerCase()));
  }

  if (!dc) {
    process.stderr.write(`Dashcard not found: ${selector}\n`);
    process.stderr.write(`Available (${dashcards.length}):\n`);
    dashcards.forEach((d, i) => {
      process.stderr.write(`  ${i}: ${d.card?.name || '(virtual)'} [card_id: ${d.card_id}]\n`);
    });
    process.exit(1);
  }

  const compact = {
    dashcard_id: dc.id,
    card_id: dc.card_id,
    card_name: dc.card?.name || null,
    display: dc.card?.display || dc.visualization_settings?.virtual_card?.display || null,
    tab_id: dc.dashboard_tab_id,
    row: dc.row,
    col: dc.col,
    size_x: dc.size_x,
    size_y: dc.size_y,
    parameter_mappings: dc.parameter_mappings || [],
    visualization_settings: dc.visualization_settings || {},
  };
  console.log(JSON.stringify(compact, null, 2));
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
