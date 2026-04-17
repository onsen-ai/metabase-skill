import { apiRequest } from '../client.mjs';

import { createInterface } from 'readline';

export async function run(instance, command, args) {
  switch (command) {
    case 'users': return users(instance, args);
    case 'user': return user(instance, args);
    case 'groups': return groups(instance, args);
    case 'group': return group(instance, args);
    case 'permissions': return permissions(instance, args);
    case 'sandboxes': return sandboxes(instance, args);
    case 'sandbox': return sandbox(instance, args);
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
}

// --- USERS ---

async function users(instance, args) {
  const query = getArg(args, '--query');
  const status = getArg(args, '--status') || 'active';
  const filterAdmins = args.includes('--admins');
  const groupFilter = getArg(args, '--group');
  const groupsAllFilter = getArg(args, '--groups-all');

  let path = `/api/user?status=${status}`;
  if (query) path += `&query=${encodeURIComponent(query)}`;

  const [userRes, groupsRes] = await Promise.all([
    apiRequest(instance, 'GET', path),
    apiRequest(instance, 'GET', '/api/permissions/group'),
  ]);
  let list = (userRes.data.data || userRes.data);
  const groupNames = {};
  groupsRes.data.forEach(g => { groupNames[g.id] = g.name; });

  if (filterAdmins) {
    list = list.filter(u => u.is_superuser);
  }

  if (groupFilter) {
    const gids = groupFilter.split(',').map(Number);
    list = list.filter(u => (u.group_ids || []).some(gid => gids.includes(gid)));
  }

  if (groupsAllFilter) {
    const gids = groupsAllFilter.split(',').map(Number);
    list = list.filter(u => gids.every(gid => (u.group_ids || []).includes(gid)));
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(list.map(u => ({
      id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name,
      is_superuser: u.is_superuser, is_active: u.is_active,
      groups: (u.group_ids || []).map(gid => ({ id: gid, name: groupNames[gid] || `Group ${gid}` })),
    }))));
  } else {
    const label = [
      filterAdmins ? 'Admins' : 'Users',
      groupFilter ? `in group ${groupFilter.split(',').map(g => groupNames[Number(g)] || g).join(' or ')}` : '',
      groupsAllFilter ? `in ALL of groups ${groupsAllFilter.split(',').map(g => groupNames[Number(g)] || g).join(' + ')}` : '',
    ].filter(Boolean).join(' ');
    console.log(`${label}:`);
    list.forEach(u => {
      const admin = u.is_superuser ? ' [admin]' : '';
      const active = u.is_active ? '' : ' [deactivated]';
      const groups = (u.group_ids || [])
        .filter(gid => gid !== 1)
        .map(gid => `${groupNames[gid] || 'Unknown'} (${gid})`);
      const groupStr = groups.length ? ` — ${groups.join(', ')}` : '';
      console.log(`  ${String(u.id).padStart(4)}  ${(u.common_name || u.email).padEnd(30)} ${u.email}${admin}${active}${groupStr}`);
    });
    console.log(`\n${list.length} ${filterAdmins ? 'admins' : 'users'}`);
  }
}

