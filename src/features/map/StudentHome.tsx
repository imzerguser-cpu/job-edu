import {useCallback,useEffect,useState,type ReactNode} from 'react';
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
import {CitizenMap} from './CitizenMap';
import {BuildingPlaceholder} from './BuildingPlaceholder';
import {GameWindow,type GameTab} from './GameWindow';
import {CharacterHud,CharacterPicker,GrowthPanel,LevelUpToast,QuestBoard,lastSeenLevel,loadCharacter,markLevelSeen,saveCharacter,type CharacterId} from './CitizenGrowth';
import {loadGrowthStats} from './growthStats';
import {levelInfo,totalXp,type GrowthStats} from '../../domain/growth';
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
  const [view,setView]=useState<'map'|BuildingId|'guide'|'growth'|'character'>(()=>hasSeenGuide(citizen.id)?'map':'guide');
  // 퀘스트나 추천 직업에서 건물로 보낼 때 어느 탭을 먼저 열지.
  const [tab,setTab]=useState<string|undefined>(undefined);
  const [roster,setRoster]=useState<Student[]>([citizen]);
  const [stats,setStats]=useState<GrowthStats|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [character,setCharacter]=useState<CharacterId>(()=>loadCharacter(citizen.id));
  const [levelUp,setLevelUp]=useState<{level:number;title:string}|null>(null);
  useEffect(()=>{
    let alive=true;
    loadGrowthStats({careerStore:store,taskStore,financeStore,savingsStore,loanStore,proposalStore,communityStore,careerProfileStore},citizen.id).then(next=>{
      if(!alive)return;
      setStats(next);
      const info=levelInfo(totalXp(next)),seen=lastSeenLevel(citizen.id);
      // 처음 접속한 기기에서는 축하 없이 현재 레벨만 기억한다(이미 쌓은 레벨로 매번 축하하지 않게).
      if(seen!==null&&info.level>seen)setLevelUp({level:info.level,title:info.title});
      markLevelSeen(citizen.id,info.level);
    });
    return ()=>{alive=false};
  },[store,taskStore,financeStore,savingsStore,loanStore,proposalStore,communityStore,careerProfileStore,citizen.id,refresh]);
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

  if(view==='guide')return <GuideWorkspace store={store} school={school} communityLabel={school.communityName} onClose={closeGuide}/>;

  const studentId=context.membership.studentId??undefined;
  const work=(icons:string[])=>[
    {id:'tasks',icon:'📋',label:'오늘의 업무',content:<TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={studentId} iconFilter={icons} currencySymbol={school.currencyName}/>},
    {id:'jobs',icon:'💼',label:'여기서 일하기',content:<CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={studentId} departmentNames={school.departmentNames} iconFilter={icons}/>},
  ] satisfies GameTab[];

  let win:ReactNode=null;
  if(view==='growth')win=<GameWindow title="나의 성장 기록" subtitle="레벨·업적·경험치를 확인해요" tabs={[{id:'growth',icon:'🏅',label:'성장 기록',content:<GrowthPanel stats={stats}/>}]} onClose={closeWindow}/>;
  else if(view==='character')win=<GameWindow title="내 캐릭터" subtitle="마을에서 나를 보여 줄 캐릭터를 골라요" tabs={[{id:'pick',icon:'🧑',label:'캐릭터',content:<CharacterPicker current={character} onPick={id=>{setCharacter(id);saveCharacter(citizen.id,id)}} onClose={()=>setView('map')}/>}]} onClose={()=>setView('map')}/>;
  else if(view!=='map'){
    const building=buildings.find(b=>b.id===view)!;
    const eyebrow=building.departmentId?departmentDisplayName(school,building.departmentId):undefined;
    // 은행·상점도 "쓰는 곳"이면서 동시에 "일하는 곳"이다 — 은행원·카페 직원·매점 관리원이
    // 자기 일터에서 업무를 찾을 수 있도록 일하기 탭을 함께 붙인다(이전엔 마이페이지에서만 보였음).
    const tabs:GameTab[]=view==='mypage'?[
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
      {id:'shop',icon:'🛍️',label:'카페·매점 이용',content:<StoreWorkspace store={businessStore} teacher={false} students={[citizen]} currencySymbol={school.currencyName} studentId={citizen.id}/>},
      ...work(building.icons??[]),
      {id:'startup',icon:'🚀',label:'창업 센터',content:<StartupCenter studentId={citizen.id} proposalStore={proposalStore} loanStore={loanStore} businessStore={businessStore} currencySymbol={school.currencyName} onGo={go}/>},
    ]:building.icons?work(building.icons)
    :[{id:'soon',icon:'🚧',label:'준비 중',content:<BuildingPlaceholder label={building.label}/>}];
    win=<GameWindow key={view+'-'+(tab??'')} initialTab={tab} buildingId={building.id} title={building.label} subtitle={building.subtitle} eyebrow={eyebrow} tabs={tabs} onClose={closeWindow}/>;
  }

  return <div className="citizen-shell">
    <CharacterHud citizen={citizen} community={school.communityName} character={character} stats={stats} jobCount={stats?.activeJobs??null} onGuide={()=>setView('guide')} onGrowth={()=>setView('growth')} onPickCharacter={()=>setView('character')} onDiscover={()=>go('mypage','discover')}/>
    {levelUp&&<LevelUpToast level={levelUp.level} title={levelUp.title} onClose={()=>setLevelUp(null)}/>}
    <ClassGoalsBanner key={refresh} store={communityStore}/>
    <QuestBoard stats={stats} onGo={go}/>
    <CitizenMap onNavigate={setView}/>
    {win}
  </div>;
}
