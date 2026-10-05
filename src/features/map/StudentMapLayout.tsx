import type {ReactNode} from 'react';
import {CitizenMap} from './CitizenMap';
import type {BuildingId} from './buildings';
import '../../ui/student-map.css';

export type MapPanel='profile'|'quests'|'goals'|'places'|'guide'|'news';

// Production and tablet preview share the same viewport layout.
export function StudentMapLayout({avatar,name,questCount,newsCount,onPanel,onNavigate,children}:{avatar?:ReactNode;name:string;questCount:number|null;newsCount?:number|null;onPanel:(panel:MapPanel)=>void;onNavigate:(id:BuildingId)=>void;children?:ReactNode}){
  return <div className="student-map-home">
    <nav className="map-toolbar" aria-label="학생 메뉴">
      <button type="button" onClick={()=>onPanel('profile')} aria-haspopup="dialog">{avatar??'👤'} {name}<span className="toolbar-detail"> · 내 정보</span></button>
      <button type="button" className="map-quests-button" onClick={()=>onPanel('quests')} aria-haspopup="dialog">🧭 지금 할 수 있는 모험{questCount!==null&&<span className="map-quest-count">{questCount}</span>}</button>
      {newsCount!==undefined&&<button type="button" className="map-quests-button" onClick={()=>onPanel('news')} aria-haspopup="dialog">🔔 새 소식{newsCount?<span className="map-quest-count">{newsCount}</span>:null}</button>}
      <button type="button" onClick={()=>onPanel('goals')} aria-haspopup="dialog">🌱 우리 반 목표</button>
      <button type="button" onClick={()=>onPanel('places')} aria-haspopup="dialog">🏘️ 건물 목록</button>
      <button type="button" onClick={()=>onPanel('guide')} aria-haspopup="dialog">❔ 안내서</button>
    </nav>
    <div className="student-map-stage"><CitizenMap compact onNavigate={onNavigate}/></div>
    <p className="map-touch-hint">건물을 터치해 들어가요. 작은 건물은 ‘건물 목록’에서도 고를 수 있어요.</p>
    {children}
  </div>;
}
