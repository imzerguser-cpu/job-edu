import {useEffect,useRef,useState,type FormEvent} from 'react';
import {departments,jobIcons,iconNames} from '../../domain/jobs';
import {formatMoney,toMajor,toMinor} from '../../domain/money';
import {
  canClose,canDecide,canVote,passedVote,proposalStatusNames,proposalTypeNames,
  type BusinessProposalFields,type JobProposalFields,type Proposal,type ProposalComment,type ProposalType,type SimpleProposalFields,
} from '../../domain/proposals';
import type {Student} from '../../domain/model';
import type {ProposalStore,JobDecisionExtra,BusinessDecisionExtra} from '../../data/proposalRepository';

type AnyFields=JobProposalFields|BusinessProposalFields|SimpleProposalFields;
const simpleTypes:ProposalType[]=['rule','event','community'];

export function CivicWorkspace({store,teacher,students,studentId}:{store:ProposalStore;teacher:boolean;students:Student[];studentId?:string}){
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [myVotes,setMyVotes]=useState<Record<string,'yes'|'no'|null>>({});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [composing,setComposing]=useState<ProposalType|null>(null);
  const [editingDraft,setEditingDraft]=useState<Proposal|null>(null);
  const [openingVote,setOpeningVote]=useState<Proposal|null>(null);
  const [deciding,setDeciding]=useState<Proposal|null>(null);
  const mounted=useRef(true);

  async function load(){
    const list=await store.loadProposals();
    if(!mounted.current)return;
    setProposals(list);
    if(!teacher){
      const votes=await Promise.all(list.filter(p=>p.status==='voting'||p.status==='closed'||p.status==='approved'||p.status==='rejected').map(p=>store.myVote(p.id).then(v=>[p.id,v] as const)));
      if(mounted.current)setMyVotes(Object.fromEntries(votes));
    }
  }
  useEffect(()=>{mounted.current=true;setLoading(true);load().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[store,teacher]);

  async function run(action:()=>Promise<void>,success:string){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await load();if(mounted.current){setMessage(success);setComposing(null);setEditingDraft(null);setOpeningVote(null);setDeciding(null)}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  const activeStudentCount=students.filter(s=>s.status==='active').length;

  if(loading)return <p role="status">시민광장을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>시민광장</h2>{!teacher&&<div className="header-actions">
      <button className="button quiet" onClick={()=>setComposing('job')}>+ 직업 제안</button>
      <button className="button quiet" onClick={()=>setComposing('business')}>+ 사업 제안</button>
      <button className="button quiet" onClick={()=>setComposing('rule')}>+ 규칙 제안</button>
      <button className="button quiet" onClick={()=>setComposing('event')}>+ 행사 제안</button>
      <button className="button quiet" onClick={()=>setComposing('community')}>+ 학교 개선 제안</button>
    </div>}</div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    {composing&&<ProposalForm type={composing} busy={busy} onCancel={()=>setComposing(null)}
      onSubmit={fields=>run(()=>store.submit(composing,fields),'제안을 올렸습니다. 선생님의 검토를 기다려 주세요.')}
      onSaveDraft={fields=>run(async()=>{await store.saveDraft(composing,fields)},'초안을 저장했습니다.')}/>}
    {editingDraft&&<ProposalForm type={editingDraft.type} initial={editingDraft.fields} busy={busy} onCancel={()=>setEditingDraft(null)}
      onSubmit={fields=>run(async()=>{await store.updateDraft(editingDraft.id,fields);await store.submitDraft(editingDraft.id)},'제안을 제출했습니다.')}
      onSaveDraft={fields=>run(()=>store.updateDraft(editingDraft.id,fields),'초안을 저장했습니다.')}/>}
    {!proposals.length?<p className="empty">아직 올라온 제안이 없어요.</p>:<div className="list">
      {proposals.map(p=>{
        const title=p.type==='job'?(p.fields as JobProposalFields).title:p.type==='business'?(p.fields as BusinessProposalFields).name:(p.fields as SimpleProposalFields).title;
        const isAuthor=studentId===p.authorStudentId;
        const myVote=myVotes[p.id];
        return <article key={p.id} className="task-row">
          <div className="task-row-head"><b>{proposalTypeNames[p.type]} · {title}</b><span className="badge">{proposalStatusNames[p.status]}</span></div>
          <p className="muted">제안자: {isAuthor?'나':studentName(p.authorStudentId)}</p>
          <ProposalDetails proposal={p}/>
          {(p.status==='closed'||p.status==='approved'||p.status==='rejected')&&<p className="muted">찬성 {p.tallyYes} · 반대 {p.tallyNo} · 참여 {p.tallyTotal}명{p.status==='closed'&&teacher&&<> · 통과 기준 {passedVote(p,activeStudentCount)?'충족':'미충족'}</>}</p>}
          {p.decisionNote&&<p className="review-note">선생님 의견: {p.decisionNote}</p>}

          {!teacher&&isAuthor&&p.status==='draft'&&<div className="header-actions">
            <button className="button quiet" onClick={()=>setEditingDraft(p)}>수정</button>
            <button className="button primary" disabled={busy} onClick={()=>run(()=>store.submitDraft(p.id),'제안을 제출했습니다.')}>제출하기</button>
          </div>}

          {!teacher&&p.status==='voting'&&(canVote(p)?(myVote?<p className="muted">투표 완료: {myVote==='yes'?'찬성':'반대'}</p>
            :<div className="header-actions"><button className="button primary" disabled={busy} onClick={()=>run(()=>store.castVote(p.id,'yes'),'찬성으로 투표했습니다.')}>찬성</button><button className="button quiet" disabled={busy} onClick={()=>run(()=>store.castVote(p.id,'no'),'반대로 투표했습니다.')}>반대</button></div>)
            :<p className="muted">투표가 마감되었어요.</p>)}

          {teacher&&p.status==='submitted'&&(openingVote?.id===p.id
            ?<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.openVoting(p,Number(f.get('days')),Number(f.get('minPart')),Number(f.get('threshold'))),'투표를 시작했습니다.')}}>
              <label>마감까지(일)<input name="days" type="number" min={1} max={60} defaultValue={7} required/></label>
              <label>최소 참여율(%)<input name="minPart" type="number" min={0} max={100} defaultValue={50} required/></label>
              <label>찬성 기준(%)<input name="threshold" type="number" min={0} max={100} defaultValue={50} required/></label>
              <div className="header-actions"><button className="button primary" disabled={busy}>투표 시작</button><button type="button" className="button quiet" onClick={()=>setOpeningVote(null)}>취소</button></div>
            </form>
            :<button className="button primary" onClick={()=>setOpeningVote(p)}>투표 시작</button>)}

          {teacher&&p.status==='voting'&&<button className="button quiet" disabled={busy||!canClose(p)} onClick={()=>run(()=>store.tallyVotes(p),'투표를 집계했습니다.')}>{canClose(p)?'마감 및 집계':'마감 전'}</button>}

          {teacher&&canDecide(p)&&(deciding?.id===p.id
            ?<DecisionForm proposal={p} students={students} busy={busy} onCancel={()=>setDeciding(null)}
                onDecide={(approve,note,extra)=>run(()=>store.decide(p,approve,note,extra),approve?'제안을 승인했습니다.':'제안을 반려했습니다.')}/>
            :<div className="header-actions"><button className="button primary" onClick={()=>setDeciding(p)}>승인 검토</button></div>)}

          {p.status!=='draft'&&<ProposalComments store={store} proposalId={p.id}/>}
        </article>;
      })}
    </div>}
  </section>;
}

