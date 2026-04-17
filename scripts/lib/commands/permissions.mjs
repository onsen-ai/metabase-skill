import { apiRequest } from '../client.mjs';

export async function run(instance, command, args) {
  switch (command) {
    case 'users': return users(instance, args);
    case 'user': return user(instance, args);
    case 'groups': return groups(instance, args);
    case 'group': return group(instance, args);
    case 'permissions': return permissions(instance, args);
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
}

// --- USERS ---

async function users(instance, args) {
  const query = getArg(args, '--query');
  const status = getArg(args, '--status') || 'active';
  const groupId = getArg(args, '--group');
  let path = `/api/user?status=${status}`;
  if (query) path += `&query=${encodeURIComponent(query)}`;
  if (groupId) path += `&group_id=${groupId}`;

  const [userRes, groupsRes] = await Promise.all([
    apiRequest(instance, 'GET', path),
    apiRequest(instance, 'GET', '/api/permissions/group'),
  ]);
  const list = (userRes.data.data || userRes.data);
  const groupNames = {};
  groupsRes.data.forEach(g => { groupNames[g.id] = g.name; });

  if (args.includes('--json')) {
    console.log(JSON.stringify(list.map(u => ({
      id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name,
      is_superuser: u.is_superuser, is_active: u.is_active,
      groups: (u.group_ids || []).map(gid => ({ id: gid, name: groupNames[gid] || `Group ${gid}` })),
    }))));
  } else {
    console.log('Users:');
    list.forEach(u => {
      const admin = u.is_superuser ? ' [admin]' : '';
      const active = u.is_active ? '' : ' [deactivated]';
      const groups = (u.group_ids || [])
        .filter(gid => gid !== 1)
        .map(gid => groupNames[gid] || `Group ${gid}`);
      const groupStr = groups.length ? ` (${groups.join(', ')})` : '';
      console.log(`  ${String(u.id).padStart(4)}  ${(u.common_name || u.email).padEnd(30)} ${u.email}${admin}${active}${groupStr}`);
    });
    console.log(`\n${list.length} users`);
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
  const dbId = getArg(args, '--database');
  const groupId = getArg(args, '--group');
  const isCollections = args.includes('--collections');

  const lookups = await loadLookups(instance);

  if (isCollections) {
    const { data } = await apiRequest(instance, 'GET', '/api/collection/graph');
    if (args.includes('--json')) {
      console.log(JSON.stringify(data));
    } else {
      console.log(`Collection Permissions (revision ${data.revision}):\n`);
      for (const [gid, colls] of Object.entries(data.groups)) {
        console.log(`  ${lookups.groups[gid] || 'Group ' + gid} (id: ${gid}):`);
        for (const [cid, perm] of Object.entries(colls)) {
          const name = lookups.collections[cid] || `collection ${cid}`;
          console.log(`    ${name.padEnd(40)} ${perm}`);
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

  if (args.includes('--json')) {
    console.log(JSON.stringify(data));
  } else {
    console.log(`Database Permissions (revision ${data.revision}):\n`);
    for (const [gid, dbs] of Object.entries(data.groups)) {
      console.log(`  ${lookups.groups[gid] || 'Group ' + gid} (id: ${gid}):`);
      for (const [did, perms] of Object.entries(dbs)) {
        const dbName = lookups.databases[did] || 'DB ' + did;
        const view = typeof perms['view-data'] === 'string' ? perms['view-data'] : 'schema-level';
        const query = typeof perms['create-queries'] === 'string' ? perms['create-queries'] : 'schema-level';
        console.log(`    ${dbName.padEnd(35)} view: ${view.padEnd(15)} queries: ${query}`);
      }
      console.log();
    }
  }
}

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
