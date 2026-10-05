// 시민 성장(레벨·경험치·업적·모험) — RPG처럼 "내 캐릭터가 자란다"는 느낌을 주기 위한 계층.
// 경험치는 따로 저장하지 않고, 이미 서버(Rules)가 검증해 둔 기록(배정·업무 제출·월급·구매·
// 저축·대출·제안)에서 매번 다시 계산한다 — 학생이 숫자를 조작할 쓰기 경로 자체가 없고,
// 새 컬렉션이나 Rules 변경도 필요 없다. 계산에 쓰는 기록은 모두 줄어들지 않는 값만 골랐다
// (업무 "시도 횟수"는 다시 시작해도 줄지 않고, 현재 완료 상태는 보너스로만 쓴다).
import type {BuildingId} from '../features/map/buildings';

export interface GrowthStats {
  applications:number;      // 지금까지 낸 직업 신청 수(신청 문서 기준)
  activeJobs:number;        // 지금 맡고 있는 직업 수
  taskSubmissions:number;   // 업무 제출 시도 합계(task.attempt의 합)
  tasksApproved:number;     // 지금 "완료" 상태인 업무 수
  tasksOpen:number;         // 수행 중·다시 제출 상태인 업무 수
  tasksRevision:number;     // 그중 다시 제출 요청을 받은 업무 수
  openTaskBuilding:BuildingId|null; // 할 일이 있는 업무의 직업이 있는 건물(모험 바로가기용)
  salaries:number;          // 받은 월급 횟수
  purchases:number;         // 상점에서 산 횟수
  savingsJoined:number;     // 가입한 저축 수
  savingsMatured:number;    // 만기까지 지킨 저축 수
  loansRepaid:number;       // 다 갚은 대출 수
  proposalsSubmitted:number;// 초안이 아닌 제안 수
  proposalsApproved:number; // 승인된 제안 수
  praisesReceived:number;   // 친구에게 받은 칭찬 스티커 수
  helpsGiven:number;        // 도움 게시판에서 끝까지 도와준 수
  selfDiscoveries:number;   // "나를 찾는 모험"을 마친 횟수(경험치는 3번까지만)
  discoveryCode:string|null;// 가장 최근 흥미 코드(예: 'AS')
  checkins:number;          // 출근 도장 찍은 날 수(D-122)
  checkinStreak:number;     // 연속 출근 일수(주말 제외)
  checkedInToday:boolean;
}
export const emptyGrowthStats:GrowthStats={applications:0,activeJobs:0,taskSubmissions:0,tasksApproved:0,tasksOpen:0,tasksRevision:0,openTaskBuilding:null,salaries:0,purchases:0,savingsJoined:0,savingsMatured:0,loansRepaid:0,proposalsSubmitted:0,proposalsApproved:0,praisesReceived:0,helpsGiven:0,selfDiscoveries:0,discoveryCode:null,checkins:0,checkinStreak:0,checkedInToday:false};

// 행동 하나당 얻는 경험치. 일하기(제출·월급)가 가장 크게, 사회 참여(제안)가 그다음이 되도록.
export const xpTable=[
  {key:'applications',label:'직업 신청',xp:20},
  {key:'activeJobs',label:'맡은 직업',xp:80},
  {key:'taskSubmissions',label:'업무 제출',xp:30},
  {key:'tasksApproved',label:'업무 완료',xp:40},
  {key:'salaries',label:'월급 받기',xp:50},
  {key:'purchases',label:'상점 이용',xp:10},
  {key:'savingsJoined',label:'저축 가입',xp:40},
  {key:'savingsMatured',label:'저축 만기',xp:40},
  {key:'loansRepaid',label:'대출 상환',xp:60},
  {key:'proposalsSubmitted',label:'시민 제안',xp:50},
  {key:'proposalsApproved',label:'제안 통과',xp:100},
  {key:'helpsGiven',label:'친구 도와주기',xp:40},
  {key:'praisesReceived',label:'칭찬 받기',xp:15},
  {key:'selfDiscoveries',label:'나를 찾는 모험',xp:60},
  {key:'checkins',label:'출근 도장',xp:10},
] as const satisfies readonly {key:keyof GrowthStats;label:string;xp:number}[];

