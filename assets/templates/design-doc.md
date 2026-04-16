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

## Metrics

| Metric | Calculation | Display | Card |
|--------|------------|---------|------|
| [e.g., Total Revenue] | [e.g., SUM(total)] | [e.g., scalar] | [e.g., Revenue KPI] |
| [e.g., Revenue Trend] | [e.g., SUM(total) GROUP BY month] | [e.g., line] | [e.g., Revenue Over Time] |
| [e.g., Top Products] | [e.g., SUM(total) GROUP BY product, ORDER BY DESC LIMIT 20] | [e.g., table] | [e.g., Product Table] |

## Dimensions

| Dimension | Source | Used in |
|-----------|--------|---------|
| [e.g., Month] | [e.g., orders.created_at (temporal: month)] | [e.g., Revenue Trend] |
| [e.g., Category] | [e.g., products.category] | [e.g., Category Breakdown, Top Products] |
| [e.g., Product Name] | [e.g., products.title] | [e.g., Top Products] |

## Filters / Parameters

| Filter | Slug | Type | Default | Required | Cascades from | Applied to |
|--------|------|------|---------|----------|---------------|------------|
| [e.g., Date Range] | date_range | date/all-options | past30days~ | yes | — | All cards |
| [e.g., Category] | category | string/= | — | no | — | Category cards |

## Tabs & Layout

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
