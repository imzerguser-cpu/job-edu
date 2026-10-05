import {useEffect,useState} from 'react';
import {achievements,levelInfo,totalXp} from '../../domain/growth';
import {bandInfo,hollandInfo,strengthInfo,topStrengths,valueInfo,type HollandType} from '../../domain/careerDiscovery';
import {formatMoney} from '../../domain/money';
import {studentLabel,type Student} from '../../domain/model';
import type {StudentReport} from '../../data/reportRepository';

const codeName=(code:string)=>code.split('').map(t=>`${hollandInfo[t as HollandType]?.icon??''} ${hollandInfo[t as HollandType]?.name??t}`).join(' + ');

// 학기말 성장 보고서(D-124): 학생 한 명을 A4 한 장으로. "인쇄하기"를 누르면 이 보고서만 인쇄된다.
export function GrowthReport({student,students,schoolName,currencySymbol,load,onClose}:{student:Student;students:Student[];schoolName:string;currencySymbol:string;load:(studentId:string)=>Promise<StudentReport>;onClose:()=>void}){
  const [report,setReport]=useState<StudentReport|null>(null),[error,setError]=useState(''),[note,setNote]=useState('');
  useEffect(()=>{let alive=true;setReport(null);load(student.id).then(r=>{if(alive)setReport(r)}).catch(e=>{if(alive)setError((e as Error).message)});return()=>{alive=false}},[student.id,load]);
  function print(){
    document.body.classList.add('printing-report');
    const done=()=>{document.body.classList.remove('printing-report');window.removeEventListener('afterprint',done)};
    window.addEventListener('afterprint',done);
    window.print();
  }
  const name=(id:string)=>students.find(s=>s.id===id)?.name??'친구';
  if(error)return <section className="panel"><p role="alert" className="error">{error}</p><button className="button quiet" onClick={onClose}>닫기</button></section>;
  if(!report)return <section className="panel"><p role="status">{student.name} 학생의 기록을 모으고 있어요…</p></section>;
  const info=levelInfo(totalXp(report.stats)),badges=achievements(report.stats).filter(b=>b.earned);
  const first=report.discoveries[0],last=report.discoveries[report.discoveries.length-1];
  const s=report.stats;
  return <section className="panel growth-report">
    <div className="header-actions report-actions"><button className="button primary" onClick={print}>🖨️ 인쇄하기</button><button className="button quiet" onClick={onClose}>닫기</button></div>
    {report.partial&&<p className="notice report-actions">일부 기록을 불러오지 못했어요. 빈 항목은 0으로 보일 수 있어요.</p>}
    <article className="print-report">
      <header className="report-head">
        <div><span className="eyebrow">{schoolName} · {student.schoolYear}학년도</span><h2>{studentLabel(student)} 학생의 성장 기록</h2></div>
        <div className="report-level"><b>Lv.{info.level}</b><small>{info.title}</small><small>경험치 {info.xp.toLocaleString()}</small></div>
      </header>
      <section><h3>🏘️ 마을에서 한 일</h3>
        <ul className="report-facts">
          <li><b>맡은 직업</b><span>{report.jobs.join(', ')||'없음'}</span></li>
          <li><b>업무 제출</b><span>{s.taskSubmissions}번 (지금 완료 {report.tasksApproved}건)</span></li>
          <li><b>받은 월급</b><span>{s.salaries}번 · {formatMoney(report.salaryMinor,currencySymbol)}</span></li>
          <li><b>업무 완료 보상</b><span>{formatMoney(report.rewardsMinor,currencySymbol)}</span></li>
          <li><b>출근 도장</b><span>{s.checkins}일 (최근 연속 {s.checkinStreak}일)</span></li>
          <li><b>저축</b><span>가입 {s.savingsJoined}번 · 만기 {s.savingsMatured}번</span></li>
          <li><b>친구 도와주기</b><span>{s.helpsGiven}번</span></li>
          <li><b>받은 칭찬</b><span>{s.praisesReceived}개</span></li>
          <li><b>시민 제안</b><span>{s.proposalsSubmitted}건 (통과 {s.proposalsApproved}건)</span></li>
        </ul>
      </section>
      {report.recentPraises.length>0&&<section><h3>🌟 친구들이 남긴 칭찬</h3><ul className="report-quotes">{report.recentPraises.map((p,i)=><li key={i}>“{p.message}” — {name(p.from)}</li>)}</ul></section>}
      <section><h3>🏅 얻은 업적 {badges.length}개</h3><p className="report-badges">{badges.length?badges.map(b=><span key={b.id}>{b.icon} {b.title}</span>):'아직 없음'}</p></section>
      <section><h3>🧭 나를 찾는 모험</h3>
        {!last?<p>아직 참여하지 않았어요.</p>:<>
          <ul className="report-facts">
            <li><b>흥미 유형</b><span>{codeName(last.code)} ({bandInfo[last.band].name}, {report.discoveries.length}회 참여)</span></li>
            <li><b>강점</b><span>{topStrengths(last.strengths).map(a=>`${strengthInfo[a].icon} ${strengthInfo[a].name}`).join(', ')}</span></li>
            {last.values.length>0&&<li><b>소중한 것</b><span>{last.values.map(v=>valueInfo[v].name).join(', ')}</span></li>}
            {first&&first!==last&&<li><b>변화</b><span>처음 {codeName(first.code)} → 지금 {codeName(last.code)}</span></li>}
          </ul>
          {last.reflection&&<p className="report-quote">나의 생각: “{last.reflection}”</p>}
        </>}
      </section>
      <section><h3>✏️ 선생님 한마디</h3>
        <textarea className="report-note" value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={500} placeholder="인쇄 전에 적어 주세요. (저장되지 않아요)"/>
        <p className="report-note-print">{note}</p>
      </section>
      <footer className="muted">이 보고서는 작은 사회 앱의 활동 기록(최근 100건 기준)으로 만들었습니다. 흥미·강점 결과는 진단이 아니라 학생의 자기 보고입니다.</footer>
    </article>
  </section>;
}
