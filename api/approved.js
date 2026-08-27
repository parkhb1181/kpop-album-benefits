import { listApproved } from './_reports.js';
import { configured } from './_store.js';

/**
 * 승인된 제보 목록. 빌드가 읽어 앨범 페이지에 얹는다.
 *
 * 빌드가 KV를 직접 보지 않고 이 엔드포인트를 거치는 이유 —
 * GitHub Actions에 KV 토큰을 또 넣지 않기 위해서다. 비밀은 적게 퍼질수록 좋다.
 * 승인된 것만 나가므로 공개해도 된다.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured) return res.status(200).json({ reports: [] });
  try {
    return res.status(200).json({ reports: await listApproved() });
  } catch (e) {
    return res.status(200).json({ reports: [], error: e.message });
  }
}
