---
name: metabase
description: >
  End-to-end Metabase BI development: design, build, and manage dashboards, questions (cards),
  snippets, and collections. Use this skill whenever the user mentions metabase, dashboard creation,
  BI dashboard, analytics dashboard, metabase question, metabase card, MBQL query, native SQL question,
  metabase snippet, metabase collection, visualization settings, dashboard filters, parameter mappings,
  or wants to create/edit/manage any Metabase content. Also use when the user wants to build a
  reporting dashboard, KPI scorecard, or data exploration tool backed by a SQL database.
  Covers the full lifecycle: requirements → design → SQL development → implementation → testing.
  Works with multiple Metabase instances. Always use this skill for any Metabase-related task.
---

# Metabase Skill

End-to-end BI development tool for Metabase. Covers the full developer lifecycle: design dashboards, write and test SQL, create questions and snippets, assemble dashboards with filters and viz settings, and validate the result.

All scripts are in `${CLAUDE_SKILL_DIR}/scripts/` and require only Node.js (no npm dependencies).

## First-Time Setup

Check if `~/.metabase-skill/config.json` exists:
- **If it exists:** Read it to confirm connection details (instance names, URLs).
- **If it doesn't exist:** Tell the user to run the setup wizard:

> Run this in your terminal to configure a Metabase connection:
> ```
> node ${CLAUDE_SKILL_DIR}/scripts/metabase.mjs setup
> ```

The setup wizard supports multiple instances (e.g., production, staging) with two auth modes: env var reference (recommended) or direct API key storage.

## Quick Reference

| Task | Command | Output |
|------|---------|--------|
| **List databases** | `databases` | Formatted text |
| **List tables + fields** | `tables --database <id>` | Formatted text |
| **Browse collections** | `collections --tree` | Formatted tree |
| **List collection items** | `collection-items <id>` | Formatted text |
| **Search everything** | `search <query> [--models card,dashboard]` | Formatted text |
| **Card summary** | `card <id>` | Compact JSON |
| **Card full → file** | `card <id> --full --out <file>` | Writes to file |
| **Create card** | `card create --from <file>` | Returns `{id, name}` |
| **Update card** | `card update <id> --patch <file>` | GET-merge-PUT |
| **Delete card** | `card delete <id>` | Confirms deletion |
| **Copy card** | `card copy <id> [--collection <id>]` | Returns new `{id, name}` |
| **Execute card query** | `card query <id> [--out <file>]` | Results (20 rows or file) |
| **Dashboard summary** | `dashboard <id>` | Compact JSON |
| **Dashboard layout → file** | `dashboard <id> --layout --out <file>` | Lightweight layout (no card objects) |
| **Dashboard full → file** | `dashboard <id> --full --out <file>` | Full payload to file |
| **Create dashboard** | `dashboard create --from <file>` | Returns `{id, name}` |
| **Direct PUT dashboard** | `dashboard put <id> --from <file>` | LLM-constructed payload |
| **Update dashboard** | `dashboard update <id> --patch <file>` | GET-merge-PUT |
| **Delete dashboard** | `dashboard delete <id>` | Confirms deletion |
| **Copy dashboard** | `dashboard copy <id>` | Returns new `{id, name}` |
| **Extract dashcard** | `dashcard <dashboard-id> <index\|name>` | Single dashcard config |
| **List snippets** | `snippets` | Formatted text |
| **Get snippet** | `snippet <id>` | Snippet content |
| **Create snippet** | `snippet create --name <n> --content <sql>` | Returns `{id, name}` |
| **Update snippet** | `snippet update <id> [--name <n>] [--content <sql>]` | Updated snippet |
| **Create collection** | `collection create --name <n> [--parent <id>]` | Returns `{id, name}` |
| **Update collection** | `collection update <id> [--name <n>] [--parent <id>]` | Updated collection |

All commands prefixed with: `node ${CLAUDE_SKILL_DIR}/scripts/metabase.mjs`

Global options: `--instance <name>` to override default instance, `--json` for structured output on discovery commands.

## Context Safety Rules

These rules protect the LLM context window and prevent secret leakage. They are not optional.

