export function summarizeCard(card) {
  return {
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
}

export function summarizeDashboard(dash) {
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
    cards: (dash.dashcards || [])
      .filter(dc => dc.card_id)
      .map(dc => ({
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
      })),
    virtual_cards: (dash.dashcards || [])
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
    card_count: (dash.dashcards || []).filter(dc => dc.card_id).length,
    virtual_count: (dash.dashcards || []).filter(dc => !dc.card_id).length,
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
