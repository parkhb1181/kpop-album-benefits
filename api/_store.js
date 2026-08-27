/**
 * 구독 저장소 — Upstash REST(= Vercel KV)를 평범한 fetch로 쓴다.
 *
 * `@vercel/kv` 패키지를 안 쓰는 이유는 이 저장소가 REST라서 의존성이 필요 없기 때문이다.
 * 이 프로젝트는 수집기 전체가 의존성 0개로 도는데 알림 하나 때문에 늘릴 이유가 없다.
 *
 * 필요한 환경변수 (Vercel이 KV를 붙이면 자동으로 들어온다):
 *   KV_REST_API_URL · KV_REST_API_TOKEN
 */

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

export const configured = Boolean(URL_ && TOKEN);

async function cmd(...args) {
  if (!configured) throw new Error('KV 미설정 (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()).result;
}

/** endpoint를 그대로 키로 쓰면 길고 URL 문자가 섞인다. 짧은 지문으로 바꾼다. */
async function fingerprint(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Buffer.from(h).toString('hex').slice(0, 24);
}

export async function addSubscription(sub) {
  const id = await fingerprint(sub.endpoint);
  // 구독 자체와 "누가 있나" 목록을 따로 둔다. 목록만 훑으면 전체 발송이 된다.
  await cmd('SET', `sub:${id}`, JSON.stringify({ endpoint: sub.endpoint, at: new Date().toISOString() }));
  await cmd('SADD', 'subs', id);
  return id;
}

export async function removeSubscription(endpoint) {
  const id = await fingerprint(endpoint);
  await cmd('DEL', `sub:${id}`);
  await cmd('SREM', 'subs', id);
  return id;
}

/**
 * 구독자 전원.
 *
 * 한 명당 GET 한 번씩 돌면 구독자 수만큼 왕복이 생겨서, 1,000명이면 발송을 시작하기도
 * 전에 함수 시간 제한이 끝난다. MGET으로 묶어 100명씩 한 번에 가져온다.
 */
export async function allSubscriptions() {
  const ids = (await cmd('SMEMBERS', 'subs')) || [];
  const out = [];
  const ghosts = [];

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const raws = (await cmd('MGET', ...chunk.map((id) => `sub:${id}`))) || [];
    chunk.forEach((id, k) => {
      const raw = raws[k];
      if (!raw) return ghosts.push(id); // 목록에만 남은 유령
      try {
        out.push({ id, ...JSON.parse(raw) });
      } catch {
        ghosts.push(id); // 깨진 값도 유령으로 본다
      }
    });
  }

  // 유령 정리는 발송 경로를 막지 않도록 실패해도 넘어간다
  for (const id of ghosts) {
    try {
      await cmd('SREM', 'subs', id);
    } catch {}
  }
  return out;
}

export const getJSON = async (key) => {
  const raw = await cmd('GET', key);
  return raw ? JSON.parse(raw) : null;
};
export const setJSON = (key, value) => cmd('SET', key, JSON.stringify(value));
