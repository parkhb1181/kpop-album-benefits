import { getJSON, configured } from './_store.js';

/**
 * 서비스워커가 깨어난 뒤 "무엇이 새로 떴는지" 읽어가는 곳.
 *
 * 푸시를 페이로드 없이 보내기 때문에(vapid.mjs 참고) 내용은 여기서 온다.
 * 덕분에 알림 문구가 **발송 시점이 아니라 열람 시점** 기준으로 맞는다.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured) return res.status(200).json({ new: [], at: null });
  try {
    const latest = await getJSON('latest');
    return res.status(200).json(latest || { new: [], at: null });
  } catch (e) {
    return res.status(200).json({ new: [], at: null, error: e.message });
  }
}
