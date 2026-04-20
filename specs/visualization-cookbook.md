# Metabase Visualization Settings Cookbook

Complete, copy-pasteable `visualization_settings` examples for every common display type.
Use these as templates -- swap in your own column names and values.

All examples are extracted from **real production cards and dashboards** unless marked
`[representations]`, which come from the curated representations repo.

---

## How visualization_settings Work

### Two Layers: Card-Level vs Dashcard-Level

Metabase has **two places** where visualization_settings live:

1. **Card-level** (`card.visualization_settings`) -- saved on the question/model itself.
   These are the defaults whenever the card is viewed standalone or embedded in any dashboard.

2. **Dashcard-level** (`dashcard.visualization_settings`) -- saved on the dashboard card placement.
   These **override** card-level settings for that specific dashboard placement only.
   Common uses: override `card.title`, change `scalar.field` to show a different column from the
   same multi-column query, tweak `column_settings` for a dashboard-specific format.

When Metabase renders a dashcard, it deep-merges: `card.visualization_settings` + `dashcard.visualization_settings`.

**CRITICAL for native SQL charts:** Never create line/bar/area/pie/row/combo cards with
`"visualization_settings": {}`. Metabase cannot reliably auto-detect which columns map to
which axes for native SQL cards. Always set `graph.dimensions`, `graph.metrics`, and
`graph.x_axis.scale` at the **card level** during creation. Without these, Metabase may
guess wrong (e.g., putting a categorical column on the X-axis instead of the date column).
Dashcard-level overrides deep-merge on top, but if the card level has no axis config at all,
the merge has nothing to anchor to. Scalar and table cards are safe with `{}`.

### column_settings Key Format

Column settings are keyed by a JSON-encoded array:

```
'["name","COLUMN_NAME"]'
```

The key is a **stringified JSON array** where the first element is `"name"` and the second is
the column name as it appears in the query result. Examples:

```json
{
  "column_settings": {
    "[\"name\",\"revenue\"]": { "number_style": "currency", "decimals": 0 },
    "[\"name\",\"margin_pct\"]": { "number_style": "percent", "decimals": 1 }
  }
}
```

### series_settings Key Format

Series settings are keyed by the **series name** -- which is either the column name (for single-breakout)
or the breakout value (for multi-series charts):

```json
{
  "series_settings": {
    "Revenue": { "color": "#509EE3", "display": "line" },
    "Volume":  { "color": "#88BF4D", "display": "bar" }
  }
}
```

### graph.dimensions and graph.metrics

- `graph.dimensions` -- array of column names used for the X-axis and breakout.
  First element = X-axis, second element (optional) = series breakout.
- `graph.metrics` -- array of column names used for the Y-axis values.

---

## Line Chart

### Minimal
_Source: production card (simplified)_

```json
{
  "graph.dimensions": ["date_column"],
  "graph.metrics": ["value_column"],
  "graph.show_values": true,
  "graph.x_axis.labels_enabled": false,
  "graph.y_axis.labels_enabled": false
}
```

### Full-Featured
_Source: representations repo (line_chart.yaml)_ `[representations]`

```json
{
  "graph.dimensions": ["CREATED_AT"],
  "graph.metrics": ["sum"],
  "graph.show_values": true,
  "graph.label_values_frequency": "fit",
  "graph.x_axis.title_text": "Month",
  "graph.x_axis.scale": "timeseries",
  "graph.y_axis.title_text": "Revenue ($)",
  "graph.y_axis.scale": "linear",
  "graph.y_axis.auto_range": false,
  "graph.y_axis.min": 0,
  "graph.y_axis.max": 100000,
  "graph.show_goal": true,
  "graph.goal_value": 50000,
  "graph.goal_label": "Monthly Target",
  "graph.show_trendline": true,
  "series_settings": {
    "sum": {
      "display": "line",
      "color": "#509EE3",
      "line.style": "solid",
      "line.size": "M",
      "line.interpolate": "cardinal",
      "line.missing": "interpolate",
      "line.marker_enabled": true,
      "show_series_values": true
    }
  }
}
```

### Multi-Series with Breakout
_Source: production card_

