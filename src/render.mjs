import { optimize } from './optimize.mjs';
import { metaTags, abs, displayArtist } from './seo.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

const CSS = `
:root{--bg:#fff;--fg:#16151a;--mut:#6b6975;--line:#e6e4ea;--acc:#c2410c;--ok:#15803d;--card:#faf9fb}
@media(prefers-color-scheme:dark){:root{--bg:#131217;--fg:#eceaf2;--mut:#a3a0ad;--line:#2c2a33;--acc:#fb923c;--ok:#4ade80;--card:#1a191f}}
*{box-sizing:border-box}
body{margin:0 auto;padding:28px 16px 72px;max-width:1080px;background:var(--bg);color:var(--fg);
font:15px/1.6 -apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif}
h1{font-size:23px;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:15px;margin:34px 0 10px;padding-bottom:8px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
h3{font-size:13px;color:var(--mut);margin:20px 0 8px;font-weight:600}
.pk{font-weight:500;color:var(--mut);font-size:13px}
.ok{font-size:11px;font-weight:600;color:var(--ok);border:1px solid currentColor;border-radius:99px;padding:1px 8px}
.one{font-size:11px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.stamp{color:var(--mut);font-size:13px;margin-bottom:6px}
.sum{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:13.5px;margin-top:14px}
.sum2{background:var(--card);border:1px solid var(--ok);border-radius:8px;padding:12px 14px;font-size:14px;margin-bottom:12px}
.warn{background:var(--card);border:1px solid var(--acc);border-radius:8px;padding:11px 13px;font-size:13.5px;margin-bottom:10px}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:640px}
th{text-align:left;color:var(--mut);font-weight:600;font-size:11.5px;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.rt{white-space:nowrap;font-weight:600}
.num{white-space:nowrap;text-align:right}
.ev{font-size:11.5px;color:var(--acc);margin-top:2px}
.ben div{margin-bottom:4px}
.flag{color:var(--acc);font-weight:600}.none{color:var(--mut)}.ok2{color:var(--ok);font-weight:600}
.mut{color:var(--mut);font-size:12px}.q{color:var(--acc);font-weight:700}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--line)}
a:hover{border-bottom-color:currentColor}
.err{color:var(--acc);font-size:13px;margin-top:28px}
.pol{margin-top:12px;font-size:12px;color:var(--mut);line-height:1.7;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.gal{display:flex;gap:14px;overflow-x:auto;padding:4px 0 12px}
.gal figure{margin:0;flex:0 0 190px}
.gal figcaption{font-size:12px;font-weight:700;margin-bottom:6px}
.gal img{width:100%;border:1px solid var(--line);border-radius:8px;display:block;background:var(--card)}
.gal .noimg{width:100%;aspect-ratio:72/152;border:1px dashed var(--line);border-radius:8px;display:flex;flex-direction:column;
align-items:center;justify-content:center;color:var(--mut);font-size:12px;text-align:center;line-height:1.5}
.gal p{font-size:11.5px;color:var(--mut);margin:6px 0 0;line-height:1.5}
td.th{width:52px;padding:8px 4px 8px 8px}
td.th img{width:44px;height:44px;object-fit:cover;border:1px solid var(--line);border-radius:5px;display:block}
.back{font-size:13px;color:var(--mut);display:inline-block;margin-bottom:14px;border:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:16px}
.card{border:1px solid var(--line);border-radius:10px;padding:14px;display:block;border-bottom:1px solid var(--line)}
.card:hover{border-color:var(--mut)}
.card .ar{font-size:12px;color:var(--mut);font-weight:600}
.card .al{font-size:15px;font-weight:700;margin:3px 0 8px;line-height:1.35}
.card .meta{font-size:12px;color:var(--mut)}
.badge{display:inline-block;font-size:10.5px;font-weight:700;color:var(--ok);border:1px solid currentColor;border-radius:99px;padding:0 6px;margin-right:5px}
.sold{color:var(--acc);font-weight:700}
.soldb{font-size:11px;font-weight:700;color:var(--acc);border:1px solid currentColor;border-radius:99px;padding:1px 8px}
.chart{font-size:11px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.comp{margin-top:10px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--card)}
.comp summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--mut)}
.comp pre{margin:8px 0 0;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word;font-family:inherit;color:var(--fg)}
.comp p{margin:8px 0 0}
`;

