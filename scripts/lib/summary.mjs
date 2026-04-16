export function summarizeCard(card) {
  const out = {
    id: card.id,
    name: card.name,
    type: card.type,
    display: card.display,
    query_type: card.query_type,
    database_id: card.database_id,
    table_id: card.table_id,
    collection_id: card.collection_id,
    archived: card.archived,
    description: card.description || null,
  };

  // Produced columns (from result_metadata) — primary signal for "what does this card return?"
  if (Array.isArray(card.result_metadata) && card.result_metadata.length) {
    const cols = card.result_metadata.map(c => c.display_name || c.name).filter(Boolean);
    out.result_columns = cols.slice(0, 20);
    if (cols.length > 20) out.result_columns_truncated = cols.length;
  }

  // Native SQL: snippets and template tags — tells us the card's parameters and shared SQL
  const stage = card.dataset_query?.stages?.[0];
  const tags = stage?.['template-tags'] || card.dataset_query?.native?.['template-tags'];
  if (tags && typeof tags === 'object') {
    const referenced_snippets = [];
    const template_tags = [];
    for (const [key, tag] of Object.entries(tags)) {
      if (tag?.type === 'snippet') {
        if (tag['snippet-name']) referenced_snippets.push(tag['snippet-name']);
      } else if (tag?.type) {
        const t = { name: tag.name || key, type: tag.type };
        if (tag['widget-type']) t.widget_type = tag['widget-type'];
        if (tag.default !== undefined && tag.default !== null) t.default = tag.default;
        if (tag.required) t.required = true;
        template_tags.push(t);
      }
    }
    if (referenced_snippets.length) out.referenced_snippets = referenced_snippets;
    if (template_tags.length) out.template_tags = template_tags;
  }

  return out;
}

function resolveColumnRefs(refs, mapping) {
  if (!Array.isArray(refs)) return refs;
  if (!mapping || typeof mapping !== 'object') return refs;
  return refs.map(r => {
    const entry = mapping[r];
    return (Array.isArray(entry) && entry[0]?.originalName) || r;
  });
}

function extractDashcardOverrides(viz) {
  if (!viz || typeof viz !== 'object') return undefined;
  // Two patterns coexist:
  // - Simple dashcards put overrides at the top level (e.g. scalars)
  // - Combined-visualization dashcards wrap them in viz.visualization.settings
  //   and reference columns as COLUMN_N via columnValuesMapping
  const settings = viz.visualization?.settings || viz;
  const mapping = viz.visualization?.columnValuesMapping;
  const out = {};
  if (settings['card.title']) out.title = settings['card.title'];
  if (settings['card.description']) out.description = settings['card.description'];
  if (settings['scalar.field']) out.scalar_field = settings['scalar.field'];
  if (Array.isArray(settings['graph.metrics']) && settings['graph.metrics'].length) {
    out.graph_metrics = resolveColumnRefs(settings['graph.metrics'], mapping);
  }
  if (Array.isArray(settings['graph.dimensions']) && settings['graph.dimensions'].length) {
    out.graph_dimensions = resolveColumnRefs(settings['graph.dimensions'], mapping);
  }
  if (settings.series_settings && typeof settings.series_settings === 'object') {
    const titles = {};
    for (const [k, v] of Object.entries(settings.series_settings)) {
      if (v && typeof v === 'object' && v.title) titles[k] = v.title;
    }
    if (Object.keys(titles).length) out.series_titles = titles;
  }
  return Object.keys(out).length ? out : undefined;
}

export function summarizeDashboard(dash) {
  const dashcards = dash.dashcards || [];
  const cardIdCounts = {};
  for (const dc of dashcards) {
    if (dc.card_id) cardIdCounts[dc.card_id] = (cardIdCounts[dc.card_id] || 0) + 1;
  }
  const repeated_card_ids = Object.entries(cardIdCounts)
    .filter(([, n]) => n > 1)
    .map(([id, n]) => ({ card_id: Number(id), count: n }));

  return {
    id: dash.id,
    name: dash.name,
    description: dash.description || null,
    width: dash.width,
    auto_apply_filters: dash.auto_apply_filters,
    collection_id: dash.collection_id,
    archived: dash.archived,
    tabs: (dash.tabs || []).map(t => ({ id: t.id, name: t.name })),
    parameters: (dash.parameters || []).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      default: p.default,
    })),
    cards: dashcards
      .filter(dc => dc.card_id)
      .map(dc => {
        const overrides = extractDashcardOverrides(dc.visualization_settings);
        return {
          dashcard_id: dc.id,
          card_id: dc.card_id,
          name: dc.card?.name || null,
          display: dc.card?.display || null,
          row: dc.row,
          col: dc.col,
          size_x: dc.size_x,
          size_y: dc.size_y,
          tab_id: dc.dashboard_tab_id,
          param_mappings: dc.parameter_mappings?.length || 0,
          ...(overrides ? { overrides } : {}),
        };
      }),
    virtual_cards: dashcards
      .filter(dc => !dc.card_id)
      .map(dc => ({
        dashcard_id: dc.id,
        type: dc.visualization_settings?.virtual_card?.display || 'unknown',
        text: (dc.visualization_settings?.text || '').substring(0, 80),
        row: dc.row,
        col: dc.col,
        size_x: dc.size_x,
        size_y: dc.size_y,
        tab_id: dc.dashboard_tab_id,
      })),
    card_count: dashcards.filter(dc => dc.card_id).length,
    unique_card_count: Object.keys(cardIdCounts).length,
    repeated_card_ids,
    virtual_count: dashcards.filter(dc => !dc.card_id).length,
    param_count: (dash.parameters || []).length,
    tab_count: (dash.tabs || []).length,
  };
}

export function layoutDashboard(dash) {
  return {
    name: dash.name,
    description: dash.description,
    width: dash.width,
    auto_apply_filters: dash.auto_apply_filters,
    tabs: (dash.tabs || []).map(t => ({ id: t.id, name: t.name })),
    parameters: dash.parameters || [],
    dashcards: (dash.dashcards || []).map(dc => ({
      id: dc.id,
      card_id: dc.card_id,
      dashboard_tab_id: dc.dashboard_tab_id,
      row: dc.row,
      col: dc.col,
      size_x: dc.size_x,
      size_y: dc.size_y,
      parameter_mappings: dc.parameter_mappings || [],
      visualization_settings: dc.visualization_settings || {},
      series: dc.series?.map(s => ({ id: s.id })) || [],
    })),
  };
}
