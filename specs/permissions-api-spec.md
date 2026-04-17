# Metabase Permissions API Spec

> User, group, and permission management for Metabase instances.
> Reverse-engineered from the Metabase OpenAPI spec and live API responses.

## API Endpoints

### Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user` | GET | List users (paginated, filterable by status/group/query) |
| `/api/user` | POST | Create user |
| `/api/user/current` | GET | Get current authenticated user |
| `/api/user/{id}` | GET | Get user by ID |
| `/api/user/{id}` | PUT | Update user |
| `/api/user/{id}` | DELETE | Deactivate user (soft delete) |
| `/api/user/{id}/reactivate` | PUT | Reactivate deactivated user |

### Groups

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/permissions/group` | GET | List all groups with member counts |
| `/api/permissions/group` | POST | Create group |
| `/api/permissions/group/{id}` | GET | Get group details |
| `/api/permissions/group/{group-id}` | PUT | Update group name |
| `/api/permissions/group/{group-id}` | DELETE | Delete group |

### Membership

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/permissions/membership` | GET | List all memberships (user → group map) |
| `/api/permissions/membership` | POST | Add user to group |
| `/api/permissions/membership/{id}` | PUT | Update membership (set group manager) |
| `/api/permissions/membership/{id}` | DELETE | Remove user from group |

### Permissions Graph

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/permissions/graph` | GET | Full permissions graph (all groups × all databases) |
| `/api/permissions/graph/db/{db-id}` | GET | Permissions for a specific database |
| `/api/permissions/graph/group/{group-id}` | GET | Permissions for a specific group |
| `/api/permissions/graph` | PUT | Batch update permissions (dangerous — see warnings) |

### Collection Permissions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collection/graph` | GET | Collection permissions graph |
| `/api/collection/graph` | PUT | Batch update collection permissions (dangerous) |

---

## Users

### GET /api/user (List Users)

Paginated response: `{data: [...], total: N, limit: N, offset: N}`

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: `active`, `deactivated`, `all` |
| `query` | string | Search by name or email |
| `group_id` | integer | Filter by group membership |
| `include_deactivated` | boolean | Include deactivated users |

### POST /api/user (Create User)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string (email) | **yes** | User's email address |
| `first_name` | string\|null | no | First name |
| `last_name` | string\|null | no | Last name |
| `user_group_memberships` | array\|null | no | Groups to add user to: `[{"id": <group_id>}]` |
| `login_attributes` | object\|null | no | Custom login attributes (free-form) |

### PUT /api/user/{id} (Update User)

All fields optional:

| Field | Type | Description |
|-------|------|-------------|
| `first_name` | string\|null | First name |
| `last_name` | string\|null | Last name |
| `email` | string\|null | Email address |
| `is_superuser` | boolean\|null | Admin status |
| `is_group_manager` | boolean\|null | Group manager status |
| `locale` | string\|null | Locale code (e.g. `en_US`) |
| `user_group_memberships` | array\|null | Replace all group memberships |
| `login_attributes` | object\|null | Custom attributes |

### DELETE /api/user/{id} (Deactivate)

Soft-deletes the user (sets `is_active: false`). The user can be reactivated later via `PUT /api/user/{id}/reactivate`.

### User Object (GET response)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `email` | string | Email address |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `common_name` | string | Display name (first + last) |
| `is_superuser` | boolean | Is admin |
| `is_active` | boolean | Active (not deactivated) |
| `is_qbnewb` | boolean | New to query builder |
| `date_joined` | string (ISO 8601) | When user was created |
| `last_login` | string (ISO 8601) | Last login timestamp |
| `updated_at` | string (ISO 8601) | Last update |
| `locale` | string\|null | Locale preference |
| `sso_source` | string\|null | SSO provider (e.g. `"google"`) |
| `group_ids` | array of integers | Groups the user belongs to |
| `personal_collection_id` | integer | User's personal collection ID |
| `login_attributes` | object\|null | Custom attributes |

---

## Groups

### GET /api/permissions/group (List Groups)

Returns array of group objects:

```json
[
  {"id": 1, "name": "All Users", "member_count": 6},
  {"id": 2, "name": "Administrators", "member_count": 2}
]
```

**Built-in groups:**
- **Group 1 "All Users"** — every user is automatically a member. Cannot be deleted.
- **Group 2 "Administrators"** — full access to everything. Cannot be deleted.

