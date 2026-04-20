# Usage Analytics Models Reference

> **Enterprise only.** Usage Analytics is available on Metabase Enterprise instances. Free/open-source instances do not have it.

## Discovery

```
GET /api/collection/tree?namespace=analytics
→ Find collection where type === "instance-analytics"
→ GET /api/collection/{id}/items?models=dataset,dashboard
→ Models (datasets) and dashboards listed separately
```

- **Database ID:** `13371337` (hardcoded in Metabase source, same across all instances)
- **Database name:** "Internal Metabase Database", `is_audit: true`
- **Engine:** matches the app database (typically Postgres in production)
- **Model card IDs vary per instance** — always discover at runtime via the collection

## Query Constraints

### Native SQL is BLOCKED

`"Native queries are not allowed on the audit database"` — `POST /api/dataset` with `type: "native"` returns HTTP 500. **Always use MBQL.**

### MBQL via POST /api/dataset

```json
{
  "database": 13371337,
  "type": "query",
  "query": {
    "source-table": "card__<model_card_id>",
    "aggregation": [["count"]],
    "filter": [">", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ"}], ["relative-datetime", -30, "day"]],
    "breakout": [["field", "entity_type", {"base-type": "type/Text"}]],
    "order-by": [["desc", ["aggregation", 0]]],
    "limit": 25
  }
}
```

### Card query via POST /api/card/{id}/query

Returns raw model data, capped at 2000 rows. Simpler for browsing.

### Performance Rules

| Model | Size | Safe Window | Notes |
|-------|------|-------------|-------|
| View log | **Very large** (millions) | 7 days safe, 30 days simple agg only | Multi-breakout at 30 days WILL timeout |
| Query log | **Very large** (millions) | 7 days safe, 30 days simple agg only | Same as View log |
| Activity log | Large | 7-30 days | Filter by date |
| Content | Medium (~50K) | No filter needed | Safe for full-table aggregations |
| People | Small (~2K) | No filter needed | All queries fast |
| Group Members | Small | No filter needed | Fast |
| Dashboard cards | Medium | No filter needed | Fast |
| Databases | Tiny | No filter needed | Fast |
| Tables | Medium | No filter needed | Fast |
| Fields | Medium-large | No filter needed | Usually fast |
| Alerts | Small | No filter needed | Fast |
| Dashboard subscriptions | Small | No filter needed | Fast |
| System tasks | Small (14 days only) | No filter needed | Built-in 14-day retention |
| Task Runs | Medium | Filter by date if slow | Usually fast |
| Last content viewed at | Medium | No filter needed | One row per entity |

---

## Models

### 1. View Log

Each row describes a question, model, table, or dashboard view.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | View event ID |
| timestamp | DateTimeWithLocalTZ | When the view occurred |
| user_id | Integer | Viewing user (null = system, "External User" = embedded) |
| entity_type | Text | `card`, `dashboard`, `collection`, `table`, `document` |
| entity_id | Integer | ID of viewed entity |
| entity_qualified_id | Text | Qualified ID (e.g., `dashboard_109`) |

**Note:** Query results include enriched join columns (`full_name`, `name`) not in base schema.

### 2. Activity Log

Things that happened in Metabase — edits, creates, deletes, logins.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Activity event ID |
| topic | Text | Event type (e.g., `card-create`, `dashboard-update`) |
| timestamp | DateTimeWithLocalTZ | When it happened |
| end_timestamp | Text | End time (for duration events) |
| user_id | Integer | Who did it |
| entity_type | Text | What was affected |
| entity_id | Integer | ID of affected entity |
| entity_qualified_id | Text | Qualified ID |
| details | Text | JSON details blob |

### 3. Query Log

