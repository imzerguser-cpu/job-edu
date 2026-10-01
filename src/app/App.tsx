import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {firebase} from '../data/firebase';
import {getCitizen,listSchools,listStudentsPage,openSchool,updateStudent,type StudentPage} from '../data/schoolRepository';
import {isTeacher,type School,type SchoolContext,type Student} from '../domain/model';
import {studentAuthPassword,studentLoginEmail} from '../domain/studentAuth';
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
import {firestoreCommunity} from '../data/communityRepository';
import {firestoreCareerProfiles} from '../data/careerProfileRepository';
import {TeacherCommunity} from '../features/community/CommunityWorkspace';
import {CareerDiscoveryTeacher} from '../features/discovery/CareerDiscovery';
import {RosterImport} from '../features/roster/RosterImport';
import {StudentHome} from '../features/map/StudentHome';
import {TaskWorkspace} from '../features/tasks/TaskWorkspace';
import {BankWorkspace} from '../features/finance/BankWorkspace';
import {StoreWorkspace} from '../features/business/StoreWorkspace';
import {CivicWorkspace} from '../features/civic/CivicWorkspace';
import {ViolationWorkspace} from '../features/civic/ViolationWorkspace';
import {OperationsWorkspace} from '../features/admin/OperationsWorkspace';

