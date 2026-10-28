const TIMEOUT_MS = 10000;

export async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  latest: (cursor) => getJson('/api/articles/latest' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')),
  popular: () => getJson('/api/articles/popular'),
  featured: () => getJson('/api/articles/featured'),
  rising: () => getJson('/api/articles/rising'),
  videos: () => getJson('/api/videos'),
  banners: () => getJson('/api/banners'),
  categoryArticles(name, { sub, cursor } = {}) {
    const params = new URLSearchParams();
    if (sub) params.set('sub', sub);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return getJson(`/api/categories/${encodeURIComponent(name)}/articles${qs ? `?${qs}` : ''}`);
  }
};
