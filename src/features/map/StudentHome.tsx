import type {StorybookAppearance} from '../../domain/storybook';
import {firestoreAvatar} from '../../data/avatarRepository';
import {AvatarStudio} from '../avatar/AvatarStudio';
import {CharacterSetup} from '../avatar/CharacterSetup';
import {StudentGenderRequest} from '../avatar/GenderReset';
import {firestoreAvatarResets} from '../../data/avatarResetRepository';
import {Avatar} from '../avatar/Avatar';
import {useCallback,useEffect,useRef,useMemo,useState,type ReactNode} from 'react';
import {departmentDisplayName} from '../../domain/jobs';
import {listActiveStudents} from '../../data/schoolRepository';
import {firebase} from '../../data/firebase';
import type {School,SchoolContext,Student} from '../../domain/model';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {FinanceStore} from '../../data/financeRepository';
import type {SavingsStore} from '../../data/savingsRepository';
import type {LoanStore} from '../../data/loanRepository';
import type {FinancialProductStore} from '../../data/financialProductRepository';
import type {BusinessStore} from '../../data/businessRepository';
import type {ProposalStore} from '../../data/proposalRepository';
import type {ViolationStore} from '../../data/violationRepository';
import type {CommunityStore} from '../../data/communityRepository';
import type {CareerProfileStore} from '../../data/careerProfileRepository';
import {CareerDiscovery} from '../discovery/CareerDiscovery';
import {ClassGoalsBanner,HelpBoard,PraiseTree} from '../community/CommunityWorkspace';
import {StartupCenter} from '../business/StartupCenter';
import {CareerWorkspace} from '../jobs/CareerWorkspace';
import {TaskWorkspace} from '../tasks/TaskWorkspace';
import {BankWorkspace} from '../finance/BankWorkspace';
import {StoreWorkspace} from '../business/StoreWorkspace';
import {CivicWorkspace} from '../civic/CivicWorkspace';
import {ViolationWorkspace} from '../civic/ViolationWorkspace';
import {DestinationMenu} from './CitizenMap';
import {StudentMapLayout,type MapPanel} from './StudentMapLayout';
import {BuildingPlaceholder} from './BuildingPlaceholder';
import {GameWindow,type GameTab} from './GameWindow';
import {CharacterHud,GrowthPanel,LevelUpToast,QuestBoard,lastSeenLevel,markLevelSeen} from './CitizenGrowth';
import {loadGrowthStats} from './growthStats';
import {firestoreCheckins} from '../../data/checkinRepository';
import {lastSeenNews,loadNews,markNewsSeen,type NewsItem} from './news';
import {levelInfo,totalXp,quests,type GrowthStats} from '../../domain/growth';
import {GuideWorkspace} from './GuideWorkspace';
import {buildings,type BuildingId} from './buildings';

// One-time auto-open per student (설명서를 처음엔 튜토리얼처럼, 이후엔 버튼으로 다시보기 —
// 사용자 요청). localStorage is per-device/browser, not per-account, but that's the right
// granularity here: a shared classroom tablet should show it again for a student who's new to
// THAT device, and a private guard against re-showing forever isn't worth a Firestore write.
function guideSeenKey(studentId:string){return `jobedu-guide-seen-${studentId}`}
function hasSeenGuide(studentId:string){try{return localStorage.getItem(guideSeenKey(studentId))==='1'}catch{return true}}
function markGuideSeen(studentId:string){try{localStorage.setItem(guideSeenKey(studentId),'1')}catch{/* private mode etc. — fine to show again next time */}}

