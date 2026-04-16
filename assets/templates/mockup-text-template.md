# Dashboard Mockup: [Name]

Grid: 24 columns. Each card shows [name: value/type] with column width.

## Filters
```
[Filter1 ▼ default_value]  [Filter2 ▼ default_value]  [Filter3 ▼ default_value]
```

## Tab: [Name]

### Row 0 — KPI Cards
```
[Metric1: $1.5M]  [Metric2: 18,760]  [Metric3: $80.35]  [Metric4: 2,500]
     6 cols             6 cols             6 cols             6 cols
```

### Row 4 — Charts
```
[Chart Title ───────────────────]  [Chart Title ───────────────────]
  line chart, 12 cols                bar chart, 12 cols
  y: revenue                         y: count
  x: month                           x: category
```

### Row 12 — Tables
```
[Table Title ──────────────────────────────────────────────────────]
  table, 24 cols
  columns: name, category, revenue, orders, avg_price
```

## Tab: [Name]

### Row 0 — Section Heading
```
[## Section Title ─────────────────────────────────────────────────]
  virtual heading, 24 cols x 1 row
```

### Row 1 — Content
```
[Card Title ────────────────────]  [Card Title ────────────────────]
  [display type], 12 cols            [display type], 12 cols
```

---

Notes:
- 24-column grid. Cards cannot exceed col + size_x <= 24.
- Scalar cards: typically 6x4 (4 across) or 8x4 (3 across)
- Charts: typically 12x8 (2 across) or 24x8 (full width)
- Tables: typically 24x10 (full width)
- Virtual headings: 24x1
- Leave no gaps between rows unless intentional spacing
