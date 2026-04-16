# Metabase Discovery API Spec

> Reverse-engineered from live Metabase API responses.
> Validated against [Metabase OpenAPI spec](specs/metabase-openapi.yaml) (database, search endpoints).
> Tested across Metabase versions v0.54 through v0.58.

These endpoints are read-only discovery APIs used to explore databases, resolve names to IDs, and search for existing content. They are the foundation for building queries and navigating Metabase programmatically.

## API Endpoints

```
GET  /api/database                      — list all databases
GET  /api/database/:id/metadata         — get tables + fields for a database
GET  /api/search                        — universal search across all models
```

Authentication: `X-API-Key: <token>` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/database` | GET | List all databases the user can access |
| `/api/database/{id}` | GET | Get a single database by ID |
| `/api/database/{id}/metadata` | GET | Get all tables and fields for a database |
| `/api/search` | GET | Search for items across all model types |
| `/api/search/force-reindex` | POST | Trigger immediate search reindexing (admin) |

---

## GET /api/database (List Databases)

Returns all databases the current user has access to.

**Key query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include` | `"tables"\|null` | `null` | Set to `"tables"` to hydrate tables for each database |
| `include_analytics` | boolean\|null | `false` | Include analytics databases |
| `saved` | boolean\|null | `false` | Include the "saved questions" virtual database |

Additional filter parameters: `include_editable_data_model`, `exclude_uneditable_details`, `include_only_uploadable`, `can-query`, `can-write-metadata`.

### Response Shape

```json
{
  "data": [ ... ],
  "total": 10
}
```

### Database Object Schema (key fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Database ID |
| `name` | string | Database display name |
| `engine` | string | Database engine type (see below) |
| `description` | string\|null | Database description |
| `timezone` | string | Database timezone (e.g. `"UTC"`) |
| `is_sample` | boolean | Whether this is the sample database |
| `auto_run_queries` | boolean | Auto-run queries on save |
| `native_permissions` | string | Native query permission level: `"write"` or `"none"` |
| `initial_sync_status` | string | Sync status: `"complete"`, `"incomplete"`, `"aborted"` |
| `features` | array of strings | Database capabilities (e.g. `"basic-aggregations"`, `"native-parameters"`) |
| `can_upload` | boolean | Whether uploads are supported |

Additional fields: `is_full_sync`, `is_on_demand`, `is_audit`, `is_attached_dwh`, `cache_ttl`, `cache_field_values_schedule`, `metadata_sync_schedule`, `creator_id`, `created_at`, `updated_at`, `settings`, `details`, `dbms_version`, `uploads_enabled`, `uploads_schema_name`, `uploads_table_prefix`, `refingerprint`, `provider_name`, `router_database_id`, `router_user_attribute`, `points_of_interest`, `caveats`.

### Engine Types (observed)

| Engine | Description |
|--------|-------------|
| `redshift` | Amazon Redshift |
| `postgres` | PostgreSQL |
| `bigquery-cloud-sdk` | Google BigQuery |
| `h2` | H2 (sample database) |

---

## GET /api/database/{id}/metadata

Returns full metadata for a database including all tables and their fields. This is the primary endpoint for resolving table/field names to numeric IDs needed by MBQL queries.

**WARNING:** This response can be very large (e.g. 100+ MB for large data warehouses with thousands of tables). Always save to file and process with scripts.

