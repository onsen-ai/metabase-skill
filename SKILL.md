---
name: metabase
description: >
  End-to-end Metabase BI development: design, build, and manage dashboards, questions (cards),
  snippets, and collections. Use this skill whenever the user mentions metabase, dashboard creation,
  BI dashboard, analytics dashboard, metabase question, metabase card, MBQL query, native SQL question,
  metabase snippet, metabase collection, visualization settings, dashboard filters, parameter mappings,
  or wants to create/edit/manage any Metabase content. Also use when the user wants to build a
  reporting dashboard, KPI scorecard, trading dashboard, or data exploration tool backed by a SQL
  database. Covers chart formatting, number formatting, conditional formatting, dashboard layout,
  and the full lifecycle: requirements → design → SQL development → implementation → testing.
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

## Project Directory

All working files (design docs, mockups, SQL, card specs, layout JSON) must be saved to a **project directory** — never `/tmp`. This ensures SQL can be version controlled, reviewed, and audited.

**At the start of any NEW or EDIT workflow, establish the project directory:**

1. If the user has an existing project/repo, use it
2. If not, ask: "Where should I save the working files for this dashboard? (e.g., `~/projects/sales-dashboard/`)"
3. Create the directory structure:

```
<project-dir>/
├── design/
│   ├── design-doc.md          # Requirements, metrics, dimensions, filters
│   ├── mockup.md              # Text mockup
│   └── mockup.html            # HTML mockup
├── sql/
│   ├── snippets/              # Reusable SQL fragments
│   │   ├── order_base.sql
│   │   └── date_filter.sql
│   ├── 01_revenue_trend.sql   # One file per card
│   ├── 02_revenue_by_cat.sql
│   └── ...
├── cards/                     # Card creation JSON specs
│   ├── card_revenue_trend.json
│   └── ...
└── dashboard/
    ├── shell.json             # Dashboard creation payload
    └── layout.json            # Dashboard PUT layout payload
```

**SQL files are the source of truth.** Every native SQL question must start as a `.sql` file in the project directory. The workflow is:
1. Write SQL to `sql/filename.sql`
2. Test it (via `card query` once the card exists, or a temporary card)
3. Build the card JSON spec referencing the SQL content from the file
4. Create the card via `card create --from cards/spec.json`

When passing SQL to the CLI, read it from the file — don't paste SQL inline. This keeps the SQL auditable and the card spec clean.

## Task Identification

Decide the mode before starting work:

| Mode | When | Workflow |
|------|------|----------|
| **NEW** | Build a dashboard from scratch | Design → SQL Dev → Implement → Test |
| **STUDY** | Understand a specific existing dashboard in depth (describe it, audit it, plan changes from it) | Summary → Visual confirmation → Per-card inspection → Override audit |
| **EDIT** | Modify an existing dashboard | Run STUDY first → Identify changes → Implement → Test |
| **EXPLORE** | Browse collections, understand what exists | Discovery commands |
| **REORGANIZE** | Move items, manage collections | Collection commands |

---

## NEW Dashboard Workflow

### Phase 1: Design

The design phase is available when the user wants to plan before building. **It's not mandatory** — if the user knows what they want and says "just build it", skip straight to SQL Development or Implementation. Use judgement: a simple 3-card dashboard doesn't need a formal design process; a 30-card multi-tab scorecard does.

When used, the design phase has three stages: **Define → Mockup → Approve**. The user can exit at any stage and move to implementation.

#### Stage 1: Requirements & Definitions

Gather requirements:

1. **What business question does this dashboard answer?**
2. **Who is the audience?** Executive summary (scalars, trends) vs analyst detail (tables, drill-downs)
3. **What data sources?** Run `databases` then `tables --database <id>` to discover available tables and fields

Then formally define the dashboard's data model:

**Metrics** — each measure that will appear on the dashboard:

| Metric | Calculation | Display | Card |
|--------|------------|---------|------|
| Total Revenue | SUM(total) | scalar | Revenue KPI |
| Revenue Trend | SUM(total) GROUP BY month | line | Revenue Over Time |
| Orders by Category | COUNT(*) GROUP BY category | bar | Category Breakdown |

