import {formatMoney} from '../../domain/money';
import type {Student} from '../../domain/model';
import type {TaskStore} from '../../data/taskRepository';
import type {FinanceStore} from '../../data/financeRepository';
import type {CommunityStore} from '../../data/communityRepository';
import {buildingForIcon} from './growthStats';
import type {CareerStore} from '../../data/careerRepository';
import type {BuildingId} from './buildings';

// 학생용 "새 소식"(D-123): 마지막으로 확인한 뒤에 생긴 일만 모아 보여 준다. 새로 저장하는 것은 없고,
// 이미 읽을 수 있는 기록(내 업무·내 계좌·칭찬·도움 게시판)의 시각을 비교한다. 확인 시각은 이 기기에만.
export interface NewsItem {id:string;icon:string;text:string;at:number;target?:BuildingId;tab?:string}

const ms=(v:unknown)=>{
  if(!v)return 0;
  const t=v as {toMillis?:()=>number;toDate?:()=>Date};
  if(typeof t.toMillis==='function')return t.toMillis();
  if(typeof v==='string'){const n=Date.parse(v);return Number.isFinite(n)?n:0}
  return 0;
};
function seenKey(studentId:string){return `jobedu-news-seen-${studentId}`}
export function lastSeenNews(studentId:string){try{const n=Number(localStorage.getItem(seenKey(studentId)));return Number.isFinite(n)&&n>0?n:null}catch{return null}}
export function markNewsSeen(studentId:string,at=Date.now()){try{localStorage.setItem(seenKey(studentId),String(at))}catch{/* 이 화면에서만 */}}

export async function loadNews(src:{taskStore:TaskStore;careerStore:CareerStore;financeStore:FinanceStore;communityStore:CommunityStore},me:Student,roster:Student[],currencySymbol:string,since:number):Promise<NewsItem[]>{
  const name=(id:string|null|undefined)=>roster.find(s=>s.id===id)?.name??'친구';
  const [tasks,careers,entries,praises,helps]=await Promise.allSettled([src.taskStore.load(),src.careerStore.load(),src.financeStore.myEntries(),src.communityStore.listPraises(),src.communityStore.listHelp()]);
  const items:NewsItem[]=[];
  if(tasks.status==='fulfilled'){
    const title=(id:string)=>tasks.value.templates.find(t=>t.id===id)?.title??'업무';
    const place=(jobId:string)=>{const job=careers.status==='fulfilled'?careers.value.jobs.find(j=>j.id===jobId):undefined;return job?buildingForIcon(job.icon)??'mypage':'mypage'};
    for(const t of tasks.value.tasks.filter(t=>t.assigneeStudentId===me.id)){
      const at=ms((t as unknown as {updatedAt?:unknown}).updatedAt);if(at<=since)continue;
      if(t.status==='approved')items.push({id:`task-ok-${t.id}-${t.attempt}`,icon:'✅',text:`"${title(t.templateId)}" 업무가 승인됐어요!`,at});
      else if(t.status==='revision_requested')items.push({id:`task-re-${t.id}-${t.attempt}`,icon:'🔁',text:`"${title(t.templateId)}" 다시 제출해 주세요${t.reviewNote?` — ${t.reviewNote}`:''}`,at,target:place(t.jobId),tab:'tasks'});
      else if(t.status==='assigned')items.push({id:`task-new-${t.id}-${t.attempt}`,icon:'📋',text:`새 업무가 왔어요: "${title(t.templateId)}"`,at,target:place(t.jobId),tab:'tasks'});
    }
  }
  if(entries.status==='fulfilled'){
    for(const e of entries.value){
      const at=ms((e as unknown as {postedAt?:unknown}).postedAt);
      if(at>since&&e.deltaMinor>0)items.push({id:`money-${e.id}`,icon:'💰',text:`${e.label} +${formatMoney(e.deltaMinor,currencySymbol)}`,at,target:'bank',tab:'bank'});
    }
  }
  if(praises.status==='fulfilled'){
    for(const p of praises.value.filter(p=>p.toStudentId===me.id)){
      const at=ms((p as unknown as {createdAt?:unknown}).createdAt);
      if(at>since)items.push({id:`praise-${p.id}`,icon:'🌟',text:`${name(p.fromStudentId)}의 칭찬: "${p.message}"`,at,target:'mypage',tab:'praise'});
    }
  }
  if(helps.status==='fulfilled'){
    for(const h of helps.value){
      const at=ms((h as unknown as {updatedAt?:unknown}).updatedAt);if(at<=since)continue;
      if(h.requesterStudentId===me.id&&h.status==='accepted')items.push({id:`help-acc-${h.id}`,icon:'🤝',text:`${name(h.helperStudentId)}가 내 부탁 "${h.title}"을 맡았어요`,at,target:'mypage',tab:'help'});
      if(h.requesterStudentId===me.id&&h.status==='done')items.push({id:`help-done-${h.id}`,icon:'📮',text:`"${h.title}" 부탁을 해냈대요. 확인해 주세요!`,at,target:'mypage',tab:'help'});
      if(h.helperStudentId===me.id&&h.status==='confirmed')items.push({id:`help-pay-${h.id}`,icon:'🎁',text:`"${h.title}" 보상을 받을 수 있어요!`,at,target:'mypage',tab:'help'});
    }
  }
  return items.sort((a,b)=>b.at-a.at).slice(0,30);
}
