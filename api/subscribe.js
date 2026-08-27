import { addSubscription, removeSubscription, configured } from './_store.js';

/**
 * 구독 등록·해지.
 *
 * 저장하는 건 푸시 엔드포인트 하나뿐이다 — 이메일도, 계정도, 어떤 아티스트를 좋아하는지도
 * 받지 않는다. 알림은 "새 예판이 떴다" 하나라서 그 이상이 필요 없다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 받습니다' });
  if (!configured) return res.status(503).json({ error: '알림 저장소가 아직 연결되지 않았습니다' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const endpoint = body.subscription?.endpoint || body.endpoint;
    if (!endpoint || !/^https:\/\//.test(endpoint)) {
      return res.status(400).json({ error: '구독 정보가 올바르지 않습니다' });
    }
    if (body.unsubscribe) {
      await removeSubscription(endpoint);
      return res.status(200).json({ ok: true, subscribed: false });
    }
    await addSubscription({ endpoint });
    return res.status(200).json({ ok: true, subscribed: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
