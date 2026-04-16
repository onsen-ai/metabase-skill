const REPLACE_KEYS = new Set([
  'dataset_query', 'result_metadata', 'parameter_mappings', 'parameters',
  'dashcards', 'tabs', 'series',
]);

export function deepMerge(target, patch) {
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    const patchVal = patch[key];
    const targetVal = result[key];

    if (patchVal === null || patchVal === undefined) {
      result[key] = patchVal;
    } else if (Array.isArray(patchVal)) {
      result[key] = patchVal;
    } else if (REPLACE_KEYS.has(key)) {
      result[key] = patchVal;
    } else if (typeof patchVal === 'object' && typeof targetVal === 'object' && !Array.isArray(targetVal) && targetVal !== null) {
      result[key] = deepMerge(targetVal, patchVal);
    } else {
      result[key] = patchVal;
    }
  }
  return result;
}

export function stripReadOnlyCardFields(card) {
  const {
    creator, collection, dashboard, 'last-edit-info': lei,
    param_fields, moderation_reviews, can_write, can_delete,
    can_restore, can_run_adhoc_query, can_manage_db, view_count,
    average_query_time, dashboard_count, parameter_usage_count,
    last_query_start, last_used_at, cache_invalidated_at,
    created_at, updated_at, entity_id, creator_id, is_remote_synced,
    archived_directly, initially_published_at, dependency_analysis_version,
    made_public_by_id, public_uuid, legacy_query, document_id,
    card_schema, metabase_version, query_description, persisted,
    ...writable
  } = card;
  return writable;
}

export function stripReadOnlyDashboardFields(dash) {
  const {
    creator_id, collection, 'last-edit-info': lei, param_fields,
    moderation_reviews, can_write, can_delete, can_restore,
    can_set_cache_policy, view_count, last_viewed_at,
    last_used_param_values, created_at, updated_at, entity_id,
    is_remote_synced, archived_directly, show_in_getting_started,
    dependency_analysis_version, initially_published_at,
    made_public_by_id, public_uuid, collection_authority_level,
    translations, id,
    ...writable
  } = dash;
  return writable;
}

export function prepareDashcardsForPut(dashcards) {
  return dashcards.map(dc => ({
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
  }));
}

export function prepareTabsForPut(tabs) {
  return (tabs || []).map(t => ({ id: t.id, name: t.name }));
}