async function user(instance, args) {
  const sub = args[0];

  if (sub === 'create') return userCreate(instance, args.slice(1));
  if (sub === 'update') return userUpdate(instance, args.slice(1));
  if (sub === 'deactivate') return userDeactivate(instance, args.slice(1));

  const id = parseInt(sub, 10);
  if (isNaN(id)) {
    process.stderr.write('Usage: user <id> | user create | user update | user deactivate\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'GET', `/api/user/${id}`);
  if (args.includes('--json')) {
    console.log(JSON.stringify(data));
  } else {
    console.log(`User ${data.id}: ${data.common_name}`);
    console.log(`  Email:      ${data.email}`);
    console.log(`  Admin:      ${data.is_superuser}`);
    console.log(`  Active:     ${data.is_active}`);
    console.log(`  Groups:     ${(data.group_ids || []).join(', ')}`);
    console.log(`  Joined:     ${data.date_joined}`);
    console.log(`  Last login: ${data.last_login || 'never'}`);
    if (data.sso_source) console.log(`  SSO:        ${data.sso_source}`);
  }
}

async function userCreate(instance, args) {
  const email = getArg(args, '--email');
  const first = getArg(args, '--first');
  const last = getArg(args, '--last');

  if (!email) {
    process.stderr.write('Usage: user create --email <e> [--first <f>] [--last <l>]\n');
    process.exit(1);
  }

  const body = { email };
  if (first) body.first_name = first;
  if (last) body.last_name = last;

  const { data } = await apiRequest(instance, 'POST', '/api/user', body);
  console.log(JSON.stringify({ id: data.id, email: data.email, common_name: data.common_name }));
}

async function userUpdate(instance, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    process.stderr.write('Usage: user update <id> [--first <f>] [--last <l>] [--email <e>] [--superuser true|false]\n');
    process.exit(1);
  }

  const body = {};
  const first = getArg(args, '--first');
  if (first) body.first_name = first;
  const last = getArg(args, '--last');
  if (last) body.last_name = last;
  const email = getArg(args, '--email');
  if (email) body.email = email;
  const superuser = getArg(args, '--superuser');
  if (superuser !== null) body.is_superuser = superuser === 'true';

  if (Object.keys(body).length === 0) {
    process.stderr.write('Nothing to update.\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'PUT', `/api/user/${id}`, body);
  console.log(JSON.stringify({ id: data.id, email: data.email, common_name: data.common_name, is_superuser: data.is_superuser }));
}

async function userDeactivate(instance, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    process.stderr.write('Usage: user deactivate <id>\n');
    process.exit(1);
  }
  await apiRequest(instance, 'DELETE', `/api/user/${id}`);
  process.stderr.write(`User ${id} deactivated.\n`);
}

// --- GROUPS ---

async function groups(instance, args) {
  const { data } = await apiRequest(instance, 'GET', '/api/permissions/group');

  if (args.includes('--json')) {
    console.log(JSON.stringify(data));
  } else {
    console.log('Permission Groups:');
    data.forEach(g => {
      const builtin = g.id <= 2 ? ' [built-in]' : '';
      console.log(`  ${String(g.id).padStart(4)}  ${g.name.padEnd(30)} ${g.member_count} members${builtin}`);
    });
    console.log(`\n${data.length} groups`);
  }
}

async function group(instance, args) {
  const sub = args[0];

  if (sub === 'create') return groupCreate(instance, args.slice(1));
  if (sub === 'delete') return groupDelete(instance, args.slice(1));
  if (sub === 'add-user') return groupAddUser(instance, args.slice(1));
  if (sub === 'remove-user') return groupRemoveUser(instance, args.slice(1));

  const id = parseInt(sub, 10);
  if (isNaN(id)) {
    process.stderr.write('Usage: group <id> | group create | group delete | group add-user | group remove-user\n');
    process.exit(1);
  }

  const { data } = await apiRequest(instance, 'GET', `/api/permissions/group/${id}`);
  if (args.includes('--json')) {
    console.log(JSON.stringify(data));
  } else {
    console.log(`Group ${data.id}: ${data.name}`);
    console.log(`  Members: ${data.member_count || data.members?.length || 0}`);
    if (data.members?.length) {
      data.members.forEach(m => {
        const mgr = m.is_group_manager ? ' [manager]' : '';
        console.log(`    ${String(m.user_id).padStart(4)}  ${(m.first_name + ' ' + m.last_name).padEnd(25)} ${m.email}${mgr}`);
      });
    }
  }
}

async function groupCreate(instance, args) {
  const name = getArg(args, '--name');
  if (!name) {
    process.stderr.write('Usage: group create --name <name>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'POST', '/api/permissions/group', { name });
  console.log(JSON.stringify({ id: data.id, name: data.name }));
}

async function groupDelete(instance, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    process.stderr.write('Usage: group delete <id>\n');
    process.exit(1);
  }
  if (id <= 2) {
    process.stderr.write('Error: Cannot delete built-in groups (All Users, Administrators).\n');
    process.exit(1);
  }
  await apiRequest(instance, 'DELETE', `/api/permissions/group/${id}`);
  process.stderr.write(`Group ${id} deleted.\n`);
}

async function groupAddUser(instance, args) {
  const groupId = parseInt(args[0], 10);
  const userId = parseInt(args[1], 10);
  if (isNaN(groupId) || isNaN(userId)) {
    process.stderr.write('Usage: group add-user <group-id> <user-id>\n');
    process.exit(1);
  }
  const { data } = await apiRequest(instance, 'POST', '/api/permissions/membership', {
    group_id: groupId, user_id: userId, is_group_manager: false,
  });
  console.log(JSON.stringify({ membership_id: data.membership_id || data.id, group_id: groupId, user_id: userId }));
}

async function groupRemoveUser(instance, args) {
  const membershipId = parseInt(args[0], 10);
  if (isNaN(membershipId)) {
    process.stderr.write('Usage: group remove-user <membership-id>\n');
    process.exit(1);
  }
  await apiRequest(instance, 'DELETE', `/api/permissions/membership/${membershipId}`);
  process.stderr.write(`Membership ${membershipId} removed.\n`);
}

// --- LOOKUPS ---

async function loadLookups(instance) {
  const [groupsRes, dbsRes, collsRes] = await Promise.all([
    apiRequest(instance, 'GET', '/api/permissions/group'),
    apiRequest(instance, 'GET', '/api/database'),
    apiRequest(instance, 'GET', '/api/collection').catch(() => ({ data: [] })),
  ]);

  const groups = {};
  groupsRes.data.forEach(g => { groups[g.id] = g.name; });

  const databases = {};
  (dbsRes.data.data || dbsRes.data).forEach(d => { databases[d.id] = d.name; });

  const collections = { root: 'Root collection' };
  (Array.isArray(collsRes.data) ? collsRes.data : []).forEach(c => { collections[c.id] = c.name; });

  return { groups, databases, collections };
}

// --- PERMISSIONS ---

async function permissions(instance, args) {
  const sub = args[0];
  if (sub === 'set') return permissionsSet(instance, args.slice(1));
  if (sub === 'set-collection') return permissionsSetCollection(instance, args.slice(1));
  if (sub === 'set-snippets') return permissionsSetSnippets(instance, args.slice(1));
  if (sub === 'app') return permissionsApp(instance, args.slice(1));
  if (sub === 'summary') return permissionsSummary(instance, args.slice(1));

  const dbId = getArg(args, '--database');
  const groupId = getArg(args, '--group');
  const isCollections = args.includes('--collections');
  const nativeSqlOnly = args.includes('--native-sql');

  const lookups = await loadLookups(instance);

  if (isCollections) {
    const { data } = await apiRequest(instance, 'GET', '/api/collection/graph');
    if (args.includes('--json')) {
      console.log(JSON.stringify(data));
    } else {
      console.log(`Collection Permissions (revision ${data.revision}):\n`);
      for (const [gid, colls] of Object.entries(data.groups)) {
        console.log(`  ${lookups.groups[gid] || 'Group ' + gid} (${gid}):`);
        for (const [cid, perm] of Object.entries(colls)) {
          const name = lookups.collections[cid] || `Unknown`;
          console.log(`    ${String(cid).padStart(5)}  ${name.padEnd(35)} ${perm}`);
        }
        console.log();
      }
    }
    return;
  }

  let path = '/api/permissions/graph';
  if (dbId) path = `/api/permissions/graph/db/${dbId}`;
  if (groupId) path = `/api/permissions/graph/group/${groupId}`;

  const { data } = await apiRequest(instance, 'GET', path);

  if (nativeSqlOnly) {
    console.log('Groups with native SQL access:\n');
    let totalGroups = 0;
    for (const [gid, dbs] of Object.entries(data.groups)) {
      const nativeDbs = [];
      for (const [did, perms] of Object.entries(dbs)) {
        const query = typeof perms['create-queries'] === 'string' ? perms['create-queries'] : null;
        if (query === 'query-builder-and-native') {
          nativeDbs.push(did);
        }
      }
      if (nativeDbs.length) {
        totalGroups++;
        const groupName = lookups.groups[gid] || 'Unknown';
        console.log(`  ${groupName} (${gid}):`);
        nativeDbs.forEach(did => {
          console.log(`    ${String(did).padStart(4)}  ${lookups.databases[did] || 'Unknown'}`);
        });
        console.log();
      }
    }
    console.log(`${totalGroups} groups with native SQL access`);
    return;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(data));
  } else {
    console.log(`Database Permissions (revision ${data.revision}):\n`);
    for (const [gid, dbs] of Object.entries(data.groups)) {
      console.log(`  ${lookups.groups[gid] || 'Group ' + gid} (${gid}):`);
      for (const [did, perms] of Object.entries(dbs)) {
        const dbName = lookups.databases[did] || 'Unknown';
        const view = typeof perms['view-data'] === 'string' ? perms['view-data'] : 'schema-level';
        const query = typeof perms['create-queries'] === 'string' ? perms['create-queries'] : 'schema-level';
        console.log(`    ${String(did).padStart(4)}  ${dbName.padEnd(32)} view: ${view.padEnd(15)} queries: ${query}`);
      }
      console.log();
    }
  }
}

// --- CONFIRM PROMPT ---

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(message, answer => { rl.close(); resolve(answer.trim().toLowerCase() === 'y'); });
  });
}