Every query Metabase executed — the richest model for performance and usage analysis.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Query execution ID |
| started_at | DateTimeWithLocalTZ | Query start time |
| running_time_seconds | Float | Execution duration |
| result_rows | Integer | Rows returned |
| is_native | Boolean | **Execution type, NOT card type.** Subscriptions running native cards report `false` |
| query_source | Text | See taxonomy below |
| error | Text | Error message (null = success) |
| user_id | Integer | Who ran it |
| card_id | Integer | Source card (null for ad-hoc) |
| card_qualified_id | Text | Qualified card ID |
| dashboard_id | Integer | Dashboard context (null if not from dashboard) |
| dashboard_qualified_id | Text | Qualified dashboard ID |
| pulse_id | Integer | Subscription/pulse ID |
| database_id | Integer | Target database |
| database_qualified_id | Text | Qualified database ID |
| cache_hit | Boolean | Whether result came from cache |
| action_id | Integer | Action ID (for actions) |
| action_qualified_id | Text | Qualified action ID |
| query | Text | The actual query text |

#### query_source Taxonomy

| Category | Values | Use for |
|----------|--------|---------|
| **Human** | `dashboard`, `ad-hoc`, `question`, `collection` | Interactive usage |
| **Automated** | `pulse`, `dashboard-subscription`, `cache-refresh` | Background/scheduled |
| **Embedded** | `embedded-dashboard`, `embedded-csv-download`, `embedded-xlsx-download`, `embedded-json-download` | External-facing |
| **Download** | `csv-download`, `xlsx-download`, `json-download` | In-app exports |
| **Public download** | `public-csv-download`, `public-json-download` | Public link exports |
| **Public** | `public-dashboard`, `public-question` | Public link views |
| **Other** | `map-tiles` | Map tile rendering |

### 4. People

All Metabase users — active and deactivated.

| Column | Type | Description |
|--------|------|-------------|
| user_id | Integer | User ID |
| entity_qualified_id | Text | Qualified ID |
| type | Text | `personal` |
| email | Text | Email address |
| first_name | Text | First name |
| last_name | Text | Last name |
| full_name | Text | Display name |
| date_joined | DateTimeWithLocalTZ | Account creation date |
| last_login | DateTimeWithLocalTZ | Most recent login (null = never) |
| updated_at | DateTime | Last profile update |
| is_admin | Boolean | Superuser flag |
| is_active | Boolean | Active (true) or deactivated (false) |
| sso_source | Text | SSO provider (`saml`, `google`, `jwt`, null = password) |
| locale | Text | User locale preference |

### 5. Content

All Metabase content — questions, models, dashboards, collections, events, metrics.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Content ID |
| entity_qualified_id | Text | Qualified ID |
| entity_type | Text | `question`, `dashboard`, `model`, `collection`, `metric`, `action`, `event`, `document`, `glossary`, `transform` |
| created_at | DateTimeWithLocalTZ | Creation date |
| updated_at | DateTimeWithLocalTZ | Last modification |
| creator_id | Integer | Who created it |
| name | Text | Display name |
| description | Text | Description |
| collection_id | Integer | Parent collection |
| made_public_by_user | Integer | User who created public link (null = not public) |
| is_embedding_enabled | Boolean | Embedding enabled |
| is_verified | Boolean | Verified/official content |
| archived | Boolean | Archived flag |
| action_type | Text | Action type (for actions) |
| action_model_id | Integer | Action's model (for actions) |
| collection_is_official | Boolean | Parent collection is official |
| collection_is_personal | Boolean | In a personal collection |
| question_viz_type | Text | Visualization type (`table`, `bar`, `line`, `scalar`, etc.) |
| question_database_id | Text | Target database ID |
| question_is_native | Boolean | **True = native SQL, false = MBQL.** Authoritative source for SQL vs MBQL counts |
| event_timestamp | DateTimeWithLocalTZ | Event date (for timeline events) |

### 6. Dashboard Cards

All dashcard placements (including text/heading cards).

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Dashcard ID |
| entity_qualified_id | Text | Qualified ID |
| dashboard_qualified_id | Text | Parent dashboard |
| dashboardtab_id | Text | Tab ID |
| card_qualified_id | Text | Source card (null for text/heading) |
| created_at | DateTimeWithLocalTZ | Creation date |
| updated_at | DateTimeWithLocalTZ | Last update |
| visualization_settings | Text | JSON viz settings |
| parameter_mappings | Text | JSON parameter mappings |

### 7. Databases

