import {useEffect,useMemo,useState} from 'react';
import {
  bandForGrade,bandInfo,fitStars,hollandCode,hollandInfo,hollandTypes,interestItems,recommendJobs,recommendWorldCareers,reflectionPrompt,
  scoreInterest,scoreStrengths,strengthAreas,strengthInfo,strengthItems,strengthScale,topStrengths,valueInfo,workValues,
  type Answers,type Discovery,type GradeBand,type HollandType,type WorkValue,
} from '../../domain/careerDiscovery';
import type {Career} from '../../domain/jobs';
import type {Student} from '../../domain/model';
import type {CareerProfileStore,CareerProfile,CareerHistoryEntry} from '../../data/careerProfileRepository';
import type {CareerStore} from '../../data/careerRepository';
import {buildingForIcon} from '../map/growthStats';
import type {BuildingId} from '../map/buildings';

// 학년대별 "진로 디자인과 준비" 활동 — 결과를 보고 끝이 아니라 작은 실천으로 이어지게.
const nextSteps:Record<GradeBand,string[]>={
  low:['내가 좋아하는 것을 그림으로 그려 친구에게 소개해요.','추천 직업 중 하나를 골라 마을에서 직접 해 봐요.','가족에게 어떤 일을 하는지 물어봐요.'],
  mid:['관심 있는 직업을 맡은 친구에게 질문 3개를 해 봐요.','추천 직업 하나에 신청해서 한 달 동안 해 봐요.','내 강점을 더 키울 수 있는 활동을 하나 정해요.'],
  high:['관심 직업이 하는 일·필요한 능력·준비 방법을 조사해요.','마을에서 관심 직업과 비슷한 일을 맡아 경험을 쌓아요.','이번 달 나의 진로 실천 계획을 세우고 돌아봐요.'],
};

type Step='intro'|'interest'|'strength'|'values'|'result';

