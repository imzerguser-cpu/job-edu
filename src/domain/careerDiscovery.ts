// "나를 찾는 모험" — 초등 1~6학년 진로 자기이해(좋아하는 것·잘하는 것·소중한 것) 탐색 프로그램.
//
// 이론적 바탕(자세한 설명은 docs/CAREER_DISCOVERY.md):
// - 홀랜드(Holland) 직업흥미 이론(RIASEC): 흥미를 6가지 유형으로 보고, 가장 높은 두 유형을
//   "흥미 코드"로 삼아 어울리는 직업과 연결한다. 초등학생 눈높이에 맞게 유형 이름을 바꿨다.
// - 가드너(Gardner) 다중지능 이론: "잘하는 것"을 한 줄 성적이 아니라 8가지 강점 영역으로 본다.
// - 수퍼(Super) 진로발달 이론: 초등은 "성장기"(환상→흥미→능력)라 결과는 확정이 아니라
//   지금의 나를 보여주는 스냅숏이다. 그래서 여러 번 다시 해 보고 지난 결과와 비교할 수 있게 했다.
//   가치(소중한 것)는 수퍼의 일 가치 개념을 쉬운 말로 바꿔 고학년에만 넣었다.
// - 갓프레드슨(Gottfredson) 제한·타협 이론: 6~8세에 "남자 일/여자 일", 9~13세에 "높은/낮은 일"로
//   꿈을 스스로 좁히기 쉽다. 그래서 추천은 항상 여러 분야를 섞어 보여 주고, 결과 화면에서
//   "직업에는 남자 일·여자 일이 따로 없다"는 메시지를 준다.
// - 학교 진로교육 목표·성취기준(교육부): 자기이해와 사회적 역량 개발 / 일과 직업세계 이해 /
//   진로 탐색 / 진로 디자인과 준비의 4영역, 저·중·고학년 구분을 그대로 따른다.

export const hollandTypes=['R','I','A','S','E','C'] as const;
export type HollandType=typeof hollandTypes[number];
export const hollandInfo:Record<HollandType,{name:string;icon:string;color:string;short:string;desc:string}>={
  R:{name:'만드는 탐험가',icon:'🛠️',color:'#e07a3f',short:'손과 몸으로 직접 만들고 움직이기',desc:'도구를 쓰고, 만들고, 고치고, 몸을 움직이는 활동을 좋아해요. 식물이나 동물을 돌보는 것도 잘 어울려요.'},
  I:{name:'궁금한 탐구가',icon:'🔍',color:'#3f7fe0',short:'왜 그런지 궁금해하고 알아내기',desc:'"왜 그럴까?"를 끝까지 파고들어요. 관찰하고, 실험하고, 문제를 푸는 걸 좋아해요.'},
  A:{name:'상상하는 예술가',icon:'🎨',color:'#b35fd6',short:'나만의 생각을 그림·글·소리로 표현하기',desc:'그림, 글, 음악, 춤처럼 나만의 방식으로 표현하는 걸 좋아해요. 새로운 아이디어가 많아요.'},
  S:{name:'돕는 친구',icon:'🤝',color:'#3fae6a',short:'사람을 돕고 가르치고 함께하기',desc:'친구를 도와주고, 가르쳐 주고, 이야기를 들어 주는 걸 좋아해요. 함께할 때 힘이 나요.'},
  E:{name:'이끄는 리더',icon:'📣',color:'#e0a53f',short:'앞에서 이끌고 설득하고 도전하기',desc:'모둠을 이끌고, 내 생각을 설득하고, 새로운 일에 도전하는 걸 좋아해요.'},
  C:{name:'꼼꼼한 관리자',icon:'🗂️',color:'#5f7a8f',short:'차근차근 정리하고 기록하고 지키기',desc:'정해진 순서대로 차근차근, 꼼꼼하게 정리하고 기록하는 걸 좋아해요. 약속을 잘 지켜요.'},
};