Connected data sources.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Database ID |
| entity_qualified_id | Text | Qualified ID |
| created_at | DateTimeWithLocalTZ | When connected |
| updated_at | DateTimeWithLocalTZ | Last config change |
| name | Text | Display name |
| description | Text | Description |
| database_type | Text | Engine (`redshift`, `postgres`, `bigquery-cloud-sdk`, etc.) |
| metadata_sync_schedule | Text | Cron schedule for sync |
| cache_field_values_schedule | Text | Cron schedule for field value caching |
| timezone | Text | Database timezone |
| is_on_demand | Boolean | On-demand sync |
| auto_run_queries | Boolean | Auto-run queries |
| cache_ttl | Integer | Cache TTL in seconds |
| creator_id | Integer | Who connected it |
| db_version | Text | Database version string |

### 8. Fields

All fields from all connected databases.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Field ID |
| entity_qualified_id | Text | Qualified ID |
| created_at | DateTimeWithLocalTZ | Discovery date |
| updated_at | DateTimeWithLocalTZ | Last update |
| name | Text | Column name |
| display_name | Text | Human-readable name |
| description | Text | Description |
| base_type | Text | Data type |
| visibility_type | Text | `normal`, `hidden`, `details-only` |
| fk_target_field_id | Integer | FK target |
| has_field_values | Text | Field value caching strategy |
| active | Boolean | Active (not removed) |
| table_id | Integer | Parent table |

### 9. Tables

All tables from all connected databases.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Table ID |
| entity_qualified_id | Text | Qualified ID |
| created_at | DateTimeWithLocalTZ | Discovery date |
| updated_at | DateTimeWithLocalTZ | Last update |
| name | Text | Table name |
| display_name | Text | Human-readable name |
| description | Text | Description |
| active | Boolean | Active (not removed) |
| database_id | Integer | Parent database |
| schema | Text | Schema name |
| is_upload | Boolean | Created via CSV upload |
| entity_type | Text | `entity/GenericTable`, `entity/TransactionTable`, etc. |
| visibility_type | Text | `null`, `hidden`, `technical`, `cruft` |
| estimated_row_count | BigInteger | Estimated rows |
| view_count | Integer | Times viewed in Metabase |
| owner_email | Text | Table owner email |
| owner_user_id | Integer | Table owner user ID |

### 10. Group Members

Permission group membership. One row per user-group pair.

| Column | Type | Description |
|--------|------|-------------|
| user_id | Integer | User ID |
| group_id | Integer | Group ID |
| group_name | Text | Group display name |

### 11. Alerts

All alerts (active and archived).

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Alert ID |
| entity_qualified_id | Text | Qualified ID |
| created_at | DateTimeWithLocalTZ | Creation date |
| updated_at | DateTimeWithLocalTZ | Last update |
| creator_id | Integer | Who created it |
| card_id | Integer | Monitored card |
| card_qualified_id | Text | Qualified card ID |
| alert_condition | Text | `rows`, `above`, `below` |
| schedule_type | Text | `hourly`, `daily`, `weekly` |
| schedule_day | Text | Day of week |
| schedule_hour | Integer | Hour of day |
| archived | Boolean | Archived flag |
| recipient_type | Text | `email`, `slack` |
| recipients | Text | Recipient list (JSON) |
| recipient_external | Text | External recipients |

### 12. Dashboard Subscriptions

Scheduled dashboard email/Slack deliveries.

| Column | Type | Description |
|--------|------|-------------|
| entity_id | Integer | Subscription ID |
| entity_qualified_id | Text | Qualified ID |
| created_at | DateTimeWithLocalTZ | Creation date |
| updated_at | DateTimeWithLocalTZ | Last update |
| creator_id | Integer | Who created it |
| archived | Boolean | Archived flag |
| dashboard_qualified_id | Text | Target dashboard |
| schedule_type | Text | `hourly`, `daily`, `weekly`, `monthly` |
| schedule_day | Text | Day of week |
| schedule_hour | Integer | Hour of day |
| recipient_type | Text | `email`, `slack` |
| recipients | Text | Recipient list (JSON) |
| recipient_external | Text | External recipients |
| parameters | Text | Filter parameters (JSON) |

### 13. System Tasks

Internal Metabase background tasks (last 14 days only).

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Task ID |
| task | Text | Task name (e.g., `sync-and-analyze`, `send-pulses`) |
| status | Text | `started`, `success`, `failed` |
| database_qualified_id | Text | Target database |
| started_at | DateTimeWithLocalTZ | Start time |
| ended_at | DateTimeWithLocalTZ | End time |
| duration_seconds | Float | Duration |
| details | Text | JSON details |

