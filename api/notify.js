import { allSubscriptions, removeSubscription, getJSON, setJSON, configured } from './_store.js';
import { sendPush } from '../src/vapid.mjs';

/**
 * 크론이 부른다. 사이트에 새 앨범이 올라왔으면 구독자를 깨운다.
 *
 * **마감 알림은 여기서 안 보낸다.** 그건 캘린더(.ics)가 하루 전·1시간 전에 이미 울린다.
 * 둘 다 보내면 같은 일로 알림이 두 번 온다. 푸시는 캘린더가 못 하는 것 —
 * "없던 게 생겼다" — 만 맡는다.
 *
 * 판단 근거는 배포된 index.json이다. 저장소 파일을 읽지 않아서
 * 함수가 어떤 파일을 포함하는지에 기대지 않는다.
 */

const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');

export default async function handler(req, res) {
  // 크론 외의 호출을 막는다. Vercel 크론은 이 헤더를 붙여 온다.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: '권한 없음' });
  }
  if (!configured) return res.status(503).json({ error: 'KV 미설정' });
  if (!SITE) return res.status(503).json({ error: 'SITE_URL 미설정' });

  const vapid = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:noreply@kpop-album.vercel.app',
  };
  if (!vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'VAPID 키 미설정' });

  try {
    const idx = await (await fetch(`${SITE}/index.json`, { signal: AbortSignal.timeout(10000) })).json();
    const live = (idx.albums || []).filter((a) => !a.expired);
    const slugs = live.map((a) => a.slug);

    const seen = (await getJSON('seen-slugs')) || null;
    // 첫 실행에서는 전부 "새 것"이다. 기준선만 잡고 아무도 안 깨운다.
    if (!seen) {
      await setJSON('seen-slugs', slugs);
      return res.status(200).json({ ok: true, first: true, tracked: slugs.length });
    }

    const known = new Set(seen);
    const fresh = live.filter((a) => !known.has(a.slug));
    await setJSON('seen-slugs', slugs);

    if (!fresh.length) return res.status(200).json({ ok: true, new: 0 });

    await setJSON('latest', {
      at: new Date().toISOString(),
      new: fresh.slice(0, 10).map((a) => ({
        artist: a.artistDisplay || a.artist,
        album: a.album,
        slug: a.slug,
      })),
    });

    // 발송. 죽은 구독(404·410)은 그 자리에서 지운다 — 안 그러면 실패가 매번 쌓인다.
    const subs = await allSubscriptions();
    let sent = 0;
    let gone = 0;
    for (const s of subs) {
      try {
        const r = await sendPush(s, vapid);
        if (r.gone) {
          await removeSubscription(s.endpoint);
          gone++;
        } else if (r.ok) sent++;
      } catch {
        // 한 명이 실패해도 나머지는 계속 보낸다
      }
    }
    return res.status(200).json({ ok: true, new: fresh.length, subscribers: subs.length, sent, gone });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
