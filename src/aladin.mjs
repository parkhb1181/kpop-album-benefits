import { getText, strip, parseTitle } from './fetchx.mjs';

const BASE = 'https://www.aladin.co.kr';

export async function search(query) {
  const html = await getText(
    `${BASE}/search/wsearchresult.aspx?SearchTarget=Music&SearchWord=${encodeURIComponent(query)}`
  );

  // 상품 블록 분리: ss_book_box 우선, 없으면 bo3 앵커로 폴백
  let blocks = html.split('ss_book_box').slice(1);
  if (blocks.length === 0) {
    blocks = html.split(/<a[^>]+class="bo3"/).slice(1);
  }

  const out = [];
  for (const b of blocks) {
    const itemId = (b.match(/wproduct\.aspx\?ItemId=(\d+)/) || [])[1];
    if (!itemId) continue;
    const titleRaw = (b.match(/class="bo3"[^>]*>([\s\S]{0,300}?)<\/a>/) || [])[1];
    if (!titleRaw) continue;
    const title = strip(titleRaw);
    if (!title) continue;

    const priceM = b.match(/([\d,]+)원\s*→\s*<[^>]*>?\s*<?[^<]*?([\d,]+)원/) || b.match(/([\d,]+)원/);
    const salesPoint = (b.match(/세일즈포인트\s*:\s*([\d,]+)/) || [])[1];
    // 특전 관련 문구 (예약판매 특전 / 초도 / 증정 종료 등)
    const flat = strip(b);
    // UI 잡텍스트에서 잘라낸다 (장바구니/보관함/매장… 이후는 상품정보가 아님)
    const CUT = /(장바구니|바로구매|보관함|마이리스트|매장판매중|매장새상품|알라딘 중고|판매자 중고|우주점|지역변경|양탄자배송|세일즈포인트|마일리지)/;
    const clip = (s) => {
      const i = s.search(CUT);
      return (i > 0 ? s.slice(0, i) : s).trim().replace(/[\s·,]+$/, '');
    };
    const benefit = [];
    for (const re of [
      /예약\s*판매\s*특전[^.]{0,120}/g,
      /예약특전[^.]{0,120}/g,
      /초도[^.]{0,120}/g,
      /포스터[^.]{0,60}증정[^.]{0,60}/g,
    ]) {
      for (const m of flat.matchAll(re)) {
        const c = clip(m[0]);
        if (c.length > 6) benefit.push(c);
      }
    }
    // 짧은 것이 다른 것의 부분집합이면 버린다
    benefit.sort((a, b2) => b2.length - a.length);
    const kept = [];
    for (const b2 of benefit) if (!kept.some((k) => k.includes(b2))) kept.push(b2);

    out.push({
      retailer: '알라딘',
      id: itemId,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: priceM ? Number((priceM[2] || priceM[1]).replace(/,/g, '')) : null,
      sales: salesPoint ? Number(salesPoint.replace(/,/g, '')) : null,
      releaseDate: (flat.match(/(\d{4})년\s*(\d{1,2})월/) || []).slice(1, 3).join('-') || null,
      url: `${BASE}/shop/wproduct.aspx?ItemId=${itemId}`,
      benefit: kept.slice(0, 3),
      benefitFlag: kept.length > 0,
      freeShipping: /무료배송/.test(flat),
      soldOut: /품절|절판/.test(flat),
      thumb: (b.match(/(https:\/\/image\.aladin\.co\.kr\/product\/[^"' )]+\.(?:jpg|png))/i) || [])[1] || null,
    });
  }
  // 중복 제거
  const seen = new Set();
  return out.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/**
 * 상품 상세 — 검색 결과에는 "증정 종료"만 나오고,
 * 진행 중인 특전 내용·기간·쿠폰은 상세 페이지에만 있다.
 */
export async function detail(itemId) {
  const html = await getText(`${BASE}/shop/wproduct.aspx?ItemId=${itemId}`);
  const f = strip(html);

  const benefit = [];

  // "… 미공개 포토카드(2종 중 1종 랜덤) 를 증정합니다. * 기간: 2026.8.5(수) 14:00 ~ 수량 소진시까지"
  // "(알라딘 특전)" 표기와 증정 문구가 떨어져 있어서 '증정합니다' 기준으로 앞뒤를 잡는다.
  const m1 = f.match(/([^*.]{5,80}?)\s*를?\s*증정합니다[.\s]*\*?\s*기간\s*:\s*([^\-*]{0,50})/);
  if (m1) {
    // "…) [2종 세트] 을 구매한 고객분들께 각 앨범당 알라딘 특전 미공개 포토카드(…)" 에서
    // 상품명 잔여물을 떼고 '알라딘 특전' 뒤만 남긴다
    let what = m1[1].replace(/\s+/g, ' ').trim();
    const after = what.match(/알라딘\s*특전\s*(.+)$/);
    if (after) what = after[1].trim();
    else what = what.replace(/^.*?고객분들께\s*(?:각\s*앨범당\s*)?/, '').trim();
    const per = /각\s*앨범당/.test(m1[1]) ? ' (각 앨범당)' : '';
    const when = m1[2].replace(/\s+/g, ' ').trim();
    benefit.push(`알라딘 특전: ${what}${per} · 기간 ${when}`);
  } else {
    // 폴백 — 상품명 옆 "특전 … 별도증정"
    const m2 = f.match(/특전\s+([^*]{0,80}?)\s*별도증정/);
    if (m2) benefit.push(`알라딘 특전: ${m2[1].replace(/\s+/g, ' ').trim()}`);
  }

  // 구매 금액대별 쿠폰 — 상품가가 같아도 실질 총액을 가른다
  const coupons = [];
  for (const m of f.matchAll(/([\d,]+)만원\s*이상\s*구매시\s*([\d,]+)천원\s*쿠폰/g)) {
    coupons.push({ over: Number(m[1].replace(/,/g, '')) * 10000, amount: Number(m[2].replace(/,/g, '')) * 1000 });
  }

  // 배송료
  const freeShipping = /배송료\s*무료/.test(f);

  // 특전 상태 — "없음"과 "종료"와 "진행 중"은 다른 정보다
  const ended = /특전[^.]{0,40}증정\s*종료|증정은?\s*종료/.test(f);
  const status = benefit.length ? 'has' : ended ? 'ended' : 'none';

  // 특전 이미지 후보 (알라딘은 별도 특전 컷을 잘 안 올린다)
  const images = [
    ...new Set(
      [...html.matchAll(/https?:\/\/image\.aladin\.co\.kr\/product\/[^"'\\ )<>]+\.(?:jpg|png|jpeg)/gi)].map((m) => m[0])
    ),
  ];

  return { benefit, coupons, freeShipping, images, status };
}