```json
{
  "graph.dimensions": ["created_at"],
  "graph.metrics": ["Experiences per user"],
  "graph.show_values": true,
  "graph.show_trendline": true,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "timeseries",
  "graph.y_axis.labels_enabled": false,
  "graph.show_goal": false,
  "graph.show_stack_values": "all",
  "graph.series_order_dimension": "Experience type",
  "graph.series_order": [
    { "key": "Personalisation", "color": "#F2A86F", "enabled": true, "name": "Personalisation" },
    { "key": "Onboarding",      "color": "#88BF4D", "enabled": true, "name": "Onboarding" },
    { "key": "Core",            "color": "#509EE3", "enabled": true, "name": "Core" }
  ],
  "column_settings": {
    "[\"name\",\"Experiences per user\"]": { "decimals": 1 }
  },
  "series_settings": {
    "Onboarding":      { "color": "#88BF4D" },
    "Core":            { "color": "#509EE3" },
    "Personalisation": { "color": "#E75454" }
  },
  "stackable.stack_type": "stacked"
}
```

### Percentage Line with Fixed Y-Axis Range
_Source: production card_

```json
{
  "graph.dimensions": ["date_column"],
  "graph.metrics": ["rate_column"],
  "graph.show_values": true,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "timeseries",
  "graph.y_axis.labels_enabled": false,
  "graph.y_axis.auto_split": false,
  "graph.y_axis.auto_range": false,
  "graph.y_axis.min": 0.8,
  "graph.y_axis.max": 1,
  "scalar.field": "rate_column",
  "scalar.comparisons": [
    { "id": "unique-id-here", "type": "previousValue" }
  ],
  "column_settings": {
    "[\"name\",\"rate_column\"]": {
      "decimals": 1,
      "number_style": "percent"
    }
  },
  "series_settings": {
    "rate_column": { "color": "#fbd089" }
  }
}
```

### Dashcard-Level Overrides for Line Charts
_Source: production dashboard_109 dashcard overrides_

When embedding a line chart in a dashboard, common overrides include:

```json
{
  "card.title": "Custom Dashboard Title",
  "graph.y_axis.title_text": "",
  "graph.show_values": true,
  "graph.x_axis.labels_enabled": false,
  "graph.y_axis.labels_enabled": false,
  "graph.y_axis.auto_split": false,
  "graph.label_value_frequency": "fit",
  "graph.metrics": ["sum"],
  "column_settings": {
    "[\"name\",\"sum\"]": { "decimals": 0, "prefix": "" }
  },
  "series_settings": {
    "- Total -": { "color": "#fbd089" }
  },
  "graph.x_axis.scale": "timeseries",
  "graph.dimensions": ["period", "breakdown"]
}
```

---

## Bar Chart

### Minimal
_Source: production card (simplified)_

```json
{
  "graph.dimensions": ["date_column"],
  "graph.metrics": ["count"],
  "graph.show_values": true,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "timeseries"
}
```

### Stacked Bar with Series Order
_Source: production card_

```json
{
  "graph.dimensions": ["date"],
  "graph.metrics": ["New", "Repeat"],
  "graph.show_values": true,
  "graph.show_stack_values": "all",
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "timeseries",
  "graph.y_axis.labels_enabled": false,
  "graph.show_goal": false,
  "graph.show_trendline": false,
  "graph.series_order_dimension": "user_type",
  "graph.series_order": [
    { "key": "Repeat", "color": "#509EE3", "enabled": true, "name": "Repeat" },
    { "key": "New",    "color": "#88BF4D", "enabled": true, "name": "New" }
  ],
  "series_settings": {
    "Repeat": { "color": "#509EE3" }
  },
  "stackable.stack_type": "stacked"
}
```

### Stacked Bar with Breakout and Category Colors
_Source: representations repo (bar_chart_stacked.yaml)_ `[representations]`

```json
{
  "graph.dimensions": ["CREATED_AT", "CATEGORY"],
  "graph.metrics": ["count"],
  "graph.show_values": true,
  "graph.show_stack_values": "total",
  "graph.x_axis.title_text": "Quarter",
  "graph.y_axis.title_text": "Order Count",
  "stackable.stack_type": "stacked",
  "graph.max_categories_enabled": true,
  "graph.max_categories": 4,
  "graph.other_category_aggregation_fn": "sum"
}
```

### Stacked Bar with Custom Series Colors (ABCDE segments)
_Source: production card_

