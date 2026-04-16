# Metabase Snippet API Spec

> Reverse-engineered from live Metabase API responses.
> Cross-referenced with [metabase/representations](https://github.com/metabase/representations/blob/main/core-spec/v1/schemas/snippet.yaml) official serialization schema.
> Validated against [Metabase OpenAPI spec](specs/metabase-openapi.yaml) (`POST/PUT /api/native-query-snippet` request body schemas).
> Tested across Metabase versions v0.54 through v0.58.

## API Endpoints

```
GET  /api/native-query-snippet          — list all snippets
POST /api/native-query-snippet          — create a new snippet
GET  /api/native-query-snippet/:id      — get snippet by ID
PUT  /api/native-query-snippet/:id      — update a snippet
```

Authentication: `X-API-Key: <token>` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/native-query-snippet` | GET | List all snippets (optionally filter by `?archived=true`) |
| `/api/native-query-snippet` | POST | Create a new `NativeQuerySnippet` |
| `/api/native-query-snippet/{id}` | GET | Get a single snippet by numeric ID |
| `/api/native-query-snippet/{id}` | PUT | Update an existing snippet |

**Note:** Snippets do not support DELETE. To remove a snippet, archive it via `PUT /api/native-query-snippet/{id}` with `{"archived": true}`.

### GET /api/native-query-snippet

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `archived` | boolean\|null | `false` | When `true`, returns only archived snippets; when `false` or omitted, returns active snippets |

Returns an array of snippet objects.

### POST /api/native-query-snippet (from OpenAPI)

**Request body (`application/json`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Snippet name (cannot include `}` or start with spaces) |
| `content` | string | **yes** | SQL content of the snippet |
| `description` | string\|null | no | Human-readable description |
| `collection_id` | integer (>= 1)\|null | no | Snippet collection ID |

### PUT /api/native-query-snippet/{id} (from OpenAPI)

**Path parameters:** `id` — integer >= 1

**Request body (`application/json`):** All fields optional.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string\|null | Updated name (same constraints: no `}`, no leading spaces) |
| `content` | string\|null | Updated SQL content |
| `description` | string\|null | Updated description |
| `collection_id` | integer (>= 1)\|null | Move to a different snippet collection |
| `archived` | boolean\|null | Set `true` to archive, `false` to restore |

---

## Response Schema

Both GET (list and single) return the same object shape. The list endpoint returns an array of these objects.

### Writable Fields (accepted on POST/PUT)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Snippet name — used in `{{snippet: Name}}` references in native queries |
| `content` | string | SQL content that gets inlined when the snippet is referenced |
| `description` | string\|null | Human-readable description (empty string `""` or `null` when not set) |
| `collection_id` | integer\|null | Parent snippet collection ID (`null` = root/uncategorized) |
| `archived` | boolean | Whether the snippet is archived (`false` by default) |

### Read-Only Fields (returned on GET, ignored on PUT)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Numeric snippet ID (auto-assigned) |
| `entity_id` | string\|null | Unique entity identifier for serialization (`null` on older snippets) |
| `creator_id` | integer | Numeric ID of the user who created the snippet |
| `creator` | object | Embedded creator user object (see below) |
| `template_tags` | object | Template tag definitions within the snippet content (see below) |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `updated_at` | string (ISO 8601) | Last modification timestamp |
| `dependency_analysis_version` | integer | Internal dependency tracking version (e.g. `0`, `5`) |
| `is_remote_synced` | boolean\|null | Remote sync status (always `null` in observed data) |

### Creator Object

Embedded in each snippet response:

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | User ID |
| `email` | string | User email |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `common_name` | string | Display name (e.g. `"Jane Smith"`) |
| `is_superuser` | boolean | Whether user is a superuser |
| `is_qbnewb` | boolean | Whether user is new to Metabase |
| `is_data_analyst` | boolean | Analyst flag (only present on some versions) |
| `last_login` | string (ISO 8601) | Last login timestamp |
| `date_joined` | string (ISO 8601) | Account creation timestamp |
| `tenant_id` | integer\|null | Tenant ID (multi-tenant setups) |

### Template Tags Object

When a snippet's `content` references other snippets via `{{snippet: Name}}`, the `template_tags` object describes those references. Empty `{}` when the snippet contains no sub-references.

Each key is the full tag name (e.g. `"snippet: Active Product Filter"`):

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"snippet"` for snippet references |
| `name` | string | Full tag name (matches the key, e.g. `"snippet: Active Product Filter"`) |
| `id` | string (UUID) | Unique tag identifier |
| `display-name` | string | Human-readable display name |
| `snippet-name` | string | The referenced snippet's name |
| `snippet-id` | integer | Numeric ID of the referenced snippet |

