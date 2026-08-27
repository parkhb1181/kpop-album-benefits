/**
 * 특전 실물 제보 — 저장과 검수.
 *
 * **자동 공개는 없다.** 공개 사이트에 검수 없는 이미지 업로드를 열면 반드시 이상한 게
 * 올라온다. 가능성이 아니라 시간문제고, 그게 팬 사이트에 뜨는 순간 끝이다.
 * 그래서 흐름이 고정이다: 업로드 → 비공개 대기열 → 사람이 승인 → 그때 공개.
 *
 * 어디에 담는가 —
 *   메타데이터  Upstash KV (이미 있다)
 *   이미지     Vercel Blob (퍼스트파티, 새 약관이 안 붙는다)
 * Supabase를 안 쓰는 이유는 위 둘로 충분한데 플랫폼만 하나 더 늘기 때문이다.
 * 실시간도 안 쓴다 — 제보가 뜨는 걸 지켜보는 사람이 없고, 사이트는 어차피 다시 만들어진다.
 */

import { getJSON, setJSON, configured } from './_store.js';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
export const blobReady = Boolean(BLOB_TOKEN);

/** 받아들이는 이미지 — 확장자가 아니라 실제 바이트로 판별한다 */
const SIGNATURES = [
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  },
];

export const MAX_BYTES = 6 * 1024 * 1024;

/**
 * 확장자나 Content-Type을 믿지 않는다. `.jpg`로 이름 붙인 실행 파일도 올라온다.
 * 앞머리 바이트로 실제 형식을 본다.
 */
export function sniff(buf) {
  return SIGNATURES.find((s) => s.test(buf)) || null;
}

/** Vercel Blob에 올린다. 패키지 없이 REST로 — 이 프로젝트는 의존성을 안 늘린다. */
export async function putBlob(path, buf, contentType) {
  const res = await fetch(`https://blob.vercel-storage.com/${encodeURI(path)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${BLOB_TOKEN}`,
      'x-api-version': '7',
      'x-content-type': contentType,
      // 대기열 단계에서는 공개 주소를 만들되 경로를 못 맞히게 한다.
      // 승인 전 이미지가 검색·목록에 노출되면 검수가 무의미해진다.
      'x-add-random-suffix': '1',
    },
    body: buf,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Blob ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).url;
}

export async function delBlob(url) {
  await fetch('https://blob.vercel-storage.com/delete', {
    method: 'POST',
    headers: { authorization: `Bearer ${BLOB_TOKEN}`, 'content-type': 'application/json', 'x-api-version': '7' },
    body: JSON.stringify({ urls: [url] }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

// ── 대기열 ──────────────────────────────────────────────────

const PENDING = 'reports:pending';
const APPROVED = 'reports:approved';

export const listPending = async () => (await getJSON(PENDING)) || [];
export const listApproved = async () => (await getJSON(APPROVED)) || [];

export async function addPending(report) {
  const q = await listPending();
  q.unshift(report);
  // 대기열이 무한정 커지지 않게 막는다 — 방치하면 검수 화면이 못 열린다
  await setJSON(PENDING, q.slice(0, 300));
}

/** 승인/거절. 거절이면 올라온 이미지를 실제로 지운다 — 보관할 이유가 없다. */
export async function decide(id, approve) {
  const q = await listPending();
  const i = q.findIndex((r) => r.id === id);
  if (i < 0) return { ok: false, error: '대기열에 없습니다' };
  const [r] = q.splice(i, 1);
  await setJSON(PENDING, q);

  if (!approve) {
    if (r.url) await delBlob(r.url);
    return { ok: true, approved: false };
  }
  const a = await listApproved();
  a.unshift({ ...r, approvedAt: new Date().toISOString() });
  await setJSON(APPROVED, a.slice(0, 2000));
  return { ok: true, approved: true };
}

/** 같은 사람이 쏟아붓지 못하게 한다. 정교할 필요는 없고 폭주만 막으면 된다. */
export async function rateLimited(ip) {
  if (!configured || !ip) return false;
  const key = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`; // 시간 단위
  const n = ((await getJSON(key)) || 0) + 1;
  await setJSON(key, n);
  return n > 10;
}
