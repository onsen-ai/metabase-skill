import { apiRequest } from '../client.mjs';

export async function run(instance, args) {
  const sub = args[0];
  if (sub === 'create') return create(instance, args.slice(1));
  if (sub === 'update') return update(instance, args.slice(1));

  process.stderr.write('Usage: collection create | collection update\n');
  process.stderr.write('  For listing: use "collections" or "collection-items <id>"\n');
  process.exit(1);
}

async function create(instance, args) {
  const name = getArg(args, '--name');
  if (!name) {
    process.stderr.write('Usage: collection create --name <n> [--parent <id>] [--description <d>]\n');
    process.exit(1);
  }
  const body = { name };
  const parentId = getArg(args, '--parent');
  if (parentId) body.parent_id = parseInt(parentId);
  const description = getArg(args, '--description');
  if (description) body.description = description;

  const { data } = await apiRequest(instance, 'POST', '/api/collection', body);
  console.log(JSON.stringify({ id: data.id, name: data.name, location: data.location }));
}

async function update(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: collection update <id> [--name <n>] [--parent <id>] [--archived true|false]\n');
    process.exit(1);
  }
  const body = {};
  const name = getArg(args, '--name');
  if (name) body.name = name;
  const parentId = getArg(args, '--parent');
  if (parentId) body.parent_id = parseInt(parentId);
  const archived = getArg(args, '--archived');
  if (archived !== null) body.archived = archived === 'true';
  const description = getArg(args, '--description');
  if (description !== null) body.description = description;

  if (Object.keys(body).length === 0) {
    process.stderr.write('Nothing to update. Provide --name, --parent, --description, or --archived.\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'PUT', `/api/collection/${id}`, body);
  console.log(JSON.stringify({ id: data.id, name: data.name, archived: data.archived }));
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