export function xpBreakdown(stats:GrowthStats){
  // 나를 찾는 모험은 여러 번 해 보는 게 좋지만(수퍼: 자라면서 달라진다) 경험치는 3번까지만 준다.
  return xpTable.map(row=>{const raw=Math.max(0,Math.floor(Number(stats[row.key])||0));const count=row.key==='selfDiscoveries'?Math.min(raw,3):raw;return {...row,count,total:count*row.xp}});
}
export function totalXp(stats:GrowthStats){return xpBreakdown(stats).reduce((sum,r)=>sum+r.total,0)}

export const levelTitles=['새내기 시민','견습 시민','성실한 시민','솜씨 좋은 시민','믿음직한 시민','마을 일꾼','마을 기둥','명예 시민','마을 영웅','전설의 시민'];
export const MAX_LEVEL=levelTitles.length;
// 레벨 L에 도달하는 데 필요한 누적 경험치: 0, 100, 300, 600, 1000, 1500 … (한 칸마다 100씩 더 필요)
export function xpForLevel(level:number){const l=Math.max(1,Math.min(MAX_LEVEL,Math.floor(level)));return 50*(l-1)*l}
export function levelInfo(xp:number){
  const safe=Math.max(0,Math.floor(xp));
  let level=1;
  while(level<MAX_LEVEL&&safe>=xpForLevel(level+1))level++;
  const floor=xpForLevel(level),next=level<MAX_LEVEL?xpForLevel(level+1):null;
  const progress=next===null?1:(safe-floor)/(next-floor);
  return {level,title:levelTitles[level-1],xp:safe,floor,next,toNext:next===null?0:next-safe,progress};
}

export interface Achievement {id:string;icon:string;title:string;desc:string;earned:boolean}
export function achievements(s:GrowthStats):Achievement[]{
  return [
    {id:'first-job',icon:'🪪',title:'첫 직업',desc:'직업을 처음 맡았어요',earned:s.activeJobs>=1},
    {id:'two-jobs',icon:'🎒',title:'두 가지 일',desc:'직업을 두 개 이상 맡았어요',earned:s.activeJobs>=2},
    {id:'first-submit',icon:'📮',title:'첫 제출',desc:'업무를 처음 제출했어요',earned:s.taskSubmissions>=1},
    {id:'hard-worker',icon:'💪',title:'성실한 일꾼',desc:'업무를 10번 제출했어요',earned:s.taskSubmissions>=10},
    {id:'first-salary',icon:'💰',title:'첫 월급',desc:'처음으로 월급을 받았어요',earned:s.salaries>=1},
    {id:'first-purchase',icon:'🛍️',title:'첫 쇼핑',desc:'상점에서 처음 물건을 샀어요',earned:s.purchases>=1},
    {id:'saver',icon:'🐷',title:'저축 새싹',desc:'저축에 처음 가입했어요',earned:s.savingsJoined>=1},
    {id:'patient',icon:'⏳',title:'끝까지 기다림',desc:'저축을 만기까지 지켰어요',earned:s.savingsMatured>=1},
    {id:'debt-free',icon:'🤝',title:'약속을 지킨 시민',desc:'대출을 다 갚았어요',earned:s.loansRepaid>=1},
    {id:'voice',icon:'📣',title:'시민의 목소리',desc:'시민광장에 제안을 올렸어요',earned:s.proposalsSubmitted>=1},
    {id:'changer',icon:'🏛️',title:'마을을 바꾼 시민',desc:'내 제안이 투표로 통과됐어요',earned:s.proposalsApproved>=1},
    {id:'know-me',icon:'🧭',title:'나를 아는 시민',desc:'나를 찾는 모험을 마쳤어요',earned:s.selfDiscoveries>=1},
    {id:'growing',icon:'🌳',title:'자라는 나',desc:'나를 찾는 모험을 두 번 이상 했어요',earned:s.selfDiscoveries>=2},
    {id:'helper',icon:'🦸',title:'도움의 손길',desc:'친구의 부탁을 처음 해결했어요',earned:s.helpsGiven>=1},
    {id:'hero',icon:'🏅',title:'마을 해결사',desc:'친구의 부탁을 5번 해결했어요',earned:s.helpsGiven>=5},
    {id:'praised',icon:'🌟',title:'칭찬 받은 시민',desc:'친구에게 칭찬 스티커를 받았어요',earned:s.praisesReceived>=1},
    {id:'star',icon:'💫',title:'칭찬 부자',desc:'칭찬 스티커를 10개 받았어요',earned:s.praisesReceived>=10},
    {id:'checkin-10',icon:'☀️',title:'성실한 출근',desc:'출근 도장을 10번 찍었어요',earned:s.checkins>=10},
    {id:'checkin-30',icon:'🏆',title:'개근 시민',desc:'출근 도장을 30번 찍었어요',earned:s.checkins>=30},
    {id:'streak-5',icon:'🔥',title:'5일 연속 출근',desc:'5일(학교 가는 날) 연속으로 출근했어요',earned:s.checkinStreak>=5},
  ];
}

