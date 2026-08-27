/**
 * 진단용 — 함수가 실제로 어떤 환경변수를 보는지 이름만 보고한다.
 * 값은 절대 내보내지 않는다. 확인이 끝나면 지운다.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const names = Object.keys(process.env).sort();
  return res.status(200).json({
    kvLike: names.filter((n) => /^(KV|UPSTASH|REDIS)/i.test(n)),
    vapidLike: names.filter((n) => /^(VAPID|SITE_URL|CRON)/i.test(n)),
    total: names.length,
    node: process.version,
  });
}