```json
{
  "graph.dimensions": ["date_column", "segment_column"],
  "graph.metrics": ["sum"],
  "graph.show_values": true,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.axis_enabled": true,
  "graph.x_axis.scale": "timeseries",
  "graph.y_axis.labels_enabled": false,
  "graph.y_axis.auto_split": false,
  "graph.y_axis.auto_range": true,
  "stackable.stack_type": "stacked",
  "column_settings": {
    "[\"name\",\"sum\"]": { "decimals": 0 }
  },
  "series_settings": {
    "A": { "color": "#008800" },
    "B": { "color": "#00BB00" },
    "C": { "color": "#CCCC00" },
    "D": { "color": "#FF0000" },
    "E": { "color": "#000066" }
  }
}
```

---

## Combo Chart (Line + Bar)

### Footfall and Conversion (dual axis)
_Source: production card_

A combo chart uses `series_settings` to assign each series to either `"bar"` or `"line"` display,
and optionally to `"left"` or `"right"` axis.

```json
{
  "graph.dimensions": ["period"],
  "graph.metrics": ["footfall conversion"],
  "graph.show_values": true,
  "graph.show_trendline": false,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "ordinal",
  "graph.y_axis.labels_enabled": true,
  "series_settings": {
    "footfall conversion": {
      "color": "#007d6c",
      "display": "line",
      "axis": "right",
      "title": "Footfall conversion"
    },
    "footfall": {
      "color": "#fbd089",
      "display": "bar",
      "axis": "left",
      "title": "Footfall"
    },
    "orders": {
      "title": "Orders"
    }
  },
  "column_settings": {
    "[\"name\",\"footfall conversion\"]": {
      "number_style": "percent",
      "decimals": 1
    },
    "[\"name\",\"volume\"]": {
      "column_title": "Volume",
      "decimals": 0,
      "scale": 0.001
    }
  }
}
```

Key combo chart settings in `series_settings`:
- `"display": "line"` or `"display": "bar"` -- controls the series type
- `"axis": "left"` or `"axis": "right"` -- assigns to Y-axis
- `"title"` -- overrides the legend label

---

## Table

### Minimal
```json
{
  "table.pivot": false
}
```

### With Column Visibility, Titles, and Mini Bars
_Source: production dashboard_109 dashcard (Trading detailed report)_

```json
{
  "table.pivot": false,
  "table.columns": [
    { "name": "period",    "enabled": true },
    { "name": "breakdown", "enabled": true },
    { "name": "revenue",   "enabled": true },
    { "name": "margin",    "enabled": true },
    { "name": "margin_pct","enabled": true },
    { "name": "volume",    "enabled": true },
    { "name": "hidden_col","enabled": false }
  ],
  "column_settings": {
    "[\"name\",\"revenue\"]": {
      "column_title": "Revenue inc VAT",
      "decimals": 0,
      "show_mini_bar": false
    },
    "[\"name\",\"margin\"]": {
      "column_title": "Margin inc retro",
      "decimals": 0,
      "show_mini_bar": true
    },
    "[\"name\",\"margin_pct\"]": {
      "column_title": "Margin %",
      "number_style": "percent",
      "decimals": 1,
      "show_mini_bar": false
    },
    "[\"name\",\"volume\"]": {
      "column_title": "Volume",
      "show_mini_bar": false,
      "decimals": 0
    },
    "[\"name\",\"period\"]": {
      "column_title": "Period",
      "time_enabled": null
    }
  }
}
```

### With Conditional Formatting (Highlighting)
_Source: representations repo (table_formatted.yaml)_ `[representations]`

```json
{
  "table.columns": [
    { "name": "TITLE",      "enabled": true },
    { "name": "CATEGORY",   "enabled": true },
    { "name": "PRICE",      "enabled": true },
    { "name": "RATING",     "enabled": true },
    { "name": "VENDOR",     "enabled": true },
    { "name": "CREATED_AT", "enabled": true },
    { "name": "EAN",        "enabled": false }
  ],
  "table.column_formatting": [
    {
      "columns": ["PRICE"],
      "type": "single",
      "operator": ">",
      "value": 100,
      "color": "#84BB4C",
      "highlight_row": false
    },
    {
      "columns": ["PRICE"],
      "type": "single",
      "operator": "<",
      "value": 20,
      "color": "#ED6E6E",
      "highlight_row": true
    },
    {
      "columns": ["RATING"],
      "type": "range",
      "colors": ["#ED6E6E", "#F9CF48", "#84BB4C"],
      "min_type": "custom",
      "min_value": 1,
      "max_type": "custom",
      "max_value": 5
    }
  ],
  "column_settings": {
    "[\"name\",\"PRICE\"]": {
      "number_style": "currency",
      "currency": "USD",
      "currency_style": "symbol",
      "decimals": 2,
      "column_title": "Price (USD)"
    },
    "[\"name\",\"CREATED_AT\"]": {
      "date_style": "MMMM D, YYYY",
      "date_abbreviate": true,
      "time_enabled": null
    },
    "[\"name\",\"RATING\"]": {
      "number_style": "decimal",
      "decimals": 1,
      "suffix": " / 5"
    }
  }
}
```