function stderr(msg) { process.stderr.write(msg + '\n'); }

// --- PERMISSIONS SET (DB) ---

async function permissionsSet(instance, args) {
  const groupId = getArg(args, '--group');
  const dbId = getArg(args, '--database');
  const view = getArg(args, '--view');
  const queries = getArg(args, '--queries');
  const download = getArg(args, '--download');
  const dataModel = getArg(args, '--data-model');
  const details = getArg(args, '--details');
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');

  if (!groupId || !dbId || (!view && !queries && !download && !dataModel && !details)) {
    stderr('Usage: permissions set --group <id> --database <id> [--view ...] [--queries ...] [--download ...] [--data-model ...] [--details ...] [--dry-run] [--yes]');
    process.exit(1);
  }

  const validView = ['unrestricted', 'legacy-no-self-service', 'blocked'];
  const validQueries = ['query-builder-and-native', 'query-builder', 'no'];
  const validDownload = ['full', 'limited', 'none'];
  if (view && !validView.includes(view)) { stderr('--view must be: ' + validView.join('|')); process.exit(1); }
  if (queries && !validQueries.includes(queries)) { stderr('--queries must be: ' + validQueries.join('|')); process.exit(1); }
  if (download && !validDownload.includes(download)) { stderr('--download must be: ' + validDownload.join('|')); process.exit(1); }

  const lookups = await loadLookups(instance);
  const groupName = lookups.groups[groupId] || 'Group ' + groupId;
  const dbName = lookups.databases[dbId] || 'DB ' + dbId;

  const { data: graph } = await apiRequest(instance, 'GET', `/api/permissions/graph/group/${groupId}`);
  const currentPerms = graph.groups[groupId]?.[dbId] || {};
  const before = { ...currentPerms };

  const updated = { ...currentPerms };
  if (view) updated['view-data'] = view;
  if (queries) updated['create-queries'] = queries;
  if (download) updated['download'] = download === 'none' ? { schemas: 'none' } : { schemas: download };
  if (dataModel) updated['data-model'] = dataModel === 'yes' ? { schemas: 'all' } : { schemas: 'none' };
  if (details) updated['details'] = details;

  stderr(`\nChanging permissions for ${groupName} (${groupId}) on ${dbName} (${dbId}):\n`);
  if (view) stderr(`  view-data:       ${fmt(before['view-data'])} → ${view}`);
  if (queries) stderr(`  create-queries:  ${fmt(before['create-queries'])} → ${queries}`);
  if (download) stderr(`  download:        ${fmt(before['download']?.schemas)} → ${download}`);
  if (dataModel) stderr(`  data-model:      ${fmt(before['data-model']?.schemas)} → ${dataModel === 'yes' ? 'all' : 'none'}`);
  if (details) stderr(`  details:         ${fmt(before['details'])} → ${details}`);
  stderr('');

  if (dryRun) { stderr('Dry run — no changes applied.'); return; }
  if (!skipConfirm && !(await confirm('Apply? (y/n): '))) { stderr('Cancelled.'); return; }

  try {
    const { data: result } = await apiRequest(instance, 'PUT',
      '/api/permissions/graph?skip-graph=true',
      { revision: graph.revision, groups: { [groupId]: { [dbId]: updated } } });
    stderr(`✓ Applied (revision ${graph.revision} → ${result.revision})`);
  } catch (err) {
    if (err.status === 409) { stderr('Conflict: permissions were changed by someone else. Please retry.'); process.exit(1); }
    throw err;
  }
}

