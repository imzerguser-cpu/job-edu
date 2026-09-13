import {useEffect,useRef,useState,type FormEvent} from 'react';
import {departments,jobIcons,iconNames} from '../../domain/jobs';
import {formatMoney,toMinor} from '../../domain/money';
import {
  canClose,canDecide,canVote,passedVote,proposalStatusNames,proposalTypeNames,
  type BusinessProposalFields,type JobProposalFields,type Proposal,type ProposalType,
} from '../../domain/proposals';
import type {Student} from '../../domain/model';
import type {ProposalStore,JobDecisionExtra,BusinessDecisionExtra} from '../../data/proposalRepository';

export function CivicWorkspace({store,teacher,students,studentId}:{store:ProposalStore;teacher:boolean;students:Student[];studentId?:string}){
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [myVotes,setMyVotes]=useState<Record<string,'yes'|'no'|null>>({});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [composing,setComposing]=useState<ProposalType|null>(null);
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
    try{await action();await load();if(mounted.current){setMessage(success);setComposing(null);setOpeningVote(null);setDeciding(null)}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  const activeStudentCount=students.filter(s=>s.status==='active').length;

  if(loading)return <p role="status">시민광장을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>시민광장</h2>{!teacher&&<div className="header-actions"><button className="button quiet" onClick={()=>setComposing('job')}>+ 직업 제안</button><button className="button quiet" onClick={()=>setComposing('business')}>+ 사업 제안</button></div>}</div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    {composing&&<ProposalForm type={composing} busy={busy} onCancel={()=>setComposing(null)} onSubmit={fields=>run(()=>store.submit(composing,fields),'제안을 올렸습니다. 선생님의 검토를 기다려 주세요.')}/>}
    {!proposals.length?<p className="empty">아직 올라온 제안이 없어요.</p>:<div className="list">
      {proposals.map(p=>{
        const title=p.type==='job'?(p.fields as JobProposalFields).title:(p.fields as BusinessProposalFields).name;
        const isAuthor=studentId===p.authorStudentId;
        const myVote=myVotes[p.id];
        return <article key={p.id} className="task-row">
          <div className="task-row-head"><b>{proposalTypeNames[p.type]} · {title}</b><span className="badge">{proposalStatusNames[p.status]}</span></div>
          <p className="muted">제안자: {isAuthor?'나':studentName(p.authorStudentId)}</p>
          <ProposalDetails proposal={p}/>
          {(p.status==='closed'||p.status==='approved'||p.status==='rejected')&&<p className="muted">찬성 {p.tallyYes} · 반대 {p.tallyNo} · 참여 {p.tallyTotal}명{p.status==='closed'&&teacher&&<> · 통과 기준 {passedVote(p,activeStudentCount)?'충족':'미충족'}</>}</p>}
          {p.decisionNote&&<p className="review-note">선생님 의견: {p.decisionNote}</p>}

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
  const f=proposal.fields as BusinessProposalFields;
  return <div className="muted"><p>{f.product}</p><p>고객: {f.customers} · 가격: {f.price}</p></div>;
}

function ProposalForm({type,busy,onCancel,onSubmit}:{type:ProposalType;busy:boolean;onCancel:()=>void;onSubmit:(fields:JobProposalFields|BusinessProposalFields)=>void}){
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    if(type==='job')onSubmit({title:String(f.get('title')).trim(),purpose:String(f.get('purpose')).trim(),tasks:String(f.get('tasks')).trim(),beneficiary:String(f.get('beneficiary')).trim(),suggestedSalaryMinor:toMinor(Number(f.get('salary'))||0),tools:String(f.get('tools')).trim(),reason:String(f.get('reason')).trim()});
    else onSubmit({name:String(f.get('name')).trim(),product:String(f.get('product')).trim(),customers:String(f.get('customers')).trim(),price:String(f.get('price')).trim(),capital:String(f.get('capital')).trim(),staffNeeded:String(f.get('staffNeeded')).trim(),expectedRevenue:String(f.get('expectedRevenue')).trim(),expectedCost:String(f.get('expectedCost')).trim(),advantages:String(f.get('advantages')).trim(),risks:String(f.get('risks')).trim()});
  }
  return <form className="action-form" onSubmit={submit}>
    <h3>{type==='job'?'직업 추천서':'사업 제안서'}</h3>
    {type==='job'?<>
      <label>직업 이름<input autoFocus name="title" required maxLength={60}/></label>
      <label>어떤 일을 하나요<textarea name="purpose" required maxLength={1000} rows={2}/></label>
      <label>구체적인 업무<textarea name="tasks" required maxLength={1000} rows={2}/></label>
      <label>누구에게 도움이 되나요<input name="beneficiary" maxLength={500}/></label>
      <label>예상 급여(마동/월)<input name="salary" type="number" min={0} max={10000} step={1}/></label>
      <label>필요한 도구<input name="tools" maxLength={500}/></label>
      <label>추천 이유<textarea name="reason" required maxLength={1000} rows={2}/></label>
    </>:<>
      <label>사업 이름<input autoFocus name="name" required maxLength={60}/></label>
      <label>상품/서비스<textarea name="product" required maxLength={500} rows={2}/></label>
      <label>고객<input name="customers" maxLength={500}/></label>
      <label>가격<input name="price" maxLength={200}/></label>
      <label>초기 자본<input name="capital" maxLength={200}/></label>
      <label>필요한 인원<input name="staffNeeded" maxLength={200}/></label>
      <label>예상 수익<textarea name="expectedRevenue" maxLength={500} rows={2}/></label>
      <label>예상 비용<textarea name="expectedCost" maxLength={500} rows={2}/></label>
      <label>장점<textarea name="advantages" maxLength={1000} rows={2}/></label>
      <label>예상 문제와 해결 방법<textarea name="risks" maxLength={1000} rows={2}/></label>
    </>}
    <div className="header-actions"><button className="button primary" disabled={busy}>제안 올리기</button><button type="button" className="button quiet" onClick={onCancel}>취소</button></div>
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
    else onDecide(true,note,{ownerStudentId:String(f.get('owner'))});
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
