import { apiRequest } from '../client.mjs';

export async function run(instance, command, args) {
  if (command === 'snippets') return list(instance, args.includes('--json'));

  const sub = args[0];
  if (sub === 'create') return create(instance, args.slice(1));
  if (sub === 'update') return update(instance, args.slice(1));

  const id = parseInt(sub);
  if (isNaN(id)) {
    process.stderr.write('Usage: snippet <id> | snippet create | snippet update\n');
    process.exit(1);
  }
  return get(instance, id);
}

async function list(instance, json = false) {
  const { data } = await apiRequest(instance, 'GET', '/api/native-query-snippet');
  const snippets = data.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description || null,
    collection_id: s.collection_id,
    archived: s.archived,
  }));

  if (json) {
    console.log(JSON.stringify(snippets));
  } else {
    console.log('Snippets:');
    snippets.forEach(s => {
      const desc = s.description ? ` — ${s.description.substring(0, 60)}` : '';
      const arch = s.archived ? ' [archived]' : '';
      console.log(`  ${String(s.id).padStart(4)}  ${s.name}${desc}${arch}`);
    });
    console.log(`\n${snippets.length} snippets`);
  }
}

async function get(instance, id) {
  const { data } = await apiRequest(instance, 'GET', `/api/native-query-snippet/${id}`);
  console.log(JSON.stringify({
    id: data.id,
    name: data.name,
    description: data.description || null,
    content: data.content,
    collection_id: data.collection_id,
    archived: data.archived,
  }));
}

async function create(instance, args) {
  const name = getArg(args, '--name');
  const content = getArg(args, '--content');
  if (!name || !content) {
    process.stderr.write('Usage: snippet create --name <n> --content <sql> [--collection <id>] [--description <d>]\n');
    process.exit(1);
  }
  const body = { name, content };
  const collectionId = getArg(args, '--collection');
  if (collectionId) body.collection_id = parseInt(collectionId);
  const description = getArg(args, '--description');
  if (description) body.description = description;

  const { data } = await apiRequest(instance, 'POST', '/api/native-query-snippet', body);
  console.log(JSON.stringify({ id: data.id, name: data.name }));
}

async function update(instance, args) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    process.stderr.write('Usage: snippet update <id> [--name <n>] [--content <sql>] [--archived true|false]\n');
    process.exit(1);
  }
  const body = {};
  const name = getArg(args, '--name');
  if (name) body.name = name;
  const content = getArg(args, '--content');
  if (content) body.content = content;
  const archived = getArg(args, '--archived');
  if (archived !== null) body.archived = archived === 'true';
  const description = getArg(args, '--description');
  if (description !== null) body.description = description;

  if (Object.keys(body).length === 0) {
    process.stderr.write('Nothing to update. Provide --name, --content, --description, or --archived.\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'PUT', `/api/native-query-snippet/${id}`, body);
  console.log(JSON.stringify({ id: data.id, name: data.name, archived: data.archived }));
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
