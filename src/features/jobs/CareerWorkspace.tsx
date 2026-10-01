import {useEffect,useRef,useState,type FormEvent} from 'react';
import {canAssign,departments,departmentDisplayName,jobIcons,iconNames,statuses,type Application,type Career,type CareerData} from '../../domain/jobs';
import {toMajor,toMinor} from '../../domain/money';
import type {SchoolContext,Student} from '../../domain/model';
import type {CareerStore} from '../../data/careerRepository';
import {updateDepartmentNames} from '../../data/schoolRepository';
import {firebase} from '../../data/firebase';

export function CareerWorkspace({store,schoolId,teacher,students,studentId,departmentNames,context,iconFilter,onChange}:{store:CareerStore;schoolId:string;teacher:boolean;students:Student[];studentId?:string;departmentNames?:Partial<Record<string,string>>;context?:SchoolContext;iconFilter?:string[];onChange?:()=>void}){
  const [data,setData]=useState<CareerData>({jobs:[],applications:[],assignments:[]}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState('all'),[view,setView]=useState<'jobs'|'applications'|'assignments'>('jobs'),[editing,setEditing]=useState<Career|null>(null),[applying,setApplying]=useState<Career|null>(null),[reviewing,setReviewing]=useState<Application|null>(null),[namingDepartments,setNamingDepartments]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;let alive=true;setLoading(true);store.load().then(d=>{if(alive)setData(d)}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false;mounted.current=false}},[store]);
  async function run(action:()=>Promise<void>,success:string){if(busy)return;setBusy(true);setError('');setMessage('');try{await action();const next=await store.load();if(mounted.current){setData(next);setMessage(success);setApplying(null);setEditing(null);setReviewing(null);onChange?.()}}catch(e){if(mounted.current)setError((e as {code?:string}).code==='permission-denied'?'학교 접근 권한을 확인할 수 없습니다. 다시 로그인해 주세요.':(e as Error).message)}finally{if(mounted.current)setBusy(false)}}
  // A building on the student map (§ CitizenMap) scopes this whole workspace to just the jobs it
  // covers (StudentHome passes iconFilter) — department filtering doesn't apply inside a building,
  // the building itself already is the filter, and buildings within the same department (e.g.
  // broadcast/art, both 'media') need to stay visually distinct rather than showing each other's jobs.
  const inBuilding=Array.isArray(iconFilter);
  const scopedJobIds=new Set((inBuilding?data.jobs.filter(j=>iconFilter!.includes(j.icon)):data.jobs).map(j=>j.id));
  const scopedApplications=inBuilding?data.applications.filter(a=>scopedJobIds.has(a.jobId)):data.applications;
  const scopedAssignments=inBuilding?data.assignments.filter(a=>scopedJobIds.has(a.jobId)):data.assignments;
  const mine=scopedAssignments.filter(a=>a.status==='active'&&(teacher||a.studentId===studentId));
  const jobs=inBuilding?data.jobs.filter(j=>scopedJobIds.has(j.id)):data.jobs.filter(j=>filter==='all'||j.departmentId===filter);
  const deptName=(id:string)=>departmentDisplayName({departmentNames},id);
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  const jobName=(id:string)=>data.jobs.find(j=>j.id===id)?.name??id;
  return <section className="careers"><div className="page-heading"><div><span className="eyebrow">나의 역할, 우리의 사회</span><h1>{teacher?'직업 운영실':'나에게 맞는 직업 찾기'}</h1><p>{teacher?'직업을 준비하고, 시민의 신청을 살펴보고, 역할을 배정해요.':'하고 싶은 일을 찾아 신청해 보세요. 여러 직업을 함께 맡을 수 있어요.'}</p></div>{teacher&&<div className="header-actions">{context&&<button className="button quiet" onClick={()=>setNamingDepartments(!namingDepartments)}>국 이름 설정</button>}<button className="button primary" onClick={()=>setEditing({id:crypto.randomUUID(),schoolId,departmentId:'life',name:'',description:'',core:false,status:'preparing',recommendedGrades:[1,2,3,4,5,6],icon:'plant_manager',salaryMinor:0,capacity:null,activeAssignmentCount:0,schemaVersion:1})}>+ 직업 만들기</button></div>}</div>
    {namingDepartments&&context&&<DepartmentNamesEditor departmentNames={departmentNames} context={context} onCancel={()=>setNamingDepartments(false)}/>}
    <nav className="workspace-tabs" aria-label="직업 메뉴">{([['jobs','직업 둘러보기'],['applications',teacher?'신청 검토':'내 신청 내역'],['assignments',teacher?'직업 배정':'내 직업']] as const).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setApplying(null);setEditing(null);setReviewing(null)}}>{label}{id==='applications'&&<span>{scopedApplications.filter(a=>a.status==='submitted').length}</span>}</button>)}</nav>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    {loading?<p role="status">직업을 불러오고 있어요.</p>:<>
      {editing&&<CareerEditor key={editing.id} job={editing} busy={busy} departmentNames={departmentNames} onCancel={()=>setEditing(null)} onSave={job=>run(()=>store.save(job),'직업을 저장했습니다.')}/>}
      {applying&&<form className="panel section action-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.apply(applying.id,String(f.get('reason'))),'신청했습니다. 선생님의 배정을 기다려 주세요.')}}><h2>{applying.name} 신청하기</h2><label>이 일을 하고 싶은 이유<textarea autoFocus name="reason" required maxLength={500} rows={3}/></label><div className="header-actions"><button className="button primary" disabled={busy}>신청 보내기</button><button type="button" className="button quiet" onClick={()=>setApplying(null)}>취소</button></div></form>}
      {view==='jobs'&&<>{!inBuilding&&<div className="department-filters"><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>전체 직업 <strong>{data.jobs.length}</strong></button>{departments.map(d=><button key={d.id} aria-pressed={filter===d.id} onClick={()=>setFilter(d.id)}><img src={`/assets/departments/${d.icon}_department_icon.png`} alt=""/>{deptName(d.id)}</button>)}</div>}
        {!data.jobs.length?<div className="panel empty"><h2>아직 등록된 직업이 없어요</h2><p>{teacher?'기본 직업 6개로 시작하거나 우리 학교만의 직업을 만들어 보세요.':'선생님이 직업을 준비하고 있어요.'}</p>{teacher&&<button className="button primary section" disabled={busy} onClick={()=>run(()=>store.seed(),'기본 직업을 준비했습니다.')}>기본 직업으로 시작</button>}</div>:!jobs.length?<p className="empty">{inBuilding?'이 건물에서 맡을 수 있는 직업이 아직 없어요. 선생님이 직업을 만들면 여기에 나타나요.':'이 국에는 아직 직업이 없어요.'}</p>:<div className="job-grid">{jobs.map(job=>{const a=data.applications.find(a=>a.jobId===job.id&&a.studentId===studentId),assigned=mine.some(a=>a.jobId===job.id),full=job.capacity!=null&&job.activeAssignmentCount>=job.capacity;return <article className={`job-card department-${job.departmentId}`} key={job.id}><div className="job-top"><img className="job-icon" src={`/assets/jobs/${job.icon}_job_icon.png`} alt=""/><span className={`job-status status-${job.status}`}>{statuses[job.status]}</span></div><span className="job-department">{deptName(job.departmentId)}{job.core?' · 핵심 직업':''}</span><h2>{job.name}</h2><p>{job.description}</p><div className="job-grades">권장 {job.recommendedGrades.join('·')}학년 <small>다른 학년도 신청 가능</small></div>{job.capacity!=null&&<p className="muted">정원 {job.activeAssignmentCount}/{job.capacity}명{full?' · 정원이 찼어요':''}</p>}{teacher?<button className="button quiet full" disabled={job.status==='closed'} onClick={()=>setEditing(job)}>{job.status==='closed'?'종료 기록 보존 중':'직업 설정'}</button>:<button className="button primary full" disabled={job.status!=='recruiting'||!!a||assigned||busy||full} onClick={()=>setApplying(job)}>{assigned?'내가 맡은 직업':a?'신청 내역 확인':full?'정원이 찼어요':job.status==='recruiting'?'이 직업 신청하기':statuses[job.status]}</button>}</article>})}</div>}
      </>}
      {view==='applications'&&<section className="panel section"><h2>{teacher?'시민들의 신청':'내 신청 내역'}</h2>{scopedApplications.length?scopedApplications.map(a=><article className="application-row" key={a.id}><div><span className={`job-status status-${a.status==='submitted'?'preparing':a.status==='approved'?'active':'closed'}`}>{a.status==='submitted'?'검토 대기':a.status==='approved'?'배정 완료':'반려'}</span><h3>{jobName(a.jobId)}{teacher?` · ${studentName(a.studentId)}`:''}</h3><p>{a.reason}</p>{a.reviewNote&&<p className="review-note">선생님 의견: {a.reviewNote}</p>}<ApplicationHistoryButton applicationId={a.id} store={store}/>{!teacher&&a.status==='rejected'&&<button className="button quiet" disabled={busy} onClick={()=>setApplying(data.jobs.find(j=>j.id===a.jobId)??null)}>다시 신청하기</button>}</div>{teacher&&a.status==='submitted'&&<button className="button secondary" onClick={()=>setReviewing(a)}>신청 검토</button>}</article>):<p className="empty">아직 신청 내역이 없어요.</p>}
        {reviewing&&<form className="action-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),approve=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='approve';void run(()=>store.review(reviewing,approve,String(f.get('note'))),approve?'신청을 승인하고 직업을 배정했습니다.':'반려 의견을 남겼습니다.')}}><h3>{jobName(reviewing.jobId)} · {studentName(reviewing.studentId)}</h3><label>검토 의견 (반려할 때 필수)<textarea autoFocus name="note" maxLength={500} rows={2}/></label><div className="header-actions"><button className="button primary" value="approve" disabled={busy}>승인하고 배정</button><button className="button quiet" value="reject" disabled={busy}>반려</button><button className="button quiet" type="button" onClick={()=>setReviewing(null)}>닫기</button></div></form>}
      </section>}
      {view==='assignments'&&<section className="panel section"><h2>{teacher?'시민별 직업 배정':'내가 맡은 직업'}</h2>{teacher&&<form className="assignment-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.assign(String(f.get('job')),String(f.get('student'))),'직업을 배정했습니다.')}}><label>학생<select name="student" required><option value="">학생 선택</option>{students.filter(s=>s.status==='active').map(s=><option value={s.id} key={s.id}>{s.name} · {s.grade}학년</option>)}</select></label><label>직업<select name="job" required><option value="">직업 선택</option>{data.jobs.filter(canAssign).map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label><button className="button primary" disabled={busy}>직업 배정</button></form>}{mine.length?mine.map(a=><div className="application-row" key={a.id}><div><h3>{jobName(a.jobId)}</h3><p>{teacher?studentName(a.studentId):'나의 역할'} · {statuses[data.jobs.find(j=>j.id===a.jobId)?.status??'closed']}</p><AssignmentHistoryButton assignmentId={a.id} store={store}/></div>{teacher&&<button className="button quiet" disabled={busy} onClick={()=>run(()=>store.end(a),'배정을 종료했습니다.')}>배정 종료</button>}</div>):<p className="empty">아직 맡은 직업이 없어요. 직업을 신청하고 선생님의 배정을 기다려 주세요.</p>}</section>}
      {(data.jobs.length===100||data.applications.length===100||data.assignments.length===100)&&<p className="notice">목록은 최대 100건까지 표시합니다. 이보다 많은 기록의 조회는 다음 운영 단계에서 지원합니다.</p>}
    </>}
  </section>;
}
function CareerEditor({job,busy,departmentNames,onSave,onCancel}:{job:Career;busy:boolean;departmentNames?:Partial<Record<string,string>>;onSave:(j:Career)=>void;onCancel:()=>void}){
  const [grades,setGrades]=useState(job.recommendedGrades);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const capacityRaw=String(f.get('capacity')||'').trim();
    onSave({...job,name:String(f.get('name')).trim(),description:String(f.get('description')).trim(),departmentId:String(f.get('department')),status:String(f.get('status')) as Career['status'],core:job.core||f.get('core')==='on',icon:String(f.get('icon')),recommendedGrades:grades,salaryMinor:toMinor(Number(f.get('salary'))||0),capacity:capacityRaw?Number(capacityRaw):null});
  }
  return <form className="panel section action-form" onSubmit={submit}><h2>{job.name?'직업 설정':'새 직업 만들기'}</h2><div className="fields"><label>직업 이름<input autoFocus name="name" defaultValue={job.name} required maxLength={60}/></label><label>소속국<select name="department" defaultValue={job.departmentId}>{departments.map(d=><option key={d.id} value={d.id}>{departmentDisplayName({departmentNames},d.id)}</option>)}</select></label></div><label>하는 일<textarea name="description" defaultValue={job.description} required maxLength={1000} rows={3}/></label><div className="fields"><label>운영 상태<select name="status" defaultValue={job.status}>{Object.entries(statuses).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>직업 아이콘<select name="icon" defaultValue={job.icon}>{jobIcons.map(icon=><option value={icon} key={icon}>{iconNames[icon]}</option>)}</select></label></div><div className="fields"><label>월급(동, 매달 정산)<input name="salary" type="number" min={0} max={10000} step={1} defaultValue={toMajor(job.salaryMinor)}/></label><label>정원(비우면 제한 없음)<input name="capacity" type="number" min={1} max={300} step={1} defaultValue={job.capacity??''} placeholder="제한 없음"/></label></div>{job.capacity!=null&&<p className="muted">현재 {job.activeAssignmentCount}명 배정 중</p>}<fieldset><legend>권장 학년 (신청을 제한하지 않아요)</legend><div className="grade-options">{[1,2,3,4,5,6].map(g=><label className="checkbox" key={g}><input type="checkbox" checked={grades.includes(g)} onChange={e=>setGrades(e.target.checked?[...grades,g].sort():grades.filter(n=>n!==g))}/>{g}학년</label>)}</div></fieldset><label className="checkbox"><input type="checkbox" name="core" defaultChecked={job.core} disabled={job.core}/>작은 사회를 유지하는 핵심 직업</label><p className="muted">운영 종료 후에도 기록은 보존되며 신규 신청과 배정은 닫힙니다.</p><div className="header-actions section"><button className="button primary" disabled={busy}>직업 저장</button><button className="button quiet" type="button" onClick={onCancel}>취소</button></div></form>;
}
// Mirrors TeacherIncomeTax's pattern (BankWorkspace.tsx): its own local save state, calling the
// repository function directly rather than round-tripping through the career store's run()/reload
// — school.departmentNames itself only refreshes on the next full school load, same as tax rates.
function DepartmentNamesEditor({departmentNames,context,onCancel}:{departmentNames?:Partial<Record<string,string>>;context:SchoolContext;onCancel:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!firebase)return;
    const f=new FormData(e.currentTarget);
    const names=Object.fromEntries(departments.map(d=>[d.id,String(f.get(d.id)||'').trim()]));
    setBusy(true);setError('');setSaved(false);
    try{await updateDepartmentNames(firebase.db,context,names);setSaved(true)}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  return <form className="panel section action-form" onSubmit={submit}><h2>국 이름 설정</h2><p className="muted">비워두면 기본 이름을 사용해요. 저장 후 다시 불러오면 반영돼요.</p>{error&&<p role="alert" className="error">{error}</p>}{saved&&<p role="status" className="success">국 이름을 저장했습니다.</p>}<div className="fields">{departments.map(d=><label key={d.id}>{d.name}<input name={d.id} defaultValue={departmentNames?.[d.id]??''} maxLength={20} placeholder={d.name}/></label>)}</div><div className="header-actions section"><button className="button primary" disabled={busy}>저장</button><button className="button quiet" type="button" onClick={onCancel}>닫기</button></div></form>;
}
function AssignmentHistoryButton({assignmentId,store}:{assignmentId:string;store:CareerStore}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  type Entry={id:string;startAt:string;endAt:string};
  const [entries,setEntries]=useState<Entry[]|null>(null);
  async function toggle(){
    if(open){setOpen(false);return}
    setOpen(true);
    if(entries)return;
    setBusy(true);
    try{setEntries(await store.assignmentHistory(assignmentId))}catch{setEntries([])}
    finally{setBusy(false)}
  }
  return <span className="history-toggle"><button type="button" className="button quiet" onClick={toggle}>{open?'이력 닫기':'이전 배정 이력'}</button>
    {open&&(busy?<p className="muted">불러오는 중…</p>:entries&&entries.length?<ul className="history-list">{entries.map(h=><li key={h.id}>{new Date(h.startAt).toLocaleDateString('ko-KR')} ~ {new Date(h.endAt).toLocaleDateString('ko-KR')}</li>)}</ul>:<p className="muted">이전 배정 기록이 없어요.</p>)}
  </span>;
}
function ApplicationHistoryButton({applicationId,store}:{applicationId:string;store:CareerStore}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  type Entry={id:string;reason:string;reviewNote:string;submittedAt:string;reviewedAt:string};
  const [entries,setEntries]=useState<Entry[]|null>(null);
  async function toggle(){
    if(open){setOpen(false);return}
    setOpen(true);
    if(entries)return;
    setBusy(true);
    try{setEntries(await store.applicationHistory(applicationId))}catch{setEntries([])}
    finally{setBusy(false)}
  }
  return <span className="history-toggle"><button type="button" className="button quiet" onClick={toggle}>{open?'이전 신청 이력 닫기':'이전 신청 이력'}</button>
    {open&&(busy?<p className="muted">불러오는 중…</p>:entries&&entries.length?<ul className="history-list">{entries.map(h=><li key={h.id}>{new Date(h.submittedAt).toLocaleDateString('ko-KR')} 신청 · 반려: {h.reviewNote||'(사유 없음)'}</li>)}</ul>:<p className="muted">이전 신청 기록이 없어요.</p>)}
  </span>;
}