// --- PERMISSIONS SET-COLLECTION ---

async function permissionsSetCollection(instance, args) {
  const groupId = getArg(args, '--group');
  const collId = getArg(args, '--collection');
  const access = getArg(args, '--access');
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');

  if (!groupId || !collId || !access) {
    stderr('Usage: permissions set-collection --group <id> --collection <id> --access read|write|none [--dry-run] [--yes]');
    process.exit(1);
  }
  if (!['read', 'write', 'none'].includes(access)) { stderr('--access must be: read|write|none'); process.exit(1); }

  const lookups = await loadLookups(instance);
  const groupName = lookups.groups[groupId] || 'Group ' + groupId;
  const collName = lookups.collections[collId] || collId === 'root' ? 'Root collection' : 'Collection ' + collId;

  const { data: graph } = await apiRequest(instance, 'GET', '/api/collection/graph');
  const currentAccess = graph.groups[groupId]?.[collId] || '(unset)';

  stderr(`\nChanging collection permissions for ${groupName} (${groupId}) on ${collName} (${collId}):\n`);
  stderr(`  access: ${currentAccess} → ${access}`);
  stderr('');

  if (dryRun) { stderr('Dry run — no changes applied.'); return; }
  if (!skipConfirm && !(await confirm('Apply? (y/n): '))) { stderr('Cancelled.'); return; }

  const groupPerms = { ...(graph.groups[groupId] || {}), [collId]: access };

  try {
    const { data: result } = await apiRequest(instance, 'PUT',
      '/api/collection/graph?skip-graph=true',
      { revision: graph.revision, groups: { [groupId]: groupPerms } });
    stderr(`✓ Applied (revision ${graph.revision} → ${result.revision})`);
  } catch (err) {
    if (err.status === 409) { stderr('Conflict: collection permissions changed. Please retry.'); process.exit(1); }
    throw err;
  }
}

