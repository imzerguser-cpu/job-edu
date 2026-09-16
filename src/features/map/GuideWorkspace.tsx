import {useEffect,useState} from 'react';
import {departments,departmentDisplayName,type Career} from '../../domain/jobs';
import {formatMoney} from '../../domain/money';
import type {School} from '../../domain/model';
import type {CareerStore} from '../../data/careerRepository';
import {buildings} from './buildings';

// 초반 튜토리얼 + 언제든 다시 볼 수 있는 설명서(사용자 요청). 직업 목록은 하드코딩하지 않고
// careerStore에서 그대로 불러온다 — 교사가 직업을 새로 만들거나 이름을 바꿔도 항상 최신 상태를
// 보여준다. "이 직업은 어느 건물에서" 조회는 buildings[].icons를 그대로 재사용한다(D-96).
// 초등학교 1학년도 읽을 수 있어야 한다는 요청(D-99)에 맞춰: 문장을 짧게 쓰고, 실제 화면
// 스크린샷(public/assets/guide/*.png, chromium-cli 없이 로컬 playwright로 직접 캡처)을
// 함께 보여준다. 투표·과태료 같은 어려운 개념은 그림 없이 한 줄로만 짧게 안내한다.
const steps=[
  {img:'step-map.png',title:'1. 지도에서 건물을 눌러요',text:'가고 싶은 건물을 손가락으로 콕! 눌러요.'},
  {img:'step-jobs.png',title:'2. 하고 싶은 일을 찾아요',text:'마음에 드는 직업을 찾아요. "신청하기"를 눌러요.'},
  {img:'step-tasks.png',title:'3. 오늘 할 일을 해요',text:'선생님이 내준 일을 하고 "제출하기"를 눌러요.'},
  {img:'step-bank.png',title:'4. 돈을 받아요',text:'일을 하면 돈을 받아요. 은행에서 내 돈을 확인해요.'},
  {img:'step-store.png',title:'5. 갖고 싶은 걸 사요',text:'모은 돈으로 상점에서 물건을 살 수 있어요.'},
];

export function GuideWorkspace({store,school,communityLabel,onClose}:{store:CareerStore;school:School;communityLabel:string;onClose:()=>void}){
  const [jobs,setJobs]=useState<Career[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;store.load().then(d=>{if(alive)setJobs(d.jobs)}).catch(e=>{if(alive)setError((e as Error).message)});return()=>{alive=false}},[store]);

  const buildingOf=(icon:string)=>buildings.find(b=>b.icons?.includes(icon))?.label;
  const byDept=departments.map(d=>({
    dept:d,
    jobs:(jobs??[]).filter(j=>j.departmentId===d.id).sort((a,b)=>a.name.localeCompare(b.name,'ko')),
  }));

  return <section className="citizen-building guide">
    <div className="citizen-building-head">
      <button className="citizen-back" onClick={onClose}>← 지도</button>
      <div className="building-title"><span className="citizen-hud-eyebrow">처음이신가요?</span><h1 tabIndex={-1}>{communityLabel} 사용법</h1><p className="citizen-building-sub">언제든 오른쪽 위 "설명서" 버튼을 누르면 다시 볼 수 있어요.</p></div>
    </div>

    <section className="panel section">
      <h2>여기는 어디인가요?</h2>
      <p>{communityLabel}는 우리 반이 함께 만드는 작은 마을이에요. 직업을 골라 일을 하면 {school.currencyName}({school.currencySymbol})을 받아요. {school.currencyName}(으)로 상점에서 물건을 살 수 있어요.</p>
    </section>

    <section className="panel section">
      <h2>차근차근 따라 해요</h2>
      <ol className="guide-steps">
        {steps.map(s=><li key={s.img}>
          <img className="guide-shot" src={`/assets/guide/${s.img}`} alt="" loading="lazy"/>
          <b>{s.title}</b>
          <span>{s.text}</span>
        </li>)}
      </ol>
    </section>

    <section className="panel section">
      <h2>더 크면 해볼 수 있는 것 (선택)</h2>
      <p>새 직업이나 놀이를 만들자고 제안하고, 친구들과 투표할 수도 있어요. 약속을 안 지키면 벌점을 받을 수도 있어요.</p>
    </section>

    <section className="panel section">
      <h2>지도의 건물들</h2>
      <p className="muted">지도 그림이나 그 아래 버튼을 눌러 이동해요.</p>
      <div className="guide-building-list">
        {buildings.filter(b=>b.id!=='mypage').map(b=><div key={b.id} className="guide-building-row"><b>{b.label}</b><span>{b.subtitle}</span></div>)}
      </div>
    </section>

    <section className="panel section">
      <h2>우리 학교 직업 {jobs?.length??''}개 한눈에 보기</h2>
      {error&&<p role="alert" className="error">{error}</p>}
      {!jobs?<p role="status">직업을 불러오고 있어요.</p>:!jobs.length?<p className="empty">아직 등록된 직업이 없어요. 선생님이 곧 준비해 줄 거예요.</p>:
        byDept.map(({dept,jobs:deptJobs})=>deptJobs.length?<div key={dept.id} className="guide-dept">
          <h3>{departmentDisplayName(school,dept.id)} <span className="count">{deptJobs.length}</span></h3>
          <div className="job-grid">
            {deptJobs.map(job=><article className={`job-card department-${job.departmentId}`} key={job.id}>
              <div className="job-top"><img className="job-icon" src={`/assets/jobs/${job.icon}_job_icon.png`} alt=""/></div>
              <h4>{job.name}</h4>
              <p>{job.description}</p>
              <div className="job-grades">권장 {job.recommendedGrades.join('·')}학년 · 월급 {formatMoney(job.salaryMinor,school.currencyName)}</div>
              {buildingOf(job.icon)&&<p className="muted">📍 {buildingOf(job.icon)}에서 만날 수 있어요</p>}
            </article>)}
          </div>
        </div>:null)}
    </section>
  </section>;
}
