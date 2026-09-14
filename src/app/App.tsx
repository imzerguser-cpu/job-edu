import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {firebase} from '../data/firebase';
import {getCitizen,listSchools,listStudents,openSchool,updateStudent} from '../data/schoolRepository';
import {isTeacher,type School,type SchoolContext,type Student} from '../domain/model';
import {studentLoginEmail} from '../domain/studentAuth';
import {Demo} from '../features/jobs/Demo';
import {CareerWorkspace} from '../features/jobs/CareerWorkspace';
import {firestoreCareers} from '../data/careerRepository';
import {firestoreTasks} from '../data/taskRepository';
import {firestoreFinance} from '../data/financeRepository';
import {firestoreSavings} from '../data/savingsRepository';
import {firestoreLoans} from '../data/loanRepository';
import {firestoreFinancialProducts} from '../data/financialProductRepository';
import {firestoreBusiness} from '../data/businessRepository';
import {firestoreProposals} from '../data/proposalRepository';
import {firestoreAudit} from '../data/auditRepository';
import {firestoreViolations} from '../data/violationRepository';
import {RosterImport} from '../features/roster/RosterImport';
import {StudentHome} from '../features/map/StudentHome';
import {TaskWorkspace} from '../features/tasks/TaskWorkspace';
import {BankWorkspace} from '../features/finance/BankWorkspace';
import {StoreWorkspace} from '../features/business/StoreWorkspace';
import {CivicWorkspace} from '../features/civic/CivicWorkspace';
import {ViolationWorkspace} from '../features/civic/ViolationWorkspace';
import {OperationsWorkspace} from '../features/admin/OperationsWorkspace';