function ProposalDetails({proposal}:{proposal:Proposal}){
  if(proposal.type==='job'){
    const f=proposal.fields as JobProposalFields;
    return <div className="muted"><p>{f.purpose}</p><p>업무: {f.tasks}</p><p>예상 급여: {formatMoney(f.suggestedSalaryMinor)}</p></div>;
  }
  if(proposal.type==='business'){
    const f=proposal.fields as BusinessProposalFields;
    return <div className="muted"><p>{f.product}</p><p>고객: {f.customers} · 가격: {f.price}</p></div>;
  }
  const f=proposal.fields as SimpleProposalFields;
  return <div className="muted"><p>{f.description}</p><p>이유: {f.reason}</p></div>;
}

function ProposalForm({type,initial,busy,onCancel,onSubmit,onSaveDraft}:{type:ProposalType;initial?:AnyFields;busy:boolean;onCancel:()=>void;onSubmit:(fields:AnyFields)=>void;onSaveDraft:(fields:AnyFields)=>void}){
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const asDraft=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='draft';
    let fields:AnyFields;
    if(type==='job')fields={title:String(f.get('title')).trim(),purpose:String(f.get('purpose')).trim(),tasks:String(f.get('tasks')).trim(),beneficiary:String(f.get('beneficiary')).trim(),suggestedSalaryMinor:toMinor(Number(f.get('salary'))||0),tools:String(f.get('tools')).trim(),reason:String(f.get('reason')).trim()};
    else if(type==='business')fields={name:String(f.get('name')).trim(),product:String(f.get('product')).trim(),customers:String(f.get('customers')).trim(),price:String(f.get('price')).trim(),capital:String(f.get('capital')).trim(),staffNeeded:String(f.get('staffNeeded')).trim(),expectedRevenue:String(f.get('expectedRevenue')).trim(),expectedCost:String(f.get('expectedCost')).trim(),advantages:String(f.get('advantages')).trim(),risks:String(f.get('risks')).trim()};
    else fields={title:String(f.get('title')).trim(),description:String(f.get('description')).trim(),reason:String(f.get('reason')).trim()};
    if(asDraft)onSaveDraft(fields);else onSubmit(fields);
  }
  const jobInitial=type==='job'?initial as JobProposalFields|undefined:undefined;
  const bizInitial=type==='business'?initial as BusinessProposalFields|undefined:undefined;
  const simpleInitial=simpleTypes.includes(type)?initial as SimpleProposalFields|undefined:undefined;
  return <form className="action-form" onSubmit={submit}>
    <h3>{proposalTypeNames[type]}{initial&&' 수정'}</h3>
    {type==='job'?<>
      <label>직업 이름<input autoFocus name="title" required maxLength={60} defaultValue={jobInitial?.title}/></label>
      <label>어떤 일을 하나요<textarea name="purpose" required maxLength={1000} rows={2} defaultValue={jobInitial?.purpose}/></label>
      <label>구체적인 업무<textarea name="tasks" required maxLength={1000} rows={2} defaultValue={jobInitial?.tasks}/></label>
      <label>누구에게 도움이 되나요<input name="beneficiary" maxLength={500} defaultValue={jobInitial?.beneficiary}/></label>
      <label>예상 급여(마동/월)<input name="salary" type="number" min={0} max={10000} step={1} defaultValue={jobInitial?toMajor(jobInitial.suggestedSalaryMinor):undefined}/></label>
      <label>필요한 도구<input name="tools" maxLength={500} defaultValue={jobInitial?.tools}/></label>
      <label>추천 이유<textarea name="reason" required maxLength={1000} rows={2} defaultValue={jobInitial?.reason}/></label>
    </>:type==='business'?<>
      <label>사업 이름<input autoFocus name="name" required maxLength={60} defaultValue={bizInitial?.name}/></label>
      <label>상품/서비스<textarea name="product" required maxLength={500} rows={2} defaultValue={bizInitial?.product}/></label>
      <label>고객<input name="customers" maxLength={500} defaultValue={bizInitial?.customers}/></label>
      <label>가격<input name="price" maxLength={200} defaultValue={bizInitial?.price}/></label>
      <label>초기 자본<input name="capital" maxLength={200} defaultValue={bizInitial?.capital}/></label>
      <label>필요한 인원<input name="staffNeeded" maxLength={200} defaultValue={bizInitial?.staffNeeded}/></label>
      <label>예상 수익<textarea name="expectedRevenue" maxLength={500} rows={2} defaultValue={bizInitial?.expectedRevenue}/></label>
      <label>예상 비용<textarea name="expectedCost" maxLength={500} rows={2} defaultValue={bizInitial?.expectedCost}/></label>
      <label>장점<textarea name="advantages" maxLength={1000} rows={2} defaultValue={bizInitial?.advantages}/></label>
      <label>예상 문제와 해결 방법<textarea name="risks" maxLength={1000} rows={2} defaultValue={bizInitial?.risks}/></label>
    </>:<>
      <label>제목<input autoFocus name="title" required maxLength={60} defaultValue={simpleInitial?.title}/></label>
      <label>내용<textarea name="description" required maxLength={1000} rows={3} defaultValue={simpleInitial?.description}/></label>
      <label>제안 이유<textarea name="reason" required maxLength={1000} rows={2} defaultValue={simpleInitial?.reason}/></label>
    </>}
    <div className="header-actions">
      <button className="button primary" value="submit" disabled={busy}>{initial?'제출하기':'제안 올리기'}</button>
      <button className="button quiet" value="draft" disabled={busy}>초안 저장</button>
      <button type="button" className="button quiet" onClick={onCancel}>취소</button>
    </div>
  </form>;
}

