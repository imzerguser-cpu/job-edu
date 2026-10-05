import {useEffect,useState,type FormEvent} from 'react';
import {compareByGradeNumber,studentLabel,type Student} from '../../domain/model';
import type {AvatarResetRequest,AvatarResetStore} from '../../data/avatarResetRepository';

// 학생: 남학생/여학생을 잘못 골랐을 때 선생님께 다시 고르기를 요청한다(D-127).
export function StudentGenderRequest({store}:{store:AvatarResetStore}){
  const [req,setReq]=useState<AvatarResetRequest|null|undefined>(undefined),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{store.myRequest().then(setReq).catch(()=>setReq(null))},[store]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const reason=String(new FormData(e.currentTarget).get('reason')||'');
    setBusy(true);setError('');
    try{await store.request(reason);setReq(await store.myRequest());setOpen(false)}catch(err){setError((err as Error).message)}finally{setBusy(false)}
  }
  if(req===undefined)return null;
  return <section className="gender-request">
    <h3>👦👧 남학생/여학생을 잘못 골랐나요?</h3>
    {req?.status==='pending'?<p className="muted">선생님께 다시 고르기를 요청했어요. 선생님이 허용하면 다음에 들어올 때 다시 고를 수 있어요.</p>
      :req?.status==='approved'?<p className="success">선생님이 허용했어요! 다시 로그인하면 캐릭터를 처음부터 다시 만들 수 있어요.</p>
      :<>
        {req?.status==='rejected'&&<p className="review-note">지난 요청은 허용되지 않았어요{req.note?`: ${req.note}`:'.'}</p>}
        {!open?<button type="button" className="button quiet small" onClick={()=>setOpen(true)}>선생님께 다시 고르기 요청하기</button>
          :<form className="inline-form" onSubmit={submit}><input name="reason" required maxLength={200} placeholder="왜 바꾸고 싶은지 적어 주세요" autoFocus/><button className="button primary small" disabled={busy}>요청 보내기</button><button type="button" className="button quiet small" onClick={()=>setOpen(false)}>취소</button></form>}
        {error&&<p role="alert" className="error">{error}</p>}
      </>}
  </section>;
}

// 교사: 요청을 허용·거절하고, 요청이 없어도 학생을 골라 바로 다시 고르게 할 수 있다(D-127).
export function TeacherGenderResets({store,students}:{store:AvatarResetStore;students:Student[]}){
  const [list,setList]=useState<AvatarResetRequest[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=()=>store.pending().then(setList).catch(e=>{setList([]);setError((e as Error).message)});
  useEffect(()=>{void load()},[store]);
  const student=(id:string)=>students.find(s=>s.id===id);
  async function run(action:()=>Promise<void>,ok:string){
    setBusy(true);setError('');setMessage('');
    try{await action();setMessage(ok);await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <section className="panel">
    <div className="section-heading"><div><h2>👦👧 캐릭터 남학생/여학생 다시 고르기</h2><p className="muted">학생은 남/여를 한 번만 고를 수 있어요. 허용하면 그 학생의 남/여 선택만 지워지고, 다음 로그인 때 캐릭터 만들기가 다시 나옵니다. 산 아이템과 잔액은 그대로입니다.</p></div></div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    <h3>학생 요청 {list?`${list.length}건`:''}</h3>
    {!list?<p role="status">불러오는 중…</p>:!list.length?<p className="empty">기다리는 요청이 없어요.</p>:<div className="list">{list.map(r=>{const s=student(r.studentId);return <article key={r.studentId} className="task-row">
      <div className="task-row-head"><b>{s?studentLabel(s):'현재 명단 밖의 시민'}</b><span className="badge">대기 중</span></div>
      <p>{r.reason}</p>
      <form className="inline-form" onSubmit={e=>{e.preventDefault();const note=String(new FormData(e.currentTarget).get('note')||'');void run(()=>store.reject(r.studentId,note),'요청을 거절했습니다.')}}>
        <button type="button" className="button primary small" disabled={busy} onClick={()=>run(()=>store.approve(r.studentId),'허용했습니다. 학생이 다시 로그인하면 남/여를 다시 고를 수 있어요.')}>허용</button>
        <input name="note" maxLength={200} placeholder="거절 이유(선택)"/><button className="button quiet small" disabled={busy}>거절</button>
      </form>
    </article>})}</div>}
    <h3 className="section">요청 없이 바로 다시 고르게 하기</h3>
    <form className="assignment-form" onSubmit={e=>{e.preventDefault();const id=String(new FormData(e.currentTarget).get('student')||'');if(id)void run(()=>store.resetNow(id),'되돌렸습니다. 학생이 다시 로그인하면 남/여를 다시 고를 수 있어요.')}}>
      <label>학생<select name="student" required defaultValue=""><option value="" disabled>학생 선택</option>{students.filter(s=>s.status==='active').sort(compareByGradeNumber).map(s=><option key={s.id} value={s.id}>{studentLabel(s)}</option>)}</select></label>
      <button className="button secondary" disabled={busy}>다시 고르게 하기</button>
    </form>
  </section>;
}
