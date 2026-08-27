/**
 * 판매처별 배송 정책.
 * 2026-08-26 브라우저로 직접 확인한 값과, 확인하지 못한 값을 구분한다.
 */
export const POLICY = {
  알라딘: {
    baseFee: 0,
    freeOver: 0, // 음반은 사실상 무료배송
    combine: true,
    verified: true,
    checkedAt: '2026-08-26',
    note: '음반 무료배송 확인 (12,600원 단품·세트 모두 상품 상세에 "배송료 무료")',
    src: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=356402788',
  },
  Ktown4u: {
    baseFee: 3000,
    freeOver: 30000,
    combine: true,
    verified: true,
    checkedAt: '2026-08-26',
    note: '국내몰 기준 "배송비 3,000원 (3만원 이상 무료배송)" 명시',
    src: 'https://kr.ktown4u.com/',
  },
  사운드웨이브: {
    baseFee: 3000,
    freeOver: 50000,
    combine: true,
    verified: true,
    checkedAt: '2026-08-27',
    note: '상품 상세 배송정보에 "배송 비용 : 3,000원 (50,000원 이상 구매 시 무료)" 명시',
    src: 'https://www.sound-wave.co.kr/product/detail.html?product_no=27616',
  },
  뮤직플랜트: {
    baseFee: 3000,
    freeOver: 50000,
    combine: true,
    verified: true,
    checkedAt: '2026-08-27',
    note: '상품 상세에 "배송비용 : 50,000원 미만 경우 3,000원" 명시',
    src: 'https://www.musicplant.co.kr/shop/detail.php?pno=5C09187EE77CE469048738AB63D2E16E',
  },
  애플뮤직: {
    baseFee: 3000,
    freeOver: 50000,
    combine: true,
    verified: true,
    checkedAt: '2026-08-27',
    note: '상품 상세에 "배송비 3,000원 (50,000원 이상 구매 시 무료배송)" 명시',
    src: 'https://www.applemusic.co.kr/shop/shopdetail.html?branduid=3403506',
  },
  위드뮤: {
    baseFee: 3000,
    freeOver: null,
    combine: true,
    verified: false,
    checkedAt: '2026-08-27',
    note: '배송비 미확인 — 3,000원은 추정치',
    src: 'https://www.withmuu.com/',
  },
  위버스샵: {
    baseFee: 3000,
    freeOver: null,
    combine: true, // shippingGroupId 31로 태민·엔하이픈 모두 동일 → 합배송 그룹은 확인됨
    verified: false,
    checkedAt: '2026-08-26',
    note: '배송비 미확인 — 상품 페이지가 "로그인 후 배송 가능 여부를 확인"으로 막힘. 3,000원은 추정치',
    src: 'https://shop.weverse.io/',
  },
};

export function feeFor(retailer, subtotal, anyFreeShipping) {
  const p = POLICY[retailer];
  if (!p) return { fee: null, unknown: true };
  if (anyFreeShipping) return { fee: 0, unknown: false, why: '무료배송 상품' };
  if (p.freeOver != null && subtotal >= p.freeOver)
    return { fee: 0, unknown: !p.verified, why: p.freeOver === 0 ? '무료배송' : `${p.freeOver.toLocaleString()}원 이상` };
  if (p.baseFee == null) return { fee: null, unknown: true, why: '무게 기반' };
  return { fee: p.baseFee, unknown: !p.verified };
}
