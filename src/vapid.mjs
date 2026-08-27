/**
 * VAPID — 웹푸시 발송에 필요한 신원 증명. 의존성 0개, WebCrypto만 쓴다.
 *
 * **페이로드 없이 보낸다.** 웹푸시에 내용을 실으려면 aes128gcm 암호화(ECDH + HKDF)를
 * 직접 구현해야 하는데, 그 대신 "깨우기"만 보내고 서비스워커가 사이트의 /index.json을
 * 다시 읽게 하면 암호화가 통째로 필요 없어진다.
 *
 * 부수 효과가 오히려 낫다 — 알림 내용이 항상 최신이고(발송 시점이 아니라 열람 시점 기준),
 * 구독자 목록에 개인 정보가 덜 쌓인다.
 *
 * 필요한 건 JWT 하나뿐이다:
 *   header  {"typ":"JWT","alg":"ES256"}
 *   payload {"aud": 푸시 서비스 오리진, "exp": 만료, "sub": 연락처}
 *   서명    P-256 ECDSA
 */

const b64u = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const enc = (obj) => b64u(new TextEncoder().encode(JSON.stringify(obj)));

/**
 * 공개키(raw 65바이트 base64url)와 개인키 d에서 서명용 JWK를 만든다.
 * 공개키 = 0x04 ‖ x(32) ‖ y(32) 라서 x·y를 여기서 꺼낸다 — 환경변수를 둘로 유지하려고.
 */
function jwkFrom(publicKey, privateKeyD) {
  const raw = Buffer.from(publicKey, 'base64url');
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('VAPID 공개키가 uncompressed P-256(65바이트)이 아닙니다');
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64u(raw.subarray(1, 33)),
    y: b64u(raw.subarray(33, 65)),
    d: privateKeyD,
    ext: true,
  };
}

/**
 * 푸시 서비스에 보낼 Authorization 헤더를 만든다.
 * @param {{endpoint:string, publicKey:string, privateKey:string, subject?:string, ttlSec?:number}} o
 */
export async function vapidHeaders(o) {
  const aud = new URL(o.endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + (o.ttlSec ?? 12 * 3600); // 24시간을 넘기면 거부된다
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp, sub: o.subject || 'mailto:noreply@example.com' })}`;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwkFrom(o.publicKey, o.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );

  return {
    Authorization: `vapid t=${unsigned}.${b64u(sig)}, k=${o.publicKey}`,
    TTL: '86400',
    // 페이로드가 없다는 뜻. 이게 없으면 일부 푸시 서비스가 400을 준다.
    'Content-Length': '0',
  };
}

/**
 * 구독 하나에 깨우기 신호를 보낸다.
 * @returns {Promise<{ok:boolean, status:number, gone:boolean}>} gone=true면 구독을 지워야 한다
 */
export async function sendPush(subscription, vapid) {
  const headers = await vapidHeaders({ ...vapid, endpoint: subscription.endpoint });
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(10000),
  });
  // 404·410은 "이 구독은 죽었다"는 뜻이다. 지우지 않으면 매번 실패하며 쌓인다.
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