const shell = (title, body, meta = {}) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${metaTags({ title, ...meta })}
<style>${CSS}</style></head><body>${body}</body></html>`;

const won = (n) => (n == null ? '?' : `${n.toLocaleString()}원`);

/** "2026. 8. 27. AM 10:06:57" → "2026.8.27" — 메타 설명에 초 단위는 노이즈다 */
const shortDate = (stamp) =>
  String(stamp ?? '')
    .split(/오전|오후|AM|PM|\d{1,2}:\d{2}/)[0]
    .replace(/\s*\.\s*/g, '.')
    .replace(/[.\s]+$/, '')
    .trim();

/** 특전 상태 — "없음"과 "종료"와 "비공개"와 "확인 못함"은 전부 다른 정보다 */
const STATUS = {
  has: null, // 내용을 표시
  none: '<span class="none">특전 없음</span>',
  ended: '<span class="mut">증정 종료</span>',
  secret: '<span class="flag">특전 있음 · 구성 비공개</span>',
  unknown: '<span class="mut">확인 못함</span>',
};
const benefitCell = (i) => {
  if ((i.benefit || []).length) return (i.benefit || []).map((b) => `<div>${esc(b).slice(0, 320)}</div>`).join('');
  return STATUS[i.benefitStatus] ?? (i.benefitFlag ? '<span class="flag">특전 있음 (내용 미파싱)</span>' : STATUS.unknown);
};
const money = (i) =>
  i.price == null ? '—' : i.currency === 'USD' ? `$${i.price.toLocaleString()}` : `${i.price.toLocaleString()}원`;

/** 지금 살 수 있는가 — 특전이 "수량 소진시까지"라 이게 결정을 가른다 */
const stockCell = (i) =>
  i.soldOut === true
    ? '<span class="sold">품절</span>'
    : i.soldOut === false
      ? '<span class="ok2">판매중</span>'
      : '<span class="mut">—</span>';

/** 1인 구매 제한 — 버전마다 다르다. 팬싸 응모용 대량 구매에 결정적 */
const limitCell = (i) => (i.maxOrder ? `<b>${i.maxOrder}</b>장` : '<span class="mut">—</span>');

/**
 * 팬사인회·영상통화 이벤트 — 메이크스타에서만 나온다.
 * 앨범값(1~2만원)보다 훨씬 큰 돈이 걸리는 결정이라 특전보다 위에 놓는다.
 */
function eventsHtml(events) {
  if (!events?.length) return '';
  const rows = events
    .map((e) => {
      const when = e.closing
        ? '<span class="sold">마감임박</span>'
        : e.dday != null
          ? `<b>D-${e.dday}</b>`
          : '<span class="mut">진행중</span>';
      return `<tr><td class="rt">${esc(e.label)}</td><td class="num">${when}</td>
<td class="mut">${esc(e.from)} ~ ${esc(e.to)}</td>
<td>${esc(e.title)}</td></tr>`;
    })
    .join('');
  return `<h2>팬사인회 · 이벤트 <span class="one">메이크스타</span></h2>
<div class="warn">앨범을 <b>어디서 사느냐가 응모 자격을 가릅니다.</b> 지정된 판매처에서 사야 응모권이 나옵니다.</div>
<div class="wrap"><table><thead><tr><th>종류</th><th>남은 기간</th><th>기간</th><th>이벤트</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="pol">메이크스타 검색 기준. <b>여기 없다고 팬싸가 없는 건 아닙니다</b> — 다른 판매처가 여는 팬싸는 잡지 못합니다.
위버스샵·알라딘·Ktown4u·사운드웨이브는 팬싸 정보를 아예 제공하지 않습니다.</div>`;
}

export function renderAlbum({ target, rows, errors, stamp, events, siteUrl, slug, artistKo }) {
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key).push(r);
  }
  const groups = [...byKey.entries()].sort((a, b) => {
    const ra = new Set(a[1].map((x) => x.retailer)).size;
    const rb = new Set(b[1].map((x) => x.retailer)).size;
    return rb - ra || b[1].length - a[1].length;
  });

  const sections = groups
    .map(([key, items]) => {
      const [ed, pk] = key.split('｜');
      const retailers = new Set(items.map((x) => x.retailer));
      const badge =
        retailers.size >= 2 ? `<span class="ok">${retailers.size}개 판매처 비교</span>` : `<span class="one">1곳만</span>`;
      // 판매처를 전부 보여준다 — "특전 없음"도 결정에 필요한 정보다
      const noimgLabel = (i) =>
        i.benefitStatus === 'none'
          ? '특전 없음'
          : i.benefitStatus === 'ended'
            ? '증정 종료'
            : i.benefitStatus === 'secret'
              ? '구성 비공개'
              : (i.benefit || []).length
                ? '이미지 없음'
                : '확인 못함';
      const gal = `<div class="gal">${items
        .map(
          (i) => `<figure><figcaption>${esc(i.retailer)}</figcaption>${
            i.benefitImage
              ? `<a href="${esc(i.benefitImage)}" target="_blank" rel="noopener"><img src="${esc(i.benefitImage)}" alt="${esc(i.retailer)} 특전" loading="lazy"></a>`
              : `<div class="noimg">${noimgLabel(i)}<br><span>${(i.benefit || []).length ? '텍스트만 제공' : ''}</span></div>`
          }${(i.benefit || []).length ? `<p>${esc(i.benefit[0]).slice(0, 200)}</p>` : ''}</figure>`
        )
        .join('')}</div>`;
      const tr = items
        .map(
          (i) => `<tr><td class="th">${i.thumb ? `<img src="${esc(i.thumb)}" alt="" loading="lazy">` : ''}</td>