### With Row Highlighting on Match
_Source: production dashboard_109 dashcard_

Highlight entire rows when a text column matches a specific value:

```json
{
  "table.column_formatting": [
    {
      "columns": ["period"],
      "type": "single",
      "operator": "=",
      "value": "- Total -",
      "color": "#FBD089",
      "highlight_row": true,
      "id": 0
    }
  ]
}
```

### Positive/Negative Conditional Formatting
_Source: production dashboard_1617 dashcard_

Colour variance columns green when positive, red when negative:

```json
{
  "table.column_formatting": [
    {
      "columns": ["vs_budget", "vs_ly", "vs_lw", "vs_budget_pct", "vs_ly_pct"],
      "type": "single",
      "operator": ">",
      "value": 0,
      "color": "#88BF4D",
      "highlight_row": false
    },
    {
      "columns": ["vs_budget", "vs_ly", "vs_lw", "vs_budget_pct", "vs_ly_pct"],
      "type": "single",
      "operator": "<",
      "value": 0,
      "color": "#E66778",
      "highlight_row": false
    },
    {
      "columns": ["country", "currency"],
      "type": "single",
      "operator": "not-null",
      "value": "",
      "color": "#FBD089",
      "highlight_row": true
    }
  ]
}
```

### Range Conditional Formatting (Colour Scale)
_Source: production card_

Use a three-colour gradient for percentage-change columns:

```json
{
  "table.column_formatting": [
    {
      "columns": ["pct_change_col_1", "pct_change_col_2"],
      "type": "range",
      "colors": ["#84BB4C", "#FFFFFF", "hsla(358, 71%, 62%, 1)"],
      "min_type": "custom",
      "max_type": "custom",
      "min_value": -0.05,
      "max_value": 0.05
    },
    {
      "columns": ["inverted_pct_col"],
      "type": "range",
      "colors": ["hsla(358, 71%, 62%, 1)", "#FFFFFF", "#84BB4C"],
      "min_type": "custom",
      "max_type": "custom",
      "min_value": -0.05,
      "max_value": 0.05
    }
  ],
  "table.row_index": true
}
```

### Table with ISA-Style Mini Bars and Renamed Columns
_Source: production card_

```json
{
  "table.pivot": false,
  "table.cell_column": "ISA",
  "table.pivot_column": "product_segment",
  "table.columns": [
    { "enabled": true,  "name": "product_segment" },
    { "enabled": false, "name": "Rag Sorter" },
    { "enabled": true,  "name": "ISA" },
    { "enabled": true,  "name": "sum" },
    { "enabled": true,  "name": "sum_2" }
  ],
  "table.column_formatting": [
    {
      "columns": ["Rag Sorter"],
      "type": "single",
      "operator": "<=",
      "value": 1,
      "color": "#509EE3",
      "highlight_row": true,
      "colors": ["white", "#509EE3"],
      "min_value": 0,
      "max_value": 100
    }
  ],
  "column_settings": {
    "[\"name\",\"ISA\"]": {
      "column_title": "ISA%",
      "decimals": 1,
      "number_style": "percent",
      "show_mini_bar": true
    },
    "[\"name\",\"sum\"]": {
      "column_title": "ISA available"
    },
    "[\"name\",\"sum_2\"]": {
      "column_title": "ISA Zoned"
    },
    "[\"name\",\"sum_3\"]": {
      "column_title": "ISA OOS"
    },
    "[\"name\",\"sum_6\"]": {
      "decimals": 0,
      "show_mini_bar": false,
      "column_title": "Lost sales"
    }
  }
}
```

---

## Scalar

