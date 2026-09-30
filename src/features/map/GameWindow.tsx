import {useEffect,useRef,useState,type ReactNode} from 'react';
import {DestinationIcon} from './DestinationIcon';
import type {BuildingId} from './buildings';

export interface GameTab {id:string;icon:string;label:string;content:ReactNode}

// 건물을 누르면 지도 위에 게임 창처럼 뜨는 창(사용자 요청: "게임창과 같이 새로운 창으로").
// 지도는 뒤에 그대로 남아 있어서 창을 닫으면 바로 다음 건물로 이동할 수 있다.
// 탭은 고른 것 하나만 그린다 — 각 업무 화면이 열릴 때 자기 데이터를 불러오므로
// 안 보는 탭까지 한꺼번에 서버를 부르지 않게 하기 위함.
export function GameWindow({buildingId,title,subtitle,eyebrow,tabs,initialTab,onClose}:{buildingId?:BuildingId;title:string;subtitle:string;eyebrow?:string;tabs:GameTab[];initialTab?:string;onClose:()=>void}){
  const [active,setActive]=useState(()=>tabs.some(t=>t.id===initialTab)?initialTab!:tabs[0]?.id);
  const dialog=useRef<HTMLDivElement>(null);
  // onClose는 부모가 매번 새 함수로 넘겨도 되도록 ref로 보관한다 — effect가 다시 돌면
  // 입력 중인 칸에서 포커스를 창으로 빼앗아 버리기 때문.
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.focus();
    const {overflow}=document.body.style;document.body.style.overflow='hidden';
    // 글을 쓰던 칸에서 Esc를 눌러 작성 중인 내용이 날아가지 않도록 입력 칸 밖에서만 닫는다.
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select')))closeRef.current()};
    window.addEventListener('keydown',onKey);
    return ()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;previous?.focus?.()};
  },[]);
  const current=tabs.find(t=>t.id===active)??tabs[0];
  // 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 태블릿에서 실수로 스쳐 작성 중인 제출물이
  // 사라지는 일을 막기 위해 닫기는 ✕ 버튼과 Esc로만.
  return <div className="game-window-backdrop">
    <div className="game-window" role="dialog" aria-modal="true" aria-labelledby="game-window-title" tabIndex={-1} ref={dialog}>
      <header className="game-window-bar">
        {buildingId&&<DestinationIcon className="game-window-icon" id={buildingId}/>}
        <div className="game-window-title">{eyebrow&&<span className="citizen-hud-eyebrow">{eyebrow}</span>}<h1 id="game-window-title">{title}</h1><p>{subtitle}</p></div>
        <button type="button" className="game-window-close" onClick={onClose} aria-label="창 닫고 지도로 돌아가기">✕</button>
      </header>
      {tabs.length>1&&<nav className="game-window-tabs" role="tablist" aria-label={`${title} 메뉴`}>
        {tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={t.id===current?.id} onClick={()=>setActive(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}
      </nav>}
      <div className="game-window-body" role="tabpanel">{current?.content}</div>
    </div>
  </div>;
}
