import {useEffect,useRef,useState,type FormEvent} from 'react';
import {planBulkAssign,planBulkRestart,taskStatusNames,verificationKindNames,type Task,type TaskData,type TaskTemplate,type TaskSubmissionEntry,type VerificationKind} from '../../domain/tasks';
import type {Evidence} from '../../domain/evidence';
import type {Career} from '../../domain/jobs';
import {compareByGradeNumber,studentLabel,type Student} from '../../domain/model';
import type {TaskStore} from '../../data/taskRepository';
import type {CareerStore} from '../../data/careerRepository';
import {compressImageToBase64} from '../../ui/imageCompress';
import {taskPresets} from '../../domain/taskPresets';
import {amountUnit,formatMoney,toMajor,toMinor} from '../../domain/money';

export function TaskWorkspace({taskStore,careerStore,teacher,students,iconFilter,currencySymbol='마동'}:{taskStore:TaskStore;careerStore:CareerStore;teacher:boolean;students:Student[];studentId?:string;iconFilter?:string[];currencySymbol?:string}){
  const [data,setData]=useState<TaskData>({templates:[],tasks:[]});
  const [jobs,setJobs]=useState<Career[]>([]);
  const [assignments,setAssignments]=useState<{jobId:string;studentId:string;status:string}[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [view,setView]=useState<'templates'|'assign'|'review'>('templates');
  const [editing,setEditing]=useState<TaskTemplate|null>(null);
  const [formKey,setFormKey]=useState(0);
  const [submittingTask,setSubmittingTask]=useState<Task|null>(null);
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const mounted=useRef(true);

  async function loadAll(){
    const [t,c]=await Promise.all([taskStore.load(),careerStore.load()]);
    if(!mounted.current)return;
    setData(t);setJobs(c.jobs);setAssignments(c.assignments);
  }
  useEffect(()=>{mounted.current=true;setLoading(true);loadAll().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[taskStore,careerStore]);

  async function run(action:()=>Promise<void>,success:string){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await loadAll();if(mounted.current){setMessage(success);setEditing(null);setSubmittingTask(null);setPhotoFile(null)}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  // 여러 학생에게 한 번에(하나씩 순서대로 — 각 배정은 Rules가 따로 검사하는 트랜잭션). 일부가 실패해도 나머지는 계속한다.
  async function bulk(label:string,items:(()=>Promise<void>)[],skippedNote=''){
    if(busy)return;setBusy(true);setError('');setMessage('');
    let ok=0,failed=0;
    for(const item of items){try{await item();ok++}catch{failed++}}
    try{await loadAll()}catch{/* 목록 새로고침 실패는 무시 */}
    if(mounted.current){setMessage(`${label} ${ok}명 완료${failed?`, ${failed}명 실패`:''}${skippedNote}`);setBusy(false)}
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
  const templateReward=(id:string)=>data.templates.find(t=>t.id===id)?.rewardMinor??0;
  const jobName=(id:string)=>jobs.find(j=>j.id===id)?.name??id;
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  // A building on the student map scopes this to just its own jobs' tasks (StudentHome passes
  // iconFilter) — mirrors CareerWorkspace's iconFilter, using the jobs already loaded above.
  const scopedJobIds=iconFilter?new Set(jobs.filter(j=>iconFilter.includes(j.icon)).map(j=>j.id)):null;
  const myTasks=scopedJobIds?data.tasks.filter(t=>scopedJobIds.has(t.jobId)):data.tasks;

  if(loading)return <p role="status">업무를 불러오고 있어요.</p>;

  if(!teacher){
    return <section className="citizen-tasks">
      <h2>오늘의 업무</h2>
      {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
      {!myTasks.length?<p className="empty">{scopedJobIds?'이 건물에서 할 업무가 아직 없어요.':'아직 배정된 업무가 없어요.'}</p>:<div className="list">
        {myTasks.map(task=><article key={task.id} className="task-row">
          <div className="task-row-head"><b>{templateTitle(task.templateId)}</b><span className="badge">{taskStatusNames[task.status]}</span></div>
          {templateReward(task.templateId)>0&&<p className="reward-tag">🎁 완료 보상 +{formatMoney(templateReward(task.templateId),currencySymbol)} (선생님이 승인하면 바로 들어와요)</p>}
          {task.reviewNote&&<p className="review-note">선생님 의견: {task.reviewNote}</p>}
          {task.attempt>0&&<TaskSubmissionHistoryButton taskStore={taskStore} taskId={task.id}/>}
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
      {editing&&<form key={formKey} className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>taskStore.saveTemplate({...editing,jobId:String(f.get('job')),title:String(f.get('title')).trim(),instructions:String(f.get('instructions')).trim(),verificationKind:f.get('kind') as VerificationKind,status:f.get('status') as TaskTemplate['status'],rewardMinor:toMinor(Number(f.get('reward'))||0)}),'업무를 저장했습니다.')}}>
        <label>소속 직업<select name="job" defaultValue={editing.jobId} required onChange={e=>setEditing({...editing,jobId:e.target.value})}>{jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
        {(()=>{const icon=jobs.find(j=>j.id===editing.jobId)?.icon,presets=icon?taskPresets[icon]??[]:[];return presets.length>0&&<div className="preset-box"><span className="muted">추천 업무에서 골라 채우기:</span>{presets.map(p=><button key={p.title} type="button" className="button quiet small" onClick={()=>{setEditing({...editing,title:p.title,instructions:p.instructions,verificationKind:p.kind,rewardMinor:toMinor(p.reward)});setFormKey(k=>k+1)}}>{p.title}</button>)}</div>})()}
        <label>업무 제목<input autoFocus name="title" defaultValue={editing.title} required maxLength={60}/></label>
        <label>안내 내용<textarea name="instructions" defaultValue={editing.instructions} required maxLength={1000} rows={3}/></label>
        <label>인증 방식<select name="kind" defaultValue={editing.verificationKind}><option value="artifact">{verificationKindNames.artifact}</option><option value="photo">{verificationKindNames.photo}</option></select></label>
        <label>운영 상태<select name="status" defaultValue={editing.status}><option value="active">운영 중</option><option value="archived">보관</option></select></label>
        <label>완료 보상({amountUnit(currencySymbol)}, 승인하는 순간 학생 계좌로 바로 지급 · 0이면 없음)<input name="reward" type="number" min={0} max={1000} step={1} defaultValue={toMajor(editing.rewardMinor??0)}/></label>
        <p className="muted">자동 인증(도서 대여 등 실제 이벤트 연동)은 다음 단계에서 추가됩니다.</p>
        <div className="header-actions"><button className="button primary" disabled={busy}>저장</button><button type="button" className="button quiet" onClick={()=>setEditing(null)}>취소</button></div>
      </form>}
      {!data.templates.length?<p className="empty">아직 만든 업무가 없어요.</p>:<div className="list">{data.templates.map(t=><article key={t.id} className="task-row"><div className="task-row-head"><b>{t.title}</b><span className="badge">{jobName(t.jobId)}</span></div><p>{t.instructions}</p><p className="muted">{verificationKindNames[t.verificationKind]} · {t.status==='active'?'운영 중':'보관'}{(t.rewardMinor??0)>0?` · 완료 보상 ${formatMoney(t.rewardMinor!,currencySymbol)}`:''}</p><button className="button quiet" onClick={()=>setEditing(t)}>수정</button></article>)}</div>}
    </section>}
    {view==='assign'&&<section className="panel section">
      <h3>업무 배정</h3>
      {!activeTemplates.length?<p className="empty">운영 중인 업무가 없어요.</p>:<form className="assignment-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>taskStore.assign(String(f.get('template')),String(f.get('student'))),'업무를 배정했습니다.')}}>
        <label>업무<select name="template" required>{activeTemplates.map(t=><option key={t.id} value={t.id}>{t.title} · {jobName(t.jobId)}</option>)}</select></label>
        <label>학생<select name="student" required><option value="">학생 선택</option>{students.filter(s=>s.status==='active').sort(compareByGradeNumber).map(s=><option key={s.id} value={s.id}>{studentLabel(s)}</option>)}</select></label>
        <button className="button primary" disabled={busy}>배정</button>
      </form>}
      {activeTemplates.length>0&&<div className="bulk-box">
        <h4>한꺼번에 하기</h4>
        <form className="assignment-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const t=activeTemplates.find(x=>x.id===String(new FormData(e.currentTarget).get('template')));if(!t)return;
          const plan=planBulkAssign(t,assignments,data.tasks);
          if(!plan.toAssign.length){setError(plan.alreadyInProgress?`이 직업을 맡은 학생 ${plan.alreadyInProgress}명 모두 이미 이 업무를 하고 있어요.`:'이 직업을 맡은 학생이 아직 없어요.');return}
          void bulk('업무 배정',plan.toAssign.map(id=>()=>taskStore.assign(t.id,id)),plan.alreadyInProgress?` (이미 진행 중 ${plan.alreadyInProgress}명은 건너뜀)`:'')}}>
          <label>업무<select name="template" required>{activeTemplates.map(t=><option key={t.id} value={t.id}>{t.title} · {jobName(t.jobId)} 맡은 학생 {assignments.filter(a=>a.status==='active'&&a.jobId===t.jobId).length}명</option>)}</select></label>
          <button className="button primary" disabled={busy}>이 직업을 맡은 학생 모두에게 배정</button>
        </form>
        <form className="assignment-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const templateId=String(new FormData(e.currentTarget).get('template'))||undefined;
          const targets=planBulkRestart(data.tasks,templateId);
          if(!targets.length){setError('다시 시작할 완료 업무가 없어요.');return}
          void bulk('업무 다시 시작',targets.map(t=>()=>taskStore.restart(t)))}}>
          <label>완료된 업무<select name="template" defaultValue=""><option value="">모든 업무</option>{activeTemplates.map(t=><option key={t.id} value={t.id}>{t.title} · 완료 {data.tasks.filter(x=>x.templateId===t.id&&x.status==='approved').length}건</option>)}</select></label>
          <button className="button secondary" disabled={busy}>완료된 업무 모두 다시 시작</button>
        </form>
        <p className="muted">매일·매주 반복하는 업무는 "다시 시작"으로 새 차례를 열어 주세요. 학생은 다시 제출하고, 승인되면 완료 보상을 또 받아요.</p>
      </div>}
      <p className="muted">해당 직업을 실제로 맡고 있는 학생만 배정할 수 있어요.</p>
      {data.tasks.length?<div className="list">{data.tasks.map(t=><article key={t.id} className="task-row"><div className="task-row-head"><b>{templateTitle(t.templateId)}</b><span>{studentName(t.assigneeStudentId)}</span></div><p className="muted">{taskStatusNames[t.status]}</p>{t.status==='approved'&&<button className="button quiet" disabled={busy} onClick={()=>run(()=>taskStore.restart(t),'다시 시작했습니다.')}>다시 시작</button>}</article>)}</div>:null}
    </section>}
    {view==='review'&&<section className="panel section">
      <div className="section-heading"><h3>제출 검토</h3><button className="button quiet" disabled={busy} onClick={purgeEvidence}>만료 사진 정리</button></div>
      {!submitted.length?<p className="empty">검토할 제출이 없어요.</p>:<div className="list">{submitted.map(t=><form key={t.id} className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),approve=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='approve';void run(()=>taskStore.review(t,approve,String(f.get('note'))),approve?'승인했습니다.':'다시 제출을 요청했습니다.')}}>
        <h4>{templateTitle(t.templateId)} · {studentName(t.assigneeStudentId)}</h4>
        {t.verificationKind==='photo'&&<ReviewPhoto taskStore={taskStore} taskId={t.id}/>}
        <p className="review-note">{t.submissionText}</p>
        {t.attempt>1&&<TaskSubmissionHistoryButton taskStore={taskStore} taskId={t.id}/>}
        <label>의견(다시 제출 요청 시 필수)<textarea name="note" maxLength={500} rows={2}/></label>
        <div className="header-actions"><button className="button primary" value="approve" disabled={busy}>승인</button><button className="button quiet" value="revise" disabled={busy}>다시 제출 요청</button></div>
      </form>)}</div>}
    </section>}
  </section>;
}