- **Never load full dashboard/card payloads into context.** Use `card <id>` (summary) or `dashboard <id>` (summary). Full payloads go to files via `--full --out`.
- **Never print API keys.** The CLI reads keys from env vars or config — they never appear in output.
- **Use file-based mutations.** Write JSON payloads to files, then pass them to `card create --from` or `dashboard put --from`. This keeps large JSON out of context.
- **Dashboard payloads are lightweight without card objects.** The PUT payload only needs layout fields (card_id, row, col, size, viz_settings, parameter_mappings). The embedded `card` object is read-only and ignored. A 30-card dashboard layout is ~3K tokens — small enough to construct directly in context.

## Task Identification

Decide the mode before starting work:

| Mode | When | Workflow |
|------|------|----------|
| **NEW** | Build a dashboard from scratch | Design → SQL Dev → Implement → Test |
| **EDIT** | Modify an existing dashboard | Audit current → Identify changes → Implement → Test |
| **EXPLORE** | Browse collections, understand what exists | Discovery commands |
| **REORGANIZE** | Move items, manage collections | Collection commands |

---

## NEW Dashboard Workflow

### Phase 1: Design

Gather requirements before writing any code:

1. **What business question does this dashboard answer?**
2. **Who is the audience?** Executive summary (scalars, trends) vs analyst detail (tables, drill-downs)
3. **What data sources?** Run `databases` then `tables --database <id>` to discover available tables and fields
4. **What metrics?** Define each calculation (SUM, COUNT, AVG, ratios, YoY comparisons)
5. **What filters?** Date range, categories, regions — and which should cascade
6. **What layout?** Tabs, card types (scalar KPIs, line trends, bar breakdowns, tables), grid positions

Output a **design document** covering:
- Dashboard name, description, target collection
- Tab structure with card list per tab
- For each card: name, display type, metric definition, which filters apply
- Parameter definitions with types and defaults
- Grid layout sketch (24-column grid, cards positioned by row/col/size_x/size_y)

Read `${CLAUDE_SKILL_DIR}/assets/templates/design-doc.md` for the template.

### Phase 2: SQL Development

**When to use SQL vs MBQL:**

| Use SQL (native) when | Use MBQL when |
|----------------------|---------------|
| Complex CTEs, window functions, QUALIFY | Simple aggregation + breakout |
| Custom date logic, fiscal calendars, period comparisons | Standard temporal bucketing (day/week/month) |
| Team needs to review/version the SQL | Quick ad-hoc questions |
| Performance-sensitive queries needing DB-specific hints | Metabase-managed joins |
| Existing SQL from analytics codebase | Reusable metrics (create as type: "metric") |
| Reusable base data patterns (use snippets) | Single-table count/sum/avg |

SQL is generally preferred because it is code — it can be reviewed, versioned, and reused via snippets.

**SQL development steps:**

1. **Create a working directory** — `sql/` folder for all SQL files
2. **Write SQL files** — one file per question/card
3. **Test each query** — via the redshift skill (`query.py`) for direct execution, or create the card and run `card query <id>`
4. **Create Metabase snippets** for shared base data (common joins, date filters)
5. **Create questions** from validated SQL via `card create --from`

**SQL formatting conventions:**

Follow this style consistently:

- 4-space indentation
- UPPER CASE for keywords and functions (SELECT, FROM, JOIN, SUM, CASE, etc.)
- lower_case for aliases and identifiers
- Descriptive CTE names (e.g., `order_base`, `by_channel`, `pivoted`)
- 120-character separator lines between CTE groups
- Header comment block with purpose, source tables, parameters, notes
- One column per line in SELECT, right-padded to align AS aliases
- JOIN on new line, USING when FK names match
- GROUP BY positional references for simple cases
- Explicit AS for all aliases
- NULLIF for division-by-zero protection

Read `${CLAUDE_SKILL_DIR}/specs/sql-style-guide.md` for the full guide with examples.

**Parameterized SQL for Metabase:**

There are two fundamentally different patterns — understand the difference:

