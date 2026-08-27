import { getText, strip, parseTitle } from './fetchx.mjs';

// 국내몰(원화). 글로벌몰은 USD라 원화 비교가 불가능해 kr 서브도메인을 쓴다.
const BASE = 'https://kr.ktown4u.com';

export async function search(query) {
  const html = await getText(`${BASE}/searchList?goodsTextSearch=${encodeURIComponent(query)}`);
  const cards = html.split('data-testid="productCard"').slice(1);
  const out = [];
  for (const c of cards) {
    const goodsNo = (c.match(/goods_no=(\d+)/) || [])[1];
    if (!goodsNo) continue;
    const title = (c.match(/<img alt="([^"]+)"/) || [])[1];
    if (!title) continue;
    const priceM = c.match(/<span class="mr-0\.5 text-m3">([A-Z]{3})<\/span><span class="text-s1">([\d.,]+)<\/span>/);
    const sales = (c.match(/Sales\s*([\d,]+)/) || [])[1];
    const date = (c.match(/>(\d{4}-\d{2}-\d{2})</) || [])[1];
    const dday = (c.match(/>D-(\d+)</) || [])[1];
    out.push({
      retailer: 'Ktown4u',
      id: goodsNo,
      title: strip(title),
      ...parseTitle(title),
      currency: priceM?.[1] || null,
      price: priceM ? Number(priceM[2].replace(/,/g, '')) : null,
      sales: sales ? Number(sales.replace(/,/g, '')) : null,
      releaseDate: date || null,
      dday: dday ? Number(dday) : null,
      url: `${BASE}/iteminfo?goods_no=${goodsNo}`,
      thumb: (c.match(/src="(https:\/\/media\.ktown4u\.com\/[^"]+)"/) || [])[1] || null,
      // 상품명 접두어가 판매처 독점 특전 신호
      benefitFlag: /Ktown4u Special Gift|케타포 Special Gift|럭키드로우|사인회|Pre-?Order|Lucky Draw|SIGN EVENT/i.test(title),
    });
  }
  return out;
}

/**
 * 상세 페이지에서 특전을 뽑는다.
 * 핵심은 페이지에 박혀 있는 상품 JSON이다 —
 *   "optionName":"*Ktown4u Pre-order Benefit", "giftType":"photo.card"
 *   "optionValueName":"*케타포 특전 : 미공개 포토카드 2종 중 1종 랜덤* [상품명]"
 * 화면 텍스트보다 정확하고 브라우저도 필요 없다.
 */
export async function detail(goodsNo) {
  const html = await getText(`${BASE}/iteminfo?goods_no=${goodsNo}`);
  const benefit = [];

  // 1) 옵션 JSON에서 특전 항목
  for (const m of html.matchAll(/"optionValueName"\s*:\s*"([^"]{0,300})"/g)) {
    const v = m[1];
    if (!/특전|Benefit/i.test(v)) continue;
    // "*케타포 특전 : 미공개 포토카드 2종 중 1종 랜덤* [상품명]" → 앞부분만
    const clean = v
      .replace(/\\u003c[^>]*\\u003e/g, ' ')
      .split('*')
      .map((s) => s.trim())
      .filter((s) => /특전|포토카드|미공개/.test(s))[0];
    if (clean) benefit.push(clean.replace(/\s+/g, ' ').trim());
  }

  // 2) 특전 구성 비공개 여부
  const secret = /특전\s*\(구성은\s*비공개입니다\)/.test(html);

  // 3) 폴백 — 화면 텍스트의 안내 섹션
  if (benefit.length === 0) {
    const text = strip(html);
    const m = text.match(/(?:Pre-?order Benefit Notice|예약\s*판매\s*특전\s*안내)([\s\S]{0,600})/i);
    if (m) benefit.push(m[1].slice(0, 400).trim());
  }

  // 4) 상세 이미지 — 소속사 공통 구성품 컷(특전 이미지가 아님에 주의)
  const images = [
    ...new Set(
      [...html.matchAll(/https?:\/\/media\.ktown4u\.com\/products\/origin\/detail\/[^"'\\ )<>]+/g)].map((m) =>
        m[0].replace(/\\+$/, '')
      )
    ),
  ];

  const status = benefit.length ? "has" : secret ? "secret" : "none";
  return { benefit: [...new Set(benefit)].slice(0, 3), secret, images, status };
}
