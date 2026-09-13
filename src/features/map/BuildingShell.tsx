import type {ReactNode} from 'react';

export function BuildingShell({title,subtitle,eyebrow,onBack,children}:{title:string;subtitle:string;eyebrow?:string;onBack:()=>void;children:ReactNode}){
  return <section className="citizen-building">
    <div className="citizen-building-head">
      <button className="citizen-back" onClick={onBack}>← 지도</button>
      <div>{eyebrow&&<span className="citizen-hud-eyebrow">{eyebrow}</span>}<h1>{title}</h1><p className="citizen-building-sub">{subtitle}</p></div>
    </div>
    {children}
  </section>;
}
