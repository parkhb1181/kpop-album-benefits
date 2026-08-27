/** 진단용 — 이름과 배포 환경만 본다. 값은 절대 안 내보낸다. 확인 후 삭제. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const names = Object.keys(process.env).sort();
  return res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    target: process.env.VERCEL_TARGET_ENV || null,
    names,
  });
}