export const strengthAreas=['word','logic','space','body','music','people','self','nature'] as const;
export type StrengthArea=typeof strengthAreas[number];
export const strengthInfo:Record<StrengthArea,{name:string;icon:string}>={
  word:{name:'말·글 강점',icon:'📚'},logic:{name:'수·논리 강점',icon:'🔢'},space:{name:'그림·공간 강점',icon:'🧩'},body:{name:'몸·손 강점',icon:'🏃'},
  music:{name:'음악 강점',icon:'🎶'},people:{name:'친구 관계 강점',icon:'🫂'},self:{name:'나 이해 강점',icon:'🪞'},nature:{name:'자연 탐구 강점',icon:'🌿'},
};

export const workValues=['help','create','money','recognition','stability','freedom','together','achieve'] as const;
export type WorkValue=typeof workValues[number];
export const valueInfo:Record<WorkValue,{name:string;icon:string;desc:string;types:HollandType[]}>={
  help:{name:'도움',icon:'💗',desc:'다른 사람에게 도움이 되는 일',types:['S']},
  create:{name:'창의',icon:'💡',desc:'새로운 것을 만들어 내는 일',types:['A','I']},
  money:{name:'경제적 보상',icon:'💰',desc:'돈을 넉넉히 버는 일',types:['E','C']},
  recognition:{name:'인정',icon:'🏆',desc:'사람들에게 인정받는 일',types:['E','A']},
  stability:{name:'안정',icon:'🏠',desc:'오래도록 안심하고 할 수 있는 일',types:['C']},
  freedom:{name:'자율',icon:'🕊️',desc:'내 방식대로 할 수 있는 일',types:['A','I']},
  together:{name:'협동',icon:'👫',desc:'여럿이 함께 어울려 하는 일',types:['S','E']},
  achieve:{name:'성취',icon:'⛰️',desc:'어려운 것을 끝까지 해내는 일',types:['I','R']},
};

export type GradeBand='low'|'mid'|'high';
export const bandInfo:Record<GradeBand,{name:string;grades:string;valuePicks:number;scale:string[]}>={
  low:{name:'저학년',grades:'1~2학년',valuePicks:0,scale:['😐 별로예요','🙂 그냥 그래요','😀 좋아요']},
  mid:{name:'중학년',grades:'3~4학년',valuePicks:2,scale:['아니에요','조금 그래요','정말 그래요']},
  high:{name:'고학년',grades:'5~6학년',valuePicks:3,scale:['전혀 아니다','보통이다','매우 그렇다']},
};
// 강점 문항은 "못해요"라는 자기 낙인 대신 "배우는 중"이라는 성장형 표현을 쓴다.
export const strengthScale=['🌱 배우는 중이에요','👍 조금 잘해요','⭐ 잘해요'];
export function bandForGrade(grade:number):GradeBand{return grade<=2?'low':grade<=4?'mid':'high'}

// pic: 1~2학년용 그림(큰 이모지 장면). 글을 읽기 어려운 학생도 그림만 보고 고를 수 있게(사용자 요청, D-115).
export interface InterestItem {id:string;type:HollandType;icon:string;text:string;pic:string}
export interface StrengthItem {id:string;area:StrengthArea;icon:string;text:string;pic:string}

