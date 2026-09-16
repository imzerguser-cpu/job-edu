import type {ReactNode} from 'react';
import {DestinationIcon} from './DestinationIcon';
import {buildings} from './buildings';

export function BuildingShell({title,subtitle,eyebrow,onBack,children}:{title:string;subtitle:string;eyebrow?:string;onBack:()=>void;children:ReactNode}){
  const building=buildings.find(b=>b.label===title);
  return <section className="citizen-building">
    <div className="citizen-building-head">
      <button className="citizen-back" onClick={onBack}>← 지도</button>
      <div className="building-title">{eyebrow&&<span className="citizen-hud-eyebrow">{eyebrow}</span>}<h1 tabIndex={-1}>{title}</h1><p className="citizen-building-sub">{subtitle}</p></div>
      {building&&<DestinationIcon className="building-icon" id={building.id}/>}
    </div>
    {children}
  </section>;
}