**Dimensions** — the breakdowns and groupings:

| Dimension | Source | Used in |
|-----------|--------|---------|
| Month | orders.created_at (temporal: month) | Revenue Trend |
| Category | products.category | Category Breakdown, Top Products |

**Filters/Parameters** — what users can control:

| Filter | Type | Default | Required | Applied to |
|--------|------|---------|----------|------------|
| Date Range | date/all-options | past30days~ | yes | All cards |
| Category | string/= | — | no | Category cards |

Present to the user and get approval before proceeding to mockup.

#### Stage 2: Progressive Mockup

Build the mockup in three progressive levels. Get user approval at each level.

**Level 1: Plain Text Mockup**

A markdown sketch of the layout. Fast, disposable, forces alignment on card placement:

```
=== Tab: Overview ===

[Revenue: $1.5M]  [Orders: 18,760]  [AOV: $80.35]  [Customers: 2,500]
     6 cols            6 cols            6 cols           6 cols

[Revenue Over Time ────────────────]  [Orders by Category ──────────────]
       line chart, 12 cols                   bar chart, 12 cols

[Top Products ─────────────────────────────────────────────────────────]
                          table, 24 cols

Filters: [Date Range ▼ past 30 days]  [Category ▼ all]
```

Read `${CLAUDE_SKILL_DIR}/assets/templates/mockup-text-template.md` for the template. Save to `<project-dir>/design/mockup.md`.

**Level 2: HTML Mockup**

After text mockup is approved, generate a standalone HTML file with:
- Correct 24-column grid layout
- Card placeholders with titles, display type labels, and sample values
- Filter bar with parameter names and types
- Tab navigation if multiple tabs
- Approximate sizing matching Metabase's rendering

Read `${CLAUDE_SKILL_DIR}/assets/templates/mockup-html-template.html` for the base template. Customize it for the specific dashboard. Save as `<project-dir>/design/mockup.html` — the user opens it in a browser.

**Level 3: Metabase Mockup with Sample Data**

After HTML mockup is approved, create the actual dashboard in Metabase with:
- Simple cards using basic queries (e.g., `SELECT 'Gadgets' AS category, 42000 AS revenue`) or real queries with LIMIT
- Correct layout, tab structure, and filter parameters wired up
- Visualization settings applied (chart types, number formatting, colors)

This is a real Metabase dashboard the user can click through. It validates layout, viz settings, and filter UX before investing in proper SQL development. The sample queries will be replaced with real ones in the SQL Development and Implementation phases.

#### Stage 3: Design Document

After the mockup is approved, produce the formal design document:

Read `${CLAUDE_SKILL_DIR}/assets/templates/design-doc.md` for the template. It covers:
- Dashboard name, description, target collection
- Metrics/dimensions/filters definitions (from Stage 1)
- Tab structure with card list per tab
- For each card: name, display type, metric, filters, viz settings
- Parameter definitions with types, defaults, and cascade dependencies
- Grid layout (which cards where, sizes)
- SQL file plan (which queries to write, which snippets to create)

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

All SQL lives in the project directory's `sql/` folder. Never write SQL inline or to `/tmp`.

1. **Write snippet SQL files** — save to `sql/snippets/snippet_name.sql`, one per shared CTE/fragment
2. **Write card SQL files** — save to `sql/01_card_name.sql`, one file per question. Number-prefix for ordering.
3. **Test each query** — the default path is to create a temporary card and run `card query <id>`. If the user's project instructions (e.g. CLAUDE.md) specify a database-specific SQL runner (a redshift/snowflake/bigquery/etc. skill), use that instead for direct execution.
4. **Create Metabase snippets** — `snippet create --name "order_base" --content "$(cat sql/snippets/order_base.sql)"`
5. **Build card JSON specs** — save to `cards/card_name.json`, referencing the SQL from the file: read `sql/01_card_name.sql` and embed in the card spec's `dataset_query.native.query`
6. **Create questions** — `card create --from cards/card_name.json`

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