// 흥미 문항: 저학년 12(유형당 2) / 중학년 18(유형당 3) / 고학년 24(유형당 4).
// 앞쪽 문항일수록 쉬운 활동이고, 학년대가 올라갈수록 뒤 문항이 추가된다.
const interestPool:Record<HollandType,{icon:string;low:string;mid:string;high:string;pic?:string}[]>={
  R:[
    {icon:'🧱',pic:'🧱🏰',low:'블록이나 레고로 무언가 만들기',mid:'블록·종이·나무로 무언가 만들기',high:'도구를 써서 물건을 직접 만들기'},
    {icon:'🌱',pic:'🌱🐶',low:'밖에서 식물이나 동물 돌보기',mid:'식물을 기르거나 동물 돌보기',high:'식물을 기르고 동물을 보살피기'},
    {icon:'🔧',low:'',mid:'고장 난 물건을 고쳐 보기',high:'기계가 움직이는 원리를 알아보고 고치기'},
    {icon:'⚽',low:'',mid:'',high:'몸을 움직여 하는 일(운동·정리·옮기기)'},
  ],
  I:[
    {icon:'❓',pic:'🤔🔍',low:'왜 그런지 궁금한 것 알아보기',mid:'궁금한 것을 책이나 인터넷에서 찾아보기',high:'궁금한 것을 여러 자료로 조사해 비교하기'},
    {icon:'🧪',pic:'🧪🔬',low:'실험하거나 자세히 관찰하기',mid:'과학 실험하고 관찰하기',high:'실험하고 관찰한 결과를 정리하기'},
    {icon:'🧮',low:'',mid:'수학 문제나 퍼즐 풀기',high:'어려운 문제를 끝까지 생각해서 풀기'},
    {icon:'🪐',low:'',mid:'',high:'자연이나 우주 현상의 원인 알아보기'},
  ],
  A:[
    {icon:'🖍️',pic:'🖍️🎨',low:'그림 그리기와 색칠하기',mid:'그림이나 만화 그리기',high:'그림을 그리거나 무언가를 예쁘게 꾸미기'},
    {icon:'🎤',pic:'🎤💃',low:'노래 부르거나 춤추기',mid:'노래·악기 연주·춤',high:'음악·춤·연극으로 표현하기'},
    {icon:'✏️',low:'',mid:'이야기나 동시 짓기',high:'나만의 이야기나 글 짓기'},
    {icon:'💭',low:'',mid:'',high:'남들이 생각 못한 새 아이디어 떠올리기'},
  ],
  S:[
    {icon:'🤝',pic:'🧒🤝🧒',low:'어려워하는 친구 도와주기',mid:'모르는 친구에게 친절하게 알려 주기',high:'친구에게 공부나 방법을 가르쳐 주기'},
    {icon:'👂',pic:'👂💬',low:'친구 이야기 들어 주기',mid:'친구의 고민 이야기 들어 주기',high:'친구의 고민을 듣고 위로해 주기'},
    {icon:'👫',low:'',mid:'모둠 친구들과 사이좋게 협동하기',high:'다른 사람을 위한 봉사 활동하기'},
    {icon:'🕊️',low:'',mid:'',high:'다툰 친구들이 화해하도록 돕기'},
  ],
  E:[
    {icon:'🙋',pic:'🙋📢',low:'친구들 앞에서 발표하기',mid:'모둠장이 되어 친구들 이끌기',high:'모둠이나 학급 행사를 앞장서 이끌기'},
    {icon:'👑',pic:'👑🎲',low:'놀이에서 규칙 정하고 이끌기',mid:'가게 놀이처럼 물건 팔아 보기',high:'물건을 팔아 이익을 내는 계획 세우기'},
    {icon:'🗣️',low:'',mid:'내 생각을 친구들에게 설득하기',high:'토론에서 내 의견을 설득력 있게 말하기'},
    {icon:'🚀',low:'',mid:'',high:'새로운 일을 계획하고 도전하기'},
  ],
  C:[
    {icon:'🧺',pic:'🧺📚',low:'물건을 가지런히 정리하기',mid:'책상이나 사물함 깔끔하게 정리하기',high:'자료를 표나 목록으로 깔끔하게 정리하기'},
    {icon:'✅',pic:'🤙✅',low:'약속과 규칙 잘 지키기',mid:'정해진 순서대로 차근차근 하기',high:'계획표를 세우고 그대로 지키기'},
    {icon:'📒',low:'',mid:'용돈이나 물건을 공책에 기록하기',high:'돈이나 물건을 장부에 기록하기'},
    {icon:'🔎',low:'',mid:'',high:'실수가 없는지 꼼꼼히 다시 확인하기'},
  ],
};
const perBand:Record<GradeBand,number>={low:2,mid:3,high:4};
export function interestItems(band:GradeBand):InterestItem[]{
  // 유형이 한 줄로 몰리지 않도록 R I A S E C 순서로 번갈아 섞는다.
  const n=perBand[band],items:InterestItem[]=[];
  for(let i=0;i<n;i++)for(const type of hollandTypes){const p=interestPool[type][i];items.push({id:`${type}${i}`,type,icon:p.icon,text:p[band],pic:p.pic??p.icon})}
  return items;
}