### 14. Task Runs

Job execution tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Run ID |
| run_type | Text | Job type |
| entity_type | Text | Entity type |
| entity_id | Integer | Entity ID |
| entity_qualified_id | Text | Qualified ID |
| started_at | DateTimeWithLocalTZ | Start time |
| ended_at | DateTimeWithLocalTZ | End time |
| duration_seconds | Float | Duration |
| status | Text | Result status |
| process_uuid | Text | Process identifier |
| updated_at | DateTimeWithLocalTZ | Last update |

### 15. Last Content Viewed At

Most recent view timestamp per entity. One row per content item.

| Column | Type | Description |
|--------|------|-------------|
| entity_qualified_id | Text | Content identifier (e.g., `dashboard_109`) |
| max | DateTimeWithLocalTZ | Most recent view timestamp |

---

## MBQL Query Patterns

### Aggregations

```json
["count"]
["avg", ["field", "running_time_seconds", {"base-type": "type/Float"}]]
["sum", ["field", "running_time_seconds", {"base-type": "type/Float"}]]
["distinct", ["field", "user_id", {"base-type": "type/Integer"}]]
["min", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ"}]]
["max", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ"}]]
```

Multiple aggregations in one query:
```json
"aggregation": [["count"], ["avg", ["field", "running_time_seconds", {"base-type": "type/Float"}]]]
```

### Filters

```json
["=", ["field", "is_active", {"base-type": "type/Boolean"}], true]
["not=", ["field", "entity_type", {"base-type": "type/Text"}], "collection"]
[">", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ"}], ["relative-datetime", -30, "day"]]
["is-null", ["field", "last_login", {"base-type": "type/DateTimeWithLocalTZ"}]]
["not-null", ["field", "error", {"base-type": "type/Text"}]]
["contains", ["field", "query_source", {"base-type": "type/Text"}], "download"]
["and", ["=", ...], [">", ...]]
["or", ["=", ...], ["=", ...]]
```

### Breakouts (GROUP BY)

```json
["field", "entity_type", {"base-type": "type/Text"}]
["field", "is_active", {"base-type": "type/Boolean"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "week"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "month"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "day"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "hour-of-day"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "day-of-week"}]
["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "quarter"}]
```

### Ordering

```json
"order-by": [["desc", ["aggregation", 0]]]
"order-by": [["asc", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ", "temporal-unit": "week"}]]]
```

### Limit

```json
"limit": 25
```

### Complete Example — Top 20 dashboards by views (last 30 days)

```json
{
  "database": 13371337,
  "type": "query",
  "query": {
    "source-table": "card__<view_log_card_id>",
    "filter": ["and",
      [">", ["field", "timestamp", {"base-type": "type/DateTimeWithLocalTZ"}], ["relative-datetime", -30, "day"]],
      ["=", ["field", "entity_type", {"base-type": "type/Text"}], "dashboard"]
    ],
    "aggregation": [["count"], ["distinct", ["field", "user_id", {"base-type": "type/Integer"}]]],
    "breakout": [
      ["field", "name", {"base-type": "type/Text"}],
      ["field", "entity_id", {"base-type": "type/Integer"}]
    ],
    "order-by": [["desc", ["aggregation", 0]]],
    "limit": 20
  }
}
```

---

## Data Quality Notes

1. **`is_native` in Query log** tracks *execution* type, not card definition. Subscriptions executing native SQL cards report `is_native: false`. For accurate native vs MBQL question counts, use **Content model's `question_is_native`**.

2. **"External User"** appears in View log for embedded dashboard views — not a real Metabase user.

3. **`null` user_id** in View log / Query log = system or background process queries.

4. **View log enriched columns** — query results may include `full_name` and `name` columns from automatic joins. These are not in the base schema but appear in results.

5. **Query log enriched columns** — similarly may include `full_name`, `name`, `name_2`, `name_3`, `name_4` from joins. Column names for these vary — always check `result_metadata` for the actual query.

---

## Analytics Playbook