// --- PERMISSIONS SET-SNIPPETS (Enterprise) ---

async function permissionsSetSnippets(instance, args) {
  const groupId = getArg(args, '--group');
  const folderId = getArg(args, '--folder');
  const access = getArg(args, '--access');
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');

  if (!groupId || !folderId || !access) {
    stderr('Usage: permissions set-snippets --group <id> --folder <id> --access read|write|none [--dry-run] [--yes]');
    process.exit(1);
  }
  if (!['read', 'write', 'none'].includes(access)) { stderr('--access must be: read|write|none'); process.exit(1); }

  const lookups = await loadLookups(instance);
  const groupName = lookups.groups[groupId] || 'Group ' + groupId;

  const { data: graph } = await apiRequest(instance, 'GET', '/api/collection/graph?namespace=snippets');
  const currentAccess = graph.groups[groupId]?.[folderId] || '(unset)';

  stderr(`\nChanging snippet folder permissions for ${groupName} (${groupId}) on folder ${folderId}:\n`);
  stderr(`  access: ${currentAccess} → ${access}`);
  stderr('');

  if (dryRun) { stderr('Dry run — no changes applied.'); return; }
  if (!skipConfirm && !(await confirm('Apply? (y/n): '))) { stderr('Cancelled.'); return; }

  const groupPerms = { ...(graph.groups[groupId] || {}), [folderId]: access };

  try {
    const { data: result } = await apiRequest(instance, 'PUT',
      '/api/collection/graph?namespace=snippets&skip-graph=true',
      { revision: graph.revision, namespace: 'snippets', groups: { [groupId]: groupPerms } });
    stderr(`✓ Applied (revision ${graph.revision} → ${result.revision})`);
  } catch (err) {
    if (err.status === 409) { stderr('Conflict: snippet permissions changed. Please retry.'); process.exit(1); }
    throw err;
  }
}

// --- PERMISSIONS APP (Enterprise) ---

async function permissionsApp(instance, args) {
  if (args[0] === 'set') return permissionsAppSet(instance, args.slice(1));

  try {
    const { data } = await apiRequest(instance, 'GET', '/api/ee/advanced-permissions/application/graph');
    const lookups = await loadLookups(instance);

    if (args.includes('--json')) {
      console.log(JSON.stringify(data));
    } else {
      console.log(`Application Permissions (revision ${data.revision}):\n`);
      for (const [gid, perms] of Object.entries(data.groups)) {
        console.log(`  ${lookups.groups[gid] || 'Group ' + gid} (${gid}):`);
        console.log(`    setting: ${perms.setting || 'no'}  monitoring: ${perms.monitoring || 'no'}  subscription: ${perms.subscription || 'no'}`);
      }
    }
  } catch (err) {
    if (err.message?.includes('endpoint does not exist') || err.status === 404) {
      stderr('Application permissions are an Enterprise-only feature.');
    } else { throw err; }
  }
}

