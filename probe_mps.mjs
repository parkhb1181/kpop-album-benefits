import * as mp from './src/musicplant.mjs';
import { getText, strip } from './src/fetchx.mjs';

const list = await mp.search('태민');
console.log('상품', list.length, '건 — 상세에서 재고 신호가 상품마다 다른지 본다\n');

for (const x of list.slice(0, 6)) {
  const h = await getText(`https://www.musicplant.co.kr/shop/detail.php?pno=${x.id}`);
  const flat = strip(h);
  const sig = {
    품절버튼: /<[^>]*(?:btn|button)[^>]*>[^<]{0,20}품절/i.test(h),
    장바구니: (flat.match(/장바구니/g) || []).length,
    바로구매: (flat.match(/바로\s*구매|구매하기/g) || []).length,
    품절텍스트: (flat.match(/품절|SOLD\s*OUT/gi) || []).length,
    재입고: /재입고/.test(flat),
  };
  console.log(`  ${x.title.slice(0, 44).padEnd(46)} ${JSON.stringify(sig)}`);
}
