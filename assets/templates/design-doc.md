# Dashboard Design: [Name]

## Overview
- **Purpose:** [What business question does this dashboard answer?]
- **Audience:** [Executive / Analyst / Operations]
- **Collection:** [Target collection path]
- **Width:** fixed | full
- **Auto-apply filters:** true | false

## Data Sources
- **Database:** [database name] (id: [id])
- **Key tables:** [list tables with brief descriptions]

## Tabs

### Tab 1: [Name]

| Card | Display | Metric | Size | Position |
|------|---------|--------|------|----------|
| [Name] | scalar | [calculation] | 6x4 | row:0 col:0 |
| [Name] | line | [calculation] | 12x8 | row:4 col:0 |
| [Name] | table | [columns] | 24x10 | row:12 col:0 |

### Tab 2: [Name]

| Card | Display | Metric | Size | Position |
|------|---------|--------|------|----------|
| ... | ... | ... | ... | ... |

## Parameters (Filters)

| Name | Slug | Type | Default | Required | Cascades from |
|------|------|------|---------|----------|---------------|
| Date Range | date_range | date/all-options | past30days~ | yes | — |
| Category | category | string/= | — | no | — |

## Parameter Mappings

| Parameter | Card | Target Type | Target |
|-----------|------|-------------|--------|
| Date Range | Revenue Trend | dimension/template-tag | date_range |
| Category | Revenue by Cat | dimension/field | products.category |

## SQL Files

| File | Card | Type | Snippets Used |
|------|------|------|---------------|
| sql/01_revenue_trend.sql | Revenue Trend | native | order_base, date_filter |
| sql/02_revenue_by_cat.sql | Revenue by Category | native | order_base |
| — | Total Orders | MBQL | — |

## Snippets

| Name | Purpose | File |
|------|---------|------|
| order_base | Base order data with product + customer joins | sql/snippet_order_base.sql |
| date_filter | Reusable date range WHERE clause | sql/snippet_date_filter.sql |

## Visualization Notes

- Scalar cards: USD currency, no decimals
- Line charts: timeseries x-axis, show values, compact formatting
- Tables: column_settings for currency/percentage columns
- Color palette: [list key colors if specific branding needed]