### Minimal
```json
{}
```

An empty `visualization_settings` with `"display": "scalar"` will show the first numeric column
from the query result.

### With Currency Formatting
_Source: production dashboard dashcard_

```json
{
  "scalar.field": "ai_cost",
  "column_settings": {
    "[\"name\",\"ai_cost\"]": {
      "number_style": "currency",
      "decimals": 2
    }
  }
}
```

### With scalar.field (Multi-Column Query)
_Source: production dashboard dashcards_

When a single query returns many columns, use `scalar.field` at the **dashcard level** to
pick which column to display. This lets you reuse ONE query card across many scalar tiles.

```json
{
  "scalar.field": "cost_per_user",
  "column_settings": {
    "[\"name\",\"cost_per_user\"]": {
      "number_style": "currency",
      "decimals": 2
    }
  }
}
```

Other examples of `scalar.field` usage from the same dashboard:

Percentage field:
```json
{ "scalar.field": "success_rate", "column_settings": { "[\"name\",\"success_rate\"]": { "number_style": "percent", "decimals": 0 } } }
```

Plain integer (no formatting needed):
```json
{ "scalar.field": "messages_dispatched" }
```

Text/label field:
```json
{ "scalar.field": "last_sync_label", "column_settings": { "[\"name\",\"last_sync_label\"]": { "column_title": "Last sync (relative)" } } }
```

Suffix formatting:
```json
{ "scalar.field": "runtime", "column_settings": { "[\"name\",\"runtime\"]": { "suffix": "s", "decimals": 1 } } }
```

### With scalar.switch_positive_negative
_Source: production dashboard dashcards_

When a metric going UP is bad (e.g. error rate, flagging rate), flip the positive/negative colouring:

```json
{
  "scalar.field": "flagging_rate",
  "scalar.switch_positive_negative": true,
  "column_settings": {
    "[\"name\",\"flagging_rate\"]": {
      "number_style": "percent",
      "decimals": 2
    }
  }
}
```

### Scalar with Graph Settings (KPI + Trend)
_Source: production card_

When a scalar card also has graph settings, it can show a trend chart when placed in a dashboard:

```json
{
  "graph.show_values": true,
  "graph.dimensions": ["date_comparator_nk", "comparator"],
  "graph.metrics": ["sales"],
  "graph.series_order_dimension": null,
  "graph.series_order": null,
  "scalar.switch_positive_negative": false,
  "table.cell_column": "sum",
  "table.pivot_column": "comparator",
  "column_settings": {
    "[\"name\",\"sales\"]": { "decimals": 0 }
  },
  "series_settings": {
    "Actuals (TY)":    { "color": "#007d6c" },
    "Last year (LY)":  { "color": "#a989c5" },
    "Pre-Covid (19)":  { "color": "#EF8C8C" }
  }
}
```

---

## Smart Scalar

### Minimal with Previous Period Comparison
_Source: production card_

```json
{
  "column_settings": {
    "[\"name\",\"ISA %\"]": {
      "decimals": 1,
      "number_style": "percent"
    }
  }
}
```

Note: smart scalar automatically compares to the previous period by default. You only need
`scalar.comparisons` to customize or add multiple comparisons.

### With Explicit Previous Period
_Source: production card_

```json
{
  "table.pivot_column": "period",
  "table.cell_column": "count",
  "scalar.comparisons": [
    { "id": "unique-uuid-here", "type": "previousValue" }
  ]
}
```

### With Multiple Comparisons (previous period + year ago + static target)
_Source: representations repo (smart_scalar.yaml)_ `[representations]`

```json
{
  "scalar.compact_primary_number": "auto",
  "scalar.comparisons": [
    { "id": "prev_period", "type": "previousPeriod" },
    { "id": "year_ago",    "type": "periodsAgo",    "value": 12 },
    { "id": "target",      "type": "staticNumber",  "value": 50000, "label": "Monthly Target" }
  ],
  "column_settings": {
    "[\"name\",\"sum\"]": {
      "number_style": "currency",
      "currency": "USD",
      "currency_style": "symbol"
    }
  }
}
```

Comparison types:
- `"previousPeriod"` -- compares to the immediately prior period
- `"previousValue"` -- compares to the previous row value
- `"periodsAgo"` -- compares to N periods back (set `"value": 12` for year-over-year with monthly data)
- `"staticNumber"` -- compares to a fixed number (set `"value"` and optional `"label"`)

