/**
 * 러너 네트워크 계측 — "느린 것"과 "연결이 안 되는 것"을 구분한다.
 *
 * 뮤직플랜트가 GitHub Actions에서만 앨범당 105초를 먹었다. 로컬(한국)에서는 0.42초다.
 * 그런데 105초는 상수라서 네트워크 지연으로는 설명이 안 된다 — 지연이면 분산이 생긴다.
 *
 * 그래서 단계를 쪼개 어디서 시간이 가는지 본다:
 *   DNS 조회 → TCP 연결(IP별) → TLS 핸드셰이크 → 첫 바이트 → 본문 수신
 *
 * 그리고 **연속 호출**을 재서 "처음부터 막혔나 / 몇 건째부터 막히나"를 가른다.
 * 이 둘은 고치는 방법이 다르다 — 전자는 IP 차단, 후자는 요청 폭주(WAF)다.
 *
 * 대조군으로 알라딘을 같이 친다. 뮤직플랜트만 느린 건지 러너 전체가 느린 건지
 * 구분하지 못하면 엉뚱한 걸 고치게 된다.
 *
 *   node probe_net.mjs            # 전 단계
 *   node probe_net.mjs --burst=30 # 연속 호출 횟수 지정
 */

import { promises as dns } from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';

const BURST = Number((process.argv.find((a) => a.startsWith('--burst=')) || '').split('=')[1] || 20);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

const TARGETS = [
  {
    name: '뮤직플랜트',
    host: 'www.musicplant.co.kr',
    url: (q) => `https://www.musicplant.co.kr/shop/search_result.php?search_str=${encodeURIComponent(q)}`,
    // 결과가 실제로 들어왔는지 — 200인데 빈 껍데기인 경우를 가른다
    hit: (html) => (html.match(/detail\.php\?pno=/g) || []).length,
  },
  {
    name: '알라딘(대조군)',
    host: 'www.aladin.co.kr',
    url: (q) => `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Music&SearchWord=${encodeURIComponent(q)}`,
    hit: (html) => (html.match(/wproduct\.aspx\?ItemId=/g) || []).length,
  },
];

// 실제 빌드가 쓰는 것과 같은 모양의 질의. 캐시에 걸려 빨라지는 걸 막으려고 매번 다르게 한다.
const QUERIES = ['태민 PHASE I : Soft Violence', 'TUIDE TUNE & PLAY', 'NCT 127 BLINGY', 'CORTIS GREENGREEN', 'ENHYPEN THE SIN : BLISS'];

const ms = (t0) => `${((Number(process.hrtime.bigint() - t0) / 1e6) / 1000).toFixed(2)}s`;
const now = () => process.hrtime.bigint();

const err = (e) => {
  const bits = [e.name, e.code, e.cause?.name, e.cause?.code].filter(Boolean);
  return `${[...new Set(bits)].join('/')} — ${e.cause?.message || e.message}`;
};

// ── 1. DNS ──────────────────────────────────────────────────
async function probeDns(t) {
  const out = { a: [], aaaa: [] };
  for (const [kind, fn] of [
    ['a', () => dns.resolve4(t.host)],
    ['aaaa', () => dns.resolve6(t.host)],
  ]) {
    const t0 = now();
    try {
      out[kind] = await fn();
      console.log(`  DNS ${kind.toUpperCase().padEnd(4)} ${ms(t0).padStart(7)}  ${out[kind].join(', ')}`);
    } catch (e) {
      console.log(`  DNS ${kind.toUpperCase().padEnd(4)} ${ms(t0).padStart(7)}  ✗ ${err(e)}`);
    }
  }
  return out;
}

// ── 2. TCP 연결 (IP별) ──────────────────────────────────────
//
// fetch는 어느 IP에서 막혔는지 안 알려준다. IPv6만 죽어 있는 경우가 흔해서 따로 잰다.
function probeTcp(ip, port = 443, cap = 12000) {
  return new Promise((res) => {
    const t0 = now();
    const s = net.connect({ host: ip, port, family: net.isIPv6(ip) ? 6 : 4 });
    const done = (verdict) => {
      s.destroy();
      res(verdict);
    };
    s.setTimeout(cap, () => done(`✗ 무응답 ${cap}ms (SYN 차단 의심)`));
    s.on('connect', () => done(`✓ ${ms(t0)}`));
    s.on('error', (e) => done(`✗ ${ms(t0)} ${e.code || e.message}`));
  });
}

// ── 3. TLS 핸드셰이크 ───────────────────────────────────────
function probeTls(host, cap = 12000) {
  return new Promise((res) => {
    const t0 = now();
    const s = tls.connect({ host, port: 443, servername: host }, () => {
      const v = `✓ ${ms(t0)} (${s.getProtocol()})`;
      s.destroy();
      res(v);
    });
    s.setTimeout(cap, () => {
      s.destroy();
      res(`✗ 무응답 ${cap}ms`);
    });
    s.on('error', (e) => {
      s.destroy();
      res(`✗ ${ms(t0)} ${e.code || e.message}`);
    });
  });
}

// ── 4. HTTP 한 건 — 첫 바이트와 본문을 나눠 잰다 ─────────────
async function probeHttp(t, q, timeout = 30000) {
  const t0 = now();
  try {
    const res = await fetch(t.url(q), {
      headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    const ttfb = ms(t0);
    const html = await res.text();
    return {
      ok: res.ok,
      line: `${String(res.status).padEnd(4)} 첫바이트 ${ttfb.padStart(7)} · 전체 ${ms(t0).padStart(7)} · ${(html.length / 1024).toFixed(0)}KB · 상품 ${t.hit(html)}건`,
    };
  } catch (e) {
    return { ok: false, line: `✗    ${ms(t0).padStart(7)}  ${err(e)}` };
  }
}

// ── 실행 ────────────────────────────────────────────────────
console.log(`러너 네트워크 계측 · node ${process.version} · burst=${BURST}\n`);

for (const t of TARGETS) {
  console.log(`━━ ${t.name} (${t.host}) ━━`);

  const rec = await probeDns(t);
  for (const ip of [...rec.a, ...rec.aaaa]) {
    console.log(`  TCP  ${ip.padEnd(40)} ${await probeTcp(ip)}`);
  }
  console.log(`  TLS  ${t.host.padEnd(40)} ${await probeTls(t.host)}`);

  // 연속 호출 — 몇 건째부터 무너지는가
  console.log(`  연속 ${BURST}건:`);
  let firstFail = null;
  for (let i = 0; i < BURST; i++) {
    const r = await probeHttp(t, `${QUERIES[i % QUERIES.length]} ${i}`);
    if (!r.ok && firstFail === null) firstFail = i + 1;
    console.log(`    #${String(i + 1).padStart(2)}  ${r.line}`);
  }
  console.log(
    firstFail === null
      ? `  → ${BURST}건 전부 성공. 이 시점에는 막히지 않는다.\n`
      : firstFail === 1
        ? `  → 1건째부터 실패. 요청 누적이 아니라 **처음부터 막혀 있다**(IP 차단).\n`
        : `  → ${firstFail}건째부터 실패. **요청 누적으로 막힌다**(WAF·레이트리밋).\n`
  );
}
