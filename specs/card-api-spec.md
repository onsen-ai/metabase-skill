# Metabase Card API Spec

> Reverse-engineered from multiple standalone card responses across production Metabase instances.
> Cross-referenced with [metabase/representations](https://github.com/metabase/representations/blob/main/core-spec/v1/schemas/card.yaml) serialization schema.
> Validated against [Metabase OpenAPI spec](specs/metabase-openapi.yaml) (`POST /api/card` and `PUT /api/card/{id}` request body schemas).
> MBQL/native query reference from [representations spec.md](https://github.com/metabase/representations/blob/main/core-spec/v1/spec.md).

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/card` | POST | Create a new card |
| `/api/card/{id}` | GET | Get card by ID. As of v57, returns MBQL 5 format; use `?legacy-mbql=true` for MBQL 4. |
| `/api/card/{id}` | PUT | Update a card. All fields optional. |
| `/api/card/{id}` | DELETE | Hard delete. To soft delete, use PUT with `archived: true`. |
| `/api/card/{id}/copy` | POST | Copy card. New name becomes "Copy of _name_". |
| `/api/card/{id}/query` | POST | Execute card's query and return results. |
| `/api/card/{id}/series` | GET | Find compatible cards for series overlay on dashboards. |

---

## Card Types

Cards have three types, set via the `type` field:

| Type | Description | Usage |
|------|-------------|-------|
| `question` | Standard saved question (default) | Any display type, any query |
| `model` | Curated dataset | Becomes a reusable data source via `source-card` in other queries |
| `metric` | Reusable aggregation | Referenced via `["metric", {}, <card_id>]` in other queries' aggregation clauses |

**Response differences by type:**

- `question` — 54 top-level keys (standard)
- `metric` — 55 keys (adds `query_description`: auto-generated human-readable summary of the MBQL query)
- `model` — 55 keys (adds `persisted`: boolean, whether the model is persisted/cached)

---

## POST /api/card (Create)

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string (min 1 char) | Card name |
| `dataset_query` | object | Query definition (MBQL or native SQL) |
| `display` | string (min 1 char) | Visualization type (see Display Types) |
| `visualization_settings` | object | Display settings (can be `{}`) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"question"\|"model"\|"metric"` | Card type (default: `"question"`) |
| `description` | string\|null | Card description |
| `collection_id` | integer\|null | Parent collection (null = root) |
| `collection_position` | integer\|null | Position within collection |
| `dashboard_id` | integer\|null | Nest card under a dashboard |
| `dashboard_tab_id` | integer\|null | Specific tab within dashboard |
| `parameters` | array\|null | Card-level parameters |
| `parameter_mappings` | array\|null | Parameter mappings (usually empty) |
| `result_metadata` | array\|null | Column metadata (auto-generated if omitted) |
| `cache_ttl` | integer\|null | Cache TTL in seconds |
| `entity_id` | string\|null | Custom entity ID (NanoID) |

## PUT /api/card/{id} (Update)

All fields optional. Same fields as POST, plus:

| Field | Type | Description |
|-------|------|-------------|
| `archived` | boolean\|null | Soft delete / restore |
| `collection_preview` | boolean\|null | Show in collection preview |
| `enable_embedding` | boolean\|null | Enable static embedding |
| `embedding_type` | string\|null | `"sdk"\|"standalone"` |
| `embedding_params` | object\|null | Per-parameter embedding config (`"disabled"\|"enabled"\|"locked"`) |

Query parameter: `?delete_old_dashcards=true|false` — when changing a card's query, optionally clean up stale dashcard references.

---

## GET /api/card/{id} (Response)

The full response has **54-55 top-level fields** (54 for questions, 55 for metrics and models -- see Card Types above). Split into writable and read-only:

### Writable Fields (accepted on POST/PUT)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Card name |
| `description` | string\|null | Description |
| `display` | string | Visualization type |
| `type` | string | `"question"`, `"model"`, or `"metric"` |
| `dataset_query` | object | Query definition |
| `visualization_settings` | object | Display settings |
| `collection_id` | integer\|null | Parent collection |
| `collection_position` | integer\|null | Position in collection |
| `dashboard_id` | integer\|null | Parent dashboard |
| `dashboard_tab_id` | integer\|null | Tab within dashboard |
| `parameters` | array\|null | Card-level parameters |
| `parameter_mappings` | array\|null | Parameter mappings |
| `result_metadata` | array\|null | Column metadata |
| `cache_ttl` | integer\|null | Cache TTL |
| `archived` | boolean | Archive status |
| `collection_preview` | boolean | Show in collection preview |
| `enable_embedding` | boolean | Embedding enabled |
| `embedding_type` | string\|null | Embedding mode |
| `embedding_params` | object\|null | Embedding parameter config |

### Read-Only Fields (returned on GET, ignored on PUT)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Card ID |
| `entity_id` | string\|null | NanoID entity identifier |
| `creator_id` | integer | Creator user ID |
| `creator` | object | `{id, email, first_name, last_name, ...}` |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `updated_at` | string (ISO 8601) | Last update timestamp |
| `last_used_at` | string (ISO 8601) | Last time card was used |
| `last_query_start` | string (ISO 8601) | Last query execution start |
| `query_type` | string\|null | `"query"` (MBQL) or `"native"` (SQL) |
| `database_id` | integer | Source database ID |
| `table_id` | integer\|null | Source table ID |
| `source_card_id` | integer\|null | Source card for model-based queries |
| `card_schema` | integer | Internal schema version (e.g. `23`) |
| `metabase_version` | string\|null | Metabase version when last saved |
| `legacy_query` | string\|null | Legacy MBQL 4 query as JSON string |
| `view_count` | integer | Total view count |
| `average_query_time` | number | Average query duration in ms |
| `dashboard_count` | integer | Number of dashboards using this card |
| `parameter_usage_count` | integer | Parameter usage count |
| `can_write` | boolean | Current user can edit |
| `can_delete` | boolean | Current user can delete |
| `can_restore` | boolean | Current user can restore |
| `can_run_adhoc_query` | boolean | Current user can run ad-hoc queries |
| `can_manage_db` | boolean | Current user can manage the database |
| `collection` | object | Parent collection details |
| `dashboard` | object\|null | Parent dashboard details |
| `last-edit-info` | object | `{id, email, first_name, last_name, timestamp}` |
| `param_fields` | object | Field definitions for parameters |
| `moderation_reviews` | array | Moderation reviews |
| `public_uuid` | string\|null | Public sharing UUID |
| `made_public_by_id` | integer\|null | User who made it public |
| `is_remote_synced` | boolean | Remote sync status |
| `archived_directly` | boolean | Archived directly vs inherited |
| `initially_published_at` | string\|null | First publish timestamp |
| `dependency_analysis_version` | integer | Internal version tracker |
| `document_id` | null | Document reference |
| `cache_invalidated_at` | string\|null | Cache invalidation timestamp |
| `query_description` | string\|null | Auto-generated human-readable description of MBQL queries |
| `persisted` | boolean | Whether the model is persisted/cached (model type only) |
| `download_perms` | string | Download permissions: `"full"` or `"none"` |

Note: Not all fields appear on every card. `query_description` is only present on metric cards, `persisted` only on model cards. The observed count is 54 keys for questions, 55 for metrics and models.

---

## Serialization Spec vs API Comparison

Key differences:

- **Spec uses `entity_id` references** for collections, tables, and source cards; **API uses numeric IDs** throughout
- **`serdes/meta`** is spec-only (serialization identity); the API adds read-only computed fields (`can_write`, `view_count`, `creator`, etc.)
- Core writable fields (`name`, `display`, `dataset_query`, `visualization_settings`, `type`) are consistent between spec and API

---

## Display Types

26 display types from the card schema:

| Display | Category | Description |
|---------|----------|-------------|
| `table` | Data | Data table |
| `bar` | Chart | Vertical bar chart |
| `line` | Chart | Line chart |
| `area` | Chart | Area chart |
| `row` | Chart | Horizontal bar chart |
| `pie` | Chart | Pie / donut chart |
| `scalar` | Number | Single number |
| `smartscalar` | Number | Number with trend comparison |
| `number` | Number | Number display (alias for scalar) |
| `combo` | Chart | Combined line + bar |
| `pivot` | Data | Pivot table |
| `funnel` | Chart | Funnel chart |
| `map` | Spatial | Geographic map |
| `scatter` | Chart | Scatter plot (`scatter.bubble`: string\|null — column for bubble size) |
| `waterfall` | Chart | Waterfall chart |
| `progress` | Number | Progress bar |
| `gauge` | Number | Gauge / dial |
| `object` | Data | Detail / object view |
| `list` | Data | List view |
| `heading` | Virtual | Section heading (dashboard only) |
| `text` | Virtual | Text / markdown block (dashboard only) |
| `link` | Virtual | Link card (dashboard only) |
| `iframe` | Virtual | Embedded iframe (dashboard only) |
| `action` | Interactive | Action button |
| `sankey` | Chart | Sankey diagram |
| `boxplot` | Chart | Box plot |

---

## dataset_query — MBQL Format

Used when `query_type` is `"query"`. Structured query using Metabase Query Language (pMBQL).

### Structure

```json
{
  "lib/type": "mbql/query",
  "database": 2,
  "stages": [
    {
      "lib/type": "mbql.stage/mbql",
      "source-table": 456,
      "aggregation": [...],
      "breakout": [...],
      "filter": [...],
      "joins": [...],
      "expressions": {...},
      "order-by": [...],
      "limit": 100
    }
  ]
}
```

Stages are flat (not nested) — each stage operates on the result of the previous.

**Format on creation:** The API accepts both legacy format (`{"database": 1, "type": "query", "query": {...}}`) and pMBQL format (`{"lib/type": "mbql/query", "stages": [...]}`) on POST and PUT. Metabase internally stores pMBQL (v0.57+). When using pMBQL, all `lib/uuid` values **must be valid UUID format** (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`) — invalid UUIDs cause silent query execution failures.

### Data Sources (mutually exclusive per stage)

| Field | Type | Description |
|-------|------|-------------|
| `source-table` | integer | Table ID |
| `source-card` | integer | Saved question/model card ID |

`source-card` references a saved question or model by its numeric card ID. This is how model cards are consumed — create a model, then reference it via `"source-card": <model_card_id>` in other cards' queries.

### Field References

Three-element clause: `["field", <options>, <field_id>]`

Two formats coexist (both valid):

Newer (v0.54+): options object first, field_id second:

```json
["field", {"base-type": "type/Integer", "lib/uuid": "...", "temporal-unit": "day"}, 101]
```

Older (pre-v0.54): field_id first, options second:

```json
["field", 101, {"base-type": "type/Integer"}]
```

**Field options:**

| Option | Type | Description |
|--------|------|-------------|
| `base-type` | string | e.g. `type/Float`, `type/Integer`, `type/Text`, `type/Date` |
| `effective-type` | string | Runtime effective type |
| `temporal-unit` | string | Temporal bucketing (see below) |
| `join-alias` | string | References a join alias |
| `binning` | object | `{strategy, num-bins}` or `{strategy, bin-width}` |
| `source-field` | integer | FK field ID for implicit joins |
| `lib/uuid` | string | UUID for cross-referencing |

**Other reference types:**

- `expression` -- computed column
- `aggregation` -- aggregation reference (matches `lib/uuid`)
- `metric` -- metric card reference

```json
["expression", {}, "ExpressionName"]
["aggregation", {}, "uuid-string"]
["metric", {"lib/uuid": "..."}, 501]
```

### Aggregation Functions

| Function | Arguments | Description |
|----------|-----------|-------------|
| `count` | none or field | Row count |
| `sum` | field | Sum |
| `avg` | field | Average |
| `min` | field | Minimum |
| `max` | field | Maximum |
| `distinct` | field | Distinct count |
| `cum-count` | none or field | Cumulative count |
| `cum-sum` | field | Cumulative sum |
| `stddev` | field | Standard deviation |
| `var` | field | Variance |
| `median` | field | Median |
| `percentile` | field, p (0.0-1.0) | Percentile |
| `count-where` | filter | Conditional count |
| `sum-where` | field, filter | Conditional sum |
| `share` | filter | Fraction matching filter |
| `offset` | field, n | Value from n rows before/after |
| `metric` | metric_card_id | Reference to a metric card |

Aggregation format: `["sum", {"lib/uuid": "..."}, ["field", {options}, field_id]]`

Aggregation options can include `display-name` and `name` for custom labels.

**Computed expressions using metrics:**

```json
["/", {"lib/uuid": "...", "display-name": "Conversion Rate"},
  ["metric", {"lib/uuid": "..."}, 502],
  ["metric", {"lib/uuid": "..."}, 503]]
```

### Breakout

Same as field references. Equivalent to SQL `GROUP BY`. Commonly with `temporal-unit`:

```json
["field", {"lib/uuid": "...", "temporal-unit": "month"}, 101]
```

### Filter Operators

**Logical:** `and`, `or`, `not`

**Comparison:** `=`, `!=`, `<`, `>`, `<=`, `>=`, `between`, `inside`

**Null/Empty:** `is-null`, `not-null`, `is-empty`, `not-empty`

**String:** `contains`, `does-not-contain`, `starts-with`, `ends-with` (support `case-sensitive` option)

**Set:** `in`, `not-in`

**Temporal:** `time-interval` (n = integer, `current`, `last`, `next`; option `include-current`), `relative-time-interval`

**Segment:** `segment` (references saved segment by ID)

Filter format: `["=", {}, ["field", {options}, field_id], value]`

### Expression Operators

**Arithmetic:** `+`, `-`, `*`, `/`

**Math:** `abs`, `ceil`, `floor`, `round`, `power`, `sqrt`, `exp`, `log`

**String:** `concat`, `substring`, `replace`, `regex-match-first`, `split-part`, `trim`, `ltrim`, `rtrim`, `upper`, `lower`, `length`, `host`, `domain`, `subdomain`, `path`

**Temporal:** `now`, `today`, `interval`, `datetime-add`, `datetime-subtract`, `datetime-diff`, `convert-timezone`, `get-year`, `get-quarter`, `get-month`, `get-day`, `get-hour`, `get-minute`, `get-second`, `get-day-of-week`, `get-week`, `temporal-extract`, `month-name`, `quarter-name`, `day-name`

**Type conversion:** `integer`, `float`, `text`, `date`, `datetime`

**Conditional:** `case` (alias: `if`), `coalesce`

### Temporal Bucketing Units

**Truncation:** `default`, `millisecond`, `second`, `minute`, `hour`, `day`, `week`, `month`, `quarter`, `year`

**Extraction:** `minute-of-hour`, `hour-of-day`, `day-of-week`, `day-of-week-iso`, `day-of-month`, `day-of-year`, `week-of-year`, `week-of-year-iso`, `month-of-year`, `quarter-of-year`, `year-of-era`

### Binning Strategies

| Strategy | Extra prop | Description |
|----------|-----------|-------------|
| `num-bins` | `num-bins` (int) | Fixed number of equal-width bins |
| `bin-width` | `bin-width` (number) | Fixed width per bin |
| `default` | — | Metabase auto-selects |

### Joins

```json
{
  "joins": [{
    "stages": [{"lib/type": "mbql.stage/mbql", "source-table": 789}],
    "conditions": [["=", {}, ["field", {}, 101], ["field", {"join-alias": "Products"}, 201]]],
    "alias": "Products",
    "strategy": "left-join",
    "fields": "all"
  }]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stages` | array | yes | Query stages for the join source |
| `conditions` | array | yes | Join conditions (filter clauses) |
| `alias` | string | yes | Alias for referencing joined fields |
| `strategy` | string | yes | `"left-join"`, `"right-join"`, `"inner-join"`, `"full-join"` |
| `fields` | string\|array | no | `"all"`, `"none"`, or array of field clauses |

### Order By

```json
{"order-by": [["asc", {}, ["field", {options}, field_id]]]}
```

Direction: `"asc"` or `"desc"`. Can reference fields or aggregation UUIDs.

### Limit

`"limit": <integer | null>`

---

## dataset_query — Native SQL Format

Used when `query_type` is `"native"`. Raw SQL with optional template tags.

### Structure

```json
{
  "lib/type": "mbql/query",
  "database": 2,
  "stages": [{
    "lib/type": "mbql.stage/native",
    "native": "SELECT date, SUM(sales) FROM orders WHERE {{country}} GROUP BY date",
    "template-tags": {
      "country": {
        "type": "dimension",
        "name": "country",
        "id": "12ea3f64-...",
        "display-name": "Country",
        "widget-type": "string/=",
        "dimension": ["field", {"base-type": "type/Text"}, 3867]
      }
    }
  }]
}
```

### Template Tag Types

| Type | Purpose | SQL syntax | Extra required fields |
|------|---------|-----------|----------------------|
| `text` | String variable (quoted) | `{{name}}` | — |
| `number` | Numeric variable (unquoted) | `{{name}}` | — |
| `date` | Date variable (quoted) | `{{name}}` | — |
| `boolean` | Boolean (`1=1` / `1<>1`) | `{{name}}` | — |
| `dimension` | Field filter (smart widget) | `{{name}}` | `dimension`, `widget-type` |
| `temporal-unit` | Time granularity selector | `{{name}}` | `dimension`, optional `alias` |
| `card` | CTE subquery | `{{#card-id-slug}}` | `card-id` |
| `snippet` | Inline SQL fragment | `{{snippet: Name}}` | `snippet-name`, `snippet-id` |

### Template Tag Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Tag type (see above) |
| `name` | string | yes | Tag name (matches `{{name}}` in SQL) |
| `id` | string (UUID) | yes | Unique identifier |
| `display-name` | string | no | Human-readable label |
| `widget-type` | string | no | Filter widget type (e.g. `"string/="`, `"date/all-options"`, `"date/month-year"`) |
| `dimension` | array | conditional | Field reference (required for `dimension` and `temporal-unit`) |
| `default` | string\|array | no | Default value |
| `required` | boolean | no | Whether tag must have a value |
| `alias` | string | no | SQL column alias (for `temporal-unit`) |
| `card-id` | integer | card only | Referenced card ID |
| `snippet-name` | string | snippet only | Snippet name |
| `snippet-id` | integer | snippet only | Snippet ID |

### Parameterized SQL: Variables, Field Filters, and Optional Clauses

Metabase native queries support three patterns for parameterization. Understanding the differences is critical for writing correct, filterable SQL.

#### Basic Variables (`text`, `number`, `date`, `boolean`)

Basic variables do **simple substitution** — Metabase inserts the value directly into the SQL. You write the column and operator yourself:

```sql
SELECT * FROM orders WHERE status = {{status}}
```

When the user provides `"completed"`, Metabase generates: `WHERE status = 'completed'`

If no value is provided and the variable is not required, the query **fails** unless you wrap it in optional clause syntax.

#### Optional Clauses `[[ ]]`

Double brackets make an entire SQL section conditional. If the variable inside has no value, the entire bracketed section is removed:

```sql
SELECT * FROM orders
WHERE created_at > {{start_date}}
  [[AND status = {{status}}]]
  [[AND category = {{category}}]]
```

- If user provides `status` and `category`: both AND clauses are included
- If user provides only `status`: the category clause is removed entirely
- If user provides neither: both AND clauses are removed

**Use `[[ ]]` with basic variable types** (text, number, date) to make filters optional.

#### Field Filters (`dimension` type) — The Smart Pattern

Field filters are fundamentally different — Metabase generates the **entire WHERE condition** (column, operator, and value) for you. You supply only the variable, not the column or operator:

```sql
-- CORRECT: field filter syntax (no column, no operator)
SELECT * FROM orders WHERE {{created_at_filter}}

-- WRONG: this will NOT work for field filters
SELECT * FROM orders WHERE created_at = {{created_at_filter}}
```

**Why this matters:** Field filters handle complex scenarios automatically:
- **Multi-select**: User picks 3 categories → Metabase generates `WHERE category IN ('A', 'B', 'C')`
- **Date ranges**: User picks "Last 30 days" → Metabase generates `WHERE created_at >= DATEADD('day', -30, CURRENT_DATE())`
- **No value**: If no value provided, the WHERE clause is **omitted entirely** — field filters are optional by default

**Combining field filters with other conditions:**

```sql
SELECT * FROM orders
WHERE {{date_range}}
  AND status = 'completed'
  [[AND {{category}}]]
```

Here `{{date_range}}` is a required field filter (generates a date condition), `{{category}}` is an optional field filter wrapped in `[[ ]]` (the `AND` is removed if no category selected).

#### Field Filter Configuration (template tag)

```json
{
  "date_range": {
    "type": "dimension",
    "name": "date_range",
    "id": "uuid-here",
    "display-name": "Date Range",
    "widget-type": "date/all-options",
    "dimension": ["field", {"base-type": "type/Date"}, 1234],
    "required": true,
    "default": "past30days~"
  },
  "category": {
    "type": "dimension",
    "name": "category",
    "id": "uuid-here",
    "display-name": "Category",
    "widget-type": "string/=",
    "dimension": ["field", {"base-type": "type/Text"}, 5678]
  }
}
```

#### Widget Types for Field Filters

The `widget-type` determines the filter UI. Common types:

| Widget Type | For | Description |
|-------------|-----|-------------|
| `string/=` | Text fields | Dropdown or search box (auto-search if >300 distinct values) |
| `string/!=` | Text fields | Exclude values |
| `string/contains` | Text fields | Substring search |
| `boolean/=` | Boolean fields | True/false toggle |
| `date/all-options` | Date fields | Full date picker (relative, range, specific) |
| `date/range` | Date fields | Date range picker |
| `date/single` | Date fields | Single date |
| `date/month-year` | Date fields | Month+year picker |
| `date/quarter-year` | Date fields | Quarter+year picker |
| `date/relative` | Date fields | Relative date (last N days/weeks/months) |
| `number/=` | Number fields | Exact number match |
| `number/!=` | Number fields | Number not equal |
| `number/between` | Number fields | Number range |

#### Default Value Formats (observed in production)

| Type | Default Format | Example |
|------|---------------|---------|
| No default | `null` or absent | — |
| Boolean | Array with single value | `[false]` |
| String | `null` (no default) or string | `null` |
| Date (relative) | Relative date string | `"past30days~"`, `"past7days"`, `"past7days-from-7days"` |
| Text variable | Array | `["model"]` |
| Temporal unit | String | `"day"` |

#### Table Alias Requirement

When using field filters with table aliases, CTEs, or subqueries, you must specify the alias so Metabase generates correct SQL. Set the `alias` field in the template tag:

```json
{
  "category": {
    "type": "dimension",
    "name": "category",
    "alias": "p.category",
    "dimension": ["field", {"base-type": "type/Text"}, 5678],
    "widget-type": "string/="
  }
}
```

Without the alias, Metabase may generate `WHERE products.category = ...` instead of `WHERE p.category = ...`, causing SQL errors.

#### Dashboard Parameter → Field Filter Wiring

When a native SQL card with field filters is placed on a dashboard, the dashboard parameter maps to the template tag:

```json
{
  "parameter_id": "date_filter_param",
  "card_id": 123,
  "target": ["dimension", ["template-tag", "date_range"], {"stage-number": 0}]
}
```

The dashboard parameter's type should match the template tag's widget-type (e.g., `date/all-options` dashboard parameter → `date/all-options` widget-type on the template tag).

### Snippet Example

```sql
SELECT * FROM {{snippet: clm_base_data}} WHERE {{country}}
```

```json
{
  "snippet: clm_base_data": {
    "type": "snippet",
    "name": "snippet: clm_base_data",
    "id": "01438ecd-...",
    "snippet-name": "clm_base_data",
    "snippet-id": 1,
    "display-name": "Snippet: Clm Base Data"
  }
}
```

**Snippet nesting:** Snippets can reference other snippets in their `content` field (e.g., `{{snippet: Other Snippet}}`). However, **nesting is NOT transparent** — Metabase does not recursively resolve snippet references automatically. Every snippet referenced transitively must be declared as a `template-tag` at the **card level**. If snippet A references snippet B and snippet C, a card using snippet A must declare template-tags for all three: A, B, and C (the full transitive closure).

### Card Reference Example

```sql
WITH base AS {{#123-monthly-orders}} SELECT * FROM base WHERE date > {{start_date}}
```

---

## Visualization Settings Reference

Per-display-type settings. These apply at both the card level (`card.visualization_settings`) and the dashcard level (dashcard `visualization_settings` as overrides).

### Graph Settings (line, bar, area, combo, scatter, waterfall, row, boxplot)

| Setting | Type | Values/Description |
|---------|------|--------------------|
| `graph.dimensions` | array of strings | Dimension column names (x-axis) |
| `graph.metrics` | array of strings | Metric column names (y-axis) |
| `graph.show_values` | boolean | Show data point values |
| `graph.show_trendline` | boolean | Show trend line |
| `graph.show_goal` | boolean | Show goal line |
| `graph.goal_value` | number | Goal line value |
| `graph.goal_label` | string | Goal line label |
| `graph.show_stack_values` | string | `"total"`, `"individual"`, `"all"` |
| `graph.label_values_frequency` | string | `"fit"`, `"all"`. Also seen as `graph.label_value_frequency` (without 's') in some Metabase versions. |
| `graph.label_value_formatting` | string | `"full"`, `"compact"` |
| `graph.x_axis.title_text` | string | X-axis title |
| `graph.x_axis.scale` | string | `"ordinal"`, `"histogram"`, `"timeseries"`, `"linear"`, `"pow"`, `"log"` |
| `graph.x_axis.axis_enabled` | boolean\|string | `true`, `false`, `"compact"`, `"rotate-45"`, `"rotate-90"` |
| `graph.x_axis.labels_enabled` | boolean | Show x-axis labels |
| `graph.y_axis.title_text` | string | Y-axis title |
| `graph.y_axis.scale` | string | `"linear"`, `"pow"`, `"log"` |
| `graph.y_axis.auto_range` | boolean | Auto-calculate range |
| `graph.y_axis.auto_split` | boolean | Auto-split dual y-axes |
| `graph.y_axis.min` / `.max` | number | Y-axis range |
| `graph.y_axis.labels_enabled` | boolean | Show y-axis labels |
| `graph.y_axis.axis_enabled` | boolean | Show y-axis |
| `graph.series_order` | array\|null | Custom series display order |
| `graph.series_order_dimension` | string\|null | Dimension for series ordering |
| `graph.tooltip_columns` | array | Columns to show in tooltips |
| `graph.max_categories_enabled` | boolean | Enable max categories |
| `graph.max_categories` | number | Max categories to show |
| `graph.other_category_aggregation_fn` | string | `"sum"`, `"avg"`, `"min"`, `"max"` |
| `stackable.stack_type` | string\|null | `null`, `"stacked"`, `"normalized"` |

### Series Settings

Per-series overrides, keyed by series name in `series_settings`:

| Setting | Type | Values |
|---------|------|--------|
| `display` | string | Override chart type |
| `color` | string (hex) | Series color |
| `title` | string | Custom series label |
| `line.style` | string | `"solid"`, `"dashed"`, `"dotted"` |
| `line.size` | string | `"S"`, `"M"`, `"L"` |
| `line.interpolate` | string | `"linear"`, `"cardinal"`, `"step-before"`, `"step-after"` |
| `line.missing` | string | `"interpolate"`, `"zero"`, `"none"` |
| `line.marker_enabled` | boolean | Show data point markers |
| `axis` | string | `"left"`, `"right"` |
| `show_series_values` | boolean | Show values for this series |

### Column Settings

Per-column formatting, keyed by `'["name","COLUMN_NAME"]'` in `column_settings`:

| Setting | Type | Description |
|---------|------|-------------|
| `number_style` | string | `"currency"`, `"decimal"`, `"percent"`, `"scientific"` |
| `currency` | string | Currency code (e.g. `"GBP"`, `"USD"`) |
| `currency_style` | string | `"symbol"`, `"code"`, `"name"` |
| `number_separators` | string | e.g. `".,"` |
| `decimals` | number | Decimal places |
| `scale` | number | Multiply by factor |
| `prefix` | string | Prefix text |
| `suffix` | string | Suffix text |
| `column_title` | string | Override column header |
| `date_style` | string | Date format pattern |
| `date_separator` | string | Date separator character |
| `date_abbreviate` | boolean | Abbreviate month/day names |
| `time_enabled` | string\|null | `null`, `"minutes"`, `"seconds"`, `"milliseconds"` |
| `time_style` | string | Time format |
| `view_as` | string | `"link"`, `"image"`, `"email"`, `"auto"` |
| `link_text` | string | Custom link text |
| `link_url` | string | Custom link URL |
| `currency_in_header` | boolean | Show currency symbol in column header vs each cell |
| `show_mini_bar` | boolean | Show inline bar chart in table cells proportional to value |

### Table Settings

| Setting | Type | Description |
|---------|------|-------------|
| `table.columns` | array | `[{name, enabled}]` column visibility/ordering |
| `table.column_formatting` | array | Conditional formatting rules |
| `table.cell_column` | string | Column displayed in cells |
| `table.pivot` | boolean | Enable pivot mode |
| `table.pivot_column` | string | Column for pivoting |
| `table.column_widths` | array | Explicit column widths (pixels) |
| `table.row_index` | boolean | Show row numbers |
| `table.pagination` | boolean | Enable pagination |

**Conditional formatting types:**
- `single`: operators `=`, `!=`, `<`, `>`, `<=`, `>=`, `is-null`, `not-null`
- `range`: `colors` array, `min_type`/`max_type` (`"min"`, `"max"`, `"custom"`), `min_value`/`max_value`

### Pivot Table Settings

| Setting | Type | Description |
|---------|------|-------------|
| `pivot_table.column_split` | object | `{rows: [...], columns: [...], values: [...]}` |
| `pivot_table.collapsed_rows` | object | Collapsed row config |
| `pivot_table.show_row_totals` | boolean | Show row totals |
| `pivot_table.show_column_totals` | boolean | Show column totals |

### Scalar / Number Settings

| Setting | Type | Description |
|---------|------|-------------|
| `scalar.field` | string | Column name to display (for multi-column queries) |
| `scalar.switch_positive_negative` | boolean | Invert positive/negative coloring |
| `scalar.compact_primary_number` | string | `"auto"`, `"yes"`, `"no"` |

### Smart Scalar Settings

| Setting | Type | Description |
|---------|------|-------------|
| `scalar.comparisons` | array | Comparison objects (see below) |

Comparison types: `{"id": "uuid", "type": "previousPeriod"}`, `{"type": "periodsAgo", "value": 12}`, `{"type": "staticNumber", "value": 100, "label": "Target"}`

### Pie Chart Settings

| Setting | Type | Description |
|---------|------|-------------|
| `pie.dimension` | string | Dimension column |
| `pie.metric` | string | Metric column |
| `pie.show_legend` | boolean | Show legend |
| `pie.show_total` | boolean | Show total in center |
| `pie.percent_visibility` | string | `"off"`, `"legend"`, `"inside"`, `"both"` |
| `pie.slice_threshold` | number | Min % to show as separate slice |
| `pie.colors` | object | Map of dimension value to hex color |

### Map Settings

Key settings: `map.type` (`"region"`, `"pin"`, `"grid"`), `map.latitude_column`, `map.longitude_column`, `map.metric_column`, `map.region`, `map.pin_type` (`"tiles"`, `"markers"`, `"heat"`), `map.zoom`, `map.center_latitude`, `map.center_longitude`.

### Funnel Settings

Key settings: `funnel.dimension`, `funnel.metric`, `funnel.type` (`"funnel"`, `"bar"`).

### Waterfall Settings

Key settings: `waterfall.increase_color`, `waterfall.decrease_color`, `waterfall.total_color` (hex colors), `waterfall.show_total` (boolean).

### Gauge Settings

Key settings: `gauge.segments` (array of `{min, max, color, label}`), `gauge.segment_colors`.

### Sankey Settings

Key settings: `sankey.source`, `sankey.target`, `sankey.value` (column names), `sankey.node_align` (`"left"`, `"right"`, `"center"`, `"justify"`), `sankey.show_edge_labels`.

### BoxPlot Settings

Key settings: `boxplot.whisker_type` (`"min-max"`, `"tukey"`, `"percentile"`), `boxplot.points_mode` (`"none"`, `"outliers"`, `"all"`), `boxplot.show_mean`.

### Progress Settings

Key settings: `progress.color` (hex), `progress.goal` (number).

### Click Behavior (dashcard-level)

Dashcard `visualization_settings` can include `click_behavior` to define interactive click actions on chart elements or table cells.

```json
{
  "click_behavior": {
    "type": "link",
    "linkType": "url",
    "linkTemplate": "https://example.com/orders/{{ORDER_ID}}"
  }
}
```

Types:

| Type | linkType | Description |
|------|----------|-------------|
| `link` | `url` | Navigate to external URL (supports `{{column}}` template variables) |
| `link` | `dashboard` | Navigate to another dashboard with parameter passthrough |
| `link` | `question` | Navigate to another saved question |
| `crossfilter` | — | Filter other cards on the same dashboard |

Dashboard/question link example with parameter mapping:

```json
{
  "click_behavior": {
    "type": "link",
    "linkType": "dashboard",
    "targetId": 42,
    "parameterMapping": {
      "param_id": {"source": {"type": "column", "id": "CATEGORY", "name": "Category"}, "target": {"type": "parameter", "id": "cat_filter"}, "id": "param_id"}
    }
  }
}
```

---

## Payload Size Considerations

Standalone card responses are much smaller than dashboard payloads but still significant:

| Card Type | Typical Size |
|-----------|-------------|
| Simple MBQL question | 3-8 KB |
| Native SQL with template tags | 5-25 KB |
| Large native SQL with many columns | 25-55 KB |
| Metric card | 2-4 KB |

The largest contributors to card size are `result_metadata` (column statistics) and `dataset_query` (especially native SQL strings). For the CLI, summary mode should strip `result_metadata`, `legacy_query`, `param_fields`, `creator`, `collection`, and `last-edit-info`.