// 강점 문항: 저학년 8(영역당 1) / 중·고학년 16(영역당 2).
const strengthPool:Record<StrengthArea,{icon:string;pic:string;a:string;b:string}>={
  word:{icon:'📚',pic:'📖🗣️',a:'이야기를 재미있게 말하거나 글로 잘 써요',b:'책을 읽고 내용을 잘 설명해요'},
  logic:{icon:'🔢',pic:'🔢➕',a:'숫자와 계산을 잘해요',b:'규칙이나 이유를 잘 찾아내요'},
  space:{icon:'🧩',pic:'🎨🧩',a:'그림 그리기나 만들기를 잘해요',b:'지도나 모양을 머릿속으로 잘 떠올려요'},
  body:{icon:'🏃',pic:'🏃⚽',a:'몸을 움직이는 운동을 잘해요',b:'손으로 섬세하게 만들거나 다뤄요'},
  music:{icon:'🎶',pic:'🎶🥁',a:'노래나 리듬을 잘 따라 해요',b:'소리나 박자의 차이를 잘 알아차려요'},
  people:{icon:'🫂',pic:'👫😄',a:'친구들과 잘 어울려요',b:'친구의 마음을 잘 알아차려요'},
  self:{icon:'🪞',pic:'🪞💭',a:'내 기분이 어떤지 잘 알아요',b:'스스로 목표를 세우고 해내요'},
  nature:{icon:'🌿',pic:'🐞🌳',a:'동물이나 식물을 잘 알아봐요',b:'날씨나 계절의 변화를 잘 관찰해요'},
};
export function strengthItems(band:GradeBand):StrengthItem[]{
  const items:StrengthItem[]=strengthAreas.map(area=>({id:`${area}0`,area,icon:strengthPool[area].icon,pic:strengthPool[area].pic,text:strengthPool[area].a}));
  if(band!=='low')items.push(...strengthAreas.map(area=>({id:`${area}1`,area,icon:strengthPool[area].icon,pic:strengthPool[area].pic,text:strengthPool[area].b})));
  return items;
}

export type Answers=Record<string,number>; // 문항 id → 0|1|2
export type Scores<K extends string>=Record<K,number>; // 0~100

function average(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
export function scoreInterest(band:GradeBand,answers:Answers):Scores<HollandType>{
  const items=interestItems(band);
  return Object.fromEntries(hollandTypes.map(t=>[t,Math.round(average(items.filter(i=>i.type===t).map(i=>clamp(answers[i.id])))*50)])) as Scores<HollandType>;
}
export function scoreStrengths(band:GradeBand,answers:Answers):Scores<StrengthArea>{
  const items=strengthItems(band);
  return Object.fromEntries(strengthAreas.map(a=>[a,Math.round(average(items.filter(i=>i.area===a).map(i=>clamp(answers[i.id])))*50)])) as Scores<StrengthArea>;
}
function clamp(v:number|undefined){return typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(2,Math.round(v))):0}

// 흥미 코드: 가장 높은 1~2개 유형. 동점이면 RIASEC 순서. 두 번째가 너무 낮으면(30 미만) 한 글자만.
export function hollandCode(interest:Scores<HollandType>){
  const ranked=[...hollandTypes].sort((a,b)=>interest[b]-interest[a]||hollandTypes.indexOf(a)-hollandTypes.indexOf(b));
  return interest[ranked[1]]>=30?ranked[0]+ranked[1]:ranked[0];
}
export function topStrengths(strengths:Scores<StrengthArea>,n=3){
  return [...strengthAreas].sort((a,b)=>strengths[b]-strengths[a]||strengthAreas.indexOf(a)-strengthAreas.indexOf(b)).slice(0,n);
}