const ADMIN_WORKER_URL='https://jobedu-admin.jobedu-admin-worker.workers.dev';
function readableError(error:unknown){
  const code=(error as {code?:string}).code;
  if(code==='auth/configuration-not-found'||code==='auth/operation-not-allowed')return '학교 로그인 설정을 준비하고 있습니다. 관리자에게 문의하거나 가상 시민 체험을 이용해 주세요.';
  if(code==='auth/invalid-credential'||code==='auth/user-not-found'||code==='auth/wrong-password')return '계정과 비밀번호를 확인해 주세요.';
  if(code==='permission-denied')return '접근 권한을 확인할 수 없습니다. 학교 관리자에게 문의해 주세요.';
  if(code==='unavailable'||code==='auth/network-request-failed')return '연결을 확인한 뒤 다시 시도해 주세요.';
  if(code==='auth/too-many-requests')return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.';
  return error instanceof Error?error.message:'처리하지 못했습니다. 다시 시도해 주세요.';
}
export function App(){
  const [demo,setDemo]=useState(false);
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!!firebase),[error,setError]=useState('');
  const [links,setLinks]=useState<{schoolId:string;schoolName:string}[]>([]),[active,setActive]=useState<{context:SchoolContext;school:School}|null>(null);
  const generation=useRef(0);
  useEffect(()=>{
    if(!firebase)return;const client=firebase;
    return onAuthStateChanged(client.auth,async next=>{
      const token=++generation.current;setUser(next);setActive(null);setLinks([]);setError('');setLoading(!!next);
      if(next){try{const schools=await listSchools(client.db,next.uid);if(token===generation.current)setLinks(schools)}catch(e){if(token===generation.current)setError(readableError(e))}}
      if(token===generation.current)setLoading(false);
    });
  },[]);
  async function selectSchool(sid:string){
    if(!firebase||!user)return;const token=++generation.current;setLoading(true);setError('');setActive(null);
    try{const a=await openSchool(firebase.db,user.uid,sid);if(token===generation.current)setActive(a)}catch(e){if(token===generation.current)setError(readableError(e))}
    if(token===generation.current)setLoading(false);
  }
  async function logout(){if(!firebase)return;generation.current++;setActive(null);setLinks([]);setUser(null);try{await signOut(firebase.auth)}catch(e){setError(readableError(e))}}
  if(demo)return <Demo onExit={()=>setDemo(false)}/>;
  if(!firebase)return <Setup onDemo={()=>setDemo(true)}/>;
  return <div className="shell"><header className="header"><a className="brand" href="/" aria-label="작은 사회 처음으로"><span className="brand-mark">M</span><span>{active?.school.communityName??'작은 사회'}</span></a><div className="header-actions">{active&&<button className="button quiet" onClick={()=>{generation.current++;setActive(null)}}>학교 변경</button>}{user&&<button className="button quiet" onClick={logout}>로그아웃</button>}</div></header>
    <main>{error&&<p role="alert" className="error">{error}</p>}{loading?<section className="panel"><p role="status">학교 정보를 확인하고 있어요.</p></section>:!user?<><Login onError={setError}/><div className="demo-entry"><button className="button secondary" onClick={()=>setDemo(true)}>가상 시민으로 직업 체험하기</button><p className="muted">실제 학생 정보 없이 신청과 배정을 확인해요.</p></div></>:!active?<section className="panel narrow"><span className="eyebrow">학교 선택</span><h1>나의 작은 사회로</h1><p>등록된 학교를 선택해 주세요.</p>{links.length?links.map(l=><button className="school-choice" key={l.schoolId} onClick={()=>selectSchool(l.schoolId)}>{l.schoolName}<span aria-hidden="true">→</span></button>):<div className="notice">연결된 학교가 없습니다. 학교 관리자에게 계정 등록을 요청해 주세요.</div>}</section>:<SchoolWorkspace key={`${user.uid}/${active.context.schoolId}`} {...active}/>}</main></div>;
}
function Login({onError}:{onError:(s:string)=>void}){
  const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<'student'|'teacher'>('student');
  const defaultSchoolCode=useMemo(()=>new URLSearchParams(window.location.search).get('school')??'',[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!firebase)return;setBusy(true);onError('');const f=new FormData(e.currentTarget);
    try{
      await firebase.ready;
      const email=mode==='teacher'
        ?String(f.get('email'))
        :studentLoginEmail(String(f.get('schoolCode')),String(f.get('grade')),String(f.get('name')));
      await signInWithEmailAndPassword(firebase.auth,email,String(f.get('password')));
    }catch(err){onError(readableError(err))}
    finally{setBusy(false)}
  }
  return <section className="login-grid"><div className="welcome"><span className="eyebrow">학교 시민생활</span><h1>우리 손으로 만드는<br/>작은 사회</h1><p>나의 역할을 찾고, 함께 일하고,<br/>우리에게 필요한 변화를 만들어요.</p><div className="journey"><span>시민</span><span>직업</span><span>함께하는 생활</span></div></div>
    <form className="panel" onSubmit={submit}>
      <div className="tabs" role="tablist" aria-label="로그인 방식">
        <button type="button" className={mode==='student'?'tab active':'tab'} aria-pressed={mode==='student'} onClick={()=>setMode('student')}>학생</button>
        <button type="button" className={mode==='teacher'?'tab active':'tab'} aria-pressed={mode==='teacher'} onClick={()=>setMode('teacher')}>선생님</button>
      </div>
      {mode==='student'
        ?<><h2>학생 로그인</h2><p>선생님께 안내받은 학교 코드와 비밀번호로 로그인해요. 이메일은 필요 없어요.</p>
          <label>학교 코드<input name="schoolCode" defaultValue={defaultSchoolCode} autoComplete="off" required maxLength={40} placeholder="예: 마동초 또는 마동초등학교"/></label>
          <label>학년<select name="grade" defaultValue="" required><option value="" disabled>학년 선택</option>{[1,2,3,4,5,6].map(g=><option key={g} value={g}>{g}학년</option>)}</select></label>
          <label>이름<input name="name" autoComplete="username" required maxLength={40}/></label></>
        :<><h2>선생님 로그인</h2><p>학교에서 안내받은 계정을 사용해 주세요.</p>
          <label>계정 이메일<input type="email" name="email" autoComplete="username" required/></label></>}
      <label>비밀번호<input type="password" name="password" autoComplete="current-password" required/></label>
      <button className="button primary full" disabled={busy}>{busy?'확인 중…':'로그인'}</button>
      <p className="muted">공용 태블릿에서는 이용 후 로그아웃해 주세요.</p>
    </form>
  </section>;
}
function Setup({onDemo}:{onDemo:()=>void}){return <div className="shell"><header className="header"><div className="brand"><span className="brand-mark">M</span>작은 사회</div></header><main><section className="panel"><h1>우리 학교 연결을 준비하고 있어요</h1><p>가상 시민으로 직업 신청과 배정을 먼저 체험할 수 있습니다.</p><button className="button primary section" onClick={onDemo}>가상 시민으로 직업 체험하기</button></section></main></div>}
function SchoolWorkspace({context,school}:{context:SchoolContext;school:School}){
  const store=useMemo(()=>firestoreCareers(firebase!.db,context),[context]);
  const taskStore=useMemo(()=>firestoreTasks(firebase!.db,context),[context]);
  const financeStore=useMemo(()=>firestoreFinance(firebase!.db,context),[context]);
  const savingsStore=useMemo(()=>firestoreSavings(firebase!.db,context),[context]);
  const loanStore=useMemo(()=>firestoreLoans(firebase!.db,context),[context]);
  const productStore=useMemo(()=>firestoreFinancialProducts(firebase!.db,context),[context]);
  const businessStore=useMemo(()=>firestoreBusiness(firebase!.db,context),[context]);
  const proposalStore=useMemo(()=>firestoreProposals(firebase!.db,context),[context]);
  const violationStore=useMemo(()=>firestoreViolations(firebase!.db,context),[context]);
  const auditStore=useMemo(()=>firestoreAudit(firebase!.db,context),[context]);
  const teacher=isTeacher(context.membership),[students,setStudents]=useState<Student[]>([]),[citizen,setCitizen]=useState<Student|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[importing,setImporting]=useState(false);
  const [editingStudent,setEditingStudent]=useState<Student|null>(null),[savingStudent,setSavingStudent]=useState(false);
  const [resettingStudent,setResettingStudent]=useState<Student|null>(null),[resetBusy,setResetBusy]=useState(false),[resetResult,setResetResult]=useState<{password:string}|null>(null);
  async function saveStudent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editingStudent||savingStudent)return;
    const f=new FormData(e.currentTarget);setSavingStudent(true);setError('');
    try{
      await updateStudent(firebase!.db,context,{...editingStudent,grade:Number(f.get('grade')),className:String(f.get('className')||'').trim()||null,status:f.get('status') as Student['status']});
      setEditingStudent(null);setRefresh(n=>n+1);
    }catch(e){setError(readableError(e))}
    finally{setSavingStudent(false)}
  }
  async function resetPassword(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!resettingStudent||resetBusy)return;
    const f=new FormData(e.currentTarget);const password=String(f.get('password')||'').trim();
    setResetBusy(true);setError('');setResetResult(null);
    try{
      const idToken=await firebase!.auth.currentUser!.getIdToken();
      const res=await fetch(ADMIN_WORKER_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},
        body:JSON.stringify({schoolId:context.schoolId,schoolCode:school.schoolName,grade:String(resettingStudent.grade),name:resettingStudent.name,password:password||undefined}),
      });
      const data=await res.json() as {password?:string;error?:string};
      if(!res.ok||!data.password)throw new Error(data.error??'비밀번호를 재설정하지 못했습니다.');
      setResetResult({password:data.password});
    }catch(e){setError(readableError(e))}
    finally{setResetBusy(false)}
  }
  useEffect(()=>{let alive=true;setLoading(true);setStudents([]);setCitizen(null);setError('');const client=firebase!;
    (teacher?listStudents(client.db,context).then(s=>{if(alive)setStudents(s)}):getCitizen(client.db,context).then(s=>{if(alive)setCitizen(s)})).catch(e=>{if(alive)setError(readableError(e))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};
  },[context,teacher,refresh]);
  if(!teacher)return <>{error?<p role="alert" className="error">{error}</p>:loading?<p role="status">시민 정보를 확인하고 있어요.</p>:citizen?<StudentHome citizen={citizen} school={school} context={context} store={store} taskStore={taskStore} financeStore={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} businessStore={businessStore} proposalStore={proposalStore} violationStore={violationStore}/>:null}</>;
  return <><div className="page-heading"><div><span className="eyebrow">{school.schoolName}</span><h1>시민 관리</h1><p>우리 학교 시민의 등록 상태를 확인합니다.</p></div><span className="tag">교사 운영실</span></div>{error?<p role="alert" className="error">{error}</p>:loading?<p role="status">시민 정보를 확인하고 있어요.</p>:<><section className="panel"><div className="section-heading"><h2>학생 명단 <span className="count">{students.length}</span></h2><div className="header-actions"><button className="button quiet" onClick={()=>setRefresh(n=>n+1)}>새로고침</button><button className="button primary" onClick={()=>setImporting(!importing)}>명단 가져오기</button></div></div>{students.length===100&&<p className="notice">현재 이름순 첫 100명입니다. 대규모 명단은 다음 관리 단계에서 페이지 조회를 확장합니다.</p>}{students.length?<div className="table-scroll"><table><thead><tr><th>이름</th><th>학년</th><th>반</th><th>학년도</th><th>상태</th><th></th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.grade}학년</td><td>{s.className??'미지정'}</td><td>{s.schoolYear}</td><td>{s.status==='active'?'활동 중':s.status==='graduated'?'졸업':'전출'}</td><td><button className="button quiet" onClick={()=>setEditingStudent(s)}>수정</button> <button className="button quiet" onClick={()=>{setResettingStudent(s);setResetResult(null)}}>비밀번호 재설정</button></td></tr>)}</tbody></table></div>:<div className="empty">등록된 학생이 없습니다. 명단을 확인한 뒤 가져와 주세요.</div>}</section>
    {editingStudent&&<form className="panel section action-form" onSubmit={saveStudent}>
      <h3>{editingStudent.name} 정보 수정</h3>
      <div className="fields"><label>학년<select name="grade" defaultValue={editingStudent.grade}>{[1,2,3,4,5,6].map(g=><option key={g} value={g}>{g}학년</option>)}</select></label><label>반<input name="className" defaultValue={editingStudent.className??''} maxLength={20}/></label></div>
      <label>학적 상태<select name="status" defaultValue={editingStudent.status}><option value="active">활동 중</option><option value="graduated">졸업</option><option value="transferred">전출</option></select></label>
      <p className="muted">졸업·전출으로 바꿔도 기록은 보존됩니다. 로그인 계정 활성화는 이 화면에서 다루지 않습니다.</p>
      <div className="header-actions"><button className="button primary" disabled={savingStudent}>저장</button><button type="button" className="button quiet" onClick={()=>setEditingStudent(null)}>취소</button></div>
    </form>}
    {resettingStudent&&<form className="panel section action-form" onSubmit={resetPassword}>
      <h3>{resettingStudent.name}({resettingStudent.grade}학년) 비밀번호 재설정</h3>
      <label>새 비밀번호(선택, 비우면 자동 생성)<input name="password" minLength={6} maxLength={40} placeholder="비워두면 임의 생성"/></label>
      <div className="header-actions"><button className="button primary" disabled={resetBusy}>{resetBusy?'처리 중…':'재설정'}</button><button type="button" className="button quiet" onClick={()=>{setResettingStudent(null);setResetResult(null)}}>닫기</button></div>
      {resetResult&&<p role="status" className="notice">새 비밀번호: <b>{resetResult.password}</b> — 학생에게 알려주세요.</p>}
    </form>}
    {importing&&<section className="panel section"><RosterImport context={context} existing={students} onDone={()=>{setRefresh(n=>n+1);setImporting(false)}}/></section>}<div className="section"><CareerWorkspace store={store} schoolId={context.schoolId} teacher={true} students={students} studentId={context.membership.studentId??undefined}/></div><div className="section"><TaskWorkspace taskStore={taskStore} careerStore={store} teacher={true} students={students}/></div><div className="section"><BankWorkspace store={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} teacher={true} students={students} currencySymbol={school.currencyName} context={context} incomeTaxRateBp={school.incomeTaxRateBp}/></div><div className="section"><StoreWorkspace store={businessStore} teacher={true} students={students} currencySymbol={school.currencyName} context={context} businessTaxRateBp={school.businessTaxRateBp}/></div><div className="section"><CivicWorkspace store={proposalStore} teacher={true} students={students}/></div><div className="section"><ViolationWorkspace store={violationStore} teacher={true} students={students} currencySymbol={school.currencyName}/></div><div className="section"><OperationsWorkspace auditStore={auditStore} careerStore={store} taskStore={taskStore} businessStore={businessStore} proposalStore={proposalStore} financeStore={financeStore} students={students} currencySymbol={school.currencyName}/></div></>}</>;
}
