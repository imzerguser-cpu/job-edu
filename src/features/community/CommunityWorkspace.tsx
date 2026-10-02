import {useEffect,useState,type FormEvent} from 'react';
import {goalMetrics,goalProgress,helpStatusNames,praiseCategories,type ClassGoal,type GoalMetric,type HelpRequest,type Praise,type PraiseCategory} from '../../domain/community';
import {amountUnit,formatMoney,toMinor} from '../../domain/money';
import type {Student} from '../../domain/model';
import type {CommunityStore} from '../../data/communityRepository';

function useAction(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function run(action:()=>Promise<void>,success:string,after?:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();setMessage(success);await after?.()}
    catch(e){setError((e as {code?:string}).code==='permission-denied'?'지금은 할 수 없는 일이에요. 새로고침 후 다시 해 주세요.':(e as Error).message)}
    finally{setBusy(false)}
  }
  return {busy,error,message,run,feedback:<>{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}</>};
}

// ── 도움 요청 게시판 ──
export function HelpBoard({store,students,studentId,currencySymbol}:{store:CommunityStore;students:Student[];studentId?:string;currencySymbol:string}){
  const [list,setList]=useState<HelpRequest[]|null>(null),[writing,setWriting]=useState(false),[doneFor,setDoneFor]=useState<string|null>(null);
  const [filter,setFilter]=useState<'open'|'mine'|'all'>('open');
  const {busy,run,feedback}=useAction();
  const load=async()=>setList(await store.listHelp());
  useEffect(()=>{load().catch(()=>setList([]))},[store]);
  const name=(id:string|null)=>id?students.find(s=>s.id===id)?.name??'친구':'-';
  const teacher=!studentId;
  const shown=(list??[]).filter(r=>filter==='all'||teacher?true:filter==='open'?r.status==='open':(r.requesterStudentId===studentId||r.helperStudentId===studentId));
  async function post(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    await run(()=>store.postHelp(String(f.get('title')),String(f.get('description')),toMinor(Number(f.get('reward'))||0)),'부탁을 올렸어요! 친구가 맡아 주길 기다려요.',async()=>{setWriting(false);await load()});
  }
  return <section className="community">
    <div className="section-heading"><div><h2>🤝 도움 게시판</h2><p className="muted">{teacher?'학생들의 부탁과 도움 현황입니다. 문제가 있는 부탁은 취소하면 보상이 요청자에게 돌아갑니다.':'도움이 필요하면 부탁을 올리고, 친구의 부탁을 해결하면 보상과 경험치를 받아요. 보상은 올릴 때 은행에 맡겨 두었다가 도와준 친구에게 전해져요.'}</p></div>
      {!teacher&&<button type="button" className="button primary" onClick={()=>setWriting(!writing)}>{writing?'닫기':'+ 부탁 올리기'}</button>}</div>
    {feedback}
    {writing&&<form className="panel action-form" onSubmit={post}>
      <label>무엇을 도와주면 좋을까요?<input name="title" required maxLength={60} placeholder="예: 게시판 꾸미기 같이 해 줄 친구!" autoFocus/></label>
      <label>자세한 설명(선택)<textarea name="description" maxLength={500} rows={2}/></label>
      <label>고마움의 보상({amountUnit(currencySymbol)}, 0이면 보상 없이 부탁)<input name="reward" type="number" min={0} max={1000} step={1} defaultValue={0}/></label>
      <div className="header-actions"><button className="button primary" disabled={busy}>올리기</button></div>
    </form>}
    {!teacher&&<nav className="workspace-tabs" aria-label="도움 게시판 보기">{([['open','도와줄 수 있는 부탁'],['mine','나와 관련된 부탁'],['all','전체']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</nav>}
    {!list?<p role="status">불러오는 중…</p>:!shown.length?<p className="empty">{filter==='open'?'지금 도움을 기다리는 부탁이 없어요.':'부탁이 없어요.'}</p>:<div className="list">{shown.map(r=>{
      const mineReq=r.requesterStudentId===studentId,mineHelp=r.helperStudentId===studentId;
      return <article key={r.id} className={`help-card help-${r.status}`}>
        <div className="task-row-head"><b>{r.title}</b><span className="badge">{helpStatusNames[r.status]}</span></div>
        {r.description&&<p>{r.description}</p>}
        <p className="muted">부탁한 친구: {name(r.requesterStudentId)} · 보상 {r.rewardMinor?formatMoney(r.rewardMinor,currencySymbol):'없음(마음으로!)'}{r.helperStudentId?` · 돕는 친구: ${name(r.helperStudentId)}`:''}</p>
        {r.doneNote&&<p className="review-note">어떻게 도왔나요: {r.doneNote}</p>}
        <div className="header-actions">
          {!teacher&&r.status==='open'&&!mineReq&&<button className="button primary small" disabled={busy} onClick={()=>run(()=>store.acceptHelp(r.id),'부탁을 맡았어요! 다 하면 "해냈어요"를 눌러요.',load)}>내가 도와줄게요</button>}
          {mineReq&&r.status==='open'&&<button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.cancelHelp(r.id),'부탁을 취소했어요. 맡긴 보상은 돌려받았어요.',load)}>부탁 취소</button>}
          {mineHelp&&r.status==='accepted'&&(doneFor===r.id
            ?<form className="inline-form" onSubmit={e=>{e.preventDefault();const note=String(new FormData(e.currentTarget).get('note'));void run(()=>store.markHelpDone(r.id,note),'친구에게 확인을 부탁했어요.',async()=>{setDoneFor(null);await load()})}}><input name="note" required maxLength={500} placeholder="어떻게 도왔는지 적어요" autoFocus/><button className="button primary small" disabled={busy}>보내기</button></form>
            :<><button className="button primary small" onClick={()=>setDoneFor(r.id)}>해냈어요!</button><button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.giveUpHelp(r.id),'부탁을 다른 친구에게 넘겼어요.',load)}>그만두기</button></>)}
          {mineReq&&r.status==='done'&&<><button className="button primary small" disabled={busy} onClick={()=>run(()=>store.confirmHelp(r.id),'고마움을 전했어요!',load)}>고마워요, 확인!</button><button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.sendBackHelp(r.id),'조금 더 부탁했어요.',load)}>아직 덜 됐어요</button></>}
          {mineHelp&&r.status==='confirmed'&&<button className="button primary small" disabled={busy} onClick={()=>run(()=>store.claimHelpReward(r.id),'보상을 받았어요! 은행에서 확인해 봐요.',load)}>🎁 보상 받기</button>}
          {teacher&&['open','accepted','done'].includes(r.status)&&<button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.cancelHelp(r.id),'부탁을 취소하고 보상을 돌려주었습니다.',load)}>취소(환불)</button>}
        </div>
      </article>})}</div>}
  </section>;
}

