// 매일 출근 도장(D-122): 하루 한 번(한국 날짜 기준) 도장을 찍으면 경험치를 받는다.
// 날짜 키는 "연-월-일"(앞자리 0 없음) — Firestore Rules가 request.time+9시간으로 똑같이 계산해 검사한다.
export const KST_OFFSET_MS=9*60*60*1000;
export function kstDateKey(now=new Date()){
  const k=new Date(now.getTime()+KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${k.getUTCMonth()+1}-${k.getUTCDate()}`;
}
export function checkinId(studentId:string,dateKey:string){return `${studentId}~${dateKey}`}
function keyToUtcDate(key:string){const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))}
function shift(date:Date,days:number){return new Date(date.getTime()+days*86400000)}
function toKey(date:Date){return `${date.getUTCFullYear()}-${date.getUTCMonth()+1}-${date.getUTCDate()}`}
const isWeekend=(date:Date)=>date.getUTCDay()===0||date.getUTCDay()===6;

// 연속 출근 일수: 주말은 건너뛰고(학교에 안 오는 날), 오늘 아직 안 찍었으면 어제까지의 연속을 센다.
export function checkinStreak(dateKeys:Iterable<string>,todayKey=kstDateKey()){
  const set=new Set(dateKeys);
  let day=keyToUtcDate(todayKey);
  if(!set.has(todayKey))day=shift(day,-1);
  let streak=0;
  for(let guard=0;guard<400;guard++){
    if(isWeekend(day)){day=shift(day,-1);continue}
    if(!set.has(toKey(day)))break;
    streak++;day=shift(day,-1);
  }
  return streak;
}