// "지금 할 수 있는 모험" — 다음에 무엇을 하면 좋을지 게임 퀘스트처럼 안내한다.
// 가장 급한 것(다시 제출 요청)부터, 한 번에 너무 많지 않게 최대 3개만.
export interface Quest {id:string;icon:string;title:string;desc:string;target:BuildingId;tab?:string;xp:number}
export function quests(s:GrowthStats):Quest[]{
  const list:Quest[]=[];
  const workPlace=s.openTaskBuilding??'mypage';
  if(s.selfDiscoveries===0)list.push({id:'discover',icon:'🧭',title:'나를 찾는 모험 떠나기',desc:'내가 좋아하는 것·잘하는 것을 알아보고 어울리는 직업을 찾아요.',target:'mypage',tab:'discover',xp:60});
  if(s.tasksRevision>0)list.push({id:'revise',icon:'🔁',title:'업무 다시 제출하기',desc:'선생님 의견을 읽고 고쳐서 다시 내 보세요.',target:workPlace,tab:'tasks',xp:30});
  else if(s.tasksOpen>0)list.push({id:'submit',icon:'📝',title:'오늘의 업무 끝내기',desc:'맡은 업무를 하고 제출해 보세요.',target:workPlace,tab:'tasks',xp:30});
  if(s.activeJobs===0&&s.applications===0)list.push({id:'apply',icon:'🪪',title:'첫 직업 신청하기',desc:'건물을 둘러보고 하고 싶은 일에 신청해요.',target:'mypage',tab:'jobs',xp:20});
  else if(s.activeJobs===0)list.push({id:'wait',icon:'⏰',title:'배정 기다리기',desc:'신청을 보냈어요. 다른 직업도 둘러볼까요?',target:'mypage',xp:80});
  else if(s.activeJobs===1)list.push({id:'second-job',icon:'🎒',title:'두 번째 직업 도전',desc:'다른 건물에서 새 직업을 찾아봐요.',target:'mypage',tab:'jobs',xp:80});
  if(s.purchases===0)list.push({id:'shop',icon:'🛍️',title:'상점에서 첫 쇼핑',desc:'모은 돈으로 필요한 것을 사 봐요.',target:'store',xp:10});
  if(s.savingsJoined===0)list.push({id:'save',icon:'🐷',title:'은행에서 첫 저축',desc:'돈을 맡기면 이자가 붙어요.',target:'bank',xp:40});
  if(s.helpsGiven===0)list.push({id:'help',icon:'🤝',title:'친구 부탁 들어주기',desc:'도움 게시판에서 친구의 부탁을 맡아 봐요.',target:'mypage',tab:'help',xp:40});
  if(s.proposalsSubmitted===0)list.push({id:'propose',icon:'📣',title:'시민광장에 제안하기',desc:'우리 마을에 필요한 것을 제안해요.',target:'mypage',tab:'civic',xp:50});
  return list.slice(0,3);
}
