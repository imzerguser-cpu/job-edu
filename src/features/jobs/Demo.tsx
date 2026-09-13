import {useState} from 'react';
import {demoCareers} from '../../data/careerRepository';
import {CareerWorkspace} from './CareerWorkspace';
import type {Student} from '../../domain/model';
const students:Student[]=[{id:'demo-student',schoolId:'demo-school',name:'가상시민 하늘',grade:3,className:'체험반',citizenCode:'DEMO-001',schoolYear:2026,status:'active',schemaVersion:1},{id:'demo-friend',schoolId:'demo-school',name:'가상시민 바다',grade:1,className:'체험반',citizenCode:'DEMO-002',schoolYear:2026,status:'active',schemaVersion:1}];
export function Demo({onExit}:{onExit:()=>void}){
  const [teacher,setTeacher]=useState(false),[store]=useState(()=>demoCareers('demo-school','demo-student'));
  return <div className="shell"><header className="header"><div className="brand"><span className="brand-mark">M</span>작은 사회 <span className="tag amber">가상 체험</span></div><button className="button quiet" onClick={onExit}>로그인으로 돌아가기</button></header><main><div className="demo-notice"><div><strong>가상 시민으로 직업을 체험하고 있어요.</strong><p>실제 학교에 저장되지 않으며, 새로고침하면 처음으로 돌아갑니다.</p></div><button className="button secondary" onClick={()=>setTeacher(t=>!t)}>{teacher?'학생 체험으로':'교사 체험으로'}</button></div><div className="school-banner"><div><span className="eyebrow">체험학교 · 작은 사회</span><h2>{teacher?'우리 학교의 역할을 함께 정해요':'안녕, 하늘 시민!'}</h2><p>{teacher?'신청 검토에서 학생의 신청을 승인해 보세요.':'직업을 신청한 뒤 교사 체험에서 배정 결과를 확인해 보세요.'}</p></div><img src="/assets/backgrounds/school_front_background.png" alt="학교 건물과 정원"/></div><CareerWorkspace key={teacher?'teacher':'student'} store={store} schoolId="demo-school" teacher={teacher} students={teacher?students:[students[0]]} studentId={teacher?undefined:'demo-student'}/></main></div>;
}