**Basic variables** (`text`, `number`, `date`) — simple substitution, you write column + operator:
```sql
SELECT * FROM orders WHERE status = {{status}} [[AND category = {{category}}]]
```
Wrap in `[[ ]]` to make optional — the entire bracketed section is removed if no value provided.

**Field filters** (`dimension` type) — Metabase generates the WHERE clause for you:
```sql
SELECT * FROM orders WHERE {{date_range}} [[AND {{category}}]]
```
Do NOT write `WHERE column = {{tag}}` for field filters — write `WHERE {{tag}}` only. Metabase handles the column, operator, and multi-select (IN clauses) automatically. Field filters are optional by default — no `[[ ]]` needed unless combining with AND/OR.

Read `${CLAUDE_SKILL_DIR}/specs/card-api-spec.md` section "Parameterized SQL" for full details on variables, field filters, optional clauses, widget types, defaults, and table alias requirements.

**Snippet strategy:**

Create base data snippets for common joins that multiple cards share:
```sql
-- Snippet: order_base
SELECT o.ID AS order_id, o.CREATED_AT AS order_date, o.TOTAL,
       p.TITLE AS product_name, p.CATEGORY,
       pe.NAME AS customer_name, pe.SOURCE AS acquisition_source
FROM   ORDERS o
INNER JOIN PRODUCTS p ON o.PRODUCT_ID = p.ID
INNER JOIN PEOPLE pe ON o.USER_ID = pe.ID
```

Then reference in cards: `SELECT ... FROM ({{snippet: order_base}}) base WHERE ...`

Remember: snippet nesting is NOT transparent — if snippet A references snippet B, the card must declare template-tags for both A and B.

### Phase 3: Implementation

Execute in this order:

1. **Create collection** (if needed)
   ```
   collection create --name "Dashboard Name" --parent <id>
   ```

2. **Create snippets** from SQL files
   ```
   snippet create --name "order_base" --content "$(cat sql/snippet_order_base.sql)"
   ```

3. **Create questions** — for each SQL file, build a card spec JSON:
   ```json
   {
     "name": "Revenue by Category",
     "collection_id": <collection_id>,
     "display": "bar",
     "visualization_settings": {},
     "dataset_query": {
       "database": <db_id>,
       "type": "native",
       "native": {
         "query": "<SQL from file>",
         "template-tags": { ... }
       }
     }
   }
   ```
   Write to a file, then: `card create --from card_spec.json`
   Verify: `card query <new_card_id>`

4. **Create dashboard shell**
   ```json
   {"name": "Dashboard Name", "collection_id": <id>, "description": "..."}
   ```
   `dashboard create --from dash_shell.json`

5. **Build layout and PUT** — construct the lightweight payload:
   ```json
   {
     "tabs": [{"id": -1, "name": "Overview"}, {"id": -2, "name": "Detail"}],
     "parameters": [
       {"id": "date_range", "name": "Date Range", "slug": "date_range",
        "type": "date/all-options", "default": "past30days~"}
     ],
     "dashcards": [
       {"id": -1, "card_id": <card_id>, "dashboard_tab_id": -1,
        "row": 0, "col": 0, "size_x": 8, "size_y": 4,
        "visualization_settings": {"card.title": "Revenue"},
        "parameter_mappings": [
          {"parameter_id": "date_range", "card_id": <card_id>,
           "target": ["dimension", ["template-tag", "date_range"]]}
        ],
        "series": []}
     ]
   }
   ```
   Write to file, then: `dashboard put <dashboard_id> --from layout.json`

6. **Verify** — `dashboard <id>` to confirm structure

**Key rules for dashboard PUT:**
- Negative IDs (-1, -2, etc.) create new tabs/dashcards
- `tabs` must ALWAYS accompany `dashcards` — omitting tabs causes errors
- Dashcard IDs are NOT stable across PUTs — always GET fresh state before editing
- The `card` object inside dashcards is read-only — ignored on PUT
- `visualization_settings` on dashcards override the card's settings for that dashboard only

### Phase 4: Testing

Run through this checklist:

