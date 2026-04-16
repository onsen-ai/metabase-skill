# Metabase Dashboard API Spec

> Reverse-engineered from live Metabase API responses (multiple production dashboards).
> Cross-referenced with [metabase/representations](https://github.com/metabase/representations/blob/main/core-spec/v1/schemas/dashboard.yaml) official serialization schema.
> Validated against [Metabase OpenAPI spec](specs/metabase-openapi.yaml) (`PUT /api/dashboard/{id}` request body schema).
> Tested across Metabase versions v0.54 through v0.58.

## API Endpoint

```
GET  /api/dashboard/:id        — returns full dashboard object
PUT  /api/dashboard/:id        — updates dashboard (expects full object)
POST /api/dashboard            — creates new dashboard
```

Authentication: `X-API-Key: <token>` header.

The API uses a "fat object" pattern — GET and PUT both transfer the entire dashboard state in one request.

### Dashboard Creation Flow

Creating a full dashboard requires multiple API calls in sequence:

```
1. POST /api/card              — Create each card (question) separately → returns card_id
2. POST /api/dashboard         — Create empty dashboard shell (name, description, collection, parameters)
                                 → returns dashboard_id
3. PUT  /api/dashboard/{id}    — Add dashcards, tabs, parameter_mappings, visualization_settings
```

Exception: virtual cards (text, headings, links) need no pre-creation — they are defined inline.

### PUT Request Body (from OpenAPI spec)

The `PUT /api/dashboard/{id}` endpoint accepts a JSON object with the same structure as the `GET` response. All fields are optional on PUT — you only need to send what you want to change, plus `dashcards` require `id`, `size_x`, `size_y`, `row`, `col` as required fields. Tabs require `id` and `name`.

**Critical: tabs must always accompany dashcards.** If you include `dashcards` in a PUT, you **must** also include `tabs` (even if unchanged). Metabase recreates tabs on each PUT — omitting them orphans the `dashboard_tab_id` references on dashcards, causing a foreign key error. The safe pattern is always GET the full dashboard, modify what you need, PUT back the complete `tabs` + `dashcards` together.

**Two layers of visualization_settings.** Each dashcard has its own `visualization_settings` that **override** the underlying card's settings for that dashboard placement only. Editing viz settings on a dashcard does NOT change the card itself — the card remains untouched. To change a card's default viz settings everywhere it appears, use `PUT /api/card/{id}` directly. To change how it looks on a specific dashboard, edit the dashcard's `visualization_settings` via the dashboard PUT.

**Dashcard IDs are not stable across PUTs.** The dashboard PUT does a full delete-and-reinsert of all dashcards. Existing dashcard IDs get reassigned after each PUT. Do not cache or rely on dashcard IDs persisting — always GET the current state before making further modifications.

**Tab requirement error:** If a dashboard has tabs and you PUT `dashcards` without including `tabs`, the API returns 400 with: `"This dashboard has tab, makes sure every card has a tab"`. Every dashcard must have a valid `dashboard_tab_id` matching one of the included tabs.

**The embedded `card` object in each dashcard is read-only.** The full card JSON returned inside `dashcards[].card` on GET is for convenience — it is ignored on PUT. To modify the underlying card (query, name, card-level viz settings), use the Card API (`PUT /api/card/{id}`) separately.

### Response Shapes

**POST /api/dashboard** returns the full dashboard object (40+ fields) including empty `dashcards`, `tabs`, and `parameters` arrays.

**PUT /api/dashboard/{id}** returns the full updated dashboard object.

**POST /api/dashboard/{id}/copy** returns a partial dashboard object (28 fields) — notably missing `dashcards`, `tabs`, and permission flags. A follow-up GET is needed to see the copied content.

**Error responses:**

- **404** — plain text `"Not found."` (NOT JSON)
- **400** (validation) — `{"errors": {"field": "message"}, "specific-errors": {"field": ["details"]}}`
- **500** (server) — `{"via": [...], "cause": "message", "message": "message", "trace": [...]}` (Clojure exception)

### Additional Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard` | GET | List dashboards |
| `/api/dashboard` | POST | Create new dashboard |
| `/api/dashboard/{id}` | GET | Get full dashboard |
| `/api/dashboard/{id}` | PUT | Update dashboard |
| `/api/dashboard/{id}` | DELETE | Hard delete dashboard |
| `/api/dashboard/{from-dashboard-id}/copy` | POST | Copy a dashboard |
| `/api/dashboard/{id}/cards` | PUT | Update cards only (DEPRECATED — use PUT /api/dashboard/{id}) |
| `/api/dashboard/{id}/query_metadata` | GET | Get query metadata |
| `/api/dashboard/{id}/params/{param-key}/values` | GET | Get parameter values |
| `/api/dashboard/{id}/params/{param-key}/search/{query}` | GET | Search parameter values |
| `/api/dashboard/{id}/public_link` | POST | Create public link |
| `/api/dashboard/{id}/public_link` | DELETE | Remove public link |
| `/api/dashboard/{id}/related` | GET | Get related entities |
| `/api/dashboard/{id}/items` | GET | Get dashboard items |
| `/api/dashboard/embeddable` | GET | List embeddable dashboards |
| `/api/dashboard/public` | GET | List public dashboards |
| `/api/dashboard/save` | POST | Save a transient dashboard |
| `/api/dashboard/{dashboard-id}/dashcard/{dashcard-id}/card/{card-id}/query` | POST | Execute a card query within dashboard context |
| `/api/dashboard/pivot/{dashboard-id}/dashcard/{dashcard-id}/card/{card-id}/query` | POST | Execute a pivot query |

**Pagination:** `GET /api/collection/{id}/items` and `GET /api/search` return paginated envelopes: `{data, total, limit, offset, models}`. `GET /api/card` returns a bare unpaginated array of all cards.

---

## Serialization Spec vs API Response

The [metabase/representations](https://github.com/metabase/representations) repo defines a portable serialization format for import/export. It is **not** the API schema, but the core writable fields are consistent.

Key differences:

- **Spec uses `entity_id` references**; API uses **numeric `id` fields**
- **API embeds full `card` objects** inside each dashcard; spec just references by entity_id
- **API adds computed/read-only fields** (`can_write`, `view_count`, `last-edit-info`, `param_fields`, etc.)
- **`serdes/meta`** is spec-only (serialization identity paths)
- **`filteringParameters`** and **`isMultiSelect`** are API-only (cascading filter config)

The serialization spec is a reliable reference for which fields are core/writable. The API adds read-only computed fields on top.

---

## Top-Level Fields

### Writable (accepted on PUT/POST)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Dashboard title |
| `description` | string\|null | Dashboard description |
| `collection_id` | integer | Parent collection ID |
| `collection_position` | integer\|null | Position within collection |
| `archived` | boolean | Whether dashboard is archived |
| `width` | `"fixed"\|"full"` | Dashboard layout width |
| `auto_apply_filters` | boolean | Auto-apply filter changes (false = show Apply button) |
| `enable_embedding` | boolean | Enable static embedding |
| `embedding_type` | `"sdk"\|"standalone"\|null` | Embedding mode |
| `embedding_params` | object | Per-parameter embedding config (e.g. `{"country": "disabled"}`) |
| `cache_ttl` | integer\|null | Cache TTL in seconds |
| `parameters` | array | Dashboard filter parameters (see Parameters) |
| `dashcards` | array | Cards on the dashboard (see Dashcards) |
| `tabs` | array | Tab definitions (see Tabs) |

### Read-Only (returned on GET, ignored on PUT)

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Dashboard ID |
| `entity_id` | string | Unique entity identifier |
| `creator_id` | integer | User ID of creator |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `updated_at` | string (ISO 8601) | Last update timestamp |
| `last_viewed_at` | string (ISO 8601) | Last viewed timestamp |
| `view_count` | integer | Total view count |
| `can_write` | boolean | Current user can edit |
| `can_delete` | boolean | Current user can delete |
| `can_restore` | boolean | Current user can restore |
| `can_set_cache_policy` | boolean | Current user can set cache policy |
| `last-edit-info` | object | `{id, email, first_name, last_name, timestamp}` |
| `last_used_param_values` | object | Last parameter values used |
| `collection` | object | Parent collection details |
| `collection_authority_level` | string | Collection authority level |
| `param_fields` | object | Maps parameter IDs to field definitions |
| `public_uuid` | string\|null | Public sharing UUID |
| `made_public_by_id` | integer\|null | User who made it public |
| `moderation_reviews` | array | Moderation reviews (usually empty) |
| `points_of_interest` | string\|null | Points of interest text |
| `caveats` | string\|null | Caveats text |
| `is_remote_synced` | boolean | Remote sync status |
| `archived_directly` | boolean | Whether archived directly (not via parent) |
| `show_in_getting_started` | boolean | Featured in getting started |
| `dependency_analysis_version` | integer | Internal version tracker |
| `initially_published_at` | string\|null | First publish timestamp |
| `translations` | object\|null | Translation data |
| `position` | integer\|null | Position value |

---

## Parameters

Dashboard-level filter parameters. Each parameter defines a filter that can be mapped to one or more cards.

```json
{
  "id": "a1b2c3d4",
  "name": "Country",
  "slug": "country",
  "type": "category",
  "default": ["United Kingdom"],
  "filteringParameters": ["e942dcd5", "1ce16a3a"],
  "sectionId": "date",
  "isMultiSelect": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique parameter ID (typically 8-char hex) |
| `name` | string | yes | Display name shown in filter bar |
| `slug` | string | yes | URL-friendly identifier |
| `type` | string | yes | Parameter type (see below) |
| `default` | string\|array\|null | no | Default value(s) |
| `required` | boolean | no | Whether a value is required |
| `filteringParameters` | array of strings | no | IDs of parameters this one depends on (cascading filters) |
| `sectionId` | string | no | UI section grouping (`string`, `number`, `date`, `boolean`, `id`, `location`, `temporal-unit`) |
| `isMultiSelect` | boolean | no | Allow multiple selections (for string types) |
| `values_query_type` | string | no | How values are fetched: `list`, `search`, `none` |
| `values_source_type` | string\|null | no | Value source: `null` (auto), `card`, `static-list` |
| `values_source_config` | object | no | Source config: `{values: [[val,label],...]}` or `{card_id, value_field, label_field}` |
| `temporal_units` | array | no | Allowed temporal units for temporal-unit type |

### Parameter Types

| Type | Description | Default Value Format |
|------|-------------|---------------------|
| `category` | Categorical filter | `["value1", "value2"]` |
| `string/=` | Exact string match | `["value"]` |
| `string/!=` | String not-equal | `["value"]` |
| `string/contains` | String contains | `["value"]` |
| `string/starts-with` | String starts with | `["value"]` |
| `string/ends-with` | String ends with | `["value"]` |
| `number/=` | Exact number match | `123` |
| `number/!=` | Number not-equal | `123` |
| `number/>=` | Number greater-or-equal | `123` |
| `number/<=` | Number less-or-equal | `123` |
| `number/between` | Number range | `[10, 100]` |
| `date/single` | Single date | `"2024-01-15"` |
| `date/range` | Date range | `"2024-01-01~2024-01-31"` |
| `date/month-year` | Month picker | `"2024-01"` |
| `date/quarter-year` | Quarter picker | `"Q1-2024"` |
| `date/relative` | Relative date | `"past30days"` |
| `date/all-options` | Full date picker | `"past10days~"` (relative date syntax) |
| `boolean/=` | Boolean filter | `true` |
| `temporal-unit` | Temporal unit selector | `"day"` |

Note: these same type strings are also valid as `widget-type` values on template tags (e.g. `date/month-year` can appear as a template tag widget-type).

Note: `category` is a legacy parameter type that predates the `sectionId` system. Category parameters typically lack `sectionId` and `isMultiSelect` fields.

---

## Tabs

Optional tabbed layout. Dashcards reference tabs via `dashboard_tab_id`.

```json
{
  "id": 10,
  "dashboard_id": 42,
  "name": "Main dashboard",
  "position": 0,
  "entity_id": "BJnjfZfD8k0FMrlXNUX_m",
  "created_at": "2025-02-26T16:56:35.559832Z",
  "updated_at": "2025-05-28T15:06:55.853355Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | **required on PUT** | Tab ID (assigned by Metabase) |
| `dashboard_id` | integer | read-only | Parent dashboard |
| `name` | string | **required on PUT** | Tab display name |
| `position` | integer | yes | Tab order (0-based) |
| `entity_id` | string | read-only | Unique entity identifier |
| `created_at` | string | read-only | ISO 8601 timestamp |
| `updated_at` | string | read-only | ISO 8601 timestamp |

---

## Dashcards

Each dashcard places a card (question/visualization) on the dashboard grid.

### Grid System

- **24-column grid** — `col` ranges 0-23
- **Constraint:** `col + size_x <= 24` (cards cannot exceed grid width)
- **No overlapping** — cards must not overlap on the same tab
- **Rows grow infinitely** downward

### Dashcard Schema

```json
{
  "id": 100,
  "card_id": 101,
  "dashboard_id": 42,
  "dashboard_tab_id": 10,
  "row": 0,
  "col": 0,
  "size_x": 24,
  "size_y": 8,
  "parameter_mappings": [],
  "visualization_settings": {},
  "series": [],
  "card": { "..." },
  "inline_parameters": null,
  "action_id": null,
  "collection_authority_level": "official",
  "entity_id": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | **required on PUT** | Dashcard ID |
| `row` | integer (>= 0) | **required on PUT** | Grid row position |
| `col` | integer (>= 0) | **required on PUT** | Grid column position |
| `size_x` | integer (>= 1) | **required on PUT** | Card width in grid columns |
| `size_y` | integer (>= 1) | **required on PUT** | Card height in grid rows |
| `card_id` | integer\|null | optional | Referenced card ID (null for virtual cards) |
| `dashboard_id` | integer | read-only | Parent dashboard |
| `dashboard_tab_id` | integer\|null | optional | Tab this card belongs to (null if no tabs) |
| `parameter_mappings` | array\|null | optional | How dashboard parameters map to this card |
| `visualization_settings` | object | optional | Display overrides (see Visualization Settings) |
| `series` | array\|null | optional | Overlay additional cards (see Series) |
| `inline_parameters` | array\|null | optional | Parameter IDs to display inline on this card |
| `card` | object | read-only | Full embedded card object (see Card) |
| `action_id` | integer\|null | read-only | Action reference (for action cards) |

### Virtual Cards (no card_id)

For text, headings, links, and iframes, `card_id` is null and `visualization_settings` contains the content:

```json
{
  "card_id": null,
  "visualization_settings": {
    "virtual_card": {
      "display": "text",
      "name": null,
      "dataset_query": {},
      "visualization_settings": {}
    },
    "text": "## My Heading"
  }
}
```

Virtual card display types: `text`, `heading`, `link`, `iframe`, `placeholder`

Virtual cards support additional styling keys in `visualization_settings`:

| Key | Type | Description |
|-----|------|-------------|
| `text.align_vertical` | string | Vertical text alignment |
| `text.align_horizontal` | string | Horizontal text alignment |
| `dashcard.background` | boolean | Whether to show the card background |

Virtual text cards can include `{{TemplateTags}}` to inject dashboard parameter values dynamically. These are wired up via `text-tag` parameter mappings.

---

## Dashcard Visualization Settings

See card-api-spec.md for the complete visualization settings reference. All card-level viz settings can also be applied at the dashcard level as overrides.

Dashboard-specific visualization override keys (applied at the dashcard level only):

| Key | Type | Description |
|-----|------|-------------|
| `card.title` | string | Override the card's display title on this dashboard |
| `card.description` | string | Override the card's description on this dashboard |

### Combined Visualization (multi-column / multi-series)

A `visualization` key can appear on a dashcard in two scenarios:

1. **Series overlays** — when the `series` array has entries, combining data from multiple cards
2. **Single-card multi-metric** — when a single card returns multiple plottable columns and the visualization selects which to display

```json
{
  "visualization": {
    "display": "combo",
    "columnValuesMapping": {
      "COLUMN_1": [{"sourceId": "card:101", "originalName": "date", "name": "COLUMN_1"}],
      "COLUMN_2": [{"sourceId": "card:101", "originalName": "sales", "name": "COLUMN_2"}]
    },
    "settings": {
      "graph.dimensions": ["COLUMN_1"],
      "graph.metrics": ["COLUMN_2", "COLUMN_3"]
    }
  }
}
```

The `columnValuesMapping` maps generic `COLUMN_N` identifiers to source card columns. When multiple cards are combined, each `sourceId` references a different card (e.g. `"card:101"`, `"card:202"`). The `settings` object uses the same `graph.*` keys listed above.

---

## Series (Overlay Cards)

The `series` array on a dashcard allows overlaying additional cards' data on the same visualization (e.g., multiple lines on one chart, or actuals vs budget).

```json
{
  "series": [
    {
      "id": 202,
      "name": "Budget Sales",
      "display": "line",
      "dataset_query": { "..." },
      "visualization_settings": { "..." },
      "result_metadata": [ "..." ],
      "description": null,
      "database_id": 2,
      "collection_id": 8,
      "type": "question",
      "query_average_duration": 1234,
      "can_write": true,
      "card_schema": 1
    }
  ]
}
```

Each series entry is a **full card object** (not just a reference). The primary card is the dashcard's `card`, and each series entry adds its data on top.

When series are present, the dashcard's `visualization_settings.visualization` object typically controls how the combined data is displayed (see Combined Visualization above).

---

## Parameter Mappings

Connect a dashboard parameter to a specific field/column in a card.

```json
{
  "parameter_id": "d2e93d24",
  "card_id": 101,
  "target": [
    "dimension",
    ["field", 12345, {"base-type": "type/Text"}]
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `parameter_id` | string | References a parameter's `id` |
| `card_id` | integer | The card this mapping applies to |
| `target` | array | Target field reference (see below) |

### Target Format

Four target patterns are used:

**Dimension target — MBQL field** (most common, for MBQL query cards):

```json
["dimension", ["field", <field_id>, {"base-type": "type/Text"}], {"stage-number": 0}]
["dimension", ["field", <field_id>, null]]
```

**Dimension target — template tag** (for native SQL cards with dimension-type tags):

```json
["dimension", ["template-tag", "tag_name"], {"stage-number": 0}]
```

**Variable target** (for native SQL cards with text/number-type template tags):

```json
["variable", ["template-tag", "tag_name"]]
```

**Text-tag target** (for virtual text cards with `{{TemplateTags}}`):

```json
["text-tag", "tag_name"]
```

Notes:

- `field_id` — numeric Metabase field ID
- Field metadata can be `{"base-type": "type/Text"}`, a fuller object, or `null`
- `stage-number` — optional, for multi-stage queries (typically `0`)

---

## Card Object (embedded in dashcard)

Each dashcard's `card` field contains the full card object. This is **read-only** — ignored on dashboard PUT. See [card-api-spec.md](card-api-spec.md) for the complete card schema, MBQL/native query reference, display types, and template tag documentation.

The embedded card objects are the largest contributor to dashboard payload size (~95%). The CLI's `--layout` mode strips these for lightweight dashboard manipulation.

---

## Payload Size Considerations

The embedded `card` objects (especially `result_metadata` and `dataset_query`) make up ~95% of the payload. Typical sizes observed:

| Complexity | Cards | Size | Tokens (~) |
|------------|-------|------|------------|
| Simple (< 15 cards, no tabs) | 9-11 | 139-203 KB | ~43-62K |
| Medium (15-40 cards, 0-2 tabs) | 34-39 | 455-756 KB | ~140-232K |
| Large (40+ cards, multiple tabs) | 41-58 | 1,018-1,026 KB | ~312K |

For LLM-based tooling, the recommended approach is:

1. Keep the full JSON on disk as source of truth
2. Extract a compact summary (metadata + card list without embedded queries) for LLM context (~2-3K tokens)
3. Surgically extract/modify specific sections as needed
4. Patch changes back into the full JSON before PUT
