import {useEffect,useState} from 'react';
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
import {CareerWorkspace} from '../jobs/CareerWorkspace';
import {TaskWorkspace} from '../tasks/TaskWorkspace';
import {BankWorkspace} from '../finance/BankWorkspace';
import {StoreWorkspace} from '../business/StoreWorkspace';
import {CivicWorkspace} from '../civic/CivicWorkspace';
import {ViolationWorkspace} from '../civic/ViolationWorkspace';
import {CitizenMap} from './CitizenMap';
import {DestinationIcon} from './DestinationIcon';
import {BuildingShell} from './BuildingShell';
import {BuildingPlaceholder} from './BuildingPlaceholder';
import {GuideWorkspace} from './GuideWorkspace';
import {buildings,type BuildingId} from './buildings';

// One-time auto-open per student (설명서를 처음엔 튜토리얼처럼, 이후엔 버튼으로 다시보기 —
// 사용자 요청). localStorage is per-device/browser, not per-account, but that's the right
// granularity here: a shared classroom tablet should show it again for a student who's new to
// THAT device, and a private guard against re-showing forever isn't worth a Firestore write.
function guideSeenKey(studentId:string){return `jobedu-guide-seen-${studentId}`}
function hasSeenGuide(studentId:string){try{return localStorage.getItem(guideSeenKey(studentId))==='1'}catch{return true}}
function markGuideSeen(studentId:string){try{localStorage.setItem(guideSeenKey(studentId),'1')}catch{/* private mode etc. — fine to show again next time */}}

export function StudentHome({citizen,school,context,store,taskStore,financeStore,savingsStore,loanStore,productStore,businessStore,proposalStore,violationStore}:{citizen:Student;school:School;context:SchoolContext;store:CareerStore;taskStore:TaskStore;financeStore:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;productStore:FinancialProductStore;businessStore:BusinessStore;proposalStore:ProposalStore;violationStore:ViolationStore}){
  const [view,setView]=useState<'map'|BuildingId|'guide'>(()=>hasSeenGuide(citizen.id)?'map':'guide');
  const [jobCount,setJobCount]=useState<number|null>(null);
  const [roster,setRoster]=useState<Student[]>([citizen]);
  useEffect(()=>{
    let alive=true;
    store.load().then(d=>{if(alive)setJobCount(d.assignments.filter(a=>a.status==='active'&&a.studentId===citizen.id).length)}).catch(()=>{if(alive)setJobCount(null)});
    return ()=>{alive=false};
  },[store,citizen.id]);
  useEffect(()=>{
    let alive=true;
    if(firebase)listActiveStudents(firebase.db,context).then(list=>{if(alive)setRoster(list)}).catch(()=>{if(alive)setRoster([citizen])});
    return ()=>{alive=false};
  },[context,citizen]);
  function closeGuide(){markGuideSeen(citizen.id);setView('map')}

  if(view==='guide')return <GuideWorkspace store={store} school={school} communityLabel={school.communityName} onClose={closeGuide}/>;

  if(view==='map')return <div className="citizen-shell">
    <CitizenHud citizen={citizen} community={school.communityName} jobCount={jobCount} onGuide={()=>setView('guide')}/>
    <CitizenMap onNavigate={setView}/>
  </div>;

  const building=buildings.find(b=>b.id===view)!;
  const deptEyebrow=building.departmentId?departmentDisplayName(school,building.departmentId):undefined;
  return <BuildingShell title={building.label} subtitle={building.subtitle} eyebrow={deptEyebrow} onBack={()=>setView('map')}>
    {view==='mypage'
      ?<><CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined} departmentNames={school.departmentNames}/>
        <TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined}/>
        <CivicWorkspace store={proposalStore} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined}/>
        <ViolationWorkspace store={violationStore} teacher={false} students={roster} studentId={citizen.id} currencySymbol={school.currencyName}/></>
      :view==='bank'
      ?<BankWorkspace store={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} teacher={false} currencySymbol={school.currencyName}/>
      :view==='store'
      ?<StoreWorkspace store={businessStore} teacher={false} students={[citizen]} currencySymbol={school.currencyName} studentId={citizen.id}/>
      :building.icons
      ?<><CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined} departmentNames={school.departmentNames} iconFilter={building.icons}/>
        <TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined} iconFilter={building.icons}/></>
      :<BuildingPlaceholder label={building.label}/>}
  </BuildingShell>;
}

function CitizenHud({citizen,community,jobCount,onGuide}:{citizen:Student;community:string;jobCount:number|null;onGuide:()=>void}){
  return <aside className="citizen-hud">
    <div className="citizen-hud-top"><span className="citizen-hud-eyebrow">{community}</span><button type="button" className="button quiet small" onClick={onGuide}>📖 설명서</button></div>
    <div className="citizen-hud-profile"><DestinationIcon id="mypage"/><div><b>{citizen.name} 시민</b><small>{citizen.grade}학년 · {citizen.className??'반 미지정'}</small></div></div>
    <div className="citizen-hud-stat"><span>현재 맡은 직업</span><b>{jobCount===null?'확인 중…':`${jobCount}개`}</b></div>
  </aside>;
}
