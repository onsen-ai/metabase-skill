# Metabase Collection API Spec

> Reverse-engineered from live Metabase API responses.
> Cross-referenced with [metabase/representations](https://github.com/metabase/representations/blob/main/core-spec/v1/schemas/collection.yaml) official serialization schema.
> Validated against [Metabase OpenAPI spec](specs/metabase-openapi.yaml) (collection endpoints).
> Tested across Metabase versions v0.54 through v0.58.

## API Endpoints

```
GET  /api/collection                    — list all collections
POST /api/collection                    — create a new collection
GET  /api/collection/tree               — get full collection tree
GET  /api/collection/:id                — get single collection
PUT  /api/collection/:id                — update a collection
GET  /api/collection/:id/items          — list items in a collection
```

Authentication: `X-API-Key: <token>` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collection` | GET | List all collections (flat list) |
| `/api/collection` | POST | Create a new collection |
| `/api/collection/tree` | GET | Get collections in hierarchical tree structure |
| `/api/collection/root` | GET | Get the virtual root collection object |
| `/api/collection/root/items` | GET | List items at root level |
| `/api/collection/trash` | GET | Get the trash collection |
| `/api/collection/{id}` | GET | Get a single collection by ID |
| `/api/collection/{id}` | PUT | Update a collection (rename, move, archive) |
| `/api/collection/{id}` | DELETE | Permanently delete a collection |
| `/api/collection/{id}/items` | GET | List items within a collection |

---

## GET /api/collection (List)

Returns a flat array of all collections the current user can read.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `archived` | boolean\|null | `false` | Return archived collections instead of active ones |
| `exclude-other-user-collections` | boolean\|null | `false` | Hide other users' collections (admin only) |
| `namespace` | string\|null | — | Filter by namespace (e.g. `"snippets"`) |
| `personal-only` | boolean\|null | `false` | Return only personal collections |

---

## POST /api/collection (Create)

**Request body (`application/json`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string (min 1 char) | **yes** | Collection name |
| `description` | string\|null | no | Collection description |
| `parent_id` | integer (>= 1)\|null | no | Parent collection ID (`null` = root level) |
| `namespace` | string\|null | no | Collection namespace (e.g. `"snippets"`) |
| `authority_level` | `"official"\|null` | no | Set to `"official"` for official collections |

---

## GET /api/collection/tree

Returns collections in a recursive tree structure with `children` arrays. This is the most efficient way to get the full collection hierarchy in a single request.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exclude-archived` | boolean\|null | `false` | Exclude archived collections |
| `exclude-other-user-collections` | boolean\|null | `false` | Hide other users' collections |
| `include-library` | boolean\|null | `false` | Include library collections |
| `namespace` | string\|null | — | Filter by namespace |
| `namespaces` | array of strings\|null | — | Filter by multiple namespaces |
| `shallow` | boolean\|null | `false` | Return only one level deep |
| `collection-id` | integer\|null | — | Root of subtree (used with `shallow=true`) |

**Response:** Array of tree node objects, each with a `children` array containing nested collections.

### Tree Node Schema

Each node in the tree contains all collection fields plus tree-specific fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Collection ID |
| `name` | string | Collection name |
| `slug` | string | URL-friendly name |
| `description` | string\|null | Description |
| `location` | string | Path string (e.g. `"/"`, `"/3/"`, `"/3/101/"`) |
| `namespace` | string\|null | Namespace (`null` for regular, `"snippets"` for snippet collections) |
| `authority_level` | string\|null | `"official"` or `null` |
| `type` | string\|null | Collection type (see Types below) |
| `archived` | boolean | Whether archived |
| `archived_directly` | boolean\|null | Archived directly vs inherited |
| `personal_owner_id` | integer\|null | User ID if this is a personal collection |
| `can_write` | boolean | Whether current user can write |
| `is_sample` | boolean | Whether this is a sample collection |
| `is_remote_synced` | boolean | Remote sync flag |
| `entity_id` | string\|null | NanoID entity identifier |
| `archive_operation_id` | string\|null | Archive operation ID |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `children` | array | Nested child collections (recursive) |
| `below` | array of strings | Item types that exist in subtree (e.g. `["card", "metric", "dataset"]`) |
| `workspace_id` | integer\|null | Workspace ID (absent on some versions) |

### Location Path Format

The `location` field encodes the collection hierarchy as a path string:

| Location | Meaning |
|----------|---------|
| `"/"` | Root-level collection |
| `"/3/"` | Direct child of collection 3 |
| `"/3/101/"` | Child of collection 101, which is child of collection 3 |

---

## GET /api/collection/{id}

Returns a single collection with additional computed fields not present in tree/list responses.

**Path parameters:** `id` — integer >= 1, or a 21-character NanoID string.

### Additional Fields (beyond tree node fields)

| Field | Type | Description |
|-------|------|-------------|
| `parent_id` | integer\|null | Direct parent collection ID |
| `is_personal` | boolean | Whether this is a personal collection |
| `effective_ancestors` | array | Ancestor chain from root to parent (for breadcrumbs) |
| `effective_location` | string | Resolved location path |
| `can_delete` | boolean | Whether current user can delete |
| `can_restore` | boolean | Whether current user can restore from archive |

### Effective Ancestors

The `effective_ancestors` array contains collection objects from root to immediate parent:

```json
{
  "effective_ancestors": [
    {
      "metabase.collections.models.collection.root/is-root?": true,
      "authority_level": null,
      "name": "Our analytics",
      "is_personal": false,
      "id": "root",
      "is_remote_synced": false,
      "can_write": true
    }
  ]
}
```

The root collection uses `"id": "root"` (string, not integer) and includes the special `metabase.collections.models.collection.root/is-root?` flag.

---

## PUT /api/collection/{id}

Update a collection. All fields are optional except `archived` which has a default of `false`.

**Path parameters:** `id` — integer >= 1.

**Request body (`application/json`):**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `archived` | boolean\|null | yes (has default) | `false` | Archive or restore the collection |
| `name` | string\|null | no | — | Rename the collection |
| `description` | string\|null | no | — | Update description |
| `parent_id` | integer (>= 1)\|null | no | — | Move to a different parent collection |
| `authority_level` | `"official"\|null` | no | — | Set or remove official status |
| `type` | `"remote-synced"\|null` | no | — | Set collection type |

### Archiving Pattern

To archive a collection and all its contents:

```json
PUT /api/collection/{id}
{
  "archived": true
}
```

To restore:

```json
PUT /api/collection/{id}
{
  "archived": false
}
```

### Moving a Collection

```json
PUT /api/collection/{id}
{
  "parent_id": 42
}
```

Setting `parent_id` to `null` moves the collection to root level.

---

## GET /api/collection/{id}/items

List items within a collection. Returns a paginated response object (not a plain array).

**Path parameters:** `id` — integer >= 1, or a 21-character NanoID string.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `models` | array of strings\|null | all | Filter by item type(s) |
| `archived` | boolean\|null | `false` | Return archived items instead |
| `pinned_state` | `"is_pinned"\|"is_not_pinned"\|"all"\|null` | `"all"` | Filter by pin state |
| `sort_column` | `"model"\|"name"\|"last_edited_by"\|"last_edited_at"\|"description"\|null` | — | Sort field |
| `sort_direction` | `"asc"\|"desc"\|null` | — | Sort order |
| `official_collections_first` | boolean\|null | — | Sort official collections to top |
| `include_can_run_adhoc_query` | boolean\|null | `false` | Include ad-hoc query permission flag on cards |
| `show_dashboard_questions` | boolean\|null | `false` | Show dashboard-embedded questions |

### Model Filter Values

| Model | Description |
|-------|-------------|
| `card` | Saved questions |
| `dashboard` | Dashboards |
| `collection` | Sub-collections |
| `dataset` | Models (datasets) |
| `metric` | Metrics |
| `table` | Tables |
| `snippet` | SQL snippets |
| `timeline` | Timelines |
| `document` | Documents |
| `pulse` | Pulses (legacy alerts) |
| `transform` | Transforms |
| `no_models` | Items without model type |

### Response Shape

```json
{
  "data": [ ... ],
  "total": 50,
  "models": ["card", "collection", "dashboard", "dataset", "document", "metric", "pulse", "table", "timeline"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | Array of item objects |
| `total` | integer | Total number of items |
| `models` | array of strings | All model types that exist in this collection (regardless of filter) |

### Item Object Schema

Each item in the `data` array:

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Item ID |
| `name` | string | Item name |
| `model` | string | Item type: `"card"`, `"dashboard"`, `"collection"`, `"dataset"`, etc. |
| `description` | string\|null | Description |
| `collection_id` | integer | Parent collection ID |
| `entity_id` | string | NanoID entity identifier |
| `archived` | boolean | Whether archived |
| `can_write` | boolean | Current user can edit |
| `can_delete` | boolean | Current user can delete |
| `can_restore` | boolean | Current user can restore |
| `is_remote_synced` | boolean | Remote sync flag |
| `collection_position` | integer\|null | Pin position within collection |
| `collection_namespace` | string\|null | Namespace of parent collection |
| `collection_preview` | boolean | Whether item shows in collection preview |
| `moderated_status` | string\|null | Moderation status |
| `last-edit-info` | object\|null | `{id, email, first_name, last_name, timestamp}` (absent on some versions) |

**Card-specific fields** (when `model` is `"card"`, `"dataset"`, or `"metric"`):

| Field | Type | Description |
|-------|------|-------------|
| `display` | string | Visualization type (e.g. `"line"`, `"table"`, `"smartscalar"`) |
| `database_id` | integer | Source database ID |
| `dashboard_count` | integer | Number of dashboards using this card |
| `dashboard_id` | integer\|null | Dashboard ID (for dashboard-saved questions) |
| `dashboard` | object\|null | Dashboard info (for dashboard-saved questions) |
| `fully_parameterized` | boolean | Whether all parameters have values |
| `last_used_at` | string (ISO 8601) | Last query execution time |

**Collection-specific fields** (when `model` is `"collection"`):

| Field | Type | Description |
|-------|------|-------------|
| `location` | string | Location path (e.g. `"/3/"`) |
| `authority_level` | string\|null | `"official"` or `null` |
| `personal_owner_id` | integer\|null | User ID if personal collection |

---

## Serialization Spec vs API Comparison

| Field | Serialization Spec | API Response | Notes |
|-------|-------------------|--------------|-------|
| `name` | required | present | Same |
| `entity_id` | required | present (nullable) | Spec requires it; API may return `null` on older collections |
| `description` | optional | present | Same |
| `slug` | optional | present | Same |
| `archived` | optional (default false) | present | Same |
| `archived_directly` | optional | present | Same |
| `type` | optional (enum) | present | Spec has more types than API PUT accepts |
| `namespace` | optional (enum) | present | Same |
| `authority_level` | optional (enum) | present | Same |
| `archive_operation_id` | optional | present | Same |
| `is_remote_synced` | optional (default false) | present | Same |
| `is_sample` | optional (default false) | present | Same |
| `parent_id` | optional (entity_id ref) | present (numeric) | Spec uses entity_id; API uses numeric ID |
| `personal_owner_id` | optional (user ref) | present (numeric) | Spec uses user ref; API uses numeric ID |
| `created_at` | optional | present | Same |
| `serdes/meta` | required | **absent** | Spec-only: serialization identity path |
| `id` | **absent** | present | API-only: numeric ID |
| `location` | **absent** | present | API-only: path string |
| `can_write` | **absent** | present | API-only: permission flag |
| `can_delete` | **absent** | present | API-only: permission flag |
| `can_restore` | **absent** | present | API-only: permission flag |
| `is_personal` | **absent** | present (single GET) | API-only |
| `effective_ancestors` | **absent** | present (single GET) | API-only: breadcrumb chain |
| `effective_location` | **absent** | present (single GET) | API-only |
| `children` | **absent** | present (tree only) | API-only: tree structure |
| `below` | **absent** | present (tree only) | API-only: item types in subtree |

### Collection Types

Values for the `type` field: `null` (regular), `instance-analytics`, `library`, `library-data`, `library-metrics`, `trash`, `tenant-specific-root-collection`.

### Collection Namespaces

Values for the `namespace` field: `null` (regular/default), `snippets` (SQL snippet collections), `transforms`, `shared-tenant-collection`, `tenant-specific`.

---

## JSON Examples

### Collection Tree Node

```json
{
  "authority_level": "official",
  "description": "Official reports created by central Data team",
  "archived": false,
  "slug": "central_dashboards",
  "archive_operation_id": null,
  "can_write": true,
  "name": "Central dashboards",
  "is_remote_synced": false,
  "personal_owner_id": null,
  "type": null,
  "is_sample": false,
  "id": 3,
  "archived_directly": null,
  "entity_id": null,
  "location": "/",
  "namespace": null,
  "below": ["card", "metric", "dataset"],
  "created_at": "2022-12-07T15:14:07.321408Z",
  "children": [
    {
      "name": "Commercial",
      "id": 101,
      "location": "/3/",
      "authority_level": "official",
      "below": ["card", "metric", "dataset"],
      "children": ["..."]
    }
  ]
}
```

### Single Collection

```json
{
  "authority_level": null,
  "description": null,
  "archived": false,
  "slug": "examples",
  "archive_operation_id": null,
  "can_write": true,
  "name": "Examples",
  "is_remote_synced": false,
  "personal_owner_id": null,
  "type": null,
  "is_sample": true,
  "id": 1,
  "archived_directly": null,
  "entity_id": "53YGAg4EE6MC76nxx-f5f",
  "location": "/",
  "namespace": null,
  "parent_id": null,
  "is_personal": false,
  "effective_location": "/",
  "effective_ancestors": [
    {
      "metabase.collections.models.collection.root/is-root?": true,
      "authority_level": null,
      "name": "Our analytics",
      "is_personal": false,
      "id": "root",
      "is_remote_synced": false,
      "can_write": true
    }
  ],
  "can_restore": false,
  "can_delete": false,
  "created_at": "2024-08-30T16:44:13.734282Z"
}
```

### Collection Items Response

```json
{
  "total": 50,
  "models": ["card", "collection", "dashboard", "dataset", "document", "metric", "pulse", "table", "timeline"],
  "data": [
    {
      "id": 1234,
      "name": "Revenue Trends",
      "model": "card",
      "description": null,
      "archived": false,
      "collection_id": 8,
      "entity_id": "abc123def456ghi789jkl",
      "display": "line",
      "database_id": 2,
      "dashboard_count": 2,
      "fully_parameterized": true,
      "last_used_at": "2026-04-16T14:54:55.436212Z",
      "can_write": true,
      "can_delete": false,
      "can_restore": false,
      "is_remote_synced": false,
      "collection_position": null,
      "collection_preview": true,
      "collection_namespace": null,
      "moderated_status": null,
      "dashboard_id": null,
      "dashboard": null,
      "last-edit-info": {
        "id": 42,
        "last_name": "Smith",
        "first_name": "Jane",
        "email": "jane@example.com",
        "timestamp": "2025-12-11T14:10:33.901755Z"
      }
    }
  ]
}
```

### Minimal POST Request (create collection)

```json
{
  "name": "Q2 2026 Reports",
  "description": "Quarterly trading reports",
  "parent_id": 3,
  "authority_level": "official"
}
```

### Archive a Collection

```json
PUT /api/collection/{id}
{
  "archived": true
}
```

### Move a Collection

```json
PUT /api/collection/{id}
{
  "parent_id": 42
}
```

### Filter Items by Model

```
GET /api/collection/{id}/items?models=dashboard&models=card&sort_column=last_edited_at&sort_direction=desc
```

---

### Navigation Patterns

1. **Full tree** — `GET /api/collection/tree?exclude-archived=true` for sidebar navigation
2. **Shallow browse** — `GET /api/collection/tree?shallow=true&collection-id=3` for lazy-loading
3. **List contents** — `GET /api/collection/{id}/items?models=dashboard&models=card` for filtered views
4. **Breadcrumbs** — `GET /api/collection/{id}` and use `effective_ancestors` for path display
5. **Search within** — Use `/api/search?collection={id}&q=term` (see Discovery API)
