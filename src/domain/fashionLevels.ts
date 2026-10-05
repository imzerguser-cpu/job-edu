// 레벨이 올라야 살 수 있는 옷·소품(D-120, 사용자 요청). 성장(일하기·돕기·저축…)이 곧 꾸미기 보상이
// 되도록, 비싸고 특별한 아이템일수록 높은 레벨을 요구한다. 레벨이 모자라도 미리 입어 보기는 된다
// (목표가 눈에 보이게). 이미 산 아이템은 레벨과 상관없이 계속 입을 수 있다.
//
// 한계: 레벨은 저장된 값이 아니라 기록에서 계산하는 값이라(D-102) Firestore Rules가 구매 순간의
// 레벨을 검사할 수 없다 — 잠금은 앱 화면에서만 건다. 학급 놀이 화폐라 받아들인 절충이다.

// 동화 캐릭터 아이템: 목록 뒤쪽일수록 높은 레벨(2개마다 1단계, 최대 Lv.5).
export function storybookItemLevel(item:{index:number}){return Math.min(5,Math.max(1,Math.ceil(item.index/2)))}

export type LockState={locked:false}|{locked:true;level:number;reason:string};
export function purchaseLock(required:number,currentLevel:number|null):LockState{
  if(currentLevel===null)return {locked:true,level:required,reason:'레벨 확인 중'};
  return currentLevel>=required?{locked:false}:{locked:true,level:required,reason:`Lv.${required}부터`};
}
