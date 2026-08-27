/**
 * 마감 시각 수집 — 카운트다운과 캘린더 알람의 공통 재료.
 *
 * **"오픈까지 남은 시간"은 만들 수 없다.** 실측 결과 아무도 미리 공개하지 않는다:
 *   메이크스타 — saleStatus가 ON_SALE / ENDED 둘뿐이다. 열려야 목록에 뜬다
 *   위버스샵   — status가 SALE / SOLD_OUT 둘뿐이다. 오픈 예정 상품은 안 보인다
 * 예판 오픈 시각은 소속사 SNS에만 있고, 그건 기계로 읽을 대상이 아니다.
 *
 * 대신 **이미 열린 것의 마감**은 초 단위로 정확하다. 그리고 팬을 실제로 조급하게
 * 만드는 건 오픈이 아니라 마감이다 — 응모 마감을 놓치면 팬싸가 날아간다.
 *
 * 여기서 모으는 것:
 *   ① 이벤트 응모 마감  메이크스타 salesEndAt  (초 단위)
 *   ② 예약 배송 시작    위버스샵 deliveryStartAt (초 단위, 보통 19:00 KST)
 */

const at = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) && t > 0 ? t : null;
};

/**
 * @returns {{kind:string,label:string,at:string,ms:number,url?:string,note?:string}[]} 가까운 순
 */
export function collectDeadlines({ rows = [], events = [], now = Date.now() } = {}) {
  const out = [];

  for (const e of events) {
    const ms = at(e.endAt);
    if (!ms || ms <= now) continue;
    out.push({
      // 캘린더 UID의 재료다. 순번이 아니라 이벤트 고유 id를 써야
      // 목록 순서가 바뀌어도 구독자 캘린더에 중복 일정이 생기지 않는다.
      id: `evt${e.id}`,
      kind: e.fansign ? 'fansign' : 'event',
      label: `${e.label} 응모 마감`,
      at: e.endAt,
      ms,
      url: e.url,
      note: e.title,
    });
  }

  // 위버스샵 상품마다 붙지만 앨범 단위로는 하나다. 가장 이른 것만 쓴다.
  const ship = rows
    .map((r) => ({ ms: at(r.deliveryStartAt), iso: r.deliveryStartAt }))
    .filter((x) => x.ms && x.ms > now)
    .sort((a, b) => a.ms - b.ms)[0];
  if (ship) {
    out.push({
      id: 'release',
      kind: 'release',
      label: '예약 배송 시작',
      at: ship.iso,
      ms: ship.ms,
      note: '위버스샵 기준. 판매처마다 다를 수 있습니다',
    });
  }

  return out.sort((a, b) => a.ms - b.ms);
}

/** JS가 꺼져 있어도 대략은 보여야 한다 (카운트다운의 초기값 겸 폴백) */
export function roughLeft(ms) {
  const d = Math.floor(ms / 864e5);
  const h = Math.floor(ms / 36e5) % 24;
  const m = Math.floor(ms / 6e4) % 60;
  if (d > 0) return `${d}일 ${h}시간`;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}