### Smart Scalar with scalar.field Override (Dashcard Level)
_Source: production dashboard dashcard_

When the underlying query returns multiple columns, override at dashcard level:

```json
{
  "scalar.comparisons": [
    { "id": "some-uuid", "type": "previousPeriod" }
  ],
  "scalar.field": "cost_per_1m_output_tokens",
  "scalar.switch_positive_negative": false,
  "column_settings": {
    "[\"name\",\"cost_per_1m_output_tokens\"]": {
      "number_style": "currency"
    }
  }
}
```

---

## Pie Chart

### With Custom Colors and Legend
_Source: representations repo (pie_chart.yaml)_ `[representations]`

```json
{
  "pie.dimension": "CATEGORY",
  "pie.metric": "count",
  "pie.show_legend": true,
  "pie.show_total": true,
  "pie.percent_visibility": "both",
  "pie.slice_threshold": 2.5,
  "pie.colors": {
    "Widget":    "#509EE3",
    "Gadget":    "#88BF4D",
    "Gizmo":     "#F9CF48",
    "Doohickey": "#ED6E6E"
  }
}
```

Settings reference:
- `pie.dimension` -- the column used to create slices
- `pie.metric` -- the column used for slice values
- `pie.show_legend` -- show/hide the legend
- `pie.show_total` -- show total in the center
- `pie.percent_visibility` -- `"both"`, `"inside"`, `"legend"`, or `"off"`
- `pie.slice_threshold` -- minimum percentage to show as a separate slice (smaller ones grouped as "Other")
- `pie.colors` -- object mapping slice names to hex colours

---

## Waterfall

### Minimal
_Source: representations repo (waterfall.yaml)_ `[representations]`

```json
{
  "waterfall.increase_color": "#88BF4D",
  "waterfall.decrease_color": "#EF8C8C",
  "waterfall.total_color": "#509EE3",
  "waterfall.show_total": true
}
```

### Full Waterfall (Margin Bridge)
_Source: production card_

```json
{
  "graph.dimensions": ["metric"],
  "graph.metrics": ["value"],
  "graph.show_values": true,
  "graph.show_trendline": false,
  "graph.x_axis.labels_enabled": false,
  "graph.x_axis.scale": "ordinal",
  "graph.y_axis.title_text": "GBP / EUR",
  "graph.y_axis.labels_enabled": true,
  "graph.y_axis.axis_enabled": false,
  "waterfall.increase_color": "#88BF4D",
  "waterfall.decrease_color": "#EF8C8C",
  "waterfall.show_total": false,
  "column_settings": {
    "[\"name\",\"value\"]": { "decimals": 2 }
  }
}
```

---

## Pivot Table

### Example
_Source: representations repo (pivot_table.yaml)_ `[representations]`

```json
{
  "pivot_table.column_split": {
    "rows":    ["CATEGORY"],
    "columns": ["CREATED_AT"],
    "values":  ["count", "sum"]
  },
  "pivot_table.show_row_totals": true,
  "pivot_table.show_column_totals": true,
  "pivot_table.collapsed_rows": {
    "rows": [],
    "value": []
  },
  "column_settings": {
    "[\"name\",\"sum\"]": {
      "number_style": "currency",
      "currency": "USD",
      "currency_style": "symbol",
      "decimals": 0
    }
  }
}
```

Settings reference:
- `pivot_table.column_split.rows` -- columns placed in row headers
- `pivot_table.column_split.columns` -- columns placed in column headers
- `pivot_table.column_split.values` -- columns used as cell values
- `pivot_table.show_row_totals` / `pivot_table.show_column_totals` -- toggle totals
- `pivot_table.collapsed_rows` -- controls which row groups are collapsed by default

---

## Gauge

_Source: representations repo (gauge.yaml)_ `[representations]`

```json
{
  "gauge.segments": [
    { "min": 0,      "max": 50000,  "color": "#ED6E6E", "label": "Low" },
    { "min": 50000,  "max": 150000, "color": "#F9CF48", "label": "Medium" },
    { "min": 150000, "max": 300000, "color": "#84BB4C", "label": "High" }
  ]
}
```

---

## Funnel

_Source: representations repo (funnel.yaml)_ `[representations]`