async function permissionsAppSet(instance, args) {
  const groupId = getArg(args, '--group');
  const setting = getArg(args, '--setting');
  const monitoring = getArg(args, '--monitoring');
  const subscription = getArg(args, '--subscription');
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');

  if (!groupId || (!setting && !monitoring && !subscription)) {
    stderr('Usage: permissions app set --group <id> [--setting yes|no] [--monitoring yes|no] [--subscription yes|no] [--dry-run] [--yes]');
    process.exit(1);
  }

  const lookups = await loadLookups(instance);
  const groupName = lookups.groups[groupId] || 'Group ' + groupId;

  const { data: graph } = await apiRequest(instance, 'GET', '/api/ee/advanced-permissions/application/graph');
  const current = graph.groups[groupId] || { setting: 'no', monitoring: 'no', subscription: 'no' };

  const updated = { ...current };
  if (setting) updated.setting = setting;
  if (monitoring) updated.monitoring = monitoring;
  if (subscription) updated.subscription = subscription;

  stderr(`\nChanging application permissions for ${groupName} (${groupId}):\n`);
  if (setting) stderr(`  setting:       ${current.setting || 'no'} → ${setting}`);
  if (monitoring) stderr(`  monitoring:    ${current.monitoring || 'no'} → ${monitoring}`);
  if (subscription) stderr(`  subscription:  ${current.subscription || 'no'} → ${subscription}`);
  stderr('');

  if (dryRun) { stderr('Dry run — no changes applied.'); return; }
  if (!skipConfirm && !(await confirm('Apply? (y/n): '))) { stderr('Cancelled.'); return; }

  try {
    const { data: result } = await apiRequest(instance, 'PUT',
      '/api/ee/advanced-permissions/application/graph',
      { revision: graph.revision, groups: { [groupId]: updated } });
    stderr(`✓ Applied (revision ${graph.revision} → ${result.revision})`);
  } catch (err) {
    if (err.status === 409) { stderr('Conflict: app permissions changed. Please retry.'); process.exit(1); }
    throw err;
  }
}

// --- SANDBOXES (Enterprise) ---

async function sandboxes(instance, args) {
  try {
    const { data } = await apiRequest(instance, 'GET', '/api/mt/gtap');
    const lookups = await loadLookups(instance);

    if (args.includes('--json')) {
      console.log(JSON.stringify(data));
    } else if (data.length === 0) {
      console.log('No sandboxes configured.');
    } else {
      console.log('Sandboxes:\n');
      data.forEach(sb => {
        const groupName = lookups.groups[sb.group_id] || 'Group ' + sb.group_id;
        const attrs = Object.keys(sb.attribute_remappings || {});
        console.log(`  ${String(sb.id).padStart(4)}  group: ${groupName} (${sb.group_id})  table: ${sb.table_id}  card: ${sb.card_id || 'none'}  attributes: ${attrs.length ? attrs.join(', ') : 'none'}`);
      });
      console.log(`\n${data.length} sandboxes`);
    }
  } catch (err) {
    if (err.message?.includes('endpoint does not exist') || err.status === 404) {
      stderr('Sandboxing is an Enterprise-only feature.');
    } else { throw err; }
  }
}

async function sandbox(instance, args) {
  const sub = args[0];
  if (sub === 'create') return sandboxCreate(instance, args.slice(1));
  if (sub === 'delete') return sandboxDelete(instance, args.slice(1));
  stderr('Usage: sandbox create | sandbox delete');
  process.exit(1);
}

async function sandboxCreate(instance, args) {
  const groupId = parseInt(getArg(args, '--group'), 10);
  const tableId = parseInt(getArg(args, '--table'), 10);
  const attribute = getArg(args, '--attribute');
  const fieldId = getArg(args, '--field');

  if (isNaN(groupId) || isNaN(tableId)) {
    stderr('Usage: sandbox create --group <id> --table <id> [--attribute <name> --field <id>]');
    process.exit(1);
  }

  const body = { group_id: groupId, table_id: tableId, card_id: null, attribute_remappings: {} };
  if (attribute && fieldId) {
    body.attribute_remappings[attribute] = ['dimension', ['field', parseInt(fieldId, 10), null]];
  }

  const { data } = await apiRequest(instance, 'POST', '/api/mt/gtap', body);
  console.log(JSON.stringify({ id: data.id, group_id: data.group_id, table_id: data.table_id }));
}