function DecisionForm({proposal,students,busy,onCancel,onDecide}:{proposal:Proposal;students:Student[];busy:boolean;onCancel:()=>void;onDecide:(approve:boolean,note:string,extra?:JobDecisionExtra|BusinessDecisionExtra)=>void}){
  const [grades,setGrades]=useState<number[]>([1,2,3,4,5,6]);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const approve=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='approve';
    const note=String(f.get('note'));
    if(!approve){onDecide(false,note);return}
    if(proposal.type==='job')onDecide(true,note,{departmentId:String(f.get('department')),icon:String(f.get('icon')),recommendedGrades:grades});
    else if(proposal.type==='business')onDecide(true,note,{ownerStudentId:String(f.get('owner'))});
    else onDecide(true,note);
  }
  return <form className="action-form" onSubmit={submit}>
    {proposal.type==='job'&&<><label>소속국<select name="department" required>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>아이콘<select name="icon" required>{jobIcons.map(icon=><option key={icon} value={icon}>{iconNames[icon]}</option>)}</select></label>
      <fieldset><legend>권장 학년</legend><div className="grade-options">{[1,2,3,4,5,6].map(g=><label className="checkbox" key={g}><input type="checkbox" checked={grades.includes(g)} onChange={e=>setGrades(e.target.checked?[...grades,g].sort():grades.filter(n=>n!==g))}/>{g}학년</label>)}</div></fieldset></>}
    {proposal.type==='business'&&<label>사업 담당 학생<select name="owner" required><option value="">학생 선택</option>{students.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name} · {s.grade}학년</option>)}</select></label>}
    <label>의견(반려 시 필수)<textarea name="note" maxLength={500} rows={2}/></label>
    <div className="header-actions"><button className="button primary" value="approve" disabled={busy}>승인</button><button className="button quiet" value="reject" disabled={busy}>반려</button><button type="button" className="button quiet" onClick={onCancel}>닫기</button></div>
  </form>;
}

function ProposalComments({store,proposalId}:{store:ProposalStore;proposalId:string}){
  const [open,setOpen]=useState(false);
  const [comments,setComments]=useState<ProposalComment[]>([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function toggle(){
    if(open){setOpen(false);return}
    setBusy(true);setError('');
    try{setComments(await store.loadComments(proposalId));setOpen(true)}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function post(){
    if(!text.trim())return;
    setBusy(true);setError('');
    try{await store.postComment(proposalId,text);setText('');setComments(await store.loadComments(proposalId))}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  return <div className="section">
    <button className="button quiet" disabled={busy} onClick={toggle}>{open?`의견 숨기기 (${comments.length})`:'의견 보기'}</button>
    {error&&<p role="alert" className="error">{error}</p>}
    {open&&<>
      {!comments.length?<p className="empty">아직 의견이 없어요.</p>:<div className="list">{comments.map(c=><article key={c.id} className="task-row"><p>{c.text}</p></article>)}</div>}
      <div className="assignment-form">
        <input value={text} maxLength={500} onChange={e=>setText(e.target.value)} placeholder="의견을 남겨 주세요"/>
        <button className="button primary" disabled={busy||!text.trim()} onClick={post}>등록</button>
      </div>
    </>}
  </div>;
}
