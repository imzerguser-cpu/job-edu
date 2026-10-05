import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,where,type Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {emptyGrowthStats,type GrowthStats} from '../domain/growth';
import {checkinStreak,kstDateKey} from '../domain/checkin';
import type {Discovery} from '../domain/careerDiscovery';
import type {CareerStore} from './careerRepository';
import type {TaskStore} from './taskRepository';
import type {ProposalStore} from './proposalRepository';
import type {CommunityStore} from './communityRepository';
import type {CheckinStore} from './checkinRepository';

// 학기말 성장 보고서(D-124): 교사가 한 학생의 기록을 모아 학생 화면과 같은 방식으로 성장(레벨·업적)을 계산한다.
// 새로 저장하는 값은 없다. 각 기록은 따로 불러오고, 실패한 항목은 0으로 둔다(보고서에 표시).
export interface StudentReport {
  stats:GrowthStats;
  jobs:string[];
  tasksApproved:number;
  rewardsMinor:number;salaryMinor:number;
  recentPraises:{from:string;message:string}[];
  discoveries:(Discovery&{takenAt:string|null})[]; // 오래된 것 → 최근
  partial:boolean;
}
const iso=(v:unknown)=>(v as {toDate?:()=>Date})?.toDate?.().toISOString()??null;

export async function loadStudentReport(db:Firestore,context:SchoolContext,stores:{careerStore:CareerStore;taskStore:TaskStore;proposalStore:ProposalStore;communityStore:CommunityStore;checkinStore:CheckinStore},studentId:string):Promise<StudentReport>{
  if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
  const col=(name:string)=>collection(db,schoolPath(context,name));
  const [careers,tasks,entries,savings,loans,proposals,praises,helps,profile,history,checkins]=await Promise.allSettled([
    stores.careerStore.load(),stores.taskStore.load(),
    getDocsFromServer(query(collection(doc(col('accounts'),studentId),'entries'),limit(100))),
    getDocsFromServer(query(col('savings'),where('studentId','==',studentId),limit(100))),
    getDocsFromServer(query(col('loans'),where('studentId','==',studentId),limit(100))),
    stores.proposalStore.loadProposals(),stores.communityStore.listPraises(),stores.communityStore.listHelp(),
    getDocFromServer(doc(col('careerProfiles'),studentId)),
    getDocsFromServer(query(collection(doc(col('careerProfiles'),studentId),'history'),orderBy('takenAt','asc'),limit(20))),
    stores.checkinStore.datesFor(studentId),
  ]);
  const s:GrowthStats={...emptyGrowthStats};
  const report:StudentReport={stats:s,jobs:[],tasksApproved:0,rewardsMinor:0,salaryMinor:0,recentPraises:[],discoveries:[],partial:[careers,tasks,entries,savings,loans,proposals,praises,helps,profile,history,checkins].some(r=>r.status==='rejected')};
  if(careers.status==='fulfilled'){
    s.applications=careers.value.applications.filter(a=>a.studentId===studentId).length;
    const active=careers.value.assignments.filter(a=>a.studentId===studentId&&a.status==='active');
    s.activeJobs=active.length;
    report.jobs=active.map(a=>careers.value.jobs.find(j=>j.id===a.jobId)?.name??'(종료된 직업)');
  }
  if(tasks.status==='fulfilled'){
    const mine=tasks.value.tasks.filter(t=>t.assigneeStudentId===studentId);
    s.taskSubmissions=mine.reduce((n,t)=>n+(t.attempt||0),0);
    s.tasksApproved=report.tasksApproved=mine.filter(t=>t.status==='approved').length;
  }
  if(entries.status==='fulfilled'){
    for(const d of entries.value.docs){
      const e=d.data() as {type:string;deltaMinor:number};
      if(e.type==='SALARY'){s.salaries++;report.salaryMinor+=e.deltaMinor}
      if(e.type==='PURCHASE'&&e.deltaMinor<0)s.purchases++;
      if(e.type==='TASK_REWARD')report.rewardsMinor+=e.deltaMinor;
    }
  }
  if(savings.status==='fulfilled'){s.savingsJoined=savings.value.size;s.savingsMatured=savings.value.docs.filter(d=>d.data().status==='matured').length}
  if(loans.status==='fulfilled')s.loansRepaid=loans.value.docs.filter(d=>d.data().status==='repaid').length;
  if(proposals.status==='fulfilled'){
    const mine=proposals.value.filter(p=>p.authorStudentId===studentId&&p.status!=='draft');
    s.proposalsSubmitted=mine.length;s.proposalsApproved=mine.filter(p=>p.status==='approved').length;
  }
  if(praises.status==='fulfilled'){
    const mine=praises.value.filter(p=>p.toStudentId===studentId);
    s.praisesReceived=mine.length;
    report.recentPraises=mine.slice(0,3).map(p=>({from:p.fromStudentId,message:p.message}));
  }
  if(helps.status==='fulfilled')s.helpsGiven=helps.value.filter(h=>h.helperStudentId===studentId&&h.status==='paid').length;
  if(profile.status==='fulfilled'&&profile.value.exists()){s.selfDiscoveries=Number(profile.value.data().completions)||0;s.discoveryCode=String(profile.value.data().code)}
  if(history.status==='fulfilled')report.discoveries=history.value.docs.map(d=>({...(d.data() as Discovery),takenAt:iso(d.data().takenAt)}));
  if(checkins.status==='fulfilled'){const today=kstDateKey();s.checkins=checkins.value.length;s.checkedInToday=checkins.value.includes(today);s.checkinStreak=checkinStreak(checkins.value,today)}
  return report;
}
