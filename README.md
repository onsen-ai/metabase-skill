# Metabase Skill

A Claude Code skill for end-to-end Metabase BI development: design dashboards, write and test SQL, create questions and snippets, assemble dashboards with filters and viz settings, and validate the result.

## What It Does

- **Design** — gather requirements, discover data sources, produce a design document with layout, metrics, filters
- **SQL Development** — write parameterized SQL with field filters, optional clauses, and reusable snippets; follow consistent formatting conventions; test queries before deploying
- **Implementation** — create collections, snippets, questions (cards), and dashboards via the Metabase API; wire up filters and parameter mappings; configure visualization settings
- **Testing** — validate queries return data, spot-check accuracy, verify filters work, review layout and formatting
- **Exploration** — browse databases, tables, collections; search across all entities; inspect existing dashboards and cards

## Setup

### Prerequisites

- Node.js 18+
- A Metabase instance with an API key

### Configure

```bash
node scripts/metabase.mjs setup
```

The setup wizard asks for:
- Instance name (e.g., `production`, `staging`)
- Metabase URL
- API key (via env var name or direct entry)

Supports multiple instances. Config saved to `~/.metabase-skill/config.json`.

### Verify

```bash
node scripts/metabase.mjs databases
node scripts/test-e2e.mjs
```

## CLI Reference

```
node scripts/metabase.mjs <command> [options]

Global: --instance <name>    Override default instance
        --json               Structured output (discovery commands)

DISCOVER
  databases                       List databases
  tables --database <id>          List tables + fields
  search <query> [--models ...]   Search across entities
  collections [--tree]            Browse collections
  collection-items <id>           List collection contents

CARDS
  card <id>                       Card summary
  card <id> --full --out <file>   Full card to file
  card create --from <file>       Create card
  card update <id> --patch <file> GET-merge-PUT update
  card delete <id>                Delete card
  card copy <id>                  Copy card
  card query <id>                 Execute query

DASHBOARDS
  dashboard <id>                  Dashboard summary
  dashboard <id> --layout --out <file>  Layout-only (no card objects)
  dashboard <id> --full --out <file>    Full to file
  dashboard create --from <file>  Create dashboard
  dashboard put <id> --from <file> Direct PUT
  dashboard update <id> --patch <file>  GET-merge-PUT
  dashboard delete <id>           Delete
  dashboard copy <id>             Copy
  dashcard <id> <index|name>      Extract single dashcard

SNIPPETS
  snippets                        List snippets
  snippet <id>                    Get content
  snippet create --name <n> --content <sql>
  snippet update <id> [--name <n>] [--content <sql>]

COLLECTIONS
  collection create --name <n> [--parent <id>]
  collection update <id> [--name <n>] [--parent <id>]
```

## Project Structure

```
metabase-skill/
├── SKILL.md                    # Skill definition (loaded by Claude Code)
├── README.md                   # This file
├── scripts/                    # CLI (Node.js, no dependencies)
│   ├── metabase.mjs            # Entry point
│   ├── test-e2e.mjs            # Smoke test (29 tests)
│   └── lib/                    # Client, commands, utilities
├── specs/                      # API reference docs (7 files, 135KB)
│   ├── dashboard-api-spec.md
│   ├── card-api-spec.md
│   ├── visualization-cookbook.md  # 54 copy-pasteable viz examples
│   ├── collection-api-spec.md
│   ├── discovery-api-spec.md
│   ├── snippet-api-spec.md
│   └── sql-style-guide.md
├── assets/templates/           # Design doc template
├── evals/                      # Test cases
├── examples/                   # Real API response samples
└── representations/            # Cloned metabase/representations repo
```

## API Specs

| Spec | Tokens | Coverage |
|------|--------|----------|
| card-api-spec.md | 9,140 | Card CRUD, MBQL, native SQL, parameterized queries, template tags |
| visualization-cookbook.md | 8,873 | 54 complete viz settings examples (line, bar, table, scalar, pie, etc.) |
| dashboard-api-spec.md | 5,450 | Dashboard CRUD, layout, parameters, PUT gotchas |
| collection-api-spec.md | 4,738 | Collection tree, items, CRUD |
| discovery-api-spec.md | 3,673 | Database/table/field metadata, search |
| snippet-api-spec.md | 3,376 | Snippet CRUD, nesting, composition |
| sql-style-guide.md | ~1,800 | SQL formatting conventions with complete examples |

## Key Design Decisions

- **SQL preferred over MBQL** for reviewability, versioning, and snippet reuse
- **Dashboard PUT payloads are lightweight** (~3K tokens for 30 cards) — card objects stripped, only layout sent
- **Summary mode by default** — full payloads never enter LLM context; written to files instead
- **File-based mutations** — JSON payloads written to disk, passed to CLI, keeping large data out of context
- **Two auth modes** — env var reference (secrets never on disk) or direct key storage
