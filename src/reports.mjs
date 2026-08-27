import { getText } from './fetchx.mjs';

/**
 * 승인된 특전 제보를 빌드로 가져온다.
 *
 * 실패해도 빌드를 세우지 않는다. 제보는 덤이고, 없다고 사이트가 못 나갈 이유가 없다.
 */
export async function fetchApproved(siteUrl) {
  if (!siteUrl) return [];
  try {
    const j = JSON.parse(await getText(`${siteUrl}/api/approved`, { timeout: 8000 }));
    return Array.isArray(j.reports) ? j.reports : [];
  } catch {
    return [];
  }
}

/** 앨범 slug → 그 앨범 제보들 */
export function byAlbum(reports) {
  const m = new Map();
  for (const r of reports || []) {
    if (!r?.slug || !r?.url) continue;
    if (!m.has(r.slug)) m.set(r.slug, []);
    m.get(r.slug).push(r);
  }
  return m;
}
