import { getText, strip, parseTitle } from './fetchx.mjs';

const BASE = 'https://shop.weverse.io';

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no __NEXT_DATA__');
  return JSON.parse(m[1]);
}

function queries(html) {
  return nextData(html)?.props?.pageProps?.$dehydratedState?.queries || [];
}

/** 아티스트 목록 (artistId, name, shortName) */
export async function artists() {
  const html = await getText(`${BASE}/ko/home`);
  const q = queries(html).find((q) => String(q.queryKey?.[0]).includes('/settings/artists'));
  return q?.state?.data || [];
}

/** 아티스트 홈의 상품 카드 목록 */
export async function listSales(artistId) {
  const html = await getText(`${BASE}/ko/shop/KRW/artists/${artistId}`);
  const q = queries(html).find((q) => String(q.queryKey?.[0]).includes('categories/:parentCategoryId/sales'));
  return q?.state?.data?.productCards || [];
}

/** 상품 상세 — eventGuides(특전)가 여기 있다 */
export async function detail(artistId, saleId) {
  const html = await getText(`${BASE}/ko/shop/KRW/artists/${artistId}/sales/${saleId}`);
  const q = queries(html).find((q) => String(q.queryKey?.[0]).includes('/sales/:saleId'));
  return q?.state?.data || null;
}

/** 앨범명으로 필터해서 정규화된 행 반환 */
export async function search(artistId, keyword) {
  const cards = await listSales(artistId);
  const hit = cards.filter((c) => c.name?.toLowerCase().includes(keyword.toLowerCase()));
  const out = [];
  for (const c of hit) {
    let benefit = [];
    let images = [];
    let benefitImage = null;
    let soldOut = null;
    let maxOrder = null;
    let composition = null;
    let randomNote = null;
    try {
      const d = await detail(artistId, c.saleId);
      benefit = (d?.eventGuides || []).map((g) => strip(`${g.eventName} ${g.description}`));
      images = (d?.detailImages || []).map((i) => ({ url: i.imageUrl, w: i.width, h: i.height }));

      // 품절 — 특전이 "수량 소진시까지"라 지금 살 수 있는지가 결정을 가른다
      const opts = d?.option?.options || [];
      if (opts.length) soldOut = opts.every((o) => o.isSoldOut);

      // 1인 구매 제한 — 버전마다 다르다 (팬싸 응모용 대량 구매에 결정적)
      maxOrder = d?.goodsOrderLimit?.maxOrderQuantity ?? null;

      // 구성품 — 버전 선택의 실제 기준
      composition = (d?.notificationInfos || []).find((n) => n.title === '구성')?.description || null;

      // 랜덤 확률 안내
      randomNote = (d?.cautionInfos || []).find((t) => /랜덤.*확률|확률.*랜덤/.test(t)) || null;
      // 특전 안내 이미지("Pre-order Gift" 카드)는 구성품 컷보다 세로로 길다.
      // eventGuides가 있을 때 가장 세로로 긴 첫 장을 특전 이미지로 본다.
      if (benefit.length && images.length) {
        const tall = [...images].sort((a, b) => b.h / b.w - a.h / a.w)[0];
        if (tall && tall.h / tall.w > 1.6) benefitImage = tall.url;
        else benefitImage = images[0].url;
      }
    } catch {}
    out.push({
      retailer: '위버스샵',
      id: String(c.saleId),
      title: strip(c.name),
      ...parseTitle(c.name),
      currency: 'KRW',
      price: c.price?.salePrice ?? null,
      sales: null,
      releaseDate: c.deliveryDate ? c.deliveryDate.slice(0, 10) : null,
      // 날짜만 자르면 카운트다운을 못 만든다. 원본은 초 단위다 ("2026-08-27T19:00:00+09:00")
      deliveryStartAt: c.deliveryDate || null,
      url: `${BASE}/ko/shop/KRW/artists/${artistId}/sales/${c.saleId}`,
      benefit,
      images,
      benefitImage,
      thumb: (c.thumbnailImageUrl || null),
      benefitFlag: (c.icons || []).includes('BENEFIT'),
      // 위버스샵은 icons가 명확해서 "특전 없음"을 단정할 수 있다
      benefitStatus: (c.icons || []).includes('BENEFIT') ? 'has' : 'none',
      preOrder: (c.icons || []).includes('PRE_ORDER'),
      chart: c.albumChartTargets || [],
      soldOut,
      maxOrder,
      composition,
      randomNote,
      status: c.status || null,
    });
  }
  return out;
}