---

## Serialization Spec vs API Comparison

The [metabase/representations](https://github.com/metabase/representations) repo defines a portable serialization format. The API adds read-only computed fields on top.

| Field | Serialization Spec | API Response | Notes |
|-------|-------------------|--------------|-------|
| `name` | required | present | Same |
| `entity_id` | required | present (nullable) | Spec requires it; API may return `null` on older snippets |
| `creator_id` | required (email ref) | present (numeric) | Spec uses email; API uses numeric ID |
| `content` | required | present | Same |
| `description` | optional | present | Same |
| `archived` | optional (default false) | present | Same |
| `collection_id` | optional (entity_id ref) | present (numeric) | Spec uses entity_id ref; API uses numeric ID |
| `template_tags` | optional | present | Same shape |
| `created_at` | optional | present | Same |
| `serdes/meta` | required | **absent** | Spec-only: serialization identity path |
| `id` | **absent** | present | API-only: numeric ID |
| `creator` | **absent** | present | API-only: embedded user object |
| `updated_at` | **absent** | present | API-only |
| `dependency_analysis_version` | **absent** | present | API-only |
| `is_remote_synced` | **absent** | present | API-only |

Key differences:

- **Spec uses `entity_id` references** for `collection_id` and `creator_id`; **API uses numeric IDs**
- **`serdes/meta`** is spec-only (serialization identity paths)
- **API embeds a full `creator` object**; spec just stores the creator email
- **API adds `updated_at`**, `dependency_analysis_version`, and `is_remote_synced`

---

## How Snippets Are Used in Native Queries

Snippets are reusable SQL fragments referenced in native queries using the `{{snippet: Name}}` syntax within template tags.

### Reference Syntax

In the SQL of a native query card:

```sql
SELECT *
FROM {{snippet: clm_base_data}}
WHERE {{country}}
  AND {{time_range}}
```

### Template Tag Configuration

Each snippet reference requires a corresponding entry in the query's `template-tags` object:

```json
{
  "snippet: clm_base_data": {
    "type": "snippet",
    "name": "snippet: clm_base_data",
    "id": "01438ecd-34d4-45e8-aa14-44bd56e35d30",
    "snippet-name": "clm_base_data",
    "snippet-id": 1,
    "display-name": "Snippet: Clm Base Data"
  }
}
```

| Field | Description |
|-------|-------------|
| Key | Must match `"snippet: <snippet_name>"` exactly |
| `type` | Always `"snippet"` |
| `name` | Same as the key |
| `snippet-name` | The snippet's `name` field |
| `snippet-id` | The snippet's numeric `id` |
| `id` | UUID for the template tag (unique per reference) |
| `display-name` | Auto-generated display label |

### Snippet Composition (Nesting)

Snippets can reference other snippets within their `content` field. The snippet's `template_tags` object tracks these references:

```json
{
  "name": "active_recent_filter",
  "content": "{{snippet: Active Product Filter}} AND {{snippet: Date Range Filter}}",
  "template_tags": {
    "snippet: Active Product Filter": {
      "type": "snippet",
      "snippet-name": "Active Product Filter",
      "snippet-id": 3
    },
    "snippet: Date Range Filter": {
      "type": "snippet",
      "snippet-name": "Date Range Filter",
      "snippet-id": 4
    }
  }
}
```

Snippets can also contain text-type template tags (e.g., `{{date_column}}`). These are resolved from the card's template tag values when the snippet is embedded in a native query.

**Important:** Snippet nesting is NOT transparent. Metabase does not recursively resolve snippet references. When a card uses a snippet that references other snippets, the card's `template-tags` must declare **all** snippets in the transitive chain — not just the top-level one. For example, if `filtered_orders` references `order_base` and `date_filter`, a card using `filtered_orders` must have template-tags for all three snippets.

### Snippet Collections

Snippets can be organized into snippet-specific collections (separate from the main collection tree). The `collection_id` field on a snippet references a snippet collection, not a regular collection.

- Some instances organize snippets into specific snippet collections (e.g. `collection_id: 185`)
- Others keep all snippets at root level (`collection_id: null`)

---

## JSON Examples

### Full Snippet Response (with template tags)

```json
{
  "description": "Base CTE for dashboard queries - filters orders with common joins and filters",
  "archived": false,
  "dependency_analysis_version": 0,
  "creator": {
    "email": "analyst@example.com",
    "first_name": "Jane",
    "last_login": "2026-04-16T14:09:11.280471Z",
    "is_qbnewb": false,
    "is_superuser": true,
    "id": 1,
    "last_name": "Smith",
    "tenant_id": null,
    "date_joined": "2024-08-30T19:32:52.10722Z",
    "common_name": "Jane Smith"
  },
  "content": "SELECT \n    o.*,\n    p.code AS product_code,\n    ...\nFROM app.orders o\nJOIN app.products p ON o.product_id = p.product_id\nLEFT JOIN app.users u ON o.user_id = u.user_id\nWHERE 1=1\n    [[AND {{is_deleted}}]]\n    [[AND {{time_range}}]]\n    [[AND {{category}}]]",
  "collection_id": null,
  "name": "base_query_data",
  "is_remote_synced": null,
  "creator_id": 1,
  "updated_at": "2026-01-13T00:06:37.66924Z",
  "id": 1,
  "entity_id": "1i5ZTlByUSViLG-HkAXy_",
  "template_tags": {
    "is_deleted": {
      "id": "fd8e707d-db02-4236-84af-8e44db397470",
      "type": "text",
      "name": "is_deleted",
      "display-name": "Is Deleted"
    },
    "time_range": {
      "id": "dedb19b6-d399-4c65-981b-d6d3957c8797",
      "type": "text",
      "name": "time_range",
      "display-name": "Time Range"
    }
  },
  "created_at": "2026-01-12T22:38:11.821904Z"
}
```

### Simple Snippet (no template tags)

```json
{
  "description": "",
  "archived": false,
  "dependency_analysis_version": 5,
  "creator": {
    "email": "admin@example.com",
    "first_name": "John",
    "is_superuser": true,
    "id": 13,
    "last_name": "Doe",
    "common_name": "John Doe"
  },
  "content": "DATE_TRUNC('month', order_date) AS period, ...",
  "collection_id": 185,
  "name": "revenue_analytics_snippet",
  "is_remote_synced": null,
  "creator_id": 13,
  "updated_at": "2026-04-01T17:00:31.70222Z",
  "id": 2,
  "entity_id": null,
  "template_tags": {},
  "created_at": "2022-03-24T12:32:12.536816Z"
}
```

### Minimal POST Request (create)

```json
{
  "name": "my_base_query",
  "content": "SELECT * FROM orders WHERE status = 'active'",
  "description": "Base query for order analysis",
  "collection_id": null
}
```

### Minimal PUT Request (update content)

```json
{
  "content": "SELECT * FROM orders WHERE status = 'active' AND created_at >= CURRENT_DATE - 30"
}
```

### Archive a Snippet

```json
{
  "archived": true
}
```

---

### Name Constraints

From the OpenAPI spec: snippet names **cannot include `}`** and **cannot start with spaces**. This ensures they can be safely embedded in `{{snippet: Name}}` template tag syntax.