async function sandboxDelete(instance, args) {
  const id = parseInt(args[0], 10);
  if (isNaN(id)) { stderr('Usage: sandbox delete <id>'); process.exit(1); }
  await apiRequest(instance, 'DELETE', `/api/mt/gtap/${id}`);
  stderr(`Sandbox ${id} deleted.`);
}

// --- PERMISSIONS SUMMARY ---

async function permissionsSummary(instance, args) {
  const groupId = getArg(args, '--group');
  const lookups = await loadLookups(instance);

  // Fetch everything in parallel
  const fetches = [
    apiRequest(instance, 'GET', '/api/user?status=active'),
    apiRequest(instance, 'GET', '/api/permissions/group'),
    apiRequest(instance, 'GET', groupId ? `/api/permissions/graph/group/${groupId}` : '/api/permissions/graph'),
    apiRequest(instance, 'GET', '/api/collection/graph'),
  ];

  // Enterprise features — catch failures gracefully
  fetches.push(apiRequest(instance, 'GET', '/api/mt/gtap').catch(() => ({ data: [] })));
  fetches.push(apiRequest(instance, 'GET', '/api/ee/advanced-permissions/application/graph').catch(() => ({ data: null })));
  fetches.push(apiRequest(instance, 'GET', '/api/collection/graph?namespace=snippets').catch(() => ({ data: null })));

  const [usersRes, groupsRes, dbPermsRes, collPermsRes, sandboxRes, appPermsRes, snippetPermsRes] = await Promise.all(fetches);

  const userList = usersRes.data.data || usersRes.data;
  const groupList = groupsRes.data;
  const dbPerms = dbPermsRes.data;
  const collPerms = collPermsRes.data;
  const sandboxList = sandboxRes.data || [];
  const appPerms = appPermsRes.data;
  const snippetPerms = snippetPermsRes.data;

  if (groupId) {
    // Single group summary
    const g = groupList.find(g => String(g.id) === groupId);
    const groupName = g?.name || 'Unknown';
    console.log(`\nGroup: ${groupName} (${groupId})`);
    console.log(`  Members: ${g?.member_count || 0}`);

    // DB access
    const gDbPerms = dbPerms.groups[groupId] || {};
    console.log(`\n  Database Access:`);
    for (const [did, perms] of Object.entries(gDbPerms)) {
      const dbName = lookups.databases[did] || 'DB ' + did;
      const view = fmt(perms['view-data']);
      const query = fmt(perms['create-queries']);
      const extras = [];
      if (perms['download']?.schemas) extras.push(`download: ${perms['download'].schemas}`);
      if (perms['data-model']?.schemas) extras.push(`data-model: ${perms['data-model'].schemas}`);
      if (perms['details']) extras.push(`details: ${perms['details']}`);
      const extraStr = extras.length ? '  ' + extras.join('  ') : '';
      console.log(`    ${String(did).padStart(4)}  ${dbName.padEnd(32)} view: ${view.padEnd(15)} queries: ${query}${extraStr}`);
    }

    // Collection access
    const gCollPerms = collPerms.groups[groupId] || {};
    if (Object.keys(gCollPerms).length) {
      console.log(`\n  Collection Access:`);
      for (const [cid, perm] of Object.entries(gCollPerms)) {
        const name = lookups.collections[cid] || (cid === 'root' ? 'Root collection' : 'Collection ' + cid);
        console.log(`    ${String(cid).padStart(5)}  ${name.padEnd(35)} ${perm}`);
      }
    }

    // Snippet folders
    if (snippetPerms?.groups?.[groupId]) {
      const sPerms = snippetPerms.groups[groupId];
      console.log(`\n  Snippet Folders: ${Object.keys(sPerms).length} configured`);
    }

    // App permissions
    if (appPerms?.groups?.[groupId]) {
      const ap = appPerms.groups[groupId];
      console.log(`\n  App Permissions: setting: ${ap.setting || 'no'}  monitoring: ${ap.monitoring || 'no'}  subscription: ${ap.subscription || 'no'}`);
    }

    // Sandboxes for this group
    const gSandboxes = sandboxList.filter(s => String(s.group_id) === groupId);
    if (gSandboxes.length) {
      console.log(`\n  Sandboxes: ${gSandboxes.length}`);
      gSandboxes.forEach(s => console.log(`    table ${s.table_id}, attributes: ${Object.keys(s.attribute_remappings || {}).join(', ') || 'none'}`));
    }

    console.log('');
    return;
  }

  // Full summary
  const admins = userList.filter(u => u.is_superuser);
  const ssoSources = {};
  userList.forEach(u => { const s = u.sso_source || 'password'; ssoSources[s] = (ssoSources[s] || 0) + 1; });

  console.log('\nMetabase Permissions Summary');
  console.log('='.repeat(50));

  // Users
  console.log(`\nUSERS: ${userList.length} total, ${admins.length} admins, ${userList.length - admins.length} standard`);
  const authStr = Object.entries(ssoSources).map(([s, c]) => `${s} (${c})`).join(', ');
  console.log(`AUTH: ${authStr}`);

  // Groups
  const emptyGroups = groupList.filter(g => g.member_count === 0 && g.id > 2);
  const nativeSqlGroups = [];
  const businessGroups = [];
  for (const g of groupList) {
    if (g.id <= 2) continue;
    const gPerms = dbPerms.groups[String(g.id)] || {};
    let hasNative = false;
    for (const perms of Object.values(gPerms)) {
      if (perms['create-queries'] === 'query-builder-and-native') { hasNative = true; break; }
    }
    if (hasNative) nativeSqlGroups.push(g);
    else if (g.member_count > 0) businessGroups.push(g);
  }

  console.log(`\nGROUPS (${groupList.length}):`);

  console.log('  Built-in:');
  groupList.filter(g => g.id <= 2).forEach(g => {
    console.log(`    ${g.name.padEnd(30)} ${String(g.member_count).padStart(4)} members`);
  });

  if (nativeSqlGroups.length) {
    console.log('  With native SQL:');
    nativeSqlGroups.sort((a, b) => b.member_count - a.member_count).forEach(g => {
      const gPerms = dbPerms.groups[String(g.id)] || {};
      const nativeDbCount = Object.values(gPerms).filter(p => p['create-queries'] === 'query-builder-and-native').length;
      console.log(`    ${g.name.padEnd(30)} ${String(g.member_count).padStart(4)} members   ${nativeDbCount} DB(s) with native SQL`);
    });
  }

  if (businessGroups.length) {
    console.log('  Business (schema-level):');
    businessGroups.sort((a, b) => b.member_count - a.member_count).slice(0, 10).forEach(g => {
      console.log(`    ${g.name.padEnd(30)} ${String(g.member_count).padStart(4)} members`);
    });
    if (businessGroups.length > 10) console.log(`    ... and ${businessGroups.length - 10} more`);
  }

  if (emptyGroups.length) {
    console.log(`  Empty (0 members): ${emptyGroups.map(g => g.name).join(', ')} (${emptyGroups.length} groups)`);
  }

  // Collection summary
  let readCount = 0, writeCount = 0;
  for (const gPerms of Object.values(collPerms.groups)) {
    for (const perm of Object.values(gPerms)) {
      if (perm === 'read') readCount++;
      else if (perm === 'write') writeCount++;
    }
  }
  console.log(`\nCOLLECTION PERMISSIONS:`);
  console.log(`  ${readCount} read entries, ${writeCount} write entries across ${Object.keys(collPerms.groups).length} groups`);

  // Enterprise features
  const enterprise = [];
  if (sandboxList.length) enterprise.push(`Sandboxes: ${sandboxList.length} active`);
  if (appPerms?.groups) enterprise.push(`App permissions: ${Object.keys(appPerms.groups).length} groups configured`);
  if (snippetPerms?.groups) enterprise.push(`Snippet folders: ${Object.keys(snippetPerms.groups).length} groups configured`);
  if (enterprise.length) {
    console.log(`\nENTERPRISE FEATURES:`);
    enterprise.forEach(e => console.log(`  ${e}`));
  }

  console.log('');
}

function fmt(val) {
  if (val === undefined || val === null) return '(unset)';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