function TaskSubmissionHistoryButton({taskStore,taskId}:{taskStore:TaskStore;taskId:string}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[entries,setEntries]=useState<TaskSubmissionEntry[]|null>(null);
  async function toggle(){
    if(open){setOpen(false);return}
    setOpen(true);
    if(entries)return;
    setBusy(true);
    try{setEntries(await taskStore.submissionHistory(taskId))}catch{setEntries([])}
    finally{setBusy(false)}
  }
  return <span className="history-toggle"><button type="button" className="button quiet" onClick={toggle}>{open?'이전 제출 이력 닫기':'이전 제출 이력'}</button>
    {open&&(busy?<p className="muted">불러오는 중…</p>:entries&&entries.length?<ul className="history-list">{entries.map(e=><li key={e.id}>{e.attempt}차 제출({new Date(e.submittedAt).toLocaleString('ko-KR')}): {e.submissionText}</li>)}</ul>:<p className="muted">이전 제출 기록이 없어요.</p>)}
  </span>;
}
function ReviewPhoto({taskStore,taskId}:{taskStore:TaskStore;taskId:string}){
  const [evidence,setEvidence]=useState<Evidence|null|'loading'>('loading');
  useEffect(()=>{let alive=true;taskStore.getEvidence(taskId).then(e=>{if(alive)setEvidence(e)}).catch(()=>{if(alive)setEvidence(null)});return()=>{alive=false}},[taskStore,taskId]);
  if(evidence==='loading')return <p className="muted">사진을 불러오는 중…</p>;
  if(!evidence)return <p className="muted">사진을 찾을 수 없어요(만료되었을 수 있어요).</p>;
  return <img src={`data:${evidence.mimeType};base64,${evidence.payloadBase64}`} alt="제출된 사진" style={{maxWidth:'100%',borderRadius:12,margin:'8px 0'}}/>;
}
