import {emptyGrowthStats,type GrowthStats} from '../../domain/growth';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {FinanceStore} from '../../data/financeRepository';
import type {SavingsStore} from '../../data/savingsRepository';
import type {LoanStore} from '../../data/loanRepository';
import type {ProposalStore} from '../../data/proposalRepository';
import type {CommunityStore} from '../../data/communityRepository';
import type {CareerProfileStore} from '../../data/careerProfileRepository';
import type {CheckinStore} from '../../data/checkinRepository';
import {checkinStreak,kstDateKey} from '../../domain/checkin';
import {buildings,type BuildingId} from './buildings';

export interface GrowthSources {careerStore:CareerStore;taskStore:TaskStore;financeStore:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;proposalStore:ProposalStore;communityStore:CommunityStore;careerProfileStore:CareerProfileStore;checkinStore?:CheckinStore}

export function buildingForIcon(icon:string):BuildingId|null{return buildings.find(b=>b.icons?.includes(icon))?.id??null}

// 각 기록을 따로 불러오고, 하나가 실패해도(권한·네트워크) 그 항목만 0으로 두고 나머지는 보여 준다 —
// 성장 화면 하나 때문에 지도 전체가 멈추면 안 되기 때문.
export async function loadGrowthStats(src:GrowthSources,studentId:string):Promise<GrowthStats>{
  const [careers,tasks,salaries,purchases,savings,loans,proposals,praises,helps,profile,checkins]=await Promise.allSettled([
    src.careerStore.load(),src.taskStore.load(),
    src.financeStore.myEntryCount('SALARY'),src.financeStore.myEntryCount('PURCHASE'),
    src.savingsStore.myContracts(),src.loanStore.myLoans(),src.proposalStore.loadProposals(),
    src.communityStore.praisesReceived(studentId),src.communityStore.listHelp(),src.careerProfileStore.myProfile(),
    src.checkinStore?src.checkinStore.myDates():Promise.resolve([] as string[]),
  ]);
  const s:GrowthStats={...emptyGrowthStats};
  if(careers.status==='fulfilled'){
    s.applications=careers.value.applications.filter(a=>a.studentId===studentId).length;
    s.activeJobs=careers.value.assignments.filter(a=>a.studentId===studentId&&a.status==='active').length;
  }
  if(tasks.status==='fulfilled'){
    const mine=tasks.value.tasks.filter(t=>t.assigneeStudentId===studentId);
    s.taskSubmissions=mine.reduce((sum,t)=>sum+(t.attempt||0),0);
    s.tasksApproved=mine.filter(t=>t.status==='approved').length;
    const open=mine.filter(t=>t.status==='assigned'||t.status==='revision_requested');
    s.tasksOpen=open.length;
    s.tasksRevision=open.filter(t=>t.status==='revision_requested').length;
    const urgent=open.find(t=>t.status==='revision_requested')??open[0];
    if(urgent&&careers.status==='fulfilled'){
      const job=careers.value.jobs.find(j=>j.id===urgent.jobId);
      s.openTaskBuilding=job?buildingForIcon(job.icon):null;
    }
  }
  if(salaries.status==='fulfilled')s.salaries=salaries.value;
  if(purchases.status==='fulfilled')s.purchases=purchases.value;
  if(savings.status==='fulfilled'){
    s.savingsJoined=savings.value.length;
    s.savingsMatured=savings.value.filter(c=>c.status==='matured').length;
  }
  if(loans.status==='fulfilled')s.loansRepaid=loans.value.filter(l=>l.status==='repaid').length;
  if(proposals.status==='fulfilled'){
    const mine=proposals.value.filter(p=>p.authorStudentId===studentId&&p.status!=='draft');
    s.proposalsSubmitted=mine.length;
    s.proposalsApproved=mine.filter(p=>p.status==='approved').length;
  }
  if(praises.status==='fulfilled')s.praisesReceived=praises.value;
  if(helps.status==='fulfilled')s.helpsGiven=helps.value.filter(h=>h.helperStudentId===studentId&&h.status==='paid').length;
  if(profile.status==='fulfilled'&&profile.value){s.selfDiscoveries=profile.value.completions;s.discoveryCode=profile.value.code}
  if(checkins.status==='fulfilled'){const today=kstDateKey();s.checkins=checkins.value.length;s.checkedInToday=checkins.value.includes(today);s.checkinStreak=checkinStreak(checkins.value,today)}
  return s;
}
