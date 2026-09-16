import {useEffect,useRef,useState,type FormEvent} from 'react';
import {EmailAuthProvider,reauthenticateWithCredential,updatePassword} from 'firebase/auth';
import {auditActionNames,type AuditLog} from '../../domain/audit';
import {formatMoney} from '../../domain/money';
import type {EconomicStats} from '../../domain/finance';
import type {SchoolContext,Student} from '../../domain/model';
import type {AuditStore} from '../../data/auditRepository';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {BusinessStore} from '../../data/businessRepository';
import type {ProposalStore} from '../../data/proposalRepository';
import type {FinanceStore} from '../../data/financeRepository';
import {firebase} from '../../data/firebase';

// Keep in lockstep with the identical constant in src/app/App.tsx (not imported from there to
// avoid a circular App.tsx <-> OperationsWorkspace.tsx dependency).
const ADMIN_WORKER_URL='https://jobedu-admin.jobedu-admin-worker.workers.dev';

function readablePasswordError(error:unknown){
  const code=(error as {code?:string}).code;
  if(code==='auth/wrong-password'||code==='auth/invalid-credential')return '현재 비밀번호가 올바르지 않습니다.';
  if(code==='auth/weak-password')return '새 비밀번호가 너무 간단합니다. 6자 이상으로 입력해 주세요.';
  if(code==='auth/requires-recent-login')return '보안을 위해 로그아웃했다가 다시 로그인한 뒤 시도해 주세요.';
  return error instanceof Error?error.message:'비밀번호를 변경하지 못했습니다.';
}
function PasswordSettings(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const user=firebase?.auth.currentUser;
    if(!user||!user.email)return;
    const form=e.currentTarget,f=new FormData(form);
    const current=String(f.get('current')),next=String(f.get('next')),confirm=String(f.get('confirm'));
    setError('');setMessage('');
    if(next!==confirm){setError('새 비밀번호가 서로 다릅니다.');return}
    if(next.length<6){setError('새 비밀번호는 6자 이상이어야 합니다.');return}
    setBusy(true);
    try{
      await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,current));
      await updatePassword(user,next);
      setMessage('비밀번호를 변경했어요.');form.reset();
    }catch(err){setError(readablePasswordError(err))}
    finally{setBusy(false)}
  }
  return <form className="panel section action-form" onSubmit={submit}>
    <h3>내 계정 비밀번호 변경</h3>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="notice">{message}</p>}
    <label>현재 비밀번호<input type="password" name="current" autoComplete="current-password" required/></label>
    <label>새 비밀번호<input type="password" name="next" autoComplete="new-password" required minLength={6}/></label>
    <label>새 비밀번호 확인<input type="password" name="confirm" autoComplete="new-password" required minLength={6}/></label>
    <button className="button primary" disabled={busy}>{busy?'변경 중…':'비밀번호 변경'}</button>
  </form>;
}

interface TeacherMember {uid:string;email:string;role:string;status:string}
// Owner-only (D-95): the app treats 'teacher'/'owner' as equally privileged everywhere else, but
// creating other staff accounts and resetting their passwords is sensitive enough to keep to the
// one account that bootstrapped the school — enforced server-side by the Worker (isOwner()), not
// just by hiding this panel from non-owners here.
function TeacherAccountAdmin({context}:{context:SchoolContext}){
  const [teachers,setTeachers]=useState<TeacherMember[]|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [resetting,setResetting]=useState<string|null>(null);

  async function call(body:Record<string,unknown>){
    if(!firebase)throw new Error('연결을 확인해 주세요.');
    const idToken=await firebase.auth.currentUser!.getIdToken();
    const res=await fetch(ADMIN_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},body:JSON.stringify({schoolId:context.schoolId,...body})});
    const data=await res.json() as Record<string,unknown>;
    if(!res.ok)throw new Error(typeof data.error==='string'?data.error:'요청을 처리하지 못했습니다.');
    return data;
  }
  async function loadTeachers(){
    const data=await call({action:'listTeachers'});
    setTeachers((data.teachers as TeacherMember[])??[]);
  }
  useEffect(()=>{loadTeachers().catch(e=>setError((e as Error).message))},[context.schoolId]);

  async function createTeacher(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;
    const form=e.currentTarget,f=new FormData(form);
    const email=String(f.get('email')||'').trim(),password=String(f.get('password')||'').trim();
    setBusy(true);setError('');setMessage('');
    try{
      const data=await call({action:'createTeacher',email,password});
      setMessage(`계정을 만들었습니다: ${data.email} / 비밀번호: ${data.password} — 새 교사에게 안전하게 전달해 주세요.`);
      form.reset();
      await loadTeachers();
    }catch(err){setError((err as Error).message)}
    finally{setBusy(false)}
  }
  async function resetPassword(email:string,password:string){
    setBusy(true);setError('');setMessage('');
    try{
      const data=await call({action:'resetTeacherPassword',email,password});
      setMessage(`${data.email}의 새 비밀번호: ${data.password}`);
      setResetting(null);
    }catch(err){setError((err as Error).message)}
    finally{setBusy(false)}
  }

  return <section className="panel section">
    <h3>교사 계정 관리(최고 관리자)</h3>
    <p className="muted">새 교사 계정을 만들거나 기존 교사의 비밀번호를 재설정할 수 있어요. 이 화면은 최고 관리자 계정에만 보입니다.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="notice">{message}</p>}
    <form className="action-form" onSubmit={createTeacher}>
      <label>새 교사 이메일<input type="email" name="email" required/></label>
      <label>비밀번호(선택, 비우면 자동 생성)<input type="text" name="password" minLength={6} placeholder="비워두면 임의 생성"/></label>
      <button className="button primary" disabled={busy}>{busy?'처리 중…':'교사 계정 만들기'}</button>
    </form>
    {teachers===null?<p role="status">불러오는 중…</p>:!teachers.length?<p className="empty">등록된 교사가 없어요.</p>:<div className="list">
      {teachers.map(t=><article key={t.uid} className="task-row">
        <div className="task-row-head"><b>{t.email||'(이메일 정보 없음 — admin-bootstrap으로 만든 이전 계정)'}</b><span className="badge">{t.role==='owner'?'최고 관리자':'교사'}</span></div>
        {resetting===t.uid
          ?<form className="action-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void resetPassword(t.email,String(f.get('password')||''))}}>
              <label>새 비밀번호(선택, 비우면 자동 생성)<input type="text" name="password" minLength={6} placeholder="비워두면 임의 생성"/></label>
              <div className="header-actions"><button className="button primary" disabled={busy}>재설정</button><button type="button" className="button quiet" onClick={()=>setResetting(null)}>취소</button></div>
            </form>
          :<button className="button quiet" disabled={busy||!t.email} onClick={()=>setResetting(t.uid)}>비밀번호 재설정</button>}
      </article>)}
    </div>}
  </section>;
}

