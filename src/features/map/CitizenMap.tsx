import {departments} from '../../domain/jobs';
import {buildings,type BuildingId} from './buildings';

export function CitizenMap({onNavigate}:{onNavigate:(id:BuildingId)=>void}){
  return <div className="citizen-map">
    <img className="citizen-map-img" src="/assets/backgrounds/citizen_map_background.png" alt="우리 사회 지도"/>
    {buildings.map(b=>{
      const dept=b.departmentId?departments.find(d=>d.id===b.departmentId):null;
      const tooltip=dept?`${dept.name} · ${b.label}`:b.label;
      return <button key={b.id} className="citizen-hotspot"
        style={{left:`${b.hotspot.left}%`,top:`${b.hotspot.top}%`,width:`${b.hotspot.width}%`,height:`${b.hotspot.height}%`}}
        onClick={()=>onNavigate(b.id)} aria-label={tooltip}>
        <span>{tooltip}</span>
      </button>;
    })}
  </div>;
}
