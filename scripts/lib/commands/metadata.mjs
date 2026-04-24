import { apiRequest } from '../client.mjs';

// Metadata-maintenance commands:
//   database sync-schema <id>      — POST /api/database/{id}/sync_schema
//   field rescan-values <id>       — POST /api/field/{id}/rescan_values
//   field discard-values <id>      — POST /api/field/{id}/discard_values
//
// These are low-friction endpoints most analysts reach for when a schema changes
// (new column added, distinct values drift) and the UI becomes stale.

export async function runDatabase(instance, args) {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case 'sync-schema':
      return syncSchema(instance, rest);
    default:
      process.stderr.write(`Unknown database subcommand: ${sub}\nUsage: database sync-schema <id>\n`);
      process.exit(1);
  }
}

export async function runField(instance, args) {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case 'rescan-values':
      return rescanValues(instance, rest);
    case 'discard-values':
      return discardValues(instance, rest);
    default:
      process.stderr.write(`Unknown field subcommand: ${sub}\nUsage: field rescan-values <id> | field discard-values <id>\n`);
      process.exit(1);
  }
}

async function syncSchema(instance, args) {
  const id = args.find(a => !a.startsWith('--'));
  if (!id) {
    process.stderr.write('Usage: database sync-schema <id>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'POST', `/api/database/${id}/sync_schema`);
  console.log(JSON.stringify({ database_id: Number(id), ...(data || { status: 'ok' }) }));
}

async function rescanValues(instance, args) {
  const id = args.find(a => !a.startsWith('--'));
  if (!id) {
    process.stderr.write('Usage: field rescan-values <id>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'POST', `/api/field/${id}/rescan_values`);
  console.log(JSON.stringify({ field_id: Number(id), ...(data || { status: 'ok' }) }));
}

async function discardValues(instance, args) {
  const id = args.find(a => !a.startsWith('--'));
  if (!id) {
    process.stderr.write('Usage: field discard-values <id>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'POST', `/api/field/${id}/discard_values`);
  console.log(JSON.stringify({ field_id: Number(id), ...(data || { status: 'ok' }) }));
}
