import {compareByGradeNumber,type Student} from './model';

// 교사용 학급 현황판(D-119): 학생 한 명당 한 줄로 "지금 이 학생이 마을에서 어디쯤 있는지"를 모은다.
// 모든 값은 이미 있는 기록(배정·업무·계좌·칭찬·도움·나를 찾기)에서 계산하며 새로 저장하는 것은 없다.
export interface BoardRow {
  student:Pick<Student,'id'|'name'|'grade'|'number'>;
  jobs:string[];
  tasksOpen:number;tasksWaiting:number;tasksRevision:number;submissions:number;
  balanceMinor:number|null;
  praisesReceived:number;helpsGiven:number;
  discoveryCode:string|null;
  flags:string[];
}
export function buildClassBoard(input:{
  students:Pick<Student,'id'|'name'|'grade'|'number'|'status'>[];
  jobs:{id:string;name:string}[];
  assignments:{jobId:string;studentId:string;status:string}[];
  tasks:{assigneeStudentId:string;status:string;attempt:number}[];
  balances:Record<string,number>;
  praises:{toStudentId:string}[];
  helps:{helperStudentId:string|null;status:string}[];
  profiles:{studentId:string;code:string}[];
}):BoardRow[]{
  const jobName=(id:string)=>input.jobs.find(j=>j.id===id)?.name??'(종료된 직업)';
  return input.students.filter(s=>s.status==='active').sort(compareByGradeNumber).map(s=>{
    const mine=input.tasks.filter(t=>t.assigneeStudentId===s.id);
    const row:BoardRow={
      student:{id:s.id,name:s.name,grade:s.grade,number:s.number},
      jobs:input.assignments.filter(a=>a.studentId===s.id&&a.status==='active').map(a=>jobName(a.jobId)),
      tasksOpen:mine.filter(t=>t.status==='assigned').length,
      tasksWaiting:mine.filter(t=>t.status==='submitted').length,
      tasksRevision:mine.filter(t=>t.status==='revision_requested').length,
      submissions:mine.reduce((n,t)=>n+(Number(t.attempt)||0),0),
      balanceMinor:Object.hasOwn(input.balances,s.id)?input.balances[s.id]:null,
      praisesReceived:input.praises.filter(p=>p.toStudentId===s.id).length,
      helpsGiven:input.helps.filter(h=>h.helperStudentId===s.id&&h.status==='paid').length,
      discoveryCode:input.profiles.find(p=>p.studentId===s.id)?.code??null,
      flags:[],
    };
    // 선생님이 먼저 챙겨 보면 좋은 것 — 급한 순서대로.
    if(row.tasksWaiting)row.flags.push(`검토 대기 ${row.tasksWaiting}`);
    if(!row.jobs.length)row.flags.push('직업 없음');
    if(row.tasksRevision)row.flags.push(`다시 제출 ${row.tasksRevision}`);
    if(!row.balanceMinor)row.flags.push('잔액 없음');
    if(!row.discoveryCode)row.flags.push('나를 찾기 전');
    return row;
  });
}
export function boardSummary(rows:BoardRow[]){
  const withBalance=rows.filter(r=>r.balanceMinor!=null);
  return {
    students:rows.length,
    withJob:rows.filter(r=>r.jobs.length>0).length,
    waiting:rows.reduce((n,r)=>n+r.tasksWaiting,0),
    averageBalanceMinor:withBalance.length?Math.round(withBalance.reduce((n,r)=>n+(r.balanceMinor??0),0)/withBalance.length):0,
    discovered:rows.filter(r=>r.discoveryCode).length,
  };
}
