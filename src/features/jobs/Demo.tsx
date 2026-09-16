import {useState} from 'react';
import {demoCareers} from '../../data/careerRepository';
import {CareerWorkspace} from './CareerWorkspace';
import type {Student} from '../../domain/model';
import {CitizenMap} from '../map/CitizenMap';
import {BuildingShell} from '../map/BuildingShell';
import {buildings,type BuildingId} from '../map/buildings';
const students:Student[]=[{id:'demo-student',schoolId:'demo-school',name:'가상시민 하늘',grade:3,className:'체험반',citizenCode:'DEMO-001',schoolYear:2026,status:'active',schemaVersion:1},{id:'demo-friend',schoolId:'demo-school',name:'가상시민 바다',grade:1,className:'체험반',citizenCode:'DEMO-002',schoolYear:2026,status:'active',schemaVersion:1}];
export function Demo({onExit}:{onExit:()=>void}){
  const [teacher,setTeacher]=useState(false),[store]=useState(()=>demoCareers('demo-school','demo-student'));
  const [view,setView]=useState<'map'|BuildingId>('map');
  const building=buildings.find(b=>b.id===view);
  const careers=<CareerWorkspace key={teacher?'teacher':'student'} store={store} schoolId="demo-school" teacher={teacher} students={teacher?students:[students[0]]} studentId={teacher?undefined:'demo-student'}/>;
  return <div className="shell"><header className="header"><div className="brand"><span className="brand-mark">M</span>작은 사회 <span className="tag amber">가상 체험</span></div><button className="button quiet" onClick={onExit}>로그인으로 돌아가기</button></header><main>
    <div className="demo-notice"><div><strong>가상 시민으로 직업을 체험하고 있어요.</strong><p>실제 학교에 저장되지 않으며, 새로고침하면 처음으로 돌아갑니다.</p></div><button className="button secondary" onClick={()=>{setTeacher(t=>!t);setView('mypage')}}>{teacher?'학생 체험으로':'교사 체험으로'}</button></div>
    {view==='map'?<CitizenMap onNavigate={setView}/>:building&&<BuildingShell title={building.label} subtitle={building.subtitle} onBack={()=>setView('map')}>
      {view==='mypage'?careers:<div className="empty"><p>가상 체험에서는 직업 신청과 배정을 이용할 수 있어요.<br/>이 공간의 실제 기능은 학교 계정으로 로그인하면 이용할 수 있습니다.</p><button className="button primary section" onClick={()=>setView('mypage')}>직업 체험으로 이동</button></div>}
    </BuildingShell>}
  </main></div>;
}
