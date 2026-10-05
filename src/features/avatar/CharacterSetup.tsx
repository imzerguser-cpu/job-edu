import {useEffect,useRef,useState} from 'react';
import {defaultStorybook,type StorybookAppearance} from '../../domain/storybook';
import type {AvatarStore} from '../../data/avatarRepository';
import type {StudentCollection} from './studentCollections';
import {StorybookAvatar} from './StorybookAvatar';
import {StorybookStudio} from './StorybookStudio';
import '../../ui/avatar.css';

// 처음 로그인한 학생의 캐릭터 만들기(D-125, 사용자 요청): ① 남학생/여학생 고르기 → ② 무료 부위 꾸미기 → 저장.
// 머리·옷·신발은 나중에 학교 화폐로 상점에서 산다(레벨 잠금, D-120).
export function CharacterSetup({store,name,grade,currencySymbol,onDone}:{store:AvatarStore;name:string;grade:number;currencySymbol:string;onDone:(a:StorybookAppearance)=>void}){
  const [collection,setCollection]=useState<StudentCollection|null>(null);
  // 고른 뒤 확인 단계: 남/여는 한 번 정하면 바꿀 수 없으므로(D-126) 경고를 보여 주고 확정받는다.
  const [picked,setPicked]=useState<StudentCollection|null>(null);
  // 게임 창(GameWindow)과 같은 <dialog> 모달. 캐릭터를 저장해야 시작할 수 있으므로 Esc로 닫히지 않는다.
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const modal=dialog.current;modal?.showModal();const {overflow}=document.body.style;document.body.style.overflow='hidden';return ()=>{modal?.close();document.body.style.overflow=overflow}},[]);
  return <dialog className="game-window-backdrop" ref={dialog} aria-labelledby="setup-title" onCancel={e=>e.preventDefault()}>
    <div className="game-window character-setup">
      <header className="game-window-bar"><div className="game-window-title"><span className="citizen-hud-eyebrow">처음 오셨군요, {name} 시민!</span><h1 id="setup-title">{collection?'2단계 · 내 얼굴 꾸미기':'1단계 · 내 캐릭터 고르기'}</h1><p>{collection?'얼굴형·눈·코·입과 키를 골라요. 옷과 머리는 일해서 번 돈으로 상점에서 살 수 있어요.':'마을에서 나를 보여 줄 캐릭터를 골라요.'}</p></div></header>
      <div className="game-window-body">
        {!collection?<div className="setup-choice">
          {(['boys','girls'] as const).map(c=>{const look=defaultStorybook(grade);return <button key={c} type="button" className="setup-card" aria-pressed={picked===c} onClick={()=>setPicked(c)}>
            <StorybookAvatar style={look.style} shape={look.shape} collection={c} label={c==='boys'?'남학생 캐릭터':'여학생 캐릭터'}/>
            <b>{c==='boys'?'🧒 남학생':'👧 여학생'}</b>
          </button>})}
          {picked&&<section className="setup-confirm" role="alertdialog" aria-labelledby="setup-confirm-title">
            <h2 id="setup-confirm-title">{picked==='boys'?'🧒 남학생':'👧 여학생'} 캐릭터로 정할까요?</h2>
            <p className="setup-warning">⚠️ 남학생·여학생은 <b>한 번 정하면 다시 바꿀 수 없어요.</b> 얼굴·머리·옷은 나중에 언제든 바꿀 수 있어요.</p>
            <div className="header-actions"><button type="button" className="button primary" onClick={()=>setCollection(picked)}>네, {picked==='boys'?'남학생':'여학생'}으로 정할게요</button><button type="button" className="button quiet" onClick={()=>setPicked(null)}>다시 고를래요</button></div>
          </section>}
        </div>:<>
          <StorybookStudio store={store} currencySymbol={currencySymbol} grade={grade} setup initial={{...defaultStorybook(grade),collection}} onSaved={onDone}/>
        </>}
      </div>
    </div>
  </dialog>;
}
