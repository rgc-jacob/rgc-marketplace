import { supabase } from './supabase';

/**
 * RGC Fastify droplet base URL (no trailing slash). When unset, calls go straight to Edge fallbacks.
 * @see docs/BACKEND_INVENTORY_WEB_APPENDIX.md
 */
export function getRgcBackendBaseUrl() {
  const raw = import.meta.env.VITE_RGC_BACKEND_URL;
  return typeof raw === 'string' ? raw.replace(/\/$/, '') : '';
}

async function postJson(url, body, { signal } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

function useEdgeFallback(res, fetchError) {
  if (fetchError) return true;
  if (!res) return true;
  if (res.status >= 500) return true;
  if (res.status === 0) return true;
  return false;
}

/**
 * Turn /api/v1/search/suggest (or Edge proxy) JSON into display strings.
 * Handles several shapes used across RGC clients.
 * @param {unknown} data
 * @returns {string[]}
 */
export function normalizeRgcSuggestResponse(data) {
  const seen = new Set();
  const out = [];

  const push = (s) => {
    const t = typeof s === 'string' ? s.trim() : '';
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  };

  const fromObject = (o) => {
    if (!o || typeof o !== 'object') return;
    const cand =
      o.name ??
      o.title ??
      o.label ??
      o.text ??
      o.suggestion ??
      o.query ??
      o.value;
    if (typeof cand === 'string') push(cand);
  };

  const walk = (node, depth = 0) => {
    if (node == null || depth > 4) return;
    if (typeof node === 'string') {
      push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof node !== 'object') return;

    const arrays = ['suggestions', 'results', 'items', 'hits', 'data'];
    for (const k of arrays) {
      if (Array.isArray(node[k])) {
        walk(node[k], depth + 1);
        return;
      }
    }
    fromObject(node);
  };

  let root = data;
  if (root && typeof root === 'object' && root.data !== undefined && !Array.isArray(root)) {
    root = root.data;
  }
  walk(root);
  return out;
}

/**
 * Smart card search (primary: Fastify POST /api/v1/search, fallback: Edge search-proxy).
 * @param {{ search_query: string, result_limit?: number, cursor_rank?: string, cursor_id?: string }} params
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ data: unknown, source: 'backend'|'edge', error: Error|null }>}
 */
export async function rgcSmartSearch(params, options = {}) {
  const base = getRgcBackendBaseUrl();
  const body = {
    search_query: params.search_query,
    result_limit: params.result_limit ?? 24,
    ...(params.cursor_rank != null ? { cursor_rank: params.cursor_rank } : {}),
    ...(params.cursor_id != null ? { cursor_id: params.cursor_id } : {}),
  };

  if (base) {
    try {
      const { res, data } = await postJson(`${base}/api/v1/search`, body, options);
      if (res.ok) return { data, source: 'backend', error: null };
      if (!useEdgeFallback(res)) {
        return {
          data: null,
          source: 'backend',
          error: new Error(`Search failed (${res.status})`),
        };
      }
    } catch (e) {
      if (!useEdgeFallback(null, e)) throw e;
    }
  }

  const { data, error } = await supabase.functions.invoke('search-proxy', {
    body,
  });
  if (error) return { data: null, source: 'edge', error: new Error(error.message) };
  return { data, source: 'edge', error: null };
}

/**
 * Search autocomplete (primary: Fastify POST /api/v1/search/suggest, fallback: Edge search-proxy).
 * @param {{ search_prefix: string, result_limit?: number }} params
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ data: unknown, source: 'backend'|'edge', error: Error|null }>}
 */
export async function rgcSearchSuggest(params, options = {}) {
  const base = getRgcBackendBaseUrl();
  const body = {
    search_prefix: params.search_prefix,
    result_limit: params.result_limit ?? 10,
  };

  if (base) {
    try {
      const { res, data } = await postJson(`${base}/api/v1/search/suggest`, body, options);
      if (res.ok) return { data, source: 'backend', error: null };
      if (!useEdgeFallback(res)) {
        return {
          data: null,
          source: 'backend',
          error: new Error(`Suggest failed (${res.status})`),
        };
      }
    } catch (e) {
      if (!useEdgeFallback(null, e)) throw e;
    }
  }

  const { data, error } = await supabase.functions.invoke('search-proxy', {
    body,
  });
  if (error) return { data: null, source: 'edge', error: new Error(error.message) };
  return { data, source: 'edge', error: null };
}

const PRICE_CHARTING_PATHS = {
  search: '/api/v1/prices/search',
  'top-movers': '/api/v1/prices/top-movers',
  product: '/api/v1/prices/product',
};

/**
 * PriceCharting-style proxy (primary: Fastify, fallback: Edge pricecharting-proxy).
 * @param {{ route: 'search'|'top-movers'|'product', params: Record<string, unknown> }} payload
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ data: unknown, source: 'backend'|'edge', error: Error|null }>}
 */
export async function rgcPriceChartingRequest(payload, options = {}) {
  const { route, params } = payload;
  const path = PRICE_CHARTING_PATHS[route];
  if (!path) {
    return {
      data: null,
      source: 'backend',
      error: new Error(`Unknown price route: ${route}`),
    };
  }

  const body = { route, params };
  const base = getRgcBackendBaseUrl();

  if (base) {
    try {
      const { res, data } = await postJson(`${base}${path}`, body, options);
      if (res.ok) return { data, source: 'backend', error: null };
      if (!useEdgeFallback(res)) {
        return {
          data: null,
          source: 'backend',
          error: new Error(`Price request failed (${res.status})`),
        };
      }
    } catch (e) {
      if (!useEdgeFallback(null, e)) throw e;
    }
  }

  const { data, error } = await supabase.functions.invoke('pricecharting-proxy', {
    body,
  });
  if (error) return { data: null, source: 'edge', error: new Error(error.message) };
  return { data, source: 'edge', error: null };
}
