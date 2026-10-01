import {departments} from '../../domain/jobs';
import {buildings,type BuildingId} from './buildings';
import {DestinationIcon} from './DestinationIcon';
import {outlineGeometry} from './buildingOutlines';

export function CitizenMap({onNavigate}:{onNavigate:(id:BuildingId)=>void}){
  return <section className="citizen-explore" aria-label="우리 사회 둘러보기">
    <div className="map-intro"><div><span className="eyebrow">오늘도 함께 자라는 우리 사회</span><h2>어디로 가 볼까요?</h2></div><p>지도 속 건물이나 아래 버튼을 눌러 이동해요.</p></div>
    <div className="citizen-map">
    <img className="citizen-map-img" src="/assets/backgrounds/citizen_map_background.png" alt="우리 사회 지도"/>
    {buildings.map(b=>{
      const dept=b.departmentId?departments.find(d=>d.id===b.departmentId):null;
      const tooltip=dept?`${dept.name} · ${b.label}`:b.label;
      const {viewBox,points,...style}=outlineGeometry(b.id);
      return <button key={b.id} className="citizen-hotspot"
        style={style}
        onClick={()=>onNavigate(b.id)} aria-label={tooltip} title={tooltip}>
        <svg viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true"><polygon points={points} vectorEffect="non-scaling-stroke"/></svg>
      </button>;
    })}
    </div>
    <nav className="destination-grid" aria-label="공간 바로가기">{buildings.map(b=><button key={b.id} className={`destination destination-${b.departmentId??'home'}`} onClick={()=>onNavigate(b.id)}><DestinationIcon id={b.id}/><span>{b.label}</span><span className="destination-arrow" aria-hidden="true">↗</span></button>)}</nav>
  </section>;
}