Custom groups are created for role-based access control (e.g., "Analysts", "Marketing Team").

### POST /api/permissions/group (Create Group)

| Field | Type | Required |
|-------|------|----------|
| `name` | string | **yes** |

### PUT /api/permissions/group/{group-id} (Update Group)

| Field | Type | Required |
|-------|------|----------|
| `name` | string | **yes** |

### DELETE /api/permissions/group/{group-id}

Deletes the group and removes all memberships. Cannot delete built-in groups (1, 2).

---

## Membership

### GET /api/permissions/membership

Returns a map keyed by **user_id**, where each value is an array of membership objects:

```json
{
  "1": [
    {"membership_id": 1, "group_id": 1, "user_id": 1, "is_group_manager": false},
    {"membership_id": 2, "group_id": 2, "user_id": 1, "is_group_manager": false}
  ],
  "2": [
    {"membership_id": 3, "group_id": 1, "user_id": 2, "is_group_manager": false}
  ]
}
```

### POST /api/permissions/membership (Add User to Group)

| Field | Type | Required |
|-------|------|----------|
| `group_id` | integer | **yes** |
| `user_id` | integer | **yes** |
| `is_group_manager` | boolean | **yes** (default: false) |

### PUT /api/permissions/membership/{id} (Update)

| Field | Type | Required |
|-------|------|----------|
| `is_group_manager` | boolean | **yes** |

The `{id}` is the `membership_id` from the GET response, NOT the user_id or group_id.

### DELETE /api/permissions/membership/{id}

Removes the user from the group. The `{id}` is the `membership_id`.

---

## Permissions Graph

### Structure

The permissions graph defines what each group can do with each database:

```json
{
  "revision": 42,
  "groups": {
    "1": {
      "1": {
        "view-data": "unrestricted",
        "create-queries": "query-builder-and-native",
        "download": {"schemas": "full"}
      },
      "2": {
        "view-data": "blocked",
        "create-queries": "no"
      }
    },
    "2": {
      "1": {
        "view-data": "unrestricted",
        "create-queries": "query-builder-and-native",
        "download": {"schemas": "full"},
        "data-model": {"schemas": "all"},
        "details": "yes"
      }
    }
  }
}
```

**Path:** `groups → {group_id} → {database_id} → permissions`

### Permission Keys

| Key | Values | Description |
|-----|--------|-------------|
| `view-data` | `"unrestricted"`, `"blocked"` | Can the group see data in this database |
| `create-queries` | `"query-builder-and-native"`, `"query-builder"`, `"no"` | Query creation access level |
| `download` | `{"schemas": "full"}`, `{"schemas": "none"}` | Can download query results |
| `data-model` | `{"schemas": "all"}` | Can edit data model (admin groups) |
| `details` | `"yes"` | Can view database connection details (admin groups) |

### GET /api/permissions/graph/db/{db-id}

Returns the graph filtered to a single database. Same structure but only one database key per group.

### GET /api/permissions/graph/group/{group-id}

Returns the graph filtered to a single group. Same structure but only one group key.

### PUT /api/permissions/graph (Batch Update)

**Warning:** This replaces the ENTIRE permissions graph. You must GET the current graph, modify it, and PUT the whole thing back. Missing groups or databases will have their permissions removed.

Query parameters:
- `revision` — must match the current revision (optimistic locking)
- `force` — skip revision check (dangerous)
- `skip-graph` — don't return the updated graph in response

---

## Collection Permissions Graph

### Structure

```json
{
  "revision": 15,
  "groups": {
    "1": {
      "root": "read",
      "3": "read",
      "8": "read"
    },
    "2": {
      "root": "write",
      "3": "write",
      "8": "write"
    }
  }
}
```

**Path:** `groups → {group_id} → {collection_id} → "read" | "write"`

The special key `"root"` represents the root collection.

### Permission Levels

| Level | Description |
|-------|-------------|
| `"read"` | Can view items in the collection |
| `"write"` | Can view and edit items (create, move, archive) |

### PUT /api/collection/graph (Batch Update)

Same pattern as permissions graph — GET, modify, PUT back. Must include `revision` or use `force=true`.

| Field | Type | Required |
|-------|------|----------|
| `groups` | object | **yes** |
| `revision` | integer\|null | yes (unless `force=true`) |
| `namespace` | string\|null | no |