### User Adoption

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| How many active users? | People | `is_active` = true, count |
| WAU / MAU? | People | `last_login` > relative-datetime N days, count |
| Login recency distribution? | People | Filter `is_active` = true, filter `last_login` by various windows |
| New user growth? | People | Breakout by `date_joined` month |
| Auth method breakdown? | People | Breakout by `sso_source` |
| Who never logged in? | People | `is_active` = true AND `last_login` is-null |
| Admin audit? | People | `is_admin` = true AND `is_active` = true |

### Content Health

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Stale dashboards? | Content + View log | Count dashboards in Content; count distinct entity_id in View log (last 90 days, entity_type=dashboard); diff = stale |
| Stale questions? | Content + View log | Same approach with entity_type=card |
| Content by type? | Content | `archived` = false, breakout by `entity_type` |
| Native SQL vs MBQL? | Content | `entity_type` = question, breakout by `question_is_native` |
| Top content creators? | Content | `entity_type` = question, breakout by `creator_id`, order desc |
| Content in personal collections? | Content | Filter `collection_is_personal` = true |
| Public/embedded content? | Content | Filter `made_public_by_user` not-null or `is_embedding_enabled` = true |
| Dashboard growth over time? | Content | `entity_type` = dashboard, breakout by `created_at` quarter/month |

### Dashboard & Question Popularity

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Top dashboards by views? | View log | Filter last 30d + entity_type=dashboard, count + distinct user_id, breakout by name + entity_id |
| Least viewed dashboards? | View log | Same but order-by asc |
| Top dashboards by unique users? | View log | Order by distinct user_id desc |
| Human vs subscription-driven? | View log | High views + low unique users = subscription-driven |

### Query Performance

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Average query time? | Query log | avg(running_time_seconds), filter last 7d |
| Error rate? | Query log | count-where error not-null / count |
| Cache hit rate? | Query log | Breakout by cache_hit |
| Slowest dashboards? | Query log | Filter dashboard_id not-null, avg(running_time_seconds), breakout by dashboard_id |
| Queries by database? | Query log | Breakout by database_id (resolve names via Databases model or /api/database) |
| Load by hour? | Query log | Breakout by started_at hour-of-day |
| Load by day of week? | Query log | Breakout by started_at day-of-week |

### Human vs Automated

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Query mix breakdown? | Query log | Breakout by query_source, classify into human/automated/embedded/download |
| Weekly trend? | Query log | Breakout by started_at week + query_source |
| Subscription cost? | Query log | Filter query_source in (pulse, dashboard-subscription), sum(running_time_seconds) |
| Embedded dashboard usage? | Query log | Filter query_source = embedded-dashboard, breakout by dashboard_id |

### Downloads

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Download volume by format? | Query log | Filter query_source contains "download", breakout by query_source, count + sum(result_rows) |
| Top downloaders? | Query log | Same filter, breakout by user_id |

### Groups & Permissions

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Group sizes? | Group Members | Breakout by group_name, distinct user_id |
| User's group membership? | Group Members | Filter by user_id |

### Subscriptions & Alerts

| Question | Model | Key fields / approach |
|----------|-------|-----------------------|
| Active subscriptions? | Dashboard subscriptions | Filter archived = false, breakout by schedule_type |
| Active alerts? | Alerts | Filter archived = false, count |
| Subscription delivery channels? | Dashboard subscriptions | Breakout by schedule_type + recipient_type |

---

## Built-in Dashboards (reference)

Before running custom queries, check if a built-in dashboard already answers the question:

| Dashboard | Covers |
|-----------|--------|
| **Metabase metrics** | Instance-wide KPIs: active users, question views, creation trends |
| **Most viewed content** | Top dashboards, questions, tables, models by view count |
| **Person overview** | Individual user deep-dive (5 tabs: overview, recent, most viewed, queries, activity) |
| **Dashboard overview** | Individual dashboard performance, views, subscribers |
| **Question overview** | Individual question performance, usage, alerts |
| **Performance overview** | Query times, caching, resource consumption (5 tabs) |
| **Content with cobwebs** | Dashboards/questions not viewed in N days |
| **Dashboard subscriptions and alerts** | All active notifications |

Point the user to these first — they have pre-built filters and visualizations.