**Path parameters:** `id` — integer >= 1.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_hidden` | boolean\|null | `false` | Include hidden tables and fields |
| `include_editable_data_model` | boolean\|null | `false` | Only tables user can edit |
| `remove_inactive` | boolean\|null | `false` | Remove inactive tables/fields |
| `skip_fields` | boolean\|null | `false` | Return tables without fields (much smaller response) |

### Response Shape

The response is a database object (same fields as the list endpoint) with an additional `tables` array:

```json
{
  "id": 2,
  "name": "Analytics DWH",
  "engine": "redshift",
  "tables": [
    {
      "id": 456,
      "name": "fact_orders",
      "schema": "public",
      "fields": [ ... ]
    }
  ]
}
```

### Table Object Schema (key fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Table ID (used in MBQL `source-table`) |
| `name` | string | Table name in the database |
| `display_name` | string | Human-readable display name |
| `schema` | string | Database schema (e.g. `"public"`, `"analytics"`) |
| `db_id` | integer | Parent database ID |
| `description` | string\|null | Table description |
| `entity_type` | string | Entity classification (e.g. `"entity/GenericTable"`) |
| `active` | boolean | Whether the table is active |
| `visibility_type` | string\|null | Visibility: `null` (normal), `"hidden"`, `"technical"`, `"cruft"` |
| `estimated_row_count` | integer\|null | Estimated row count |
| `fields` | array | Array of field objects (see below) |
| `metrics` | array | Metric definitions on this table |
| `segments` | array | Segment definitions on this table |

Additional fields present but rarely needed for query building: `view_count`, `field_order`, `is_upload`, `is_writable`, `is_published`, `collection_id`, `initial_sync_status`, `data_authority`, `data_layer`, `data_source`, `database_require_filter`, `transform_id`, `owner_email`, `owner_user_id`, `archived_at`, `deactivated_at`, `created_at`, `updated_at`.

### Field Object Schema (key fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Field ID (used in MBQL `["field", id, ...]`) |
| `name` | string | Column name in the database |
| `display_name` | string | Human-readable display name |
| `description` | string\|null | Field description |
| `base_type` | string | Metabase base type (see common types below) |
| `effective_type` | string | Effective type after coercion |
| `database_type` | string | Database-native type (e.g. `"bigint"`, `"varchar"`, `"date"`) |
| `semantic_type` | string\|null | Semantic type (e.g. `"type/FK"`, `"type/PK"`, `"type/Category"`) |
| `table_id` | integer | Parent table ID |
| `active` | boolean | Whether the field is active |
| `visibility_type` | string | Visibility: `"normal"`, `"hidden"`, `"details-only"`, `"retired"` |
| `has_field_values` | string | Value strategy: `"list"`, `"search"`, `"none"`, `"auto-list"` |
| `fk_target_field_id` | integer\|null | Foreign key target field ID |
| `fingerprint` | object\|null | Statistical fingerprint (distinct counts, min/max, etc.) |

Additional fields present but rarely needed for query building: `position`, `database_position`, `custom_position`, `preview_display`, `coercion_strategy`, `parent_id`, `nfc_path`, `json_unfolding`, `database_is_pk`, `database_is_auto_increment`, `database_is_nullable`, `database_required`, `database_indexed`, `target`, `settings`, `fingerprint_version`, `last_analyzed`, `created_at`, `updated_at`.

### Common Field Types

Common `base_type` values: `type/Integer`, `type/BigInteger`, `type/Float`, `type/Decimal`, `type/Text`, `type/Boolean`, `type/Date`, `type/DateTime`, `type/DateTimeWithLocalTZ`, `type/Time`, `type/JSON`, `type/Array`.

Common `semantic_type` values: `type/PK`, `type/FK`, `type/Name`, `type/Category`, `type/CreationDate`, `type/CreationTimestamp`, `type/Email`, `type/URL`.

---

## GET /api/search (Universal Search)

Search for items across all Metabase model types. Returns relevance-scored results.

**Key query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string\|null | -- | Search query text |
| `models` | array of strings\|null | all | Filter by model type(s) |
| `archived` | boolean\|null | `false` | Search archived items |
| `collection` | integer\|null | -- | Limit search to a specific collection |
| `table_db_id` | integer\|null | -- | Limit to tables/cards from specific database |
| `search_native_query` | boolean\|null | -- | Also search native query SQL content |
| `include_dashboard_questions` | boolean\|null | `false` | Include dashboard-embedded questions |
| `calculate_available_models` | boolean\|null | -- | Return available models in response |

Additional filter parameters: `filter_items_in_personal_collection`, `created_at`, `created_by`, `last_edited_at`, `last_edited_by`, `display_type`, `verified`, `ids`, `model_ancestors`, `include_metadata`, `context`.

### Searchable Model Types

`card`, `dashboard`, `collection`, `table`, `dataset`, `metric`, `database`, `action`, `segment`, `indexed-entity`, `measure`, `transform`, `document`.

### Response Shape

```json
{
  "data": [ ... ],
  "total": 246,
  "limit": null,
  "offset": null
}
```

The response includes `data` (array of result items), `total` (match count), `limit`/`offset` (pagination), and optionally `models`, `table_db_id`, `engine`.

### Search Result Item Schema (key fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Item ID |
| `name` | string | Item name |
| `model` | string | Item type (e.g. `"dashboard"`, `"card"`, `"table"`) |
| `description` | string\|null | Description |
| `archived` | boolean | Whether archived |
| `can_write` | boolean | Current user can edit |
| `collection` | object\|null | Parent collection: `{id, name, authority_level, type}` |
| `creator_id` | integer | Creator user ID |
| `creator_common_name` | string | Creator display name |
| `last_edited_at` | string\|null (ISO 8601) | Last edit timestamp |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `scores` | array | Relevance scoring breakdown (see below) |

Additional fields: `collection_authority_level`, `collection_position`, `effective_location`, `bookmark`, `last_editor_id`, `last_editor_common_name`, `updated_at`, `moderated_status`, `verified`, `context`, `pk_ref`.

Each result includes a `scores` array with relevance scoring factors (e.g. `recency`, `text`, `view-count`, `user-recency`, `model`). Each score object has `score`, `name`, `weight`, and `contribution` fields. Results are returned sorted by total relevance.

---

## Resolving Names to IDs

MBQL queries require numeric IDs for databases, tables, and fields. The discovery endpoints provide the lookup path:

### Step 1: Find the Database ID

```
GET /api/database
```

Scan the `data` array for the database by `name` or `engine`.

### Step 2: Find the Table ID

```
GET /api/database/{db_id}/metadata?skip_fields=true
```

Use `skip_fields=true` for a much smaller response when you only need table IDs. Scan `tables` array matching by `schema` and `name`.

### Step 3: Find the Field ID

```
GET /api/database/{db_id}/metadata?include_hidden=false
```

For the full response including fields. Find the table, then scan its `fields` array matching by `name`.

### Resolution Example

To resolve `public.fact_orders.order_date`:

```javascript
// 1. Find database
const dbs = await fetch('/api/database').then(r => r.json());
const db = dbs.data.find(d => d.name === 'Analytics DWH'); // id: 2