<td class="rt">${esc(i.retailer)}</td>
<td><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>${
            (i.events || []).length ? `<div class="ev">${(i.events || []).map(esc).join(' · ')}</div>` : ''
          }</td>
<td class="num">${money(i)}</td>
<td class="num">${stockCell(i)}</td>
<td class="num">${limitCell(i)}</td>
<td class="ben">${benefitCell(i)}</td>
<td class="num">${i.sales != null ? i.sales.toLocaleString() : '—'}</td></tr>`
        )
        .join('');

      // 구성품 — 버전 선택의 실제 기준. 위버스샵이 사이즈까지 준다.
      const comp = items.find((i) => i.composition)?.composition;
      const rnd = items.find((i) => i.randomNote)?.randomNote;
      const compHtml = comp
        ? `<details class="comp"><summary>구성품 보기</summary><pre>${esc(comp)}</pre>${rnd ? `<p class="mut">${esc(rnd)}</p>` : ''}</details>`
        : '';

      const anySold = items.some((i) => i.soldOut === true);
      return `<h2>${esc(ed === '기본' ? '기본반' : ed)} <span class="pk">${esc(pk)}</span> ${badge}${
        anySold ? ' <span class="soldb">일부 품절</span>' : ''
      }</h2>
${gal}<div class="wrap"><table><thead><tr><th></th><th>판매처</th><th>상품명 / 이벤트</th><th>가격</th><th>재고</th><th>1인 최대</th><th>특전</th><th>판매량</th></tr></thead><tbody>${tr}</tbody></table></div>${compHtml}`;
    })
    .join('\n');

  const opt = optimize(rows);
  let optHtml = '';
  if (opt?.best) {
    const bd = opt.best.breakdown
      .map(
        (b) => `<tr><td class="rt">${esc(b.retailer)}</td><td class="num">${b.count}종</td><td class="num">${won(b.subtotal)}</td>
<td class="num">${b.fee == null ? '<span class="flag">무게기반</span>' : b.fee === 0 ? '<span class="ok2">무료</span>' : won(b.fee)}${b.unknown ? '<sup class="q">?</sup>' : ''}</td>
<td class="num">${b.coupon ? `<span class="ok2">-${won(b.coupon)}</span>` : '—'}</td>
<td class="mut">${esc([b.why, b.couponWhy].filter(Boolean).join(' · '))}</td></tr>`
      )
      .join('');
    const singleRows = opt.singles
      .map(
        (s) => `<tr><td class="rt">${esc(s.retailer)}</td><td class="num">${s.count}/${opt.versions}종${s.full ? '' : ' <span class="flag">부족</span>'}</td>
<td class="num">${won(s.goods)}</td>
<td class="num">${s.fee == null ? '<span class="flag">무게기반</span>' : s.fee === 0 ? '<span class="ok2">무료</span>' : won(s.fee)}</td>
<td class="num">${s.coupon ? `<span class="ok2">-${won(s.coupon)}</span>` : '—'}</td>
<td class="num"><b>${won(s.sum)}</b>${s.unknown ? '<sup class="q">?</sup>' : ''}</td></tr>`
      )
      .join('');
    optHtml = `<h2>전 버전(${opt.versions}종) 모으기 — 합배송·쿠폰 계산</h2>