export function CareerDiscovery({store,careerStore,citizen,onGo}:{store:CareerProfileStore;careerStore:CareerStore;citizen:Student;onGo:(id:BuildingId,tab?:string)=>void}){
  const [profile,setProfile]=useState<CareerProfile|null|undefined>(undefined);
  const [history,setHistory]=useState<CareerHistoryEntry[]>([]);
  const [jobs,setJobs]=useState<Career[]>([]);
  const [band,setBand]=useState<GradeBand>(bandForGrade(citizen.grade));
  const [step,setStep]=useState<Step>('intro');
  const [answers,setAnswers]=useState<Answers>({});
  const [values,setValues]=useState<WorkValue[]>([]);
  const [reflection,setReflection]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  async function reload(){
    const [p,h]=await Promise.all([store.myProfile(),store.myHistory().catch(()=>[])]);
    setProfile(p);setHistory(h);
  }
  useEffect(()=>{reload().catch(e=>{setProfile(null);setError((e as Error).message)});careerStore.load().then(d=>setJobs(d.jobs.filter(j=>j.status!=='closed'))).catch(()=>setJobs([]))},[store,careerStore]);

  const interest=useMemo(()=>scoreInterest(band,answers),[band,answers]);
  const strengths=useMemo(()=>scoreStrengths(band,answers),[band,answers]);
  const draft:Discovery={band,interest,strengths,values,code:hollandCode(interest),reflection};

  function start(){setAnswers({});setValues([]);setReflection('');setSaved(false);setError('');setStep('interest')}
  async function save(){
    setBusy(true);setError('');
    try{await store.save(draft);await reload();setSaved(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  if(profile===undefined)return <p role="status">나의 모험 기록을 불러오고 있어요.</p>;

  if(step==='intro')return <section className="discovery">
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="discovery-hero">
      <span className="discovery-hero-icon" aria-hidden="true">🧭</span>
      <div><h2>나를 찾는 모험</h2><p>내가 <b>좋아하는 것</b>, <b>잘하는 것</b>{bandInfo[band].valuePicks?<>, <b>소중하게 생각하는 것</b></>:null}을 알아보고, 나와 어울리는 직업을 찾아봐요. 맞고 틀린 답은 없어요. 지금 내 마음 그대로 골라요!</p></div>
    </div>
    <div className="band-picker" role="radiogroup" aria-label="학년대">
      {(Object.keys(bandInfo) as GradeBand[]).map(b=><button key={b} type="button" role="radio" aria-checked={band===b} onClick={()=>setBand(b)}><b>{bandInfo[b].name}</b><small>{bandInfo[b].grades} · 문항 {interestItems(b).length+strengthItems(b).length}개{bandInfo[b].valuePicks?` + 가치 ${bandInfo[b].valuePicks}개`:''}</small></button>)}
    </div>
    <div className="header-actions section"><button type="button" className="button primary" onClick={start}>{profile?'다시 모험 떠나기':'모험 시작하기'}</button></div>
    {profile&&<div className="section"><DiscoveryResult d={profile} jobs={jobs} previous={history[1]??null} onGo={onGo}/></div>}
  </section>;

  if(step==='interest'||step==='strength'){
    const items=step==='interest'?interestItems(band):strengthItems(band);
    const scale=step==='interest'?bandInfo[band].scale:strengthScale;
    const done=items.filter(i=>answers[i.id]!==undefined).length;
    const next=()=>setStep(step==='interest'?'strength':bandInfo[band].valuePicks?'values':'result');
    return <section className="discovery">
      <div className="quiz-head"><span className="citizen-hud-eyebrow">{step==='interest'?'1단계 · 내가 좋아하는 것':'2단계 · 내가 잘하는 것'}</span><h2>{step==='interest'?'이런 걸 하면 어때요?':'나는 이런 걸 얼마나 잘할까요?'}</h2>
        <div className="xp-bar"><span style={{width:`${Math.round(done/items.length*100)}%`}}/></div><small className="muted">{done}/{items.length}</small></div>
      <ol className="quiz-list">{items.map(item=><li key={item.id} className="quiz-item">
        <span className="quiz-icon" aria-hidden="true">{item.icon}</span>
        <span className="quiz-text">{item.text}</span>
        <div className="quiz-choices" role="radiogroup" aria-label={item.text}>{scale.map((label,v)=><button key={v} type="button" role="radio" aria-checked={answers[item.id]===v} onClick={()=>setAnswers(a=>({...a,[item.id]:v}))}>{label}</button>)}</div>
      </li>)}</ol>
      <div className="header-actions section">
        <button type="button" className="button quiet" onClick={()=>setStep(step==='interest'?'intro':'interest')}>← 이전</button>
        <button type="button" className="button primary" disabled={done<items.length} onClick={next}>{done<items.length?`${items.length-done}개 남았어요`:'다음 →'}</button>
      </div>
    </section>;
  }

  if(step==='values'){
    const max=bandInfo[band].valuePicks;
    return <section className="discovery">
      <div className="quiz-head"><span className="citizen-hud-eyebrow">3단계 · 내가 소중하게 생각하는 것</span><h2>일을 할 때 가장 중요한 것 {max}개를 골라요</h2><small className="muted">{values.length}/{max}개 골랐어요</small></div>
      <div className="value-grid">{workValues.map(v=>{const on=values.includes(v);return <button key={v} type="button" aria-pressed={on} disabled={!on&&values.length>=max} onClick={()=>setValues(on?values.filter(x=>x!==v):[...values,v])}><span aria-hidden="true">{valueInfo[v].icon}</span><b>{valueInfo[v].name}</b><small>{valueInfo[v].desc}</small></button>})}</div>
      <div className="header-actions section"><button type="button" className="button quiet" onClick={()=>setStep('strength')}>← 이전</button><button type="button" className="button primary" disabled={values.length!==max} onClick={()=>setStep('result')}>결과 보기 →</button></div>
    </section>;
  }

  return <section className="discovery">
    {error&&<p role="alert" className="error">{error}</p>}
    <DiscoveryResult d={saved&&profile?profile:draft} jobs={jobs} previous={saved?history[1]??null:profile?{...profile,id:'prev',takenAt:profile.updatedAt}:null} onGo={onGo}/>
    <section className="panel section">
      <h3>✏️ 나의 생각 적기</h3>
      <label>{reflectionPrompt[band]}<textarea value={reflection} maxLength={300} rows={3} onChange={e=>setReflection(e.target.value)} disabled={saved}/></label>
      <div className="header-actions">
        {saved?<><p role="status" className="success">모험 기록을 저장했어요! 경험치가 올랐어요.</p><button type="button" className="button quiet" onClick={()=>setStep('intro')}>처음으로</button></>
          :<><button type="button" className="button primary" disabled={busy} onClick={save}>{busy?'저장 중…':'모험 기록 저장하기'}</button><button type="button" className="button quiet" onClick={()=>setStep('interest')}>답 다시 고르기</button></>}
      </div>
    </section>
  </section>;
}

export function DiscoveryResult({d,jobs,previous,onGo}:{d:Discovery;jobs:Career[];previous:Pick<Discovery,'code'>&{takenAt?:string|null}|null;onGo?:(id:BuildingId,tab?:string)=>void}){
  const code=d.code.split('') as HollandType[];
  const picks=recommendJobs(d,jobs,4);
  const world=recommendWorldCareers(d);
  const tops=topStrengths(d.strengths);
  return <div className="discovery-result">
    <section className="panel type-card" style={{borderColor:hollandInfo[code[0]].color}}>
      <span className="citizen-hud-eyebrow">나의 흥미 유형 · {bandInfo[d.band].name}</span>
      <h2>{code.map(t=><span key={t} className="type-chip" style={{background:hollandInfo[t].color}}>{hollandInfo[t].icon} {hollandInfo[t].name}</span>)}</h2>
      <p>{hollandInfo[code[0]].desc}{code[1]?` 그리고 ${hollandInfo[code[1]].short}도 좋아해요.`:''}</p>
      {previous&&previous.code!==d.code&&<p className="muted">지난번{previous.takenAt?`(${new Date(previous.takenAt).toLocaleDateString('ko-KR')})`:''}에는 {previous.code.split('').map(t=>hollandInfo[t as HollandType].name).join(' + ')}이었어요. 자라면서 좋아하는 것은 바뀔 수 있어요! 🌱</p>}
    </section>
    <div className="result-columns">
      <section className="panel">
        <h3>💛 좋아하는 것(흥미)</h3>
        <div className="score-bars">{hollandTypes.map(t=><div key={t} className="score-row"><span>{hollandInfo[t].icon} {hollandInfo[t].name}</span><div className="score-track"><span style={{width:`${d.interest[t]}%`,background:hollandInfo[t].color}}/></div><b>{d.interest[t]}</b></div>)}</div>
      </section>
      <section className="panel">
        <h3>⭐ 잘하는 것(강점)</h3>
        <div className="strength-chips">{tops.map((a,i)=><span key={a} className={`strength-chip rank-${i}`}>{strengthInfo[a].icon} {strengthInfo[a].name}</span>)}</div>
        <p className="muted">나머지 강점: {strengthAreas.filter(a=>!tops.includes(a)).map(a=>strengthInfo[a].name).join(' · ')} — 배우는 중인 것도 연습하면 자라요.</p>
        {d.values.length>0&&<><h3 className="section">💎 소중한 것(가치)</h3><div className="strength-chips">{d.values.map(v=><span key={v} className="strength-chip">{valueInfo[v].icon} {valueInfo[v].name}</span>)}</div></>}
      </section>
    </div>
    <section className="panel section">
      <h3>🏘️ 우리 마을에서 해 볼 수 있는 어울리는 직업</h3>
      {!picks.length?<p className="empty">아직 마을에 직업이 없어요. 선생님이 직업을 열면 추천해 줄게요.</p>:<div className="rec-grid">{picks.map(({job,fit})=>{const b=buildingForIcon(job.icon);return <article key={job.id} className="rec-card">
        <img src={`/assets/jobs/${job.icon}_job_icon.png`} alt=""/>
        <div><b>{job.name}</b><small aria-label={`어울림 별 ${fitStars(fit)}개`}>{'⭐'.repeat(fitStars(fit))}{'☆'.repeat(3-fitStars(fit))}</small><p>{job.description}</p></div>
        {onGo&&b&&<button type="button" className="button secondary small" onClick={()=>onGo(b,'jobs')}>만나러 가기 ↗</button>}
      </article>})}</div>}
    </section>
    <section className="panel section">
      <h3>🌏 세상에는 이런 직업도 있어요</h3>
      <div className="world-chips">{world.map(c=><span key={c.name} className="world-chip" style={{borderColor:hollandInfo[c.type].color}}>{c.icon} {c.name}</span>)}</div>
      <p className="notice">💬 직업에는 <b>남자 일, 여자 일</b>이 따로 없어요. 멋진 일과 시시한 일도 없어요. 오늘의 결과는 "지금의 나"예요 — 여러 가지를 해 보면서 계속 새로 발견해 가요.</p>
    </section>
    <section className="panel section">
      <h3>🗺️ 다음 모험</h3>
      <ul className="next-steps">{nextSteps[d.band].map(s=><li key={s}>{s}</li>)}</ul>
      {d.reflection&&<p className="review-note">나의 생각: {d.reflection}</p>}
    </section>
  </div>;
}

// 교사용: 학급 전체의 흥미 유형 분포와 학생별 결과. 결과는 학생 본인과 교사만 볼 수 있다.
export function CareerDiscoveryTeacher({store,careerStore,students}:{store:CareerProfileStore;careerStore:CareerStore;students:Student[]}){
  const [profiles,setProfiles]=useState<CareerProfile[]|null>(null),[error,setError]=useState(''),[open,setOpen]=useState<string|null>(null),[jobs,setJobs]=useState<Career[]>([]);
  useEffect(()=>{store.classProfiles().then(setProfiles).catch(e=>setError((e as Error).message));careerStore.load().then(d=>setJobs(d.jobs.filter(j=>j.status!=='closed'))).catch(()=>setJobs([]))},[store,careerStore]);
  const name=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  const counts=hollandTypes.map(t=>({t,n:(profiles??[]).filter(p=>p.code[0]===t).length}));
  const max=Math.max(1,...counts.map(c=>c.n));
  return <section className="panel">
    <div className="section-heading"><h2>🧭 나를 찾는 모험 · 학급 결과</h2><span className="muted">{profiles?`${profiles.length}/${students.length}명 참여`:''}</span></div>
    <p className="muted">홀랜드 흥미 유형(RIASEC)·가드너 다중지능 강점·일의 가치를 초등 눈높이로 바꾼 자기이해 활동입니다. 진단이 아니라 대화의 출발점으로 써 주세요. 결과는 학생 본인과 교사만 볼 수 있습니다.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {!profiles?<p role="status">불러오는 중…</p>:!profiles.length?<p className="empty">아직 참여한 학생이 없어요. 학생 화면의 "나를 찾는 모험" 퀘스트로 안내해 주세요.</p>:<>
      <div className="score-bars section">{counts.map(({t,n})=><div key={t} className="score-row"><span>{hollandInfo[t].icon} {hollandInfo[t].name}</span><div className="score-track"><span style={{width:`${n/max*100}%`,background:hollandInfo[t].color}}/></div><b>{n}명</b></div>)}</div>
      <div className="table-scroll section"><table><thead><tr><th>이름</th><th>학년대</th><th>흥미 코드</th><th>강점 TOP 3</th><th>가치</th><th>횟수</th><th></th></tr></thead><tbody>
        {profiles.map(p=><tr key={p.studentId}><td>{name(p.studentId)}</td><td>{bandInfo[p.band].name}</td><td>{p.code.split('').map(t=>hollandInfo[t as HollandType].icon+hollandInfo[t as HollandType].name).join(' + ')}</td><td>{topStrengths(p.strengths).map(a=>strengthInfo[a].name).join(', ')}</td><td>{p.values.map(v=>valueInfo[v].name).join(', ')||'-'}</td><td>{p.completions}</td><td><button type="button" className="button quiet small" onClick={()=>setOpen(open===p.studentId?null:p.studentId)}>{open===p.studentId?'닫기':'자세히'}</button></td></tr>)}
      </tbody></table></div>
      {open&&(()=>{const p=profiles.find(x=>x.studentId===open)!;return <div className="section"><h3>{name(open)}의 결과</h3><DiscoveryResult d={p} jobs={jobs} previous={null}/></div>})()}
    </>}
  </section>;
}
