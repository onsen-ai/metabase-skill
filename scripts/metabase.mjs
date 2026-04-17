#!/usr/bin/env node

import { parseGlobalArgs, loadConfig, resolveInstance } from './lib/client.mjs';

const { instance: instanceName, args } = parseGlobalArgs(process.argv.slice(2));
const command = args[0];
const commandArgs = args.slice(1);

if (!command || command === '--help') {
  printHelp();
  process.exit(0);
}

if (command === 'setup') {
  const { run } = await import('./lib/commands/setup.mjs');
  await run();
  process.exit(0);
}

const config = loadConfig();
const instance = resolveInstance(config, instanceName);

try {
  switch (command) {
    case 'databases':
    case 'tables':
    case 'collections':
    case 'collection-items':
    case 'search': {
      const { run } = await import('./lib/commands/discover.mjs');
      await run(instance, command, commandArgs);
      break;
    }
    case 'card': {
      const { run } = await import('./lib/commands/card.mjs');
      await run(instance, commandArgs);
      break;
    }
    case 'dashboard':
    case 'dashcard': {
      const { run } = await import('./lib/commands/dashboard.mjs');
      await run(instance, command, commandArgs);
      break;
    }
    case 'snippets':
    case 'snippet': {
      const { run } = await import('./lib/commands/snippet.mjs');
      await run(instance, command, commandArgs);
      break;
    }
    case 'collection': {
      const { run } = await import('./lib/commands/collection.mjs');
      await run(instance, commandArgs);
      break;
    }
    case 'users':
    case 'user':
    case 'groups':
    case 'group':
    case 'permissions':
    case 'sandboxes':
    case 'sandbox': {
      const { run } = await import('./lib/commands/permissions.mjs');
      await run(instance, command, commandArgs);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
} catch (err) {
  if (err.name === 'ApiError') {
    process.stderr.write(`API Error ${err.status}: ${err.message}\n`);
    process.exit(1);
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    process.stderr.write(`Network error: ${err.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}

function printHelp() {
  process.stderr.write(`
  metabase.mjs <command> [options]

  Global options:
    --instance <name>     Override default instance

  SETUP
    setup                           Interactive setup wizard

  DISCOVER
    databases                       List databases
    tables --database <id>          List tables + fields
    search <query> [--models ...]   Search across all entities
    collections [--tree]            List collections
    collection-items <id>           List items in a collection

  CARDS
    card <id>                       Get card summary
    card <id> --full --out <file>   Save full card to file
    card create --from <file>       Create card from JSON
    card update <id> --patch <file> GET-merge-PUT update
    card delete <id>                Delete card
    card copy <id>                  Copy card
    card query <id>                 Execute card query

  DASHBOARDS
    dashboard <id>                  Get dashboard summary
    dashboard <id> --full --out <f> Save full dashboard to file
    dashboard <id> --layout --out <f> Save layout-only (no card objects)
    dashboard create --from <file>  Create dashboard from JSON
    dashboard put <id> --from <f>   Direct PUT (LLM-constructed payload)
    dashboard update <id> --patch <f> GET-merge-PUT update
    dashboard delete <id>           Delete dashboard
    dashboard copy <id>             Copy dashboard
    dashcard <dashboard-id> <index> Extract single dashcard

  SNIPPETS
    snippets                        List all snippets
    snippet <id>                    Get snippet content
    snippet create --name <n> --content <sql>
    snippet update <id> [--name <n>] [--content <sql>]

  COLLECTIONS
    collection create --name <n> [--parent <id>]
    collection update <id> [--name <n>] [--parent <id>]

  USERS & GROUPS
    users                           List users
    user <id>                       Get user details
    user create --email <e>         Create user
    user update <id>                Update user
    user deactivate <id>            Deactivate user
    groups                          List permission groups
    group <id>                      Get group details + members
    group create --name <n>         Create group
    group delete <id>               Delete group
    group add-user <gid> <uid>      Add user to group
    group remove-user <mid>         Remove membership

  PERMISSIONS
    permissions                     View database permissions graph
    permissions --database <id>     View perms for one database
    permissions --group <id>        View perms for one group
    permissions --collections       View collection permissions
`);
}
