# SQL Style Guide

Formatting conventions for SQL queries backing Metabase dashboards. Follow these consistently.

## Rules

- **4-space indentation** — no tabs
- **UPPER CASE** for keywords and functions: SELECT, FROM, JOIN, WHERE, GROUP BY, ORDER BY, SUM, COUNT, CASE, WHEN, THEN, AND, OR, NULLIF, COALESCE, ROW_NUMBER, DATEADD, DATE_TRUNC, etc.
- **lower_case** for aliases, identifiers, CTE names
- **Descriptive CTE names** that explain purpose: `order_base`, `by_channel`, `pivoted`, `prior_year`
- **120-character separator lines** between CTE groups (all dashes)
- **Header comment block** at top of every file
- **One column per line** in SELECT, right-padded with spaces to align AS aliases
- **JOIN on new line**, USING when FK names match, ON with conditions indented
- **GROUP BY:** use positional references (`GROUP BY 1, 2`) for Postgres/Redshift. For **H2 (Metabase Sample Database)**, positional GROUP BY is NOT supported — use explicit column expressions or aliases instead (e.g., `GROUP BY p.CATEGORY, FORMATDATETIME(o.CREATED_AT, 'yyyy-MM')`). When writing SQL that must work across database engines, prefer explicit expressions.
- **Explicit AS** for all column aliases
- **NULLIF** around denominators in division to prevent divide-by-zero
- **FROM on its own line** with table alias
- **Comma at end of line** (not comma-first)
- **Human-readable Title Case column aliases** with quoted identifiers: `AS "Revenue"`, `AS "Avg Price"`, `AS "Order Date"`. These directly control column headers in Metabase tables and chart axis labels. Never use ALL_CAPS aliases like `AS REVENUE` or `AS AVG_PRICE` — they display as ugly column headers in the UI
- **Every card should have a `description`** field explaining what it shows. Dashboard descriptions support markdown (bold, lists, headings). Card descriptions should be short summaries

## Header Template

```sql
------------------------------------------------------------------------------------------------------------------------
-- [Card Name]
-- Purpose: [1-2 sentences describing what this query answers]
-- Source:  [table1, table2, ...]
-- Params:  [{{param_name}} — type and description]
-- Notes:
--   - [Business rules, assumptions, edge cases]
--   - [FX conversion approach, date alignment, etc.]
------------------------------------------------------------------------------------------------------------------------
```

## Complete Example

```sql
------------------------------------------------------------------------------------------------------------------------
-- Monthly Revenue by Category
-- Purpose: Revenue trend broken down by product category with year-on-year comparison.
-- Source:  odl.fact_orders, odl.dim_products, odl.dim_dates
-- Params:  {{date_range}} — date/all-options field filter
--          {{category}} — optional string/= field filter
-- Notes:
--   - Revenue is net of discounts, excludes cancelled orders
--   - LY comparison uses 52-week alignment (same day of week)
------------------------------------------------------------------------------------------------------------------------

WITH periods AS (
    SELECT  '2026-04-05' :: DATE                                 AS current_start,
            current_start + 6                                    AS current_end,
            DATE_ADD('day', -52*7, current_start) :: DATE        AS yago_start,
            yago_start + 6                                       AS yago_end
),
date_periods AS (
    SELECT  date_nk,
            CASE WHEN date_nk BETWEEN p.current_start AND p.current_end THEN 'TY'
                 WHEN date_nk BETWEEN p.yago_start    AND p.yago_end    THEN 'LY'
            END                                                  AS period_name
    FROM    odl.dim_time, periods p
    WHERE   date_nk BETWEEN p.yago_start AND p.current_end
),

------------------------------------------------------------------------------------------------------------------------
-- Base order data with product details
------------------------------------------------------------------------------------------------------------------------
order_base AS (
    SELECT  dp.period_name,
            p.category_name                                      AS category,
            SUM(o.net_revenue_gbp)                               AS revenue,
            SUM(o.quantity)                                       AS units,
            COUNT(DISTINCT o.order_id)                            AS orders,
            COUNT(DISTINCT o.customer_id)                         AS customers,
            NULLIF(SUM(o.net_revenue_gbp), 0)
                / NULLIF(SUM(o.quantity), 0)                     AS avg_unit_price
    FROM    odl.fact_orders o
    INNER JOIN odl.dim_products p
        USING (product_sk)
    INNER JOIN date_periods dp
        ON o.order_date = dp.date_nk
    WHERE   o.order_status != 'cancelled'
        AND dp.period_name IS NOT NULL
        [[AND p.category_name = {{category}}]]
    GROUP BY 1, 2
),

------------------------------------------------------------------------------------------------------------------------
-- Pivot TY / LY into columns
------------------------------------------------------------------------------------------------------------------------
pivoted AS (
    SELECT  category,
            SUM(CASE WHEN period_name = 'TY' THEN revenue END)          AS revenue_ty,
            SUM(CASE WHEN period_name = 'LY' THEN revenue END)          AS revenue_ly,
            SUM(CASE WHEN period_name = 'TY' THEN units END)            AS units_ty,
            SUM(CASE WHEN period_name = 'TY' THEN orders END)           AS orders_ty,
            SUM(CASE WHEN period_name = 'TY' THEN customers END)        AS customers_ty
    FROM    order_base
    GROUP BY 1
)

------------------------------------------------------------------------------------------------------------------------
-- Final output with YoY variance
------------------------------------------------------------------------------------------------------------------------
SELECT  category,
        revenue_ty                                                       AS revenue,
        revenue_ly,
        CASE WHEN NULLIF(revenue_ly, 0) IS NOT NULL
             THEN (revenue_ty - revenue_ly) / revenue_ly
        END                                                              AS revenue_yoy_pct,
        units_ty                                                         AS units,
        orders_ty                                                        AS orders,
        customers_ty                                                     AS customers
FROM    pivoted
ORDER BY revenue_ty DESC
```