export const ADMIN_WORKER_URL='https://jobedu-admin.jobedu-admin-worker.workers.dev';
// Keep in lockstep with the identical interface in cf-worker/src/index.ts.
interface BulkRowResult {name:string;grade:string;ok:boolean;password?:string;error?:string}
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
      if(next){try{
        const schools=await listSchools(client.db,next.uid);if(token===generation.current)setLinks(schools);
        // 연결된 학교가 하나뿐이면 학교 선택 화면 없이 바로 들어간다(D-114).
        if(schools.length===1&&token===generation.current){const a=await openSchool(client.db,next.uid,schools[0].schoolId);if(token===generation.current)setActive(a)}
      }catch(e){if(token===generation.current)setError(readableError(e))}}
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
  return <div className="shell"><header className="header"><a className="brand" href="/" aria-label="작은 사회 처음으로"><span className="brand-mark">M</span><span>{active?.school.communityName??'작은 사회'}</span></a><div className="header-actions">{active&&links.length>1&&<button className="button quiet" onClick={()=>{generation.current++;setActive(null)}}>학교 변경</button>}{user&&<button className="button quiet" onClick={logout}>로그아웃</button>}</div></header>
    <main>{error&&<p role="alert" className="error">{error}</p>}{loading?<section className="panel"><p role="status">학교 정보를 확인하고 있어요.</p></section>:!user?<><Login onError={setError}/><div className="demo-entry"><button className="button secondary" onClick={()=>setDemo(true)}>가상 시민으로 직업 체험하기</button><p className="muted">실제 학생 정보 없이 신청과 배정을 확인해요.</p></div></>:!active?<section className="panel narrow"><span className="eyebrow">학교 선택</span><h1>나의 작은 사회로</h1><p>등록된 학교를 선택해 주세요.</p>{links.length?links.map(l=><button className="school-choice" key={l.schoolId} onClick={()=>selectSchool(l.schoolId)}>{l.schoolName}<span aria-hidden="true">→</span></button>):<div className="notice">연결된 학교가 없습니다. 학교 관리자에게 계정 등록을 요청해 주세요.</div>}</section>:<SchoolWorkspace key={`${user.uid}/${active.context.schoolId}`} {...active}/>}</main></div>;
}
function Login({onError}:{onError:(s:string)=>void}){
  const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<'student'|'teacher'>('student');
  const urlSchoolCode=useMemo(()=>new URLSearchParams(window.location.search).get('school')??'',[]);
  // 주소에 ?school=이 없으면, 학교가 하나뿐인 사이트인지 관리 서버에 물어 학교 코드 칸을 숨긴다(D-114).
  const [autoSchoolCode,setAutoSchoolCode]=useState<string|null|undefined>(urlSchoolCode?null:undefined);
  useEffect(()=>{
    if(urlSchoolCode)return;let alive=true;
    fetch(ADMIN_WORKER_URL).then(r=>r.json() as Promise<{code?:string|null}>).then(d=>{if(alive)setAutoSchoolCode(d.code||null)}).catch(()=>{if(alive)setAutoSchoolCode(null)});
    return ()=>{alive=false};
  },[urlSchoolCode]);
  const schoolCode=urlSchoolCode||autoSchoolCode||'';
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!firebase)return;setBusy(true);onError('');const f=new FormData(e.currentTarget);
    try{
      await firebase.ready;
      const email=mode==='teacher'
        ?String(f.get('email'))
        :studentLoginEmail(String(f.get('schoolCode')),String(f.get('grade')),String(f.get('name')));
      await signInWithEmailAndPassword(firebase.auth,email,mode==='teacher'?String(f.get('password')):studentAuthPassword(String(f.get('password'))));
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
        ?<><h2>학생 로그인</h2><p>{schoolCode?'내 학년과 이름, 비밀번호로 로그인해요.':'선생님께 안내받은 학교 코드와 비밀번호로 로그인해요. 이메일은 필요 없어요.'}</p>
          {schoolCode?<input type="hidden" name="schoolCode" value={schoolCode}/>
            :autoSchoolCode===undefined?<p className="muted" role="status">학교 정보를 확인하고 있어요…</p>
            :<label>학교 코드<input name="schoolCode" autoComplete="off" required maxLength={40} placeholder="예: 마동초 또는 마동초등학교"/></label>}
          <label>학년<select name="grade" defaultValue="" required><option value="" disabled>학년 선택</option>{[1,2,3,4,5,6].map(g=><option key={g} value={g}>{g}학년</option>)}</select></label>
          <label>이름<input name="name" autoComplete="username" required maxLength={40}/></label></>
        :<><h2>선생님 로그인</h2><p>학교에서 안내받은 계정을 사용해 주세요.</p>
          <label>계정 이메일<input type="email" name="email" autoComplete="username" required/></label></>}
      <label>비밀번호<input type="password" name="password" autoComplete="current-password" required inputMode={mode==="teacher"?undefined:"numeric"}/></label>
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
  const communityStore=useMemo(()=>firestoreCommunity(firebase!.db,context),[context]);
  const careerProfileStore=useMemo(()=>firestoreCareerProfiles(firebase!.db,context),[context]);
  const teacher=isTeacher(context.membership),[students,setStudents]=useState<Student[]>([]),[citizen,setCitizen]=useState<Student|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[importing,setImporting]=useState(false);
  const [editingStudent,setEditingStudent]=useState<Student|null>(null),[savingStudent,setSavingStudent]=useState(false),[editResult,setEditResult]=useState<string|null>(null);
  const [rosterSheetBusy,setRosterSheetBusy]=useState(false),[rosterSheetResults,setRosterSheetResults]=useState<{grade:string;name:string;ok:boolean;pin?:string;status?:string;error?:string}[]|null>(null),[rosterSheetCode,setRosterSheetCode]=useState('');
  async function importRosterSheet(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(rosterSheetBusy)return;
    const sheetUrl=String(new FormData(e.currentTarget).get('sheetUrl')||'').trim();if(!sheetUrl)return;
    setRosterSheetBusy(true);setError('');setRosterSheetResults(null);
    try{
      const idToken=await firebase!.auth.currentUser!.getIdToken();
      const res=await fetch(ADMIN_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},body:JSON.stringify({schoolId:context.schoolId,action:'importRoster',sheetUrl})});
      const data=await res.json() as {results?:{grade:string;name:string;ok:boolean;pin?:string;status?:string;error?:string}[];schoolCode?:string;error?:string};
      if(!res.ok||!data.results)throw new Error(data.error??'명단과 계정을 만들지 못했습니다.');
      setRosterSheetResults(data.results);setRosterSheetCode(data.schoolCode??'');setRefresh(n=>n+1);
    }catch(e){setError(readableError(e))}
    finally{setRosterSheetBusy(false)}
  }
  const [resettingStudent,setResettingStudent]=useState<Student|null>(null),[resetBusy,setResetBusy]=useState(false),[resetResult,setResetResult]=useState<{password:string}|null>(null);
  const [bulkOpen,setBulkOpen]=useState(false),[bulkBusy,setBulkBusy]=useState(false),[bulkResults,setBulkResults]=useState<BulkRowResult[]|null>(null);
  async function saveStudent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editingStudent||savingStudent)return;
    const f=new FormData(e.currentTarget);setSavingStudent(true);setError('');setEditResult(null);
    try{
      const name=String(f.get('name')||'').trim(),grade=Number(f.get('grade')),password=String(f.get('newPassword')||'').trim();
      // 학년·이름이 바뀌면 로그인 아이디도 바뀌므로, 명단과 로그인 계정을 관리 서버(Worker)에서 함께 고친다(D-112).
      if(name!==editingStudent.name||grade!==editingStudent.grade||password){
        const idToken=await firebase!.auth.currentUser!.getIdToken();
        const res=await fetch(ADMIN_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},body:JSON.stringify({schoolId:context.schoolId,action:'updateStudent',studentId:editingStudent.id,grade:String(grade),name,password})});
        const data=await res.json() as {error?:string;hasAccount?:boolean};
        if(!res.ok)throw new Error(data.error??'학생 정보를 바꾸지 못했습니다.');
        setEditResult(`${grade}학년 ${name} 학생 정보를 저장했습니다.${password?` 새 비밀번호: ${password}`:''}${data.hasAccount===false?' (아직 로그인 계정이 없는 학생입니다)':''}`);
      }
      const numberRaw=String(f.get('number')||'').trim();
      await updateStudent(firebase!.db,context,{...editingStudent,name,grade,number:numberRaw?Number(numberRaw):null,className:String(f.get('className')||'').trim()||null,status:f.get('status') as Student['status']});
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
  async function bulkReset(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(bulkBusy)return;
    const sheetUrl=String(new FormData(e.currentTarget).get('sheetUrl')||'').trim();
    if(!sheetUrl)return;
    setBulkBusy(true);setError('');setBulkResults(null);
    try{
      const idToken=await firebase!.auth.currentUser!.getIdToken();
      const res=await fetch(ADMIN_WORKER_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`},
        body:JSON.stringify({schoolId:context.schoolId,sheetUrl}),
      });
      const data=await res.json() as {results?:BulkRowResult[];error?:string};
      if(!res.ok||!data.results)throw new Error(data.error??'일괄 변경에 실패했습니다.');
      setBulkResults(data.results);
    }catch(e){setError(readableError(e))}
    finally{setBulkBusy(false)}
  }
  const [studentCursor,setStudentCursor]=useState<StudentPage['cursor']>(null),[hasMoreStudents,setHasMoreStudents]=useState(false),[loadingMore,setLoadingMore]=useState(false);
  useEffect(()=>{let alive=true;setLoading(true);setStudents([]);setCitizen(null);setError('');setStudentCursor(null);setHasMoreStudents(false);const client=firebase!;
    (teacher?listStudentsPage(client.db,context).then(p=>{if(alive){setStudents(p.students);setStudentCursor(p.cursor);setHasMoreStudents(p.hasMore)}}):getCitizen(client.db,context).then(s=>{if(alive)setCitizen(s)})).catch(e=>{if(alive)setError(readableError(e))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};
  },[context,teacher,refresh]);
  async function loadMoreStudents(){
    if(loadingMore||!firebase)return;setLoadingMore(true);setError('');
    try{const p=await listStudentsPage(firebase.db,context,studentCursor);setStudents(prev=>[...prev,...p.students]);setStudentCursor(p.cursor);setHasMoreStudents(p.hasMore)}
    catch(e){setError(readableError(e))}
    finally{setLoadingMore(false)}
  }
  if(!teacher)return <>{error?<p role="alert" className="error">{error}</p>:loading?<p role="status">시민 정보를 확인하고 있어요.</p>:citizen?<StudentHome citizen={citizen} school={school} context={context} store={store} taskStore={taskStore} financeStore={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} businessStore={businessStore} proposalStore={proposalStore} violationStore={violationStore} communityStore={communityStore} careerProfileStore={careerProfileStore}/>:null}</>;
  return <><div className="page-heading"><div><span className="eyebrow">{school.schoolName}</span><h1>시민 관리</h1><p>우리 학교 시민의 등록 상태를 확인합니다.</p></div><span className="tag">교사 운영실</span></div>{error?<p role="alert" className="error">{error}</p>:loading?<p role="status">시민 정보를 확인하고 있어요.</p>:<>{editResult&&<p role="status" className="success">{editResult}</p>}<details className="panel roster-accordion"><summary><h2>학생 명단 <span className="count">{students.length}</span></h2><span className="muted roster-accordion-hint">눌러서 펼치기·접기</span></summary><div className="header-actions section"><button className="button quiet" onClick={()=>setRefresh(n=>n+1)}>새로고침</button><button className="button primary" onClick={()=>setImporting(!importing)}>명단 가져오기</button></div>{students.length?<div className="table-scroll"><table><thead><tr><th>이름</th><th>학년</th><th>반</th><th>학년도</th><th>상태</th><th></th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.grade}학년</td><td>{s.className??'미지정'}</td><td>{s.schoolYear}</td><td>{s.status==='active'?'활동 중':s.status==='graduated'?'졸업':'전출'}</td><td><button className="button quiet" onClick={()=>setEditingStudent(s)}>수정</button> <button className="button quiet" onClick={()=>{setResettingStudent(s);setResetResult(null)}}>비밀번호 재설정</button></td></tr>)}</tbody></table>{hasMoreStudents&&<button className="button quiet section" disabled={loadingMore} onClick={loadMoreStudents}>{loadingMore?'불러오는 중…':'학생 더 보기'}</button>}</div>:<div className="empty">등록된 학생이 없습니다. 명단을 확인한 뒤 가져와 주세요.</div>}</details>
    {editingStudent&&<form className="panel section action-form" onSubmit={saveStudent}>
      <h3>{editingStudent.name} 정보 수정</h3>
      <div className="fields"><label>이름<input name="name" defaultValue={editingStudent.name} required maxLength={40}/></label><label>새 비밀번호(숫자 4자리 또는 6자 이상, 바꿀 때만)<input name="newPassword" inputMode="numeric" pattern="[0-9]{4}|.{6,}" maxLength={40} placeholder="비워두면 그대로"/></label></div>
      <div className="fields"><label>번호(학년 안 출석번호)<input name="number" type="number" min={1} max={99} defaultValue={editingStudent.number??''} placeholder="예: 3"/></label></div>
      <div className="fields"><label>학년<select name="grade" defaultValue={editingStudent.grade}>{[1,2,3,4,5,6].map(g=><option key={g} value={g}>{g}학년</option>)}</select></label><label>반<input name="className" defaultValue={editingStudent.className??''} maxLength={20}/></label></div>
      <label>학적 상태<select name="status" defaultValue={editingStudent.status}><option value="active">활동 중</option><option value="graduated">졸업</option><option value="transferred">전출</option></select></label>
      <p className="muted">학년이나 이름을 바꾸면 학생의 로그인 아이디(학년·이름)도 함께 바뀝니다. 졸업·전출으로 바꿔도 기록은 보존됩니다.</p>
      <div className="header-actions"><button className="button primary" disabled={savingStudent}>저장</button><button type="button" className="button quiet" onClick={()=>setEditingStudent(null)}>취소</button></div>
    </form>}
    {resettingStudent&&<form className="panel section action-form" onSubmit={resetPassword}>
      <h3>{resettingStudent.name}({resettingStudent.grade}학년) 비밀번호 재설정</h3>
      <label>새 비밀번호(숫자 4자리 또는 6자 이상, 비우면 자동 생성)<input name="password" inputMode="numeric" pattern="[0-9]{4}|.{6,}" maxLength={40} placeholder="비워두면 임의 생성"/></label>
      <div className="header-actions"><button className="button primary" disabled={resetBusy}>{resetBusy?'처리 중…':'재설정'}</button><button type="button" className="button quiet" onClick={()=>{setResettingStudent(null);setResetResult(null)}}>닫기</button></div>
      {resetResult&&<p role="status" className="notice">새 비밀번호: <b>{resetResult.password}</b> — 학생에게 알려주세요.</p>}
    </form>}
    <section className="panel section">
      <div className="section-heading"><h3>구글 시트로 명단·계정 한꺼번에 만들기</h3></div>
      <p className="muted">시트 첫 줄에 <b>학년, 이름</b>(선택: <b>번호</b>, <b>비밀번호</b>) 열을 두고 "링크가 있는 모든 사용자 - 뷰어"로 공유한 뒤 링크를 붙여넣어 주세요. 명단에 없는 학생은 추가하고, 로그인 계정을 만들거나 이미 있으면 비밀번호를 바꿉니다. 비밀번호 칸이 비어 있으면 <b>연도·학년·번호</b>로 기본 비밀번호를 정합니다(예: 2026년 1학년 1번 → 260101). 번호 열이 없으면 시트에서 그 학년의 순서를 번호로 씁니다. 한 번에 최대 40명.</p>
      <form className="assignment-form" onSubmit={importRosterSheet}>
        <label>구글 시트 링크<input name="sheetUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/..."/></label>
        <button className="button primary" disabled={rosterSheetBusy}>{rosterSheetBusy?'만드는 중…(1분 정도 걸려요)':'명단·계정 만들기'}</button>
      </form>
      {rosterSheetResults&&<>
        <p className="notice">성공 {rosterSheetResults.filter(r=>r.ok).length}명 · 실패 {rosterSheetResults.filter(r=>!r.ok).length}명. 학생은 로그인 화면에서 <b>학교 코드 {rosterSheetCode}</b>, 학년, 이름, 아래 비밀번호를 입력합니다. 이 표는 다시 볼 수 없으니 지금 옮겨 적거나 인쇄해 두세요.</p>
        <div className="table-scroll"><table><thead><tr><th>학년</th><th>이름</th><th>비밀번호</th><th>결과</th></tr></thead><tbody>
          {rosterSheetResults.map((r,i)=><tr key={i}><td>{r.grade}학년</td><td>{r.name}</td><td>{r.ok?<b>{r.pin}</b>:'-'}</td><td>{r.ok?(r.status==='created'?'새 계정':'비밀번호 변경'):<span className="error">{r.error}</span>}</td></tr>)}
        </tbody></table></div>
      </>}
    </section>
    <section className="panel section">
      <div className="section-heading"><h3>비밀번호 일괄 변경</h3><button type="button" className="button quiet" onClick={()=>setBulkOpen(!bulkOpen)}>{bulkOpen?'닫기':'구글 시트로 가져오기'}</button></div>
      {bulkOpen&&<>
        {/* "최대 20명" mirrors MAX_BULK_ROWS in cf-worker/src/index.ts — keep both in sync. */}
        <p className="muted">구글 시트에 <b>이름,학년,학교코드,비밀번호</b> 순서로(첫 줄은 제목) 학생을 정리하고 "링크가 있는 모든 사용자 - 뷰어"로 공유한 뒤, 그 링크를 붙여넣어 주세요. 비밀번호 칸을 비워두면 자동 생성됩니다. 한 번에 최대 20명까지 처리됩니다.</p>
        <form className="assignment-form" onSubmit={bulkReset}>
          <label>구글 시트 링크<input name="sheetUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/..."/></label>
          <button className="button primary" disabled={bulkBusy}>{bulkBusy?'처리 중…':'가져와서 적용'}</button>
        </form>
        {bulkResults&&<>
          <p className="muted">성공 {bulkResults.filter(r=>r.ok).length}명 · 실패 {bulkResults.filter(r=>!r.ok).length}명</p>
          <div className="table-scroll"><table><thead><tr><th>이름</th><th>학년</th><th>결과</th></tr></thead><tbody>
            {bulkResults.map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.grade}학년</td><td>{r.ok?<>새 비밀번호: <b>{r.password}</b></>:<span className="error">{r.error}</span>}</td></tr>)}
          </tbody></table></div>
        </>}
      </>}
    </section>
    {importing&&<section className="panel section"><RosterImport context={context} existing={students} onDone={()=>{setRefresh(n=>n+1);setImporting(false)}}/></section>}<div className="section"><CareerWorkspace store={store} schoolId={context.schoolId} teacher={true} students={students} studentId={context.membership.studentId??undefined} departmentNames={school.departmentNames} context={context}/></div><div className="section"><CareerDiscoveryTeacher store={careerProfileStore} careerStore={store} students={students}/></div><div className="section"><TaskWorkspace taskStore={taskStore} careerStore={store} teacher={true} students={students} currencySymbol={school.currencyName}/></div><div className="section"><BankWorkspace store={financeStore} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} teacher={true} students={students} currencySymbol={school.currencyName} context={context} incomeTaxRateBp={school.incomeTaxRateBp}/></div><div className="section"><StoreWorkspace store={businessStore} teacher={true} students={students} currencySymbol={school.currencyName} context={context} businessTaxRateBp={school.businessTaxRateBp}/></div><div className="section"><CivicWorkspace store={proposalStore} teacher={true} students={students}/></div><div className="section"><TeacherCommunity store={communityStore} students={students} currencySymbol={school.currencyName}/></div><div className="section"><ViolationWorkspace store={violationStore} teacher={true} students={students} currencySymbol={school.currencyName}/></div><div className="section"><OperationsWorkspace auditStore={auditStore} careerStore={store} taskStore={taskStore} businessStore={businessStore} proposalStore={proposalStore} financeStore={financeStore} students={students} currencySymbol={school.currencyName} context={context}/></div></>}</>;
}