1. **Query validation** — `card query <id>` for every card. All must return data.
2. **Data accuracy** — spot-check 2-3 key metrics against known values or direct SQL
3. **Filter testing** — apply each parameter, verify cards update correctly
4. **Layout review** — `dashboard <id>` to verify card positions, tab assignments, no overlaps
5. **Viz settings** — check number formatting (currency, %, decimals), axis labels, colors. Read `${CLAUDE_SKILL_DIR}/specs/visualization-cookbook.md` for correct settings.
6. **Performance** — any cards taking >30s? Check for missing indexes, unbounded date ranges, unnecessary JOINs
7. **Edge cases** — what happens with no data? Null values? Empty filter selections?

---

## EDIT Workflow

1. **Audit current state** — `dashboard <id>` for summary, `dashcard <id> <name>` for specific cards
2. **Identify what to change** — compare against requirements
3. **For layout changes** — `dashboard <id> --layout --out current.json`, modify, `dashboard put <id> --from updated.json`
4. **For card query changes** — `card <id> --full --out card.json`, edit the SQL/MBQL, `card update <id> --patch patch.json`
5. **For viz changes** — modify `visualization_settings` in the dashcard (dashboard-level) or card (card-level)
6. **Test** — run Phase 4 checklist on changed items

---

## EXPLORE Workflow

Graduated discovery — adapt depth to the task:

1. `databases` — what's available?
2. `tables --database <id>` — what tables and fields?
3. `collections --tree` — how is content organized?
4. `collection-items <id>` — what's in a specific collection?
5. `search <query>` — find specific cards, dashboards, or collections
6. `card <id>` — inspect a specific card's metadata
7. `dashboard <id>` — inspect a dashboard's structure

**Shortcut:** If the user's intent is clear (e.g., "show me Q3 sales by region"), skip discovery and go straight to SQL development.

---

## Defensive Guardrails

These protect performance and data integrity. Follow them, but use judgement — if the user explicitly asks for something that bends a rule, explain the trade-off and proceed if they confirm.

- **Every SQL query must have aggregation or LIMIT.** No unbounded SELECT * on large tables.
- **Queries >2min suggest anti-patterns.** Consider materialized views, date range filters on sort keys, or pre-aggregation.
- **Always test SQL before creating Metabase questions.** Run via redshift skill or `card query` first.
- **SQL files are the source of truth.** Always save SQL to disk before creating questions — this enables review and versioning.
- **Never delete without explicit user request.** Archive (set `archived: true`) instead of hard delete when possible.
- **Dashboards with many filters are fine.** Use cascading filters and sensible defaults to keep them manageable.

---

## Common Gotchas

- Dashboard PUT requires `tabs` alongside `dashcards` — always include both
- Dashcard IDs are not stable across PUTs — always GET fresh state
- The `card` object inside dashcards is read-only on PUT
- Dashcard `visualization_settings` override card-level settings for that dashboard only
- Snippets can't be deleted — only archived via `snippet update <id> --archived true`
- Snippet nesting requires ALL transitive snippets declared as template-tags at the card level
- `lib/uuid` values in pMBQL must be valid UUID format
- `category` parameter type is legacy — prefer `string/=` for new dashboards
- Field filter syntax: `WHERE {{tag}}` not `WHERE column = {{tag}}`
- 404 errors from Metabase are plain text, not JSON

---

## Reference Files

Read these as needed — don't load all at once:

| Reference | When to read | Content |
|-----------|-------------|---------|
| `specs/dashboard-api-spec.md` | Creating/editing dashboards | Dashboard CRUD, layout, parameters, PUT rules |
| `specs/card-api-spec.md` | Creating/editing cards | Card CRUD, MBQL, native SQL, parameterized SQL, template tags |
| `specs/visualization-cookbook.md` | Setting up chart formatting | 54 copy-pasteable viz settings examples |
| `specs/collection-api-spec.md` | Managing collections | Tree navigation, items, CRUD |
| `specs/discovery-api-spec.md` | Finding databases/tables/fields | Database metadata, search |
| `specs/snippet-api-spec.md` | Creating/managing snippets | Snippet CRUD, nesting |
| `specs/sql-style-guide.md` | Writing SQL | Formatting conventions, complete examples |