export function StudentHome({citizen,school,context,store,taskStore,financeStore,savingsStore,loanStore,productStore,businessStore,proposalStore,violationStore,communityStore,careerProfileStore}:{citizen:Student;school:School;context:SchoolContext;store:CareerStore;taskStore:TaskStore;financeStore:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;productStore:FinancialProductStore;businessStore:BusinessStore;proposalStore:ProposalStore;violationStore:ViolationStore;communityStore:CommunityStore;careerProfileStore:CareerProfileStore}){
  // 'growth'/'character'는 건물이 아니라 HUD에서 여는 창이다.
  const [view,setView]=useState<'map'|BuildingId|MapPanel|'growth'|'character'>(()=>hasSeenGuide(citizen.id)?'map':'guide');
  // 퀘스트나 추천 직업에서 건물로 보낼 때 어느 탭을 먼저 열지.
  const [tab,setTab]=useState<string|undefined>(undefined);
  const [roster,setRoster]=useState<Student[]>([citizen]);
  const [stats,setStats]=useState<GrowthStats|null>(null);
  const [refresh,setRefresh]=useState(0);
  const avatarStore=useMemo(()=>firebase?firestoreAvatar(firebase.db,context):null,[context]);
  const [storybook,setStorybook]=useState<StorybookAppearance>();
  // 저장된 캐릭터가 없으면(처음 로그인) 지도보다 먼저 캐릭터 만들기를 보여 준다(D-125). 불러오기에 실패하면 막지 않는다.
  const [needsSetup,setNeedsSetup]=useState(false);
  useEffect(()=>{let alive=true;setStorybook(undefined);setNeedsSetup(false);avatarStore?.load().then(d=>{if(alive){setStorybook(d.storybook);setNeedsSetup(!d.storybook)}}).catch(()=>{});return()=>{alive=false}},[avatarStore]);
  const resetStore=useMemo(()=>firebase?firestoreAvatarResets(firebase.db,context):null,[context]);
  // 꾸미기 화면(상점 아님) 아래에 남/여 다시 고르기 요청을 붙인다(D-127).
  const avatarStudio=(shop=false)=>avatarStore?<>{studioOnly(shop)}{!shop&&storybook&&resetStore&&<StudentGenderRequest store={resetStore}/>}</>:<p role="alert">캐릭터 저장소에 연결할 수 없어요. 다시 로그인해 주세요.</p>;
  const studioOnly=(shop:boolean)=>avatarStore&&<AvatarStudio store={avatarStore} currencySymbol={school.currencyName} shop={shop} grade={citizen.grade} onSaved={setStorybook} level={stats?levelInfo(totalXp(stats)).level:null} onShop={()=>go('store','fashion')}/>;
  const [levelUp,setLevelUp]=useState<{level:number;title:string}|null>(null);
  const checkinStore=useMemo(()=>firebase?firestoreCheckins(firebase.db,context):undefined,[context]);
  const [news,setNews]=useState<NewsItem[]|null>(null);
  const [checkinBusy,setCheckinBusy]=useState(false),[checkinMessage,setCheckinMessage]=useState('');
  // 처음 쓰는 기기에서는 최근 3일 소식부터 보여 준다.
  useEffect(()=>{
    let alive=true;
    const since=lastSeenNews(citizen.id)??Date.now()-3*86400000;
    loadNews({taskStore,careerStore:store,financeStore,communityStore},citizen,roster,school.currencyName,since).then(n=>{if(alive)setNews(n)}).catch(()=>{if(alive)setNews([])});
    return ()=>{alive=false};
  },[taskStore,store,financeStore,communityStore,citizen,roster,school.currencyName,refresh]);
  async function checkIn(){
    if(!checkinStore||checkinBusy)return;setCheckinBusy(true);setCheckinMessage('');
    try{await checkinStore.checkIn();setCheckinMessage('출근 완료! 오늘도 반가워요 ☀️ +10 XP');setRefresh(n=>n+1)}
    catch(e){setCheckinMessage((e as Error).message)}
    finally{setCheckinBusy(false)}
  }
  useEffect(()=>{
    let alive=true;
    loadGrowthStats({careerStore:store,taskStore,financeStore,savingsStore,loanStore,proposalStore,communityStore,careerProfileStore,checkinStore},citizen.id).then(next=>{
      if(!alive)return;
      setStats(next);
      const info=levelInfo(totalXp(next)),seen=lastSeenLevel(citizen.id);
      // 처음 접속한 기기에서는 축하 없이 현재 레벨만 기억한다(이미 쌓은 레벨로 매번 축하하지 않게).
      if(seen!==null&&info.level>seen)setLevelUp({level:info.level,title:info.title});
      markLevelSeen(citizen.id,info.level);
    });
    return ()=>{alive=false};
  },[store,taskStore,financeStore,savingsStore,loanStore,proposalStore,communityStore,careerProfileStore,checkinStore,citizen.id,refresh]);
  useEffect(()=>{
    let alive=true;
    if(firebase)listActiveStudents(firebase.db,context).then(list=>{if(alive)setRoster(list)}).catch(()=>{if(alive)setRoster([citizen])});
    return ()=>{alive=false};
  },[context,citizen]);
  function closeGuide(){markGuideSeen(citizen.id);setView('map')}
  // 창을 닫을 때마다 성장 기록을 다시 계산한다 — 방금 제출·구매·가입한 것이 바로 경험치에 반영되도록.
  const closeWindow=useCallback(()=>{setView('map');setTab(undefined);setRefresh(n=>n+1)},[]);
  // 창 안에서 다른 건물로 바로 이동(추천 직업 "만나러 가기", 창업 센터 단계 버튼 등).
  const go=useCallback((id:BuildingId,nextTab?:string)=>{setView(id);setTab(nextTab);setRefresh(n=>n+1)},[]);


  const studentId=context.membership.studentId??undefined;
  const work=(icons:string[])=>[
    {id:'tasks',icon:'📋',label:'오늘의 업무',content:<TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={studentId} iconFilter={icons} currencySymbol={school.currencyName}/>},
    {id:'jobs',icon:'💼',label:'여기서 일하기',content:<CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={studentId} departmentNames={school.departmentNames} iconFilter={icons}/>},
  ] satisfies GameTab[];

  let win:ReactNode=null;
  if(needsSetup&&avatarStore)win=<CharacterSetup store={avatarStore} name={citizen.name} grade={citizen.grade} currencySymbol={school.currencyName} onDone={a=>{setStorybook(a);setNeedsSetup(false)}}/>;
  else if(view==='guide')win=<GameWindow title="사용 안내서" subtitle="지도에서 시작하는 우리 사회" tabs={[{id:'guide',icon:'❔',label:'안내서',content:<GuideWorkspace store={store} school={school} communityLabel={school.communityName} onClose={closeGuide}/>}]} onClose={closeGuide}/>;
  else if(view==='profile')win=<GameWindow title="내 정보" subtitle="캐릭터와 성장 기록을 확인해요" tabs={[{id:'profile',icon:'👤',label:'내 정보',content:<CharacterHud storybook={storybook} citizen={citizen} community={school.communityName} stats={stats} jobCount={stats?.activeJobs??null} onGuide={()=>setView('guide')} onGrowth={()=>setView('growth')} onPickCharacter={()=>setView('character')} onDiscover={()=>go('mypage','discover')}/>}]} onClose={closeWindow}/>;
  else if(view==='news')win=<GameWindow title="새 소식" subtitle="내가 없는 동안 생긴 일이에요" tabs={[{id:'news',icon:'🔔',label:'새 소식',content:<NewsList items={news} onGo={go} onSeen={()=>markNewsSeen(citizen.id)}/>}]} onClose={()=>{setNews([]);closeWindow()}}/>;
  else if(view==='quests')win=<GameWindow title="지금 할 수 있는 모험" subtitle="하고 싶은 모험을 누르면 해당 건물로 이동해요" tabs={[{id:'quests',icon:'🧭',label:'모험',content:<QuestBoard stats={stats} onGo={go}/>}]} onClose={closeWindow}/>;
  else if(view==='goals')win=<GameWindow title="우리 반 공동 목표" subtitle="친구들과 함께 이루는 목표예요" tabs={[{id:'goals',icon:'🌱',label:'목표',content:<ClassGoalsBanner key={refresh} store={communityStore}/>}]} onClose={closeWindow}/>;
  else if(view==='places')win=<GameWindow title="건물 목록" subtitle="가고 싶은 건물을 골라요" tabs={[{id:'places',icon:'🏘️',label:'건물',content:<DestinationMenu onNavigate={go}/>}]} onClose={closeWindow}/>;
  else if(view==='growth')win=<GameWindow title="나의 성장 기록" subtitle="레벨·업적·경험치를 확인해요" tabs={[{id:'growth',icon:'🏅',label:'성장 기록',content:<GrowthPanel stats={stats}/>}]} onClose={closeWindow}/>;
  else if(view==='character')win=<GameWindow title="내 캐릭터" subtitle="마을에서 나를 보여 줄 캐릭터를 골라요" tabs={[{id:'pick',icon:'🧑',label:'캐릭터',content:avatarStudio()}]} onClose={closeWindow}/>;
  else if(view!=='map'){
    const building=buildings.find(b=>b.id===view)!;
    const eyebrow=building.departmentId?departmentDisplayName(school,building.departmentId):undefined;
    // 은행·상점도 "쓰는 곳"이면서 동시에 "일하는 곳"이다 — 은행원·카페 직원·매점 관리원이
    // 자기 일터에서 업무를 찾을 수 있도록 일하기 탭을 함께 붙인다(이전엔 마이페이지에서만 보였음).
    const tabs:GameTab[]=view==='mypage'?[
      {id:'avatar',icon:'🎨',label:'캐릭터 꾸미기',content:avatarStudio()},
      {id:'discover',icon:'🧭',label:'나를 찾기',content:<CareerDiscovery store={careerProfileStore} careerStore={store} citizen={citizen} onGo={go}/>},
      {id:'jobs',icon:'🪪',label:'내 직업',content:<CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={studentId} departmentNames={school.departmentNames}/>},
      {id:'tasks',icon:'📋',label:'모든 업무',content:<TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={studentId} currencySymbol={school.currencyName}/>},
      {id:'help',icon:'🤝',label:'도움 게시판',content:<HelpBoard store={communityStore} students={roster} studentId={citizen.id} currencySymbol={school.currencyName}/>},
      {id:'praise',icon:'🌟',label:'칭찬 나무',content:<PraiseTree store={communityStore} students={roster} studentId={citizen.id}/>},
      {id:'civic',icon:'🗳️',label:'시민광장',content:<CivicWorkspace store={proposalStore} teacher={false} students={[citizen]} studentId={studentId}/>},
      {id:'report',icon:'🚨',label:'신고·과태료',content:<ViolationWorkspace store={violationStore} teacher={false} students={roster} studentId={citizen.id} currencySymbol={school.currencyName}/>},
      {id:'growth',icon:'🏅',label:'성장 기록',content:<GrowthPanel stats={stats}/>},
    ]:view==='bank'?[
      {id:'bank',icon:'🏦',label:'은행 창구',content:<BankWorkspace store={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} teacher={false} currencySymbol={school.currencyName}/>},
      ...work(building.icons??[]),
    ]:view==='store'?[
      {id:'fashion',icon:'👕',label:'패션 상점',content:avatarStudio(true)},
      {id:'shop',icon:'🛍️',label:'카페·매점 이용',content:<StoreWorkspace store={businessStore} teacher={false} students={[citizen]} currencySymbol={school.currencyName} studentId={citizen.id}/>},
      ...work(building.icons??[]),
      {id:'startup',icon:'🚀',label:'창업 센터',content:<StartupCenter studentId={citizen.id} proposalStore={proposalStore} loanStore={loanStore} businessStore={businessStore} currencySymbol={school.currencyName} onGo={go}/>},
    ]:building.icons?work(building.icons)
    :[{id:'soon',icon:'🚧',label:'준비 중',content:<BuildingPlaceholder label={building.label}/>}];
    win=<GameWindow key={view+'-'+(tab??'')} initialTab={tab} buildingId={building.id} title={building.label} subtitle={building.subtitle} eyebrow={eyebrow} tabs={tabs} onClose={closeWindow}/>;
  }

  return <StudentMapLayout avatar={<Avatar storybook={storybook} grade={citizen.grade} className="toolbar-avatar"/>} name={citizen.name} questCount={stats?quests(stats).length:null} newsCount={news?news.length:null} onPanel={setView} onNavigate={go}>
    {stats&&checkinStore&&(!stats.checkedInToday||checkinMessage)&&<div className="checkin-card" role="status">
      {stats.checkedInToday?<><span aria-hidden="true">🔥</span><div><b>{checkinMessage}</b><small>연속 출근 {stats.checkinStreak}일째 · 지금까지 {stats.checkins}일</small></div><button type="button" className="button quiet small" onClick={()=>setCheckinMessage('')}>닫기</button></>
        :<><span aria-hidden="true">☀️</span><div><b>오늘 출근 도장을 찍어요</b><small>{checkinMessage||(stats.checkinStreak?`어제까지 연속 ${stats.checkinStreak}일 · +10 XP`:'하루 한 번 · +10 XP')}</small></div><button type="button" className="button primary small" disabled={checkinBusy} onClick={checkIn}>{checkinBusy?'찍는 중…':'출근!'}</button></>}
    </div>}
    {levelUp&&<LevelUpToast level={levelUp.level} title={levelUp.title} onClose={()=>setLevelUp(null)}/>}
    {win}
  </StudentMapLayout>;
}

function NewsList({items,onGo,onSeen}:{items:NewsItem[]|null;onGo:(id:BuildingId,tab?:string)=>void;onSeen:()=>void}){
  // 창을 연 순간 읽은 것으로 기록한다("가 보기"로 바로 다른 건물에 가도 다시 뜨지 않게).
  const seen=useRef(onSeen);seen.current=onSeen;
  useEffect(()=>{seen.current()},[]);
  if(!items)return <p role="status">새 소식을 모으고 있어요.</p>;
  if(!items.length)return <p className="empty">새 소식이 없어요. 오늘도 멋지게 일해 볼까요?</p>;
  return <ul className="news-list">{items.map(n=><li key={n.id}>
    <span className="news-icon" aria-hidden="true">{n.icon}</span>
    <div><b>{n.text}</b><small>{new Date(n.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div>
    {n.target&&<button type="button" className="button secondary small" onClick={()=>onGo(n.target!,n.tab)}>가 보기</button>}
  </li>)}</ul>;
}