## Patterns

### Conditional aggregation (pivot in SQL)
```sql
SUM(CASE WHEN period_name = 'TY' THEN revenue END)  AS revenue_ty,
SUM(CASE WHEN period_name = 'LY' THEN revenue END)  AS revenue_ly
```

### Division with NULLIF protection
```sql
NULLIF(SUM(revenue), 0) / NULLIF(SUM(quantity), 0)  AS avg_price
```

### Window function with QUALIFY
```sql
QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1
```

### Type casting (Redshift/PostgreSQL)
```sql
'2026-04-05' :: DATE
revenue :: NUMERIC(18, 2)
```

### Human-readable column aliases

```sql
SELECT  SUM(o.net_revenue_gbp)                               AS "Revenue",
        COUNT(DISTINCT o.order_id)                            AS "Orders",
        SUM(o.net_revenue_gbp)
            / NULLIF(COUNT(DISTINCT o.order_id), 0)          AS "Avg Order Value",
        p.category_name                                       AS "Category"
FROM    odl.fact_orders o
```

### Metabase field filter in WHERE
```sql
WHERE {{date_range}}                          -- field filter (dimension type)
  [[AND {{category}}]]                        -- optional field filter
  AND status = 'active'                       -- hardcoded filter
  [[AND region = {{region}}]]                 -- optional basic variable
```

## H2 (Sample Database) Compatibility

The Metabase Sample Database uses H2, which is stricter than Postgres/Redshift. When writing SQL for H2:

| Pattern | Postgres/Redshift | H2 |
|---------|-------------------|-----|
| Positional GROUP BY | `GROUP BY 1, 2` ✅ | ❌ Use explicit expressions |
| Column alias in GROUP BY | `GROUP BY "Revenue"` ✅ | ❌ Use the full expression |
| Date truncation | `DATE_TRUNC('month', col)` | `FORMATDATETIME(col, 'yyyy-MM')` |
| Type casting | `col :: DATE` | `CAST(col AS DATE)` |
| Reserved words as aliases | Usually fine | Quote with `"Month"` |

Example — H2-compatible GROUP BY:
```sql
-- WRONG for H2:
GROUP BY 1, 2

-- CORRECT for H2:
GROUP BY p.CATEGORY, FORMATDATETIME(o.CREATED_AT, 'yyyy-MM')

-- ALSO CORRECT (repeat the full expression):
GROUP BY CAST(o.CREATED_AT AS DATE)
```

If targeting only Postgres/Redshift, positional GROUP BY is fine. If the SQL might run on the Sample Database (H2), use explicit expressions.