```json
{
  "funnel.dimension": "CATEGORY",
  "funnel.metric": "count",
  "funnel.type": "funnel"
}
```

---

## Map (Pin)

_Source: representations repo (map_pins.yaml)_ `[representations]`

```json
{
  "map.type": "pin",
  "map.latitude_column": "LATITUDE",
  "map.longitude_column": "LONGITUDE",
  "map.pin_type": "markers",
  "map.zoom": 4,
  "map.center_latitude": 39.5,
  "map.center_longitude": -98.35
}
```

---

## Column Settings Deep Dive

### Number Formatting
```json
{
  "column_settings": {
    "[\"name\",\"revenue\"]": {
      "number_style": "decimal",
      "decimals": 0
    }
  }
}
```

### Currency
_Source: production card + representations repo_

```json
{
  "column_settings": {
    "[\"name\",\"cost\"]": {
      "number_style": "currency",
      "currency": "USD",
      "currency_style": "symbol",
      "currency_in_header": false,
      "decimals": 2
    }
  }
}
```

`currency_in_header`:
- `true` -- shows the currency symbol in the column header instead of each cell
- `false` -- shows the currency symbol in each cell value

### Percentage
```json
{
  "column_settings": {
    "[\"name\",\"margin_pct\"]": {
      "number_style": "percent",
      "decimals": 1
    }
  }
}
```

Note: Metabase expects percent values as decimals (0.15 = 15%). If your query returns 15 for 15%,
use `"scale": 0.01` to convert.

### Date Formatting
_Source: production dashboard_109 dashcard + representations repo_

```json
{
  "column_settings": {
    "[\"name\",\"created_at\"]": {
      "date_style": "MMMM D, YYYY",
      "date_abbreviate": true,
      "time_enabled": null
    }
  }
}
```

- `date_style` -- format string (e.g. `"MMMM D, YYYY"`, `"M/D/YYYY"`, `"YYYY-MM-DD"`)
- `date_abbreviate` -- abbreviate month names (`true` = "Jan" instead of "January")
- `time_enabled` -- `null` to hide time, `"minutes"`, `"seconds"`, or `"milliseconds"`

### Custom Prefix/Suffix and Scale
_Source: production dashboard + card_

```json
{
  "column_settings": {
    "[\"name\",\"actual\"]": {
      "scale": 0.001,
      "suffix": "k",
      "decimals": 0
    },
    "[\"name\",\"bps_change\"]": {
      "scale": 10000,
      "suffix": " bps",
      "decimals": 0
    },
    "[\"name\",\"tput\"]": {
      "decimals": 0,
      "suffix": " t/s"
    },
    "[\"name\",\"latency\"]": {
      "decimals": 1,
      "suffix": "s"
    }
  }
}
```

Common scale patterns:
- `"scale": 0.001` + `"suffix": "k"` -- divide by 1000, show as "123k"
- `"scale": 10000` + `"suffix": " bps"` -- convert decimal to basis points (0.0042 -> "42 bps")
- `"scale": 0.01` -- convert integer percentages to Metabase's decimal format

### Column Title Override
```json
{
  "column_settings": {
    "[\"name\",\"sum\"]": {
      "column_title": "Total Revenue"
    },
    "[\"name\",\"currency\"]": {
      "column_title": " "
    }
  }
}
```

---

## Series Settings Deep Dive

### Custom Colors
_Source: production cards_

```json
{
  "series_settings": {
    "Series A": { "color": "#007d6c" },
    "Series B": { "color": "#a989c5" },
    "Series C": { "color": "#EF8C8C" },
    "Series D": { "color": "#fbd089" }
  }
}
```

### Mixed Display Types (Line + Bar on same chart)
_Source: production card_

```json
{
  "series_settings": {
    "conversion_rate": {
      "color": "#007d6c",
      "display": "line",
      "axis": "right",
      "title": "Conversion Rate"
    },
    "traffic": {
      "color": "#fbd089",
      "display": "bar",
      "axis": "left",
      "title": "Traffic"
    }
  }
}
```

### Line Styles
_Source: representations repo (line_chart.yaml)_ `[representations]`

```json
{
  "series_settings": {
    "revenue": {
      "display": "line",
      "color": "#509EE3",
      "line.style": "solid",
      "line.size": "M",
      "line.interpolate": "cardinal",
      "line.missing": "interpolate",
      "line.marker_enabled": true,
      "show_series_values": true
    }
  }
}
```

