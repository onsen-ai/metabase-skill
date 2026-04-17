import { apiRequest } from '../client.mjs';

export async function run(instance, command, args) {
  switch (command) {
    case 'databases': return databases(instance, args);
    case 'tables': return tables(instance, args);
    case 'collections': return collections(instance, args);
    case 'collection-items': return collectionItems(instance, args);
    case 'search': return search(instance, args);
    default:
      process.stderr.write(`Unknown discover command: ${command}\n`);
      process.exit(1);
  }
}

function wantJson(args) {
  return args.includes('--json');
}

async function databases(instance, args) {
  const { data } = await apiRequest(instance, 'GET', '/api/database');
  const dbs = (data.data || data).map(d => ({ id: d.id, name: d.name, engine: d.engine }));

  if (wantJson(args)) {
    console.log(JSON.stringify(dbs));
  } else {
    console.log('Databases:');
    dbs.forEach(d => console.log(`  ${String(d.id).padStart(4)}  ${d.name.padEnd(35)} ${d.engine}`));
    console.log(`\n${dbs.length} databases`);
  }
}

async function tables(instance, args) {
  const dbId = getArg(args, '--database') || args.find(a => !a.startsWith('--'));
  if (!dbId) {
    process.stderr.write('Usage: tables --database <id>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'GET', `/api/database/${dbId}/metadata?include_hidden=false`);
  const tbls = (data.tables || []).map(t => ({
    id: t.id,
    name: t.name,
    schema: t.schema,
    fields: (t.fields || []).map(f => ({
      id: f.id, name: f.name, base_type: f.base_type, semantic_type: f.semantic_type,
    })),
  }));

  if (wantJson(args)) {
    console.log(JSON.stringify(tbls));
  } else {
    tbls.forEach(t => {
      console.log(`\n${t.schema}.${t.name} (id: ${t.id}, ${t.fields.length} fields)`);
      t.fields.forEach(f => {
        const sem = f.semantic_type ? ` [${f.semantic_type}]` : '';
        console.log(`  ${String(f.id).padStart(6)}  ${f.name.padEnd(30)} ${f.base_type}${sem}`);
      });
    });
    console.log(`\n${tbls.length} tables`);
  }
}

async function collections(instance, args) {
  const isTree = args.includes('--tree');
  if (isTree) {
    const { data } = await apiRequest(instance, 'GET', '/api/collection/tree?exclude-archived=true');
    if (wantJson(args)) {
      console.log(JSON.stringify(formatTreeJson(data)));
    } else {
      console.log('Collection Tree:');
      printTree(data, 0);
    }
  } else {
    const { data } = await apiRequest(instance, 'GET', '/api/collection');
    const list = data.map(c => ({
      id: c.id, name: c.name, location: c.location,
      personal_owner_id: c.personal_owner_id || null,
      ...(c.authority_level ? { authority_level: c.authority_level } : {}),
    }));
    if (wantJson(args)) {
      console.log(JSON.stringify(list));
    } else {
      console.log('Collections:');
      list.forEach(c => {
        const personal = c.personal_owner_id ? ' (personal)' : '';
        const badge = c.authority_level === 'official' ? ' ★' : '';
        console.log(`  ${String(c.id).padStart(4)}  ${c.name}${personal}${badge}`);
      });
      console.log(`\n${list.length} collections`);
    }
  }
}

function formatTreeJson(nodes) {
  return nodes.map(n => ({
    id: n.id, name: n.name,
    ...(n.authority_level ? { authority_level: n.authority_level } : {}),
    children: n.children ? formatTreeJson(n.children) : [],
  }));
}

function printTree(nodes, depth) {
  nodes.forEach(n => {
    const indent = '  '.repeat(depth + 1);
    const prefix = depth > 0 ? '└─ ' : '';
    const badge = n.authority_level === 'official' ? ' ★' : '';
    console.log(`${indent}${prefix}[${n.id}] ${n.name}${badge}`);
    if (n.children?.length) printTree(n.children, depth + 1);
  });
}

async function collectionItems(instance, args) {
  const id = args.find(a => !a.startsWith('--'));
  if (!id) {
    process.stderr.write('Usage: collection-items <id> [--models card,dashboard]\n');
    process.exit(1);
  }
  const models = getArg(args, '--models');
  let path = `/api/collection/${id}/items`;
  if (models) {
    path += '?' + models.split(',').map(m => `models=${m}`).join('&');
  }
  const { data } = await apiRequest(instance, 'GET', path);
  const items = (data.data || data).map(i => ({
    id: i.id, name: i.name, model: i.model, description: i.description || null,
  }));

  if (wantJson(args)) {
    console.log(JSON.stringify({ items, total: data.total || items.length }));
  } else {
    console.log(`Collection ${id} contents:`);
    items.forEach(i => {
      console.log(`  ${i.model.padEnd(12)} ${String(i.id).padStart(6)}  ${i.name}`);
    });
    console.log(`\n${items.length} items`);
  }
}

async function search(instance, args) {
  const query = args.find(a => !a.startsWith('--'));
  if (!query) {
    process.stderr.write('Usage: search <query> [--models card,dashboard,collection]\n');
    process.exit(1);
  }
  const models = getArg(args, '--models');
  let path = `/api/search?q=${encodeURIComponent(query)}`;
  if (models) {
    path += '&' + models.split(',').map(m => `models=${m}`).join('&');
  }
  const { data } = await apiRequest(instance, 'GET', path);
  const results = (data.data || data).map(r => ({
    id: r.id, name: r.name, model: r.model,
    collection: r.collection ? {
      id: r.collection.id, name: r.collection.name,
      ...(r.collection.authority_level ? { authority_level: r.collection.authority_level } : {}),
    } : null,
  }));

  if (wantJson(args)) {
    console.log(JSON.stringify({ results, total: data.total || results.length }));
  } else {
    console.log(`Search results for "${query}":`);
    results.forEach(r => {
      const badge = r.collection?.authority_level === 'official' ? ' ★' : '';
      const col = r.collection ? ` (${r.collection.name}${badge})` : '';
      console.log(`  ${r.model.padEnd(12)} ${String(r.id).padStart(6)}  ${r.name}${col}`);
    });
    console.log(`\n${results.length} results`);
  }
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