// ── 칭찬 나무 ──
export function PraiseTree({store,students,studentId}:{store:CommunityStore;students:Student[];studentId?:string}){
  const [list,setList]=useState<Praise[]|null>(null);
  const {busy,run,feedback}=useAction();
  const load=async()=>setList(await store.listPraises());
  useEffect(()=>{load().catch(()=>setList([]))},[store]);
  const name=(id:string)=>students.find(s=>s.id===id)?.name??'친구';
  const teacher=!studentId;
  const received=(list??[]).filter(p=>p.toStudentId===studentId).length;
  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget,f=new FormData(form);
    await run(()=>store.sendPraise(String(f.get('to')),String(f.get('category')) as PraiseCategory,String(f.get('message'))),'칭찬 스티커를 보냈어요! 🌟',async()=>{form.reset();await load()});
  }
  return <section className="community">
    <div className="section-heading"><div><h2>🌟 칭찬 나무</h2><p className="muted">{teacher?'학생들이 주고받은 칭찬입니다. 부적절한 글은 삭제할 수 있습니다.':`친구의 좋은 모습을 칭찬해요. 같은 친구에게는 하루에 한 번 보낼 수 있고, 받은 친구는 경험치를 얻어요.${studentId?` 내가 받은 칭찬: ${received}개`:''}`}</p></div></div>
    {feedback}
    {!teacher&&<form className="panel action-form praise-form" onSubmit={send}>
      <div className="fields"><label>누구에게?<select name="to" required defaultValue=""><option value="" disabled>친구 고르기</option>{students.filter(s=>s.id!==studentId&&s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>어떤 칭찬?<select name="category" defaultValue="help">{Object.entries(praiseCategories).map(([id,c])=><option key={id} value={id}>{c.icon} {c.name}</option>)}</select></label></div>
      <label>칭찬 한마디<input name="message" required maxLength={100} placeholder="예: 모둠 활동 때 내 말을 잘 들어줘서 고마워!"/></label>
      <div className="header-actions"><button className="button primary" disabled={busy}>칭찬 스티커 보내기</button></div>
    </form>}
    {!list?<p role="status">불러오는 중…</p>:!list.length?<p className="empty">아직 칭찬이 없어요. 첫 칭찬을 보내 볼까요?</p>:<div className="praise-grid">{list.map(p=><article key={p.id} className={`praise-leaf${p.toStudentId===studentId?' mine':''}`}>
      <span className="praise-icon" aria-hidden="true">{praiseCategories[p.category]?.icon??'🌟'}</span>
      <div><b>{name(p.fromStudentId)} → {name(p.toStudentId)}</b><small>{praiseCategories[p.category]?.name}</small><p>{p.message}</p></div>
      {teacher&&<button type="button" className="button quiet small" disabled={busy} onClick={()=>run(()=>store.deletePraise(p.id),'칭찬을 삭제했습니다.',load)}>삭제</button>}
    </article>)}</div>}
  </section>;
}

// ── 학급 공동 목표(지도 위 배너) ──
export function ClassGoalsBanner({store}:{store:CommunityStore}){
  const [goals,setGoals]=useState<ClassGoal[]>([]);
  useEffect(()=>{store.listGoals().then(g=>setGoals(g.filter(x=>x.status!=='archived'))).catch(()=>setGoals([]))},[store]);
  if(!goals.length)return <p role="status">아직 표시할 공동 목표가 없어요.</p>;
  return <section className="goal-banner" aria-label="우리 반 공동 목표">
    <h2>🏁 우리 반 공동 목표</h2>
    <div className="goal-list">{goals.map(g=><div key={g.id} className={`goal-item${g.status==='achieved'?' achieved':''}`}>
      <div className="task-row-head"><b>{g.status==='achieved'?'🎉 ':''}{g.title}</b><span>{Math.min(g.progress,g.target).toLocaleString()} / {g.target.toLocaleString()}</span></div>
      <div className="xp-bar"><span style={{width:`${Math.round(goalProgress(g)*100)}%`}}/></div>
      <small className="muted">{goalMetrics[g.metric]}{g.rewardText?` · 달성하면: ${g.rewardText}`:''}{g.status==='achieved'?' · 달성했어요!':''}</small>
    </div>)}</div>
  </section>;
}

function TeacherGoals({store}:{store:CommunityStore}){
  const [goals,setGoals]=useState<ClassGoal[]|null>(null);
  const {busy,run,feedback}=useAction();
  const load=async()=>setGoals(await store.listGoals());
  useEffect(()=>{load().catch(()=>setGoals([]))},[store]);
  async function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget,f=new FormData(form);
    await run(()=>store.createGoal({title:String(f.get('title')),metric:String(f.get('metric')) as GoalMetric,target:Number(f.get('target')),rewardText:String(f.get('reward')||'')}),'공동 목표를 만들었습니다. 지금부터 쌓이는 기록만 셉니다.',async()=>{form.reset();await load()});
  }
  return <section className="community">
    <div className="section-heading"><div><h2>🏁 학급 공동 목표</h2><p className="muted">반 전체가 함께 이루는 목표입니다. 학생 지도 화면 위에 진행도가 보입니다. 달성 보상은 공동기금 지출(은행)로 실행할 수 있습니다.</p></div>
      <button type="button" className="button secondary" disabled={busy} onClick={()=>run(()=>store.refreshGoals(),'진행도를 새로 계산했습니다.',load)}>진행도 새로 계산</button></div>
    {feedback}
    <form className="panel action-form" onSubmit={create}>
      <div className="fields"><label>목표 이름<input name="title" required maxLength={60} placeholder="예: 이번 달 칭찬 스티커 50개 모으기"/></label>
        <label>무엇을 셀까요?<select name="metric" defaultValue="praises">{Object.entries(goalMetrics).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label></div>
      <div className="fields"><label>목표 숫자<input name="target" type="number" min={1} max={100000} required defaultValue={50}/></label>
        <label>달성 보상(선택)<input name="reward" maxLength={100} placeholder="예: 공동기금으로 간식 파티"/></label></div>
      <div className="header-actions"><button className="button primary" disabled={busy}>목표 만들기</button></div>
    </form>
    {!goals?<p role="status">불러오는 중…</p>:!goals.length?<p className="empty">아직 공동 목표가 없어요.</p>:<div className="list section">{goals.map(g=><article key={g.id} className="task-row">
      <div className="task-row-head"><b>{g.title}</b><span className="badge">{g.status==='achieved'?'달성':g.status==='archived'?'보관':'진행 중'}</span></div>
      <div className="xp-bar"><span style={{width:`${Math.round(goalProgress(g)*100)}%`}}/></div>
      <p className="muted">{goalMetrics[g.metric]} · {g.progress}/{g.target}{g.rewardText?` · 보상: ${g.rewardText}`:''}</p>
      <div className="header-actions">
        {g.metric==='manual'&&g.status!=='archived'&&<form className="inline-form" onSubmit={e=>{e.preventDefault();const v=Number(new FormData(e.currentTarget).get('progress'));void run(()=>store.setManualProgress(g,v),'진행도를 바꿨습니다.',load)}}><input name="progress" type="number" min={0} defaultValue={g.progress}/><button className="button quiet small" disabled={busy}>진행도 저장</button></form>}
        {g.status!=='archived'?<button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.setGoalStatus(g,'archived'),'목표를 보관했습니다.',load)}>보관</button>
          :<button className="button quiet small" disabled={busy} onClick={()=>run(()=>store.setGoalStatus(g,g.progress>=g.target?'achieved':'active'),'목표를 다시 열었습니다.',load)}>다시 열기</button>}
      </div>
    </article>)}</div>}
  </section>;
}

// 교사 운영실의 "함께하는 마을" 섹션: 공동 목표 / 도움 게시판 / 칭찬 나무.
export function TeacherCommunity({store,students,currencySymbol}:{store:CommunityStore;students:Student[];currencySymbol:string}){
  const [tab,setTab]=useState<'goals'|'help'|'praise'>('goals');
  return <section className="panel">
    <div className="section-heading"><h2>함께하는 마을</h2></div>
    <nav className="workspace-tabs" aria-label="함께하는 마을 메뉴">{([['goals','공동 목표'],['help','도움 게시판'],['praise','칭찬 나무']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    {tab==='goals'?<TeacherGoals store={store}/>:tab==='help'?<HelpBoard store={store} students={students} currencySymbol={currencySymbol}/>:<PraiseTree store={store} students={students}/>}
  </section>;
}