// 2. Find table + field from metadata
const meta = await fetch(`/api/database/${db.id}/metadata?include_hidden=false`).then(r => r.json());
const table = meta.tables.find(t => t.schema === 'public' && t.name === 'fact_orders');
const field = table.fields.find(f => f.name === 'order_date');

// Result: database_id=2, table_id=table.id, field_id=field.id
// Use in MBQL: ["field", field.id, {"base-type": field.base_type}]
```

### Using Search as a Shortcut

For finding cards or dashboards by name, search is faster than traversing collections:

```
GET /api/search?q=sales+report&models=dashboard
```

This returns results with IDs, collection info, and relevance scores -- useful for quickly locating specific items without navigating the full collection tree.

---

## JSON Examples

### Database List Response

```json
{
  "data": [
    {
      "id": 2,
      "name": "Analytics DB",
      "engine": "postgres",
      "timezone": "UTC",
      "is_sample": false,
      "is_full_sync": true,
      "auto_run_queries": true,
      "native_permissions": "write",
      "initial_sync_status": "complete",
      "can_upload": false,
      "created_at": "2024-08-30T19:33:38.399Z"
    },
    {
      "id": 3,
      "name": "Data Warehouse (dev)",
      "engine": "redshift"
    },
    {
      "id": 4,
      "name": "Data Warehouse (prod)",
      "engine": "redshift"
    }
  ],
  "total": 4
}
```

### Search Result

```json
{
  "data": [
    {
      "id": 109,
      "name": "Sales Dashboard v1.0",
      "model": "dashboard",
      "description": "",
      "archived": false,
      "can_write": true,
      "collection": {
        "id": 8,
        "name": "Sales Reports",
        "authority_level": "official",
        "type": null
      },
      "creator_id": 2,
      "creator_common_name": "Jane Smith",
      "last_editor_common_name": "John Doe",
      "last_edited_at": "2026-02-23T15:15:20.116107Z",
      "created_at": "2022-04-23T11:19:19.293662Z",
      "scores": [
        {"score": 0.669, "name": "text", "weight": 5, "contribution": 3.34},
        {"score": 0.995, "name": "user-recency", "weight": 5, "contribution": 4.97}
      ]
    }
  ],
  "total": 246,
  "limit": null,
  "offset": null
}
```

---

## Performance Notes

- `/api/database` -- fast, small response (~10-25 KB)
- `/api/database/{id}/metadata` -- can be extremely large for data warehouses. Use `skip_fields=true` when you only need table names/IDs
- `/api/search` -- fast, returns up to ~250 results by default with relevance scoring
- For LLM-based tooling: always save metadata to disk, never load the full response into context. Use targeted lookups by schema + table name.