${opt.anyFull ? '' : `<div class="warn"><b>어느 한 판매처에서도 ${opt.versions}종 전부를 살 수 없습니다.</b> 나눠 사야 하고, 배송비가 몇 번 붙는지가 총액을 가릅니다.</div>`}
<div class="sum2"><b>최저 조합: ${won(opt.best.sum)}</b> — 상품 ${won(opt.best.goods)} + 배송 ${won(opt.best.ship)}${opt.best.coupon ? ` · 쿠폰 받으면 −${won(opt.best.coupon)}` : ''}${opt.best.unknown ? ' <span class="flag">(일부 미확인)</span>' : ''}</div>
<div class="wrap"><table><thead><tr><th>판매처</th><th>담을 수</th><th>상품</th><th>배송비</th><th>쿠폰(받기 필요)</th><th>비고</th></tr></thead><tbody>${bd}</tbody></table></div>
${singleRows ? `<h3>판매처별 커버리지 — 한 곳에서 살 수 있는 범위</h3><div class="wrap"><table><thead><tr><th>판매처</th><th>담을 수</th><th>상품</th><th>배송</th><th>쿠폰</th><th>총액</th></tr></thead><tbody>${singleRows}</tbody></table></div>` : ''}
<div class="pol">배송·쿠폰 근거 — ${Object.entries(opt.policy)
      .map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v.note)}${v.verified ? '' : ' <sup class="q">?</sup>'}`)
      .join(' · ')}<br><span class="q">?</span> 표시는 미확인 추정치입니다.</div>`;
  }

  const multi = groups.filter(([, it]) => new Set(it.map((x) => x.retailer)).size >= 2).length;
  const soldCount = rows.filter((r) => r.soldOut === true).length;
  const chart = rows.some((r) => (r.chart || []).length > 0);

  // 검색은 한글로 온다 — "코르티스 판매처별 특전". 영문명만 있으면 그 쿼리에 안 잡힌다.
  const artistName = displayArtist(target.artist, artistKo);
  const retailerNames = [...new Set(rows.map((r) => r.retailer))];
  const desc =
    `${artistName} ${target.album} 예약판매 특전을 ${retailerNames.slice(0, 4).join('·')}` +
    `${retailerNames.length > 4 ? ` 등 ${retailerNames.length}곳` : ''}에서 비교합니다. ` +
    `버전 ${groups.length}종${soldCount ? ` · 품절 ${soldCount}건` : ''} · ${shortDate(stamp)} 기준.`;
  // 공유 카드 이미지 — 특전 이미지가 있으면 그게 가장 설명적이고, 없으면 앨범 썸네일
  const ogImage = rows.find((r) => r.benefitImage)?.benefitImage || rows.find((r) => r.thumb)?.thumb || null;

  return shell(
    `${artistName} ${target.album} — 판매처별 특전 비교`,
    `<a class="back" href="../index.html">← 전체 컴백</a>
<h1>${esc(artistName)} — ${esc(target.album)}</h1>
<div class="stamp">판매처별 예약판매 특전 · <b>${esc(stamp)} 기준</b></div>
<div class="sum">수집 <b>${rows.length}</b>개 상품 · 버전 <b>${groups.length}</b>종 · <b>${multi}</b>종은 2개 이상 판매처에서 비교 가능${
      soldCount ? ` · <b class="sold">${soldCount}개 품절</b>` : ''
    }${chart ? `<br><span class="chart">한터·써클 차트 반영</span> <span class="mut">초동 집계에 잡히는 판매처입니다</span>` : ''}</div>
${eventsHtml(events)}
${optHtml}
${sections || '<p>수집된 상품이 없습니다.</p>'}
${errors?.length ? `<div class="err">수집 실패: ${errors.map(esc).join(' / ')}</div>` : ''}`,
    {
      description: desc.slice(0, 160),
      canonical: slug ? abs(siteUrl, `album/${slug}`) : null,
      image: ogImage,
      type: 'article',
    }
  );
}

export function renderIndex({ albums, stamp, siteUrl }) {
  const cards = albums
    .map(
      (a) => `<a class="card" href="album/${esc(a.slug)}.html">
<div class="ar">${esc(a.artistDisplay || a.artist)}</div>
<div class="al">${esc(a.album)}</div>
<div class="meta">${a.benefitCount ? `<span class="badge">특전 ${a.benefitCount}곳</span>` : ''}${a.soldCount ? `<span class="soldb" style="font-size:10.5px;padding:0 6px;margin-right:5px">품절 ${a.soldCount}</span>` : ''}${a.versions}종 · ${a.retailers}개 판매처${a.deliveryDate ? ` · ${esc(a.deliveryDate)} 발매` : ''}</div>
</a>`
    )
    .join('');
  const names = albums
    .slice(0, 6)
    .map((a) => a.artistDisplay || a.artist)
    .join(', ');
  return shell(
    'K-POP 앨범 판매처별 특전 비교 — 예약판매 중인 컴백 전체',
    `<h1>진행 중인 컴백 — 판매처별 특전</h1>
<div class="stamp">위버스샵 · 알라딘 · Ktown4u 자동 수집 · <b>${esc(stamp)} 기준</b></div>
<div class="sum">예약판매 중인 앨범 <b>${albums.length}</b>개. 같은 앨범이라도 <b>어디서 사느냐에 따라 받는 포토카드가 다릅니다.</b></div>
<div class="cards">${cards}</div>`,
    {
      description: (
        `예약판매 중인 K-POP 앨범 ${albums.length}개의 판매처별 특전을 자동 수집해 비교합니다. ` +
        `${names ? `${names} 등. ` : ''}${shortDate(stamp)} 기준.`
      ).slice(0, 160),
      canonical: abs(siteUrl, ''),
      image: albums.find((a) => a.ogImage)?.ogImage || null,
    }
  );
}
