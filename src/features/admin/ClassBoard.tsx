import {useEffect,useState} from 'react';
import {boardSummary,buildClassBoard,type BoardRow} from '../../domain/classBoard';
import {formatMoney} from '../../domain/money';
import {studentLabel,type Student} from '../../domain/model';
import {hollandInfo,type HollandType} from '../../domain/careerDiscovery';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {FinanceStore} from '../../data/financeRepository';
import type {CommunityStore} from '../../data/communityRepository';
import type {CareerProfileStore} from '../../data/careerProfileRepository';
import type {StudentReport} from '../../data/reportRepository';
import {GrowthReport} from './GrowthReport';

// 교사용 학급 현황판(D-119). 각 기록은 따로 불러와, 하나가 실패해도 나머지는 보여 준다.
export function ClassBoard({students,careerStore,taskStore,financeStore,communityStore,careerProfileStore,currencySymbol,schoolName='',loadReport}:{students:Student[];careerStore:CareerStore;taskStore:TaskStore;financeStore:FinanceStore;communityStore:CommunityStore;careerProfileStore:CareerProfileStore;currencySymbol:string;schoolName?:string;loadReport?:(studentId:string)=>Promise<StudentReport>}){
  const [reportFor,setReportFor]=useState<Student|null>(null);
  const [rows,setRows]=useState<BoardRow[]|null>(null),[grade,setGrade]=useState(0),[onlyFlagged,setOnlyFlagged]=useState(false),[refresh,setRefresh]=useState(0),[partial,setPartial]=useState(false);
  useEffect(()=>{
    let alive=true;setRows(null);
    Promise.allSettled([careerStore.load(),taskStore.load(),financeStore.studentBalances(),communityStore.listPraises(),communityStore.listHelp(),careerProfileStore.classProfiles()]).then(([c,t,b,p,h,pr])=>{
      if(!alive)return;
      setPartial([c,t,b,p,h,pr].some(r=>r.status==='rejected'));
      setRows(buildClassBoard({
        students,
        jobs:c.status==='fulfilled'?c.value.jobs:[],
        assignments:c.status==='fulfilled'?c.value.assignments:[],
        tasks:t.status==='fulfilled'?t.value.tasks:[],
        balances:b.status==='fulfilled'?b.value:{},
        praises:p.status==='fulfilled'?p.value:[],
        helps:h.status==='fulfilled'?h.value:[],
        profiles:pr.status==='fulfilled'?pr.value:[],
      }));
    });
    return ()=>{alive=false};
  },[students,careerStore,taskStore,financeStore,communityStore,careerProfileStore,refresh]);
  const shown=(rows??[]).filter(r=>(!grade||r.student.grade===grade)&&(!onlyFlagged||r.flags.length>0));
  const summary=boardSummary(shown);
  return <section className="panel class-board">
    <div className="section-heading"><div><h2>📊 학급 현황판</h2><p className="muted">학생마다 직업·업무·잔액·칭찬·도움·나를 찾기 현황을 한눈에 봅니다. 오른쪽 "챙겨 볼 점"부터 확인해 주세요.</p></div>
      <button type="button" className="button quiet" onClick={()=>setRefresh(n=>n+1)}>새로고침</button></div>
    <div className="header-actions board-filters">
      <label>학년<select value={grade} onChange={e=>setGrade(Number(e.target.value))}><option value={0}>전체</option>{[1,2,3,4,5,6].map(g=><option key={g} value={g}>{g}학년</option>)}</select></label>
      <label className="checkbox"><input type="checkbox" checked={onlyFlagged} onChange={e=>setOnlyFlagged(e.target.checked)}/>챙겨 볼 학생만</label>
    </div>
    {reportFor&&loadReport&&<GrowthReport student={reportFor} students={students} schoolName={schoolName} currencySymbol={currencySymbol} load={loadReport} onClose={()=>setReportFor(null)}/>}
    {partial&&<p className="notice">일부 기록을 불러오지 못해 빈칸으로 보이는 항목이 있어요. 새로고침해 주세요.</p>}
    {!rows?<p role="status">현황을 모으고 있어요…</p>:<>
      <div className="board-summary">
        <div><b>{summary.students}명</b><small>학생</small></div>
        <div><b>{summary.withJob}명</b><small>직업 있음</small></div>
        <div><b>{summary.waiting}건</b><small>검토 대기 업무</small></div>
        <div><b>{formatMoney(summary.averageBalanceMinor,currencySymbol)}</b><small>평균 잔액</small></div>
        <div><b>{summary.discovered}명</b><small>나를 찾기 완료</small></div>
      </div>
      {!shown.length?<p className="empty">조건에 맞는 학생이 없어요.</p>:<div className="table-scroll"><table><thead><tr><th>학생</th><th>직업</th><th>업무(진행·검토·다시)</th><th>제출</th><th>잔액</th><th>칭찬</th><th>도움</th><th>흥미 유형</th><th>챙겨 볼 점</th>{loadReport&&<th>보고서</th>}</tr></thead><tbody>
        {shown.map(r=><tr key={r.student.id}>
          <td>{studentLabel(r.student)}</td>
          <td>{r.jobs.join(', ')||'-'}</td>
          <td>{r.tasksOpen} · {r.tasksWaiting} · {r.tasksRevision}</td>
          <td>{r.submissions}</td>
          <td>{r.balanceMinor==null?'-':formatMoney(r.balanceMinor,currencySymbol)}</td>
          <td>{r.praisesReceived}</td>
          <td>{r.helpsGiven}</td>
          <td>{r.discoveryCode?r.discoveryCode.split('').map(t=>hollandInfo[t as HollandType]?.icon).join(''):'-'}</td>
          <td>{r.flags.length?r.flags.map(f=><span key={f} className="board-flag">{f}</span>):<span className="board-ok">좋아요</span>}</td>
          {loadReport&&<td><button type="button" className="button quiet small" onClick={()=>{setReportFor(students.find(s=>s.id===r.student.id)??null);window.scrollTo({top:0})}}>📄 보고서</button></td>}
        </tr>)}
      </tbody></table></div>}
      <p className="muted">업무·칭찬·도움은 최근 100건 기준입니다.</p>
    </>}
  </section>;
}
