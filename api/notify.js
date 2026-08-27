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

  /**
   * 이 저장소를 배포하는 Vercel 프로젝트가 둘이었다. 크론은 vercel.json에 있으므로
   * **양쪽에서 다 돈다.** 둘이 같은 KV를 보면 거의 동시에 같은 "새 앨범"을 읽고
   * 둘 다 발송해서 구독자에게 알림이 두 번 간다.
   *
   * 한쪽의 KV 연결을 끊어도 이미 떠 있는 배포에는 변수가 구워져 있어 계속 돈다.
   * 그래서 설정이 아니라 코드로 막는다 — SITE_URL이 가리키는 프로젝트만 발송한다.
   */
  const own = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (own && !SITE.includes(own)) {
    return res.status(200).json({ ok: true, skipped: `정식 배포가 아님 (${own} ≠ ${SITE})` });
  }

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

    // 변한 게 없으면 쓰지도 않는다 (30분마다 도는데 매번 쓸 이유가 없다)
    if (!fresh.length) {
      if (slugs.length !== seen.length) await setJSON('seen-slugs', slugs);
      return res.status(200).json({ ok: true, new: 0 });
    }

    await setJSON('latest', {
      at: new Date().toISOString(),
      new: fresh.slice(0, 10).map((a) => ({
        artist: a.artistDisplay || a.artist,
        album: a.album,
        slug: a.slug,
      })),
    });

    /**
     * 발송.
     *
     * 한 명씩 순서대로 보내면 구독자가 늘수록 함수 시간 제한에 걸린다.
     * 그러면 아래의 seen-slugs 갱신에 도달하지 못해 **다음 회차에 다시 보낸다** —
     * 중복은 눈에 보이니 고칠 수 있다. 반대로 갱신을 먼저 해두면 그 앨범 알림이
     * 조용히 사라져서 아무도 모른다. 그래서 갱신은 발송 뒤에 한다.
     *
     * 그래도 시간 제한이 오기 전에 끝내는 게 낫다. 20명씩 동시에 보낸다.
     */
    const subs = await allSubscriptions();
    let sent = 0;
    let gone = 0;
    const dead = [];
    for (let i = 0; i < subs.length; i += 20) {
      const batch = subs.slice(i, i + 20);
      const results = await Promise.all(
        batch.map((s) => sendPush(s, vapid).catch(() => ({ ok: false, gone: false })))
      );
      results.forEach((r, k) => {
        if (r.gone) dead.push(batch[k].endpoint);
        else if (r.ok) sent++;
      });
    }
    // 죽은 구독(404·410)은 지운다 — 안 그러면 실패가 매번 쌓인다
    for (const endpoint of dead) {
      try {
        await removeSubscription(endpoint);
        gone++;
      } catch {}
    }

    // 여기까지 왔다는 건 발송이 끝났다는 뜻이다. 그때 비로소 "봤다"고 기록한다.
    await setJSON('seen-slugs', slugs);
    return res.status(200).json({ ok: true, new: fresh.length, subscribers: subs.length, sent, gone });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