5. **Build layout and PUT** — construct the lightweight payload. **Wire parameter mappings during layout construction** — don't add them as an afterthought. Each dashcard should include its `parameter_mappings` inline:
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
           "target": ["dimension", ["template-tag", "date_range"], {"stage-number": 0}]}
        ],
        "series": []}
     ]
   }
   ```
   Write to file, then: `dashboard put <dashboard_id> --from layout.json`
   
   **Important:** Native SQL cards must have template tags defined (in `dataset_query.native.template-tags`) BEFORE parameter mappings will work. Always verify parameter wiring in the Metabase UI after the PUT — stale cache can show false errors.

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

## STUDY Workflow

When you need to understand an existing dashboard in depth — to describe what it does, audit its design, or plan changes from it. **Run this checklist before claiming you understand a dashboard.** JSON-only analysis is brittle and routinely produces wrong descriptions when cards are repeated with viz overrides.

1. **Get summary** — `dashboard <id>`. Inspect:
   - `unique_card_count` vs `card_count` — a 6×-placed scalar contributes 6 to `card_count` and 1 to `unique_card_count`
   - `repeated_card_ids` — cards used more than once almost always carry per-placement overrides (different displayed metric, different title)
   - `cards[].overrides` — surfaces the discriminating viz settings per dashcard (`title`, `scalar_field`, `graph_metrics`, `graph_dimensions`, `series_titles`)
2. **Visual confirmation** — ask the user for a screenshot of the rendered dashboard, or open the dashboard URL yourself. The summary tells you the wiring; the screenshot tells you what users actually see. Skip only if the dashboard is trivial (1-2 cards) or the user has shown it already.
3. **Inspect each unique card** — `card <id>` for summary. The summary surfaces `result_columns` (what the SQL produces), `referenced_snippets` (shared SQL pulled in), and `template_tags` (parameters the card accepts) — usually enough to understand the card without fetching the full payload. Use `card <id> --full --out <file>` only when you need the SQL string itself.
4. **Inspect each repeated placement** — for any card_id appearing in `repeated_card_ids`, run `dashcard <dashboard-id> <index|name>` for each placement to see the full viz_settings overrides. The summary's `overrides` field is a starting point, not a substitute.
5. **Read shared snippets** — `snippet <id>` for any snippet listed in a card's `referenced_snippets`. Snippets define the data model; without them you don't understand the dashboard.
6. **Cross-check produced columns vs displayed metrics** — compare each card's `result_columns` (from the card summary) against every placement's `scalar_field` / `graph_metrics` (from the dashboard summary). Orphan columns (produced but never displayed) and missing columns (referenced but not produced) are signs of drift.
7. **Map parameters** — for each dashboard parameter, note its type, default, and which template-tags or fields the dashcards map it to.
8. **Run a card query** — `card query <id> [--out <file>]` for the most complex card to confirm the data shape actually returned.

The output of STUDY is the foundation for any EDIT or sync workflow. Don't skip steps 2 and 4 — that's where most "I described it wrong" mistakes come from.

---

## EDIT Workflow

1. **Audit current state** — run the STUDY workflow above. The audit prevents misdescribing the dashboard and catches per-dashcard viz overrides you would otherwise overwrite when constructing a new layout payload.
2. **Identify what to change** — compare against requirements
3. **For layout changes** — `dashboard <id> --layout --out current.json`, modify, `dashboard put <id> --from updated.json`
4. **For card query changes** — `card <id> --full --out card.json`, edit the SQL/MBQL, `card update <id> --patch patch.json`
5. **For viz changes** — modify `visualization_settings` in the dashcard (dashboard-level override) or card (card-level default). Remember: dashcard-level wins for that placement only.
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
- **Always test SQL before creating Metabase questions.** Run `card query` first, or use any database-specific SQL runner the user has configured in their project instructions.
- **SQL files are the source of truth.** Always save SQL to disk before creating questions — this enables review and versioning.
- **Never delete without explicit user request.** Archive (set `archived: true`) instead of hard delete when possible.
- **Dashboards with many filters are fine.** Use cascading filters and sensible defaults to keep them manageable.

---

## Common Gotchas

**Dashboard PUT:**
- Dashboard PUT requires `tabs` alongside `dashcards` — always include both
- Dashcard IDs are not stable across PUTs — always GET fresh state
- The `card` object inside dashcards is read-only on PUT
- Dashcard `visualization_settings` override card-level settings for that dashboard only

**Dashboard Summary Interpretation:**
- `card_count` is total dashcard placements; `unique_card_count` is distinct cards. A 6×-placed scalar contributes 6 to `card_count` and 1 to `unique_card_count`.
- `repeated_card_ids` lists every card_id used more than once, with counts. Per-dashcard `visualization_settings` overrides routinely make the same card_id render as N functionally distinct visualizations (different displayed metric, different title). **Always run `dashcard <dashboard-id> <index|name>` for each repeated placement before describing what the dashboard shows.**
- The summary's per-dashcard `overrides` field surfaces the discriminating viz settings (`title`, `scalar_field`, `graph_metrics`, `graph_dimensions`, `series_titles`) — use these to tell repeated placements apart at a glance, but treat `overrides` as a hint, not the full picture (it's a curated subset of the actual viz_settings).
- Override fields appear at the top level of `visualization_settings` for simple dashcards (e.g. scalars), but inside `visualization.settings` for combined-visualization dashcards (multi-series, multi-metric); the summary handles both. When wrapped in `visualization`, `graph.metrics` references renamed `COLUMN_N` keys mapped back to original column names via `columnValuesMapping` — the summary resolves these for you.
- Detect orphan SQL columns by aggregating every dashcard's `scalar_field` / `graph_metrics` for a given card and comparing against the SQL's produced columns. Don't infer orphans from row counts alone.

**Parameter Mappings:**
- Wire parameter mappings during layout creation, not as an afterthought
- Native SQL cards need template tags (`{{name}}` in SQL + template-tag definition) BEFORE they can accept parameter mappings
- Field refs in parameter mappings need `{"base-type": "type/Text"}` metadata — don't use `null`
- Include `{"stage-number": 0}` as third element in mapping targets
- After wiring parameters via API, verify in the Metabase UI — stale cache can show false errors

**Field Filters:**
- Field filter syntax: `WHERE {{tag}}` not `WHERE column = {{tag}}`
- `alias` is REQUIRED on field filter template tags when SQL uses table aliases. Without it, Metabase generates fully-qualified column names (e.g. `PUBLIC.ORDERS.CREATED_AT`) which fail when the query uses aliases like `ORDERS o`

**Virtual Cards:**
- `heading` type: plain text only, no markdown. `text` type: markdown supported
- Don't include `dataset_query: {}` in heading `virtual_card` — omit it entirely
- Heading cards need `"dashcard.background": false` for transparent section heading style
- Correct heading recipe: `{"dashcard.background": false, "virtual_card": {"name": null, "display": "heading", "visualization_settings": {}, "archived": false}, "text": "Section Title"}`

**SQL & Documentation:**
- Enforce SQL style guide from the start, not as cleanup — read `specs/sql-style-guide.md` before writing any SQL
- SQL column aliases must be human-readable Title Case with quoted identifiers: `AS "Revenue"` not `AS REVENUE` or `AS revenue`
- Always write descriptions — dashboards support markdown, cards should have short summaries
- Always test SQL before creating Metabase questions

**General:**
- Snippets can't be deleted — only archived via `snippet update <id> --archived true`
- Snippet nesting requires ALL transitive snippets declared as template-tags at the card level
- `lib/uuid` values in pMBQL must be valid UUID format
- `category` parameter type is legacy — prefer `string/=` for new dashboards
- 404 errors from Metabase are plain text, not JSON

---

## Example Prompts

These show what users can ask and what the skill should do. Use them as patterns for recognising intent and choosing the right workflow.

### Creating a Dashboard

> "Build me a sales performance dashboard on our Redshift DWH. I want to see weekly revenue, margin, and order count as KPIs at the top, then a revenue trend line and a category breakdown bar chart. Add a date range filter and a country filter."

**Workflow:** NEW → Design (define metrics/dimensions/filters → text mockup → HTML mockup → approve) → SQL Development (write .sql files for each card, create snippets for shared joins) → Implementation (create collection → snippets → cards → dashboard shell → PUT layout with parameter mappings) → Testing (verify queries, test filters, check formatting).

> "Create a quick dashboard with 3 scalar cards showing total users, active users, and churn rate from our analytics database."

**Workflow:** NEW → skip design (simple enough) → write SQL → create cards → create dashboard → PUT layout. Three cards, no tabs, maybe one date filter.

### Organising Collections

> "Our Metabase is a mess. Can you scan the Commercial collection and suggest how to reorganise it? There are dashboards mixed with random saved questions, no clear structure."

**Workflow:** REORGANIZE →
1. `collections --tree` to see the full hierarchy
2. `collection-items <id>` on the target collection to list everything
3. For each sub-collection, list its contents too
4. Analyse: group items by domain/theme, identify dashboards vs supporting questions, spot orphaned cards not used in any dashboard
5. Propose a structure: e.g., "Trading" sub-collection for trading dashboards + their cards, "Ad Hoc" for one-off questions, "Archive" for unused items
6. After user approves: `collection create` for new sub-collections, then move items by updating their `collection_id` via `card update` / `dashboard update`

> "Rename all the dashboards in collection 8 to follow our naming convention: '[Domain] Dashboard Name (version)'"

**Workflow:** REORGANIZE → `collection-items 8 --models dashboard` → for each dashboard, `dashboard update <id> --patch '{"name": "..."}'`

### Editing an Existing Dashboard

> "Dashboard 42 needs a new tab called 'Regional Breakdown' with a bar chart showing revenue by state and a table of top stores."

**Workflow:** EDIT → `dashboard 42` to audit current state → write SQL for the two new cards → create cards → GET current layout → add new tab + dashcards to the layout → PUT back → verify.

> "The date filter on dashboard 22 isn't connected to the Revenue by State card. Can you fix it?"

**Workflow:** EDIT → `dashboard 22` to see parameter mappings → `dashcard 22 "Revenue by State"` to inspect the card's current mapping → check if the card has a date template tag → if missing, update the card's SQL to add `{{date_range}}` with field filter → then update the dashboard layout to wire the parameter mapping.

### Exploring and Understanding

> "What dashboards do we have about customer analytics? Show me what's in the Customer collection."

**Workflow:** EXPLORE → `search customer --models dashboard,collection` → `collection-items <id>` → summarise findings.

> "Explain what dashboard 109 does — what cards are on it, what filters, how they're connected."

**Workflow:** EXPLORE → `dashboard 109` for summary → `dashcard 109 <name>` for key cards → explain structure, filters, and parameter wiring to the user.

### Working with SQL and Snippets

> "Create a reusable snippet called 'order_base' that joins orders with products and customers, then use it in a revenue-by-category question."

**Workflow:** Write snippet SQL to `sql/snippets/order_base.sql` → `snippet create --name "order_base" --content "$(cat sql/snippets/order_base.sql)"` → write card SQL using `{{snippet: order_base}}` → test → create card.

> "Write me a parameterised SQL question for Metabase that shows monthly revenue with a date range filter and optional category filter."

**Workflow:** Write SQL to file using field filter syntax (`WHERE {{date_range}} [[AND {{category}}]]`) → include template-tags JSON with `alias` for table aliases → test → create card.

### Improving Dashboard Quality

> "Go through dashboard 39 and improve the number formatting, add proper descriptions to all cards, and make sure the chart colours are consistent."

**Workflow:** EDIT → `dashboard 39` to audit → for each card, check viz settings → update dashcard `visualization_settings` (column_settings for currency/percentage, series_settings for colours) → update card descriptions via `card update <id> --patch` → update dashboard description with markdown.

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
