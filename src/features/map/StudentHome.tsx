import {useEffect,useState} from 'react';
import {departments} from '../../domain/jobs';
import type {School,SchoolContext,Student} from '../../domain/model';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import {CareerWorkspace} from '../jobs/CareerWorkspace';
import {TaskWorkspace} from '../tasks/TaskWorkspace';
import {CitizenMap} from './CitizenMap';
import {BuildingShell} from './BuildingShell';
import {BuildingPlaceholder} from './BuildingPlaceholder';
import {buildings,type BuildingId} from './buildings';

export function StudentHome({citizen,school,context,store,taskStore}:{citizen:Student;school:School;context:SchoolContext;store:CareerStore;taskStore:TaskStore}){
  const [view,setView]=useState<'map'|BuildingId>('map');
  const [jobCount,setJobCount]=useState<number|null>(null);
  useEffect(()=>{
    let alive=true;
    store.load().then(d=>{if(alive)setJobCount(d.assignments.filter(a=>a.status==='active'&&a.studentId===citizen.id).length)}).catch(()=>{if(alive)setJobCount(null)});
    return ()=>{alive=false};
  },[store,citizen.id]);

  if(view==='map')return <div className="citizen-shell">
    <CitizenHud citizen={citizen} community={school.communityName} jobCount={jobCount}/>
    <CitizenMap onNavigate={setView}/>
  </div>;

  const building=buildings.find(b=>b.id===view)!;
  const dept=building.departmentId?departments.find(d=>d.id===building.departmentId):null;
  return <BuildingShell title={building.label} subtitle={building.subtitle} eyebrow={dept?.name} onBack={()=>setView('map')}>
    {view==='mypage'
      ?<><CareerWorkspace store={store} schoolId={context.schoolId} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined}/>
        <TaskWorkspace taskStore={taskStore} careerStore={store} teacher={false} students={[citizen]} studentId={context.membership.studentId??undefined}/></>
      :<BuildingPlaceholder label={building.label}/>}
  </BuildingShell>;
}

function CitizenHud({citizen,community,jobCount}:{citizen:Student;community:string;jobCount:number|null}){
  return <aside className="citizen-hud">
    <span className="citizen-hud-eyebrow">{community}</span>
    <div className="citizen-hud-profile"><span className="citizen-hud-avatar">🧒</span><div><b>{citizen.name}</b><small>{citizen.grade}학년 · {citizen.className??'반 미지정'}</small></div></div>
    <div className="citizen-hud-stat"><span>현재 맡은 직업</span><b>{jobCount===null?'확인 중…':`${jobCount}개`}</b></div>
  </aside>;
}