// 마을 직업 아이콘(jobs.ts jobIcons)별 흥미 유형(주·부)과 관련 강점.
export const iconProfiles:Record<string,{types:[HollandType,HollandType];strengths:StrengthArea[]}>={
  banker:{types:['C','E'],strengths:['logic','people']},
  tax_accounting:{types:['C','I'],strengths:['logic']},
  store_manager:{types:['E','C'],strengths:['people','logic']},
  cafe_worker:{types:['S','R'],strengths:['people','body']},
  real_estate:{types:['E','C'],strengths:['people','word']},
  business_manager:{types:['E','C'],strengths:['people','logic']},
  journalist:{types:['A','I'],strengths:['word','people']},
  photographer:{types:['A','R'],strengths:['space']},
  writer:{types:['A','I'],strengths:['word','self']},
  webtoon_artist:{types:['A','E'],strengths:['space','word']},
  painter:{types:['A','R'],strengths:['space','self']},
  digital_manager:{types:['I','C'],strengths:['logic','space']},
  dj:{types:['A','E'],strengths:['music','word']},
  library_manager:{types:['C','S'],strengths:['word']},
  environment_manager:{types:['R','S'],strengths:['nature','body']},
  plant_manager:{types:['R','I'],strengths:['nature']},
  safety_manager:{types:['R','S'],strengths:['body','people']},
  rules_manager:{types:['C','S'],strengths:['self','word']},
  milk_delivery:{types:['R','C'],strengths:['body']},
  parcel_delivery:{types:['R','C'],strengths:['body','space']},
  school_notice:{types:['C','S'],strengths:['word']},
  noticeboard_manager:{types:['A','C'],strengths:['space','word']},
  event_planner:{types:['E','A'],strengths:['people','logic']},
  music:{types:['A','S'],strengths:['music']},
  singer:{types:['A','S'],strengths:['music','body']},
  dancer:{types:['A','R'],strengths:['body','music']},
  board_game:{types:['E','S'],strengths:['logic','people']},
  culture_play:{types:['S','A'],strengths:['people','body']},
};

// "세상의 직업" — 우리 마을 밖, 실제 사회의 다양한 직업. 성별 고정관념이 약한 직업을 섞었다.
export const worldCareers:Record<HollandType,{icon:string;name:string}[]>={
  R:[{icon:'👩‍🍳',name:'요리사'},{icon:'🧑‍🚒',name:'소방관'},{icon:'🤖',name:'로봇 기술자'},{icon:'🧑‍🌾',name:'스마트팜 농부'},{icon:'✈️',name:'항공 정비사'},{icon:'🪚',name:'목수'}],
  I:[{icon:'🔬',name:'과학자'},{icon:'🩺',name:'의사'},{icon:'💻',name:'프로그래머'},{icon:'🌦️',name:'기상 연구원'},{icon:'🐾',name:'수의사'},{icon:'🚀',name:'우주 공학자'}],
  A:[{icon:'✍️',name:'작가'},{icon:'🎨',name:'디자이너'},{icon:'🎻',name:'음악가'},{icon:'🎭',name:'배우'},{icon:'🏛️',name:'건축가'},{icon:'🎮',name:'게임 기획자'}],
  S:[{icon:'👩‍🏫',name:'선생님'},{icon:'🧑‍⚕️',name:'간호사'},{icon:'🧑‍🤝‍🧑',name:'사회복지사'},{icon:'💬',name:'상담사'},{icon:'🏅',name:'체육 코치'},{icon:'🧸',name:'보육 교사'}],
  E:[{icon:'💼',name:'사업가'},{icon:'⚖️',name:'변호사'},{icon:'🏛️',name:'정치인'},{icon:'📢',name:'마케터'},{icon:'🏨',name:'호텔 지배인'},{icon:'🎬',name:'영화 감독'}],
  C:[{icon:'🧾',name:'회계사'},{icon:'📚',name:'사서'},{icon:'🏦',name:'은행원'},{icon:'🏢',name:'공무원'},{icon:'📊',name:'데이터 분석가'},{icon:'🛃',name:'세관원'}],
};

