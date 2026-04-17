# Metabase Permissions Guide

Workflow guide for managing users, groups, and permissions in Metabase.

## How Metabase Permissions Work

Metabase uses a **group-based** permission model:

```
Users → belong to → Groups → have access to → Databases / Collections
```

- Every user belongs to **"All Users"** (group 1) automatically
- **Administrators** (group 2) have full access to everything
- Custom groups control access to databases, tables, and collections
- Permissions are **additive** — if a user is in multiple groups, they get the most permissive access from any group

### Permission Layers

| Layer | What it controls | API |
|-------|-----------------|-----|
| **Database permissions** | Can a group view/query a database? | `/api/permissions/graph` |
| **Collection permissions** | Can a group view/edit items in a collection? | `/api/collection/graph` |
| **Group membership** | Which users are in which groups? | `/api/permissions/membership` |

## Common Workflows

### 1. Create a New Team with Database Access

```
1. Create group:        group create --name "Analytics Team"
2. Set DB permissions:  (via Metabase UI — graph PUT is high-risk)
3. Set collection perms: (via Metabase UI)
4. Add users:           group add-user <group-id> <user-id>
```

### 2. Onboard a New User

```
1. Create user:         user create --email "name@company.com" --first "Jane" --last "Smith"
2. Add to groups:       group add-user <group-id> <user-id>
   (repeat for each group)
```

### 3. Audit Who Has Access to What

```
1. List groups:         groups
2. View memberships:    (GET /api/permissions/membership)
3. View DB permissions: permissions --database <id>
4. View collection:     permissions --collections
```

### 4. Remove a User's Access

```
1. Option A — Deactivate:  user deactivate <id>
   (removes all access, preserves their content)

2. Option B — Remove from group:  group remove-user <membership-id>
   (removes access from one group only)
```

### 5. Reorganise Groups

```
1. List current:        groups
2. Create new groups:   group create --name "..."
3. Move users:          group add-user <new-group> <user-id>
                        group remove-user <old-membership-id>
4. Delete empty groups: group delete <old-group-id>
```

## Permission Levels Explained

### Database Permissions

| Permission | `view-data` | `create-queries` | Effect |
|-----------|-------------|-------------------|--------|
| **Full access** | `unrestricted` | `query-builder-and-native` | Can see all data, write MBQL and SQL |
| **Query builder only** | `unrestricted` | `query-builder` | Can see data, write MBQL, but no native SQL |
| **View only** | `unrestricted` | `no` | Can see data in existing questions but can't create new ones |
| **No access** | `blocked` | `no` | Can't see any data from this database |

### Collection Permissions

| Permission | Effect |
|-----------|--------|
| **Write** | Can view, create, edit, move, and archive items in the collection |
| **Read** | Can view items only — can't create, edit, or move |
| **No access** | Collection is hidden from the group |

## Safety Warnings

### High-Risk Operations

These can break access for your entire team if done incorrectly:

- **PUT /api/permissions/graph** — replaces the ENTIRE permissions graph. Missing a group or database in the payload removes those permissions. Always GET first, modify, PUT back.
- **PUT /api/collection/graph** — same risk for collection permissions.
- **DELETE /api/permissions/group** — deletes the group and all its memberships. Users lose any access that came exclusively from this group.
- **DELETE /api/user/{id}** — deactivates the user. Their saved questions and dashboards remain but are no longer maintained.

### Best Practices

- **Read before writing.** Always `GET` the current state before making changes. Use the CLI's read commands to audit first.
- **Don't modify built-in groups.** Groups 1 ("All Users") and 2 ("Administrators") are system groups. Don't delete them or remove all members from Administrators.
- **Test permission changes on a staging instance** if available. Use `--instance staging` to target non-production.
- **Use groups, not individual permissions.** Create groups for roles ("Analysts", "Marketing", "Executives") and assign users to groups. Don't set per-user permissions.
- **Document your permission model.** Keep a record of which groups exist, what they can access, and who's in them.

## Example Prompts

> "Show me all users and which groups they belong to."

Workflow: `users` → `groups` → cross-reference group_ids from user objects.

> "Create a new group called 'Data Analysts' and add users 3 and 4 to it."

Workflow: `group create --name "Data Analysts"` → `group add-user <new-group-id> 3` → `group add-user <new-group-id> 4`

> "What databases can the 'All Users' group access?"

Workflow: `permissions --group 1`

> "Audit our permission setup — show me the full matrix of groups, databases, and collection access."

Workflow: `groups` → `permissions` → `permissions --collections` → summarise the matrix.

> "Deactivate user 5 — they've left the company."

Workflow: `user deactivate 5`

> "Show me all admins and which groups they're in."

Workflow: `users --admins`

> "Who has both Tech and SQL access?"

Workflow: `users --groups-all 32,53`

> "Which admins are in the Commercial group?"

Workflow: `users --admins --group 28`

> "Which groups have native SQL access to our databases?"

Workflow: `permissions --native-sql`

> "Run a security audit — find empty groups, over-privileged users, external accounts."

Workflow: `groups` (spot empty groups) → `users --admins` (review admin list) → `permissions --native-sql` (review SQL access) → `permissions --collections` (review collection write access) → summarise findings with recommendations.

## User Filtering

The `users` command supports flexible filters that combine:

| Filter | What it does | Example |
|--------|-------------|---------|
| `--admins` | Superusers only | `users --admins` |
| `--group <id>` | Members of a group | `users --group 53` |
| `--group <id,id>` | Members of ANY group (union) | `users --group 32,53` |
| `--groups-all <id,id>` | Members of ALL groups (intersection) | `users --groups-all 32,53` |
| `--query <text>` | Search by name or email | `users --query smith` |

Filters combine: `users --admins --group 28` = admins who are in Commercial.

Output resolves group IDs to names automatically.

## CLI Quick Reference

| Command | Description |
|---------|-------------|
| `users` | List all users |
| `users --admins` | List superusers only |
| `users --group <ids>` | List members of group(s) — comma-separated for union |
| `users --groups-all <ids>` | List members in ALL groups — comma-separated for intersection |
| `user <id>` | Get user details |
| `user create --email <e> --first <f> --last <l>` | Create user |
| `user update <id> [--first] [--last] [--superuser true/false]` | Update user |
| `user deactivate <id>` | Deactivate user |
| `groups` | List all permission groups |
| `group <id>` | Get group details + members |
| `group create --name <n>` | Create group |
| `group delete <id>` | Delete group |
| `group add-user <group-id> <user-id>` | Add user to group |
| `group remove-user <membership-id>` | Remove user from group |
| `permissions [--database <id>] [--group <id>]` | View database permissions |
| `permissions --native-sql` | Show only groups with native SQL access |
| `permissions --collections` | View collection permissions |