Line style options:
- `line.style` -- `"solid"`, `"dashed"`, `"dotted"`
- `line.size` -- `"S"`, `"M"`, `"L"`
- `line.interpolate` -- `"linear"`, `"cardinal"`, `"step-after"`, `"step-before"`
- `line.missing` -- `"interpolate"` (connect points), `"zero"` (treat as 0), `"none"` (gap)
- `line.marker_enabled` -- show/hide data point markers

### Series Title Override
```json
{
  "series_settings": {
    "sum":   { "title": "Total Items" },
    "sum_2": { "title": "Sales inc VAT" },
    "sum_3": { "title": "Sales ex VAT" }
  }
}
```

---

## Conditional Formatting (Tables) Deep Dive

### Single Value Highlight
_Source: production dashboards_

```json
{
  "table.column_formatting": [
    {
      "columns": ["status_column"],
      "type": "single",
      "operator": "=",
      "value": "Critical",
      "color": "#ED6E6E",
      "highlight_row": true
    }
  ]
}
```

Available operators for `"type": "single"`:
- `"="`, `"!="` -- exact match
- `">"`, `">="`, `"<"`, `"<="` -- numeric comparison
- `"contains"`, `"does-not-contain"` -- text substring
- `"starts-with"`, `"ends-with"` -- text prefix/suffix
- `"is-null"`, `"not-null"` -- null checks

### Range Colour Scale
_Source: production card + representations repo_

```json
{
  "table.column_formatting": [
    {
      "columns": ["rating"],
      "type": "range",
      "colors": ["#ED6E6E", "#F9CF48", "#84BB4C"],
      "min_type": "custom",
      "min_value": 1,
      "max_type": "custom",
      "max_value": 5
    }
  ]
}
```

Range settings:
- `colors` -- array of 2 or 3 hex colours (low, [mid], high)
- `min_type` / `max_type` -- `"custom"` for fixed values, `null` for auto
- `min_value` / `max_value` -- the numeric boundaries

### Combined: Positive Green / Negative Red / Header Row Highlight
_Source: production dashboard_1617 dashcards_

This is a very common pattern for financial tables:

```json
{
  "table.column_formatting": [
    {
      "columns": ["variance_abs", "variance_pct", "vs_budget", "vs_ly"],
      "type": "single",
      "operator": ">",
      "value": 0,
      "color": "#88BF4D",
      "highlight_row": false
    },
    {
      "columns": ["variance_abs", "variance_pct", "vs_budget", "vs_ly"],
      "type": "single",
      "operator": "<",
      "value": 0,
      "color": "#E66778",
      "highlight_row": false
    },
    {
      "columns": ["group_header_col"],
      "type": "single",
      "operator": "not-null",
      "value": "",
      "color": "#A989C5",
      "highlight_row": true
    }
  ]
}
```

---

## Dashboard Text Cards

Text cards on dashboards use a special `virtual_card` structure:

```json
{
  "virtual_card": {
    "name": null,
    "display": "text",
    "visualization_settings": {},
    "dataset_query": {},
    "archived": false
  },
  "text": "## Section Header\nMarkdown content here.",
  "dashcard.background": false,
  "text.align_vertical": "middle",
  "text.align_horizontal": "left"
}
```

---

## card.title Override

At the dashcard level, override the displayed title without changing the saved card name:

```json
{
  "card.title": "Revenue ex VAT"
}
```

Use `"card.title": "        "` (spaces) to effectively hide the title while keeping the spacing.

---

## Quick Reference: Common Colour Palette

These hex colours appear most frequently across the production dashboards:

| Colour | Hex | Usage |
|--------|-----|-------|
| Teal/Green (primary) | `#007d6c` | Primary positive metric |
| Gold/Amber | `#fbd089` / `#FBD089` | Secondary, highlights, totals |
| Green (positive) | `#88BF4D` / `#84BB4C` | Positive variance, increase |
| Red (negative) | `#EF8C8C` / `#E66778` / `#ED6E6E` | Negative variance, decrease |
| Blue | `#509EE3` | Default Metabase blue |
| Purple | `#a989c5` / `#A989C5` | Prior year comparison |
| Brand teal | `#007d6c` | Current year actuals |
| Waterfall total | `#509EE3` | Waterfall total bar |