export interface Discovery {band:GradeBand;interest:Scores<HollandType>;strengths:Scores<StrengthArea>;values:WorkValue[];code:string;reflection:string}

// 직업 어울림 점수(0~100): 흥미(주 유형 60%·부 유형 25%) + 관련 강점 15% + 가치가 맞으면 +5.
export function jobFit(d:Pick<Discovery,'interest'|'strengths'|'values'>,icon:string){
  const p=iconProfiles[icon];if(!p)return 0;
  const interest=d.interest[p.types[0]]*0.6+d.interest[p.types[1]]*0.25;
  const strength=average(p.strengths.map(s=>d.strengths[s]))*0.15;
  const value=d.values.some(v=>valueInfo[v].types.includes(p.types[0]))?5:0;
  return Math.min(100,Math.round(interest+strength+value));
}
export function fitStars(fit:number){return fit>=70?3:fit>=45?2:1}

// 우리 마을 직업 추천: 어울림 순 상위 n개. 한 유형만 몰리지 않게(갓프레드슨) 같은 주 유형은 최대 2개.
export function recommendJobs<T extends {icon:string}>(d:Pick<Discovery,'interest'|'strengths'|'values'>,jobs:T[],n=4){
  const ranked=jobs.filter(j=>iconProfiles[j.icon]).map(job=>({job,fit:jobFit(d,job.icon)})).sort((a,b)=>b.fit-a.fit);
  const picked:typeof ranked=[],perType:Partial<Record<HollandType,number>>={};
  for(const r of ranked){
    const t=iconProfiles[r.job.icon].types[0];
    if((perType[t]??0)>=2)continue;
    perType[t]=(perType[t]??0)+1;picked.push(r);
    if(picked.length>=n)break;
  }
  return picked;
}
// 세상의 직업: 흥미 코드의 두 유형에서 3개씩(한 글자 코드면 그 유형 4개 + 다음 유형 2개).
export function recommendWorldCareers(d:Pick<Discovery,'interest'>){
  const ranked=[...hollandTypes].sort((a,b)=>d.interest[b]-d.interest[a]||hollandTypes.indexOf(a)-hollandTypes.indexOf(b));
  return [...worldCareers[ranked[0]].slice(0,4).map(c=>({...c,type:ranked[0]})),...worldCareers[ranked[1]].slice(0,2).map(c=>({...c,type:ranked[1]}))];
}

// 학년대별로 스스로 돌아보는 질문(진로 디자인과 준비 영역). 결과 화면에서 한 줄 적는다.
export const reflectionPrompt:Record<GradeBand,string>={
  low:'내가 좋아하는 것을 그림 대신 한 줄로 적어 볼까요?',
  mid:'해 보고 싶은 직업 하나와 그 이유를 적어 봐요.',
  high:'나의 흥미·강점·가치를 생각하며, 앞으로 도전해 보고 싶은 일과 그 준비 방법을 적어 봐요.',
};

export function validateDiscovery(d:Discovery){
  if(!(['low','mid','high'] as const).includes(d.band))throw new Error('학년대를 확인해 주세요.');
  for(const t of hollandTypes)if(!Number.isInteger(d.interest[t])||d.interest[t]<0||d.interest[t]>100)throw new Error('흥미 점수를 확인해 주세요.');
  for(const a of strengthAreas)if(!Number.isInteger(d.strengths[a])||d.strengths[a]<0||d.strengths[a]>100)throw new Error('강점 점수를 확인해 주세요.');
  if(d.values.length>3||new Set(d.values).size!==d.values.length||d.values.some(v=>!(workValues as readonly string[]).includes(v)))throw new Error('소중한 것을 3개까지 골라 주세요.');
  if(!/^[RIASEC]{1,2}$/.test(d.code))throw new Error('흥미 코드를 확인해 주세요.');
  if(d.reflection.length>300)throw new Error('생각 적기는 300자 이하로 적어 주세요.');
}
