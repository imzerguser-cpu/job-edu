import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatMoney} from '../../domain/money';
import {violationStatusNames,type ViolationReport} from '../../domain/violations';
import type {Student} from '../../domain/model';
import type {ViolationStore} from '../../data/violationRepository';

export function ViolationWorkspace({store,teacher,students,studentId,currencySymbol='마동'}:{store:ViolationStore;teacher:boolean;students:Student[];studentId?:string;currencySymbol?:string}){
  return teacher
    ?<TeacherViolations store={store} students={students} currencySymbol={currencySymbol}/>
    :<StudentViolations store={store} students={students} studentId={studentId}/>;
}

function studentName(students:Student[],id:string){return students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민'}

function StudentViolations({store,students,studentId}:{store:ViolationStore;students:Student[];studentId?:string}){
  const [reports,setReports]=useState<ViolationReport[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [targetId,setTargetId]=useState(''),[description,setDescription]=useState('');
  const mounted=useRef(true);
  async function load(){const list=await store.myReports();if(mounted.current)setReports(list)}
  useEffect(()=>{mounted.current=true;setLoading(true);load().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[store]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!targetId||busy)return;
    setBusy(true);setError('');setMessage('');
    try{await store.submitReport(targetId,description);setMessage('신고를 접수했어요.');setDescription('');setTargetId('');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  if(loading)return <p role="status">신고 내역을 불러오고 있어요.</p>;
  return <section className="citizen-tasks">
    <div className="section-heading"><h2>규칙 위반 신고</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    <form className="assignment-form" onSubmit={submit}>
      <label>대상 시민<select value={targetId} onChange={e=>setTargetId(e.target.value)} required><option value="">선택</option>{students.filter(s=>s.status==='active'&&s.id!==studentId).map(s=><option key={s.id} value={s.id}>{s.name} · {s.grade}학년</option>)}</select></label>
      <label>무슨 일이 있었나요<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} required/></label>
      <button className="button primary" disabled={busy||!targetId}>신고하기</button>
    </form>
    <p className="muted">신고만으로는 아무 일도 일어나지 않아요 — 선생님이 확인한 뒤에만 과태료가 부과됩니다.</p>
    <h3>내가 신고한 내역</h3>
    {!reports.length?<p className="empty">아직 신고한 내역이 없어요.</p>:<div className="list">{reports.map(r=><article key={r.id} className="task-row"><div className="task-row-head"><b>{studentName(students,r.targetStudentId)}</b><span className="badge">{violationStatusNames[r.status]}</span></div>{r.decisionNote&&<p className="muted">선생님 의견: {r.decisionNote}</p>}</article>)}</div>}
  </section>;
}

function TeacherViolations({store,students,currencySymbol}:{store:ViolationStore;students:Student[];currencySymbol:string}){
  const [reports,setReports]=useState<ViolationReport[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [fineAmount,setFineAmount]=useState<Record<string,number>>({});
  const [note,setNote]=useState<Record<string,string>>({});
  const mounted=useRef(true);
  async function load(){await store.ensureCommunityFund();const list=await store.allReports();if(mounted.current)setReports(list)}
  useEffect(()=>{mounted.current=true;setLoading(true);load().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[store]);
  const pending=reports.filter(r=>r.status==='submitted');
  const decided=reports.filter(r=>r.status!=='submitted');
  async function fine(reportId:string){
    const amount=fineAmount[reportId];
    if(!amount||amount<=0)return;
    setBusy(true);setError('');setMessage('');
    try{await store.decide(reportId,Math.round(amount*100),note[reportId]??'');setMessage('과태료를 부과했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function dismiss(reportId:string){
    if(!(note[reportId]??'').trim())return;
    setBusy(true);setError('');setMessage('');
    try{await store.decide(reportId,null,note[reportId]);setMessage('신고를 기각했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  if(loading)return <p role="status">신고 내역을 불러오고 있어요.</p>;
  return <section className="citizen-tasks">
    <div className="section-heading"><h2>규칙 위반 신고 처리</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    <h3>검토 대기 ({pending.length})</h3>
    {!pending.length?<p className="empty">처리할 신고가 없어요.</p>:<div className="list">{pending.map(r=><article key={r.id} className="task-row">
      <div className="task-row-head"><b>{studentName(students,r.targetStudentId)}</b></div>
      <p className="muted">{r.description}</p>
      <label>의견/사유<textarea maxLength={500} value={note[r.id]??''} onChange={e=>setNote({...note,[r.id]:e.target.value})}/></label>
      <div className="assignment-form">
        <label>과태료 금액({currencySymbol})<input type="number" min={1} max={1000} step={1} value={fineAmount[r.id]??''} onChange={e=>setFineAmount({...fineAmount,[r.id]:Number(e.target.value)})}/></label>
        <div className="header-actions">
          <button className="button primary" disabled={busy||!fineAmount[r.id]} onClick={()=>fine(r.id)}>과태료 부과</button>
          <button className="button quiet" disabled={busy||!(note[r.id]??'').trim()} onClick={()=>dismiss(r.id)}>기각</button>
        </div>
      </div>
    </article>)}</div>}
    {!!decided.length&&<><h3>처리 완료 ({decided.length})</h3><div className="list">{decided.map(r=><article key={r.id} className="task-row"><div className="task-row-head"><b>{studentName(students,r.targetStudentId)}</b><span className="badge">{violationStatusNames[r.status]}{r.fineAmountMinor?` · ${formatMoney(r.fineAmountMinor,currencySymbol)}`:''}</span></div><p className="muted">{r.description}</p>{r.decisionNote&&<p className="muted">결정: {r.decisionNote}</p>}</article>)}</div></>}
  </section>;
}