export function OperationsWorkspace({auditStore,careerStore,taskStore,businessStore,proposalStore,financeStore,students,currencySymbol='마동',context}:{
  auditStore:AuditStore;careerStore:CareerStore;taskStore:TaskStore;businessStore:BusinessStore;proposalStore:ProposalStore;financeStore:FinanceStore;students:Student[];currencySymbol?:string;context?:SchoolContext;
}){
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [counts,setCounts]=useState<Record<string,number>|null>(null);
  const [stats,setStats]=useState<EconomicStats|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const mounted=useRef(true);

  useEffect(()=>{
    mounted.current=true;setLoading(true);
    Promise.all([auditStore.loadRecent(),careerStore.load(),taskStore.load(),businessStore.loadCatalog(),proposalStore.loadProposals(),financeStore.economicStats()])
      .then(([auditLogs,career,tasks,catalog,proposals,economicStats])=>{
        if(!mounted.current)return;
        setLogs(auditLogs);
        setStats(economicStats);
        setCounts({
          학생: students.length,
          '활동 중 학생': students.filter(s=>s.status==='active').length,
          직업: career.jobs.length,
          '모집 중 직업': career.jobs.filter(j=>j.status==='recruiting').length,
          업무: tasks.tasks.length,
          '검토 대기 업무': tasks.tasks.filter(t=>t.status==='submitted').length,
          사업: catalog.businesses.length,
          상품: catalog.products.length,
          제안: proposals.length,
          '투표 중 제안': proposals.filter(p=>p.status==='voting').length,
        });
      })
      .catch(e=>setError((e as Error).message))
      .finally(()=>{if(mounted.current)setLoading(false)});
    return()=>{mounted.current=false};
  },[auditStore,careerStore,taskStore,businessStore,proposalStore,financeStore,students]);

  if(loading)return <p role="status">운영 현황을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>운영 현황</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {counts&&<div className="kpis">{Object.entries(counts).map(([label,value])=><div key={label} className="kpi">{label}<b>{value}</b></div>)}</div>}
    <h3 className="section">경제 통계</h3>
    {stats&&<div className="kpis">
      <div className="kpi">유통 중인 {currencySymbol}<b>{formatMoney(stats.circulatingMinor,currencySymbol)}</b></div>
      <div className="kpi">학생 평균 잔액<b>{formatMoney(stats.avgStudentBalanceMinor,currencySymbol)}</b></div>
      <div className="kpi">사업 계좌 합계<b>{formatMoney(stats.businessTotalMinor,currencySymbol)}</b></div>
      <div className="kpi">공동기금 잔액<b>{formatMoney(stats.communityFundBalanceMinor,currencySymbol)}</b></div>
    </div>}
    <p className="muted">유통 중인 {currencySymbol}은 학생·사업 계좌 잔액의 합입니다(발행·공동기금 계좌는 시민 개인의 부가 아니라 제외). 최대 100개 계좌까지 집계합니다.</p>
    <h3 className="section">최근 주요 활동</h3>
    {!logs.length?<p className="empty">아직 기록된 활동이 없어요.</p>:<div className="list">{logs.map(l=><article key={l.id} className="task-row"><div className="task-row-head"><b>{auditActionNames[l.action]??l.action}</b><span className="badge">{l.targetType}</span></div><p className="muted">{l.detail}</p></article>)}</div>}
    <PasswordSettings/>
    {context?.membership.role==='owner'&&<TeacherAccountAdmin context={context}/>}
  </section>;
}
