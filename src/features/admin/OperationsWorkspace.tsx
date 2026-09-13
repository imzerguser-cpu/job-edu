import {useEffect,useRef,useState,type FormEvent} from 'react';
import {EmailAuthProvider,reauthenticateWithCredential,updatePassword} from 'firebase/auth';
import {auditActionNames,type AuditLog} from '../../domain/audit';
import type {Student} from '../../domain/model';
import type {AuditStore} from '../../data/auditRepository';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {BusinessStore} from '../../data/businessRepository';
import type {ProposalStore} from '../../data/proposalRepository';
import {firebase} from '../../data/firebase';

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

export function OperationsWorkspace({auditStore,careerStore,taskStore,businessStore,proposalStore,students}:{
  auditStore:AuditStore;careerStore:CareerStore;taskStore:TaskStore;businessStore:BusinessStore;proposalStore:ProposalStore;students:Student[];
}){
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [counts,setCounts]=useState<Record<string,number>|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const mounted=useRef(true);

  useEffect(()=>{
    mounted.current=true;setLoading(true);
    Promise.all([auditStore.loadRecent(),careerStore.load(),taskStore.load(),businessStore.loadCatalog(),proposalStore.loadProposals()])
      .then(([auditLogs,career,tasks,catalog,proposals])=>{
        if(!mounted.current)return;
        setLogs(auditLogs);
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
  },[auditStore,careerStore,taskStore,businessStore,proposalStore,students]);

  if(loading)return <p role="status">운영 현황을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>운영 현황</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {counts&&<div className="kpis">{Object.entries(counts).map(([label,value])=><div key={label} className="kpi">{label}<b>{value}</b></div>)}</div>}
    <h3 className="section">최근 주요 활동</h3>
    {!logs.length?<p className="empty">아직 기록된 활동이 없어요.</p>:<div className="list">{logs.map(l=><article key={l.id} className="task-row"><div className="task-row-head"><b>{auditActionNames[l.action]??l.action}</b><span className="badge">{l.targetType}</span></div><p className="muted">{l.detail}</p></article>)}</div>}
    <PasswordSettings/>
  </section>;
}
