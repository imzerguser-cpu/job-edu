import {useEffect,useRef,useState,type FormEvent} from 'react';
import {taskStatusNames,verificationKindNames,type Task,type TaskData,type TaskTemplate,type VerificationKind} from '../../domain/tasks';
import type {Evidence} from '../../domain/evidence';
import type {Career} from '../../domain/jobs';
import type {Student} from '../../domain/model';
import type {TaskStore} from '../../data/taskRepository';
import type {CareerStore} from '../../data/careerRepository';
import {compressImageToBase64} from '../../ui/imageCompress';

export function TaskWorkspace({taskStore,careerStore,teacher,students}:{taskStore:TaskStore;careerStore:CareerStore;teacher:boolean;students:Student[];studentId?:string}){
  const [data,setData]=useState<TaskData>({templates:[],tasks:[]});
  const [jobs,setJobs]=useState<Career[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [view,setView]=useState<'templates'|'assign'|'review'>('templates');
  const [editing,setEditing]=useState<TaskTemplate|null>(null);
  const [submittingTask,setSubmittingTask]=useState<Task|null>(null);
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const mounted=useRef(true);

  async function loadAll(){
    const [t,c]=await Promise.all([taskStore.load(),careerStore.load()]);
    if(!mounted.current)return;
    setData(t);setJobs(c.jobs);
  }
  useEffect(()=>{mounted.current=true;setLoading(true);loadAll().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[taskStore,careerStore]);

  async function run(action:()=>Promise<void>,success:string){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await loadAll();if(mounted.current){setMessage(success);setEditing(null);setSubmittingTask(null);setPhotoFile(null)}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  async function submitPhotoTask(task:Task,caption:string){
    if(!photoFile)throw new Error('사진을 선택해 주세요.');
    const {mimeType,base64}=await compressImageToBase64(photoFile);
    await taskStore.submitPhoto(task.id,mimeType,base64,caption);
  }
  async function purgeEvidence(){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{const n=await taskStore.purgeExpiredEvidence();setMessage(n>0?`만료된 사진 ${n}건을 정리했습니다.`:'정리할 만료 사진이 없어요.')}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }

  const templateTitle=(id:string)=>data.templates.find(t=>t.id===id)?.title??id;
  const jobName=(id:string)=>jobs.find(j=>j.id===id)?.name??id;
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';

  if(loading)return <p role="status">업무를 불러오고 있어요.</p>;

  if(!teacher){
    return <section className="citizen-tasks">
      <h2>오늘의 업무</h2>
      {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
      {!data.tasks.length?<p className="empty">아직 배정된 업무가 없어요.</p>:<div className="list">
        {data.tasks.map(task=><article key={task.id} className="task-row">
          <div className="task-row-head"><b>{templateTitle(task.templateId)}</b><span className="badge">{taskStatusNames[task.status]}</span></div>
          {task.reviewNote&&<p className="review-note">선생님 의견: {task.reviewNote}</p>}
          {(task.status==='assigned'||task.status==='revision_requested')&&(submittingTask?.id===task.id
            ?<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),caption=String(f.get('text'));
                void run(()=>task.verificationKind==='photo'?submitPhotoTask(task,caption):taskStore.submit(task.id,caption),'제출했습니다. 선생님의 확인을 기다려 주세요.')}}>
              {task.verificationKind==='photo'&&<label>사진<input type="file" accept="image/*" capture="environment" required onChange={e=>setPhotoFile(e.target.files?.[0]??null)}/></label>}
              <label>{task.verificationKind==='photo'?'활동 설명':'제출 내용'}<textarea autoFocus name="text" required maxLength={2000} rows={4}/></label>
              <div className="header-actions"><button className="button primary" disabled={busy}>제출하기</button><button type="button" className="button quiet" onClick={()=>{setSubmittingTask(null);setPhotoFile(null)}}>취소</button></div>
            </form>
            :<button className="button primary" onClick={()=>setSubmittingTask(task)}>제출하기</button>)}
        </article>)}
      </div>}
    </section>;
  }

  const activeTemplates=data.templates.filter(t=>t.status==='active');
  const submitted=data.tasks.filter(t=>t.status==='submitted');

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>업무 운영</h2></div>
    <nav className="workspace-tabs" aria-label="업무 메뉴">
      {([['templates','업무 만들기'],['assign','업무 배정'],['review','제출 검토']] as const).map(([id,label])=>
        <button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setEditing(null)}}>{label}{id==='review'&&<span>{submitted.length}</span>}</button>)}
    </nav>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    {view==='templates'&&<section className="panel section">
      <div className="section-heading"><h3>업무 목록</h3><button className="button primary" disabled={!jobs.length} onClick={()=>setEditing({id:crypto.randomUUID(),schoolId:'',jobId:jobs[0]?.id??'',title:'',instructions:'',verificationKind:'artifact',status:'active',schemaVersion:1})}>+ 업무 만들기</button></div>
      {!jobs.length&&<p className="empty">먼저 직업을 만들어야 업무를 등록할 수 있어요.</p>}
      {editing&&<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>taskStore.saveTemplate({...editing,jobId:String(f.get('job')),title:String(f.get('title')).trim(),instructions:String(f.get('instructions')).trim(),verificationKind:f.get('kind') as VerificationKind,status:f.get('status') as TaskTemplate['status']}),'업무를 저장했습니다.')}}>
        <label>소속 직업<select name="job" defaultValue={editing.jobId} required>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
        <label>업무 제목<input autoFocus name="title" defaultValue={editing.title} required maxLength={60}/></label>
        <label>안내 내용<textarea name="instructions" defaultValue={editing.instructions} required maxLength={1000} rows={3}/></label>
        <label>인증 방식<select name="kind" defaultValue={editing.verificationKind}><option value="artifact">{verificationKindNames.artifact}</option><option value="photo">{verificationKindNames.photo}</option></select></label>
        <label>운영 상태<select name="status" defaultValue={editing.status}><option value="active">운영 중</option><option value="archived">보관</option></select></label>
        <p className="muted">자동 인증(도서 대여 등 실제 이벤트 연동)은 다음 단계에서 추가됩니다.</p>
        <div className="header-actions"><button className="button primary" disabled={busy}>저장</button><button type="button" className="button quiet" onClick={()=>setEditing(null)}>취소</button></div>
      </form>}
      {!data.templates.length?<p className="empty">아직 만든 업무가 없어요.</p>:<div className="list">{data.templates.map(t=><article key={t.id} className="task-row"><div className="task-row-head"><b>{t.title}</b><span className="badge">{jobName(t.jobId)}</span></div><p>{t.instructions}</p><p className="muted">{verificationKindNames[t.verificationKind]} · {t.status==='active'?'운영 중':'보관'}</p><button className="button quiet" onClick={()=>setEditing(t)}>수정</button></article>)}</div>}
    </section>}
    {view==='assign'&&<section className="panel section">
      <h3>업무 배정</h3>
      {!activeTemplates.length?<p className="empty">운영 중인 업무가 없어요.</p>:<form className="assignment-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>taskStore.assign(String(f.get('template')),String(f.get('student'))),'업무를 배정했습니다.')}}>
        <label>업무<select name="template" required>{activeTemplates.map(t=><option key={t.id} value={t.id}>{t.title} · {jobName(t.jobId)}</option>)}</select></label>
        <label>학생<select name="student" required><option value="">학생 선택</option>{students.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name} · {s.grade}학년</option>)}</select></label>
        <button className="button primary" disabled={busy}>배정</button>
      </form>}
      <p className="muted">해당 직업을 실제로 맡고 있는 학생만 배정할 수 있어요.</p>
      {data.tasks.length?<div className="list">{data.tasks.map(t=><article key={t.id} className="task-row"><div className="task-row-head"><b>{templateTitle(t.templateId)}</b><span>{studentName(t.assigneeStudentId)}</span></div><p className="muted">{taskStatusNames[t.status]}</p>{t.status==='approved'&&<button className="button quiet" disabled={busy} onClick={()=>run(()=>taskStore.restart(t),'다시 시작했습니다.')}>다시 시작</button>}</article>)}</div>:null}
    </section>}
    {view==='review'&&<section className="panel section">
      <div className="section-heading"><h3>제출 검토</h3><button className="button quiet" disabled={busy} onClick={purgeEvidence}>만료 사진 정리</button></div>
      {!submitted.length?<p className="empty">검토할 제출이 없어요.</p>:<div className="list">{submitted.map(t=><form key={t.id} className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),approve=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='approve';void run(()=>taskStore.review(t,approve,String(f.get('note'))),approve?'승인했습니다.':'다시 제출을 요청했습니다.')}}>
        <h4>{templateTitle(t.templateId)} · {studentName(t.assigneeStudentId)}</h4>
        {t.verificationKind==='photo'&&<ReviewPhoto taskStore={taskStore} taskId={t.id}/>}
        <p className="review-note">{t.submissionText}</p>
        <label>의견(다시 제출 요청 시 필수)<textarea name="note" maxLength={500} rows={2}/></label>
        <div className="header-actions"><button className="button primary" value="approve" disabled={busy}>승인</button><button className="button quiet" value="revise" disabled={busy}>다시 제출 요청</button></div>
      </form>)}</div>}
    </section>}
  </section>;
}

function ReviewPhoto({taskStore,taskId}:{taskStore:TaskStore;taskId:string}){
  const [evidence,setEvidence]=useState<Evidence|null|'loading'>('loading');
  useEffect(()=>{let alive=true;taskStore.getEvidence(taskId).then(e=>{if(alive)setEvidence(e)}).catch(()=>{if(alive)setEvidence(null)});return()=>{alive=false}},[taskStore,taskId]);
  if(evidence==='loading')return <p className="muted">사진을 불러오는 중…</p>;
  if(!evidence)return <p className="muted">사진을 찾을 수 없어요(만료되었을 수 있어요).</p>;
  return <img src={`data:${evidence.mimeType};base64,${evidence.payloadBase64}`} alt="제출된 사진" style={{maxWidth:'100%',borderRadius:12,margin:'8px 0'}}/>;
}
