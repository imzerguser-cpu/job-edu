import {useEffect,useRef,useState} from 'react';
import {avatarOptions,canWear,defaultAvatar,fashionItems,optionLabels,partLabels,wearItem,type AvatarAppearance,type AvatarPart,type FashionItem,type FashionSlot} from '../../domain/avatar';
import type {AvatarSnapshot,AvatarStore} from '../../data/avatarRepository';
import {formatMoney} from '../../domain/money';
import {Avatar} from './Avatar';
import '../../ui/avatar.css';

export function AvatarStudio({store,currencySymbol,onSaved,onShop,shop=false}:{store:AvatarStore;currencySymbol:string;onSaved:(a:AvatarAppearance)=>void;onShop?:()=>void;shop?:boolean}){
  const [data,setData]=useState<AvatarSnapshot|null>(null),[draft,setDraft]=useState<AvatarAppearance>({...defaultAvatar});
  const [part,setPart]=useState<AvatarPart>('face'),[filter,setFilter]=useState<'all'|FashionSlot>('all');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState<FashionItem|null>(null);
  const mounted=useRef(false),working=useRef(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{mounted.current=true;setData(null);setError('');store.load().then(d=>{if(mounted.current){setData(d);setDraft(d.appearance)}}).catch(e=>{if(mounted.current)setError(e.message)});return()=>{mounted.current=false}},[store,attempt]);
  async function save(){
    if(working.current||!data)return;
    if(!canWear(draft,data.owned)){setError('미리 입어 본 아이템을 구매하거나 가지고 있는 옷으로 바꿔 주세요.');return}
    working.current=true;setBusy(true);setError('');setMessage('');
    try{await store.save(draft);onSaved(draft);if(mounted.current){setData({...data,appearance:draft});setMessage('내 캐릭터를 저장했어요!')}}catch(e){if(mounted.current)setError((e as Error).message)}finally{working.current=false;if(mounted.current)setBusy(false)}
  }
  async function purchase(){
    if(!pending||working.current)return;
    const item=pending;working.current=true;setBusy(true);setError('');setMessage('');
    try{
      await store.buy(item.id);
      if(mounted.current){setPending(null);setData(d=>d?{...d,owned:[...new Set([...d.owned,item.id])],balanceMinor:d.balanceMinor-item.priceMinor}:d);setMessage(`${item.name} 구매 완료! 옷장에 보관했어요. ‘이 모습 저장’을 누르면 착용해요.`)}
      const next=await store.load();if(mounted.current)setData(next);
    }catch(e){if(mounted.current)setError((e as Error).message)}finally{working.current=false;if(mounted.current)setBusy(false)}
  }
  if(!data)return <div>{error?<><p className="error" role="alert">{error}</p><button className="button secondary" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></>:<p role="status">내 캐릭터와 옷장을 불러오고 있어요.</p>}</div>;
  const owned=(item:FashionItem)=>data.owned.includes(item.id);
  return <div className="avatar-studio">
    <aside className="avatar-preview">
      <Avatar appearance={draft} label="꾸미는 중인 내 캐릭터 전신"/>
      <b>{shop?'미리 입어 보기':'나만의 캐릭터'}</b>
      <p className="muted">얼굴과 기본 머리는 무료 · 새로운 스타일은 학교 화폐로 구매</p>
      <button type="button" className="button primary" disabled={busy||!canWear(draft,data.owned)} onClick={save}>{busy?'처리 중…':'이 모습 저장'}</button>
      <button type="button" className="button quiet" disabled={busy} onClick={()=>{setDraft(data.appearance);setPending(null);setMessage('')}}>저장된 모습으로</button>
      {!canWear(draft,data.owned)&&<p className="muted">구매 전 미리 입어 보는 중이에요.</p>}
    </aside>
    <section className="avatar-options" aria-label={shop?'패션 상점':'캐릭터 꾸미기'}>
      <div className="section-heading"><h2>{shop?'옷 · 신발 · 패션 상점':'내 얼굴과 옷장'}</h2><span className="tag">잔액 {formatMoney(data.balanceMinor,currencySymbol)}</span></div>
      {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
      {pending&&<section className="avatar-confirm" aria-label="구매 확인"><h3>{pending.name} 구매하기</h3><p>{formatMoney(pending.priceMinor,currencySymbol)} 사용 · 구매 후 잔액 {formatMoney(data.balanceMinor-pending.priceMinor,currencySymbol)}</p><div className="header-actions"><button className="button primary" disabled={busy||data.balanceMinor<pending.priceMinor} onClick={purchase}>학교 화폐로 구매 확정</button><button className="button quiet" disabled={busy} onClick={()=>setPending(null)}>취소</button></div></section>}
      {shop?<>
        <div className="avatar-tabs" aria-label="상품 종류">{(['all','outfit','hair','eyewear','headwear','shoes','accessory'] as const).map(slot=><button type="button" key={slot} aria-pressed={filter===slot} onClick={()=>setFilter(slot)}>{slot==='all'?`전체 ${fashionItems.length}`:`${partLabels[slot]} ${fashionItems.filter(i=>i.slot===slot).length}`}</button>)}</div>
        <div className="fashion-grid">{fashionItems.filter(i=>filter==='all'||i.slot===filter).map(item=><article className="fashion-card" key={item.id}>
          <Avatar appearance={wearItem(draft,item)} label={`${item.name} 착용 모습`}/><b>{item.name}</b><span>{owned(item)?'보유 중':formatMoney(item.priceMinor,currencySymbol)}</span>
          <button type="button" className="button secondary" disabled={busy} onClick={()=>{setDraft(wearItem(draft,item));setMessage('')}}>{owned(item)?'입어 보기':'미리 입어 보기'}</button>
          {!owned(item)&&<button type="button" className="button primary" disabled={busy||data.balanceMinor<item.priceMinor} onClick={()=>{setDraft(wearItem(draft,item));setPending(item);setError('')}}>{data.balanceMinor<item.priceMinor?'잔액 부족':'구매하기'}</button>}
        </article>)}</div>
      </>:<>
        <div className="avatar-tabs" aria-label="꾸미기 부위">{(Object.keys(avatarOptions) as AvatarPart[]).map(p=><button type="button" key={p} aria-pressed={part===p} onClick={()=>setPart(p)}>{partLabels[p]}</button>)}</div>
        <h3>{partLabels[part]} 고르기</h3><div className="avatar-choices">{avatarOptions[part].map(value=>{
          const item=fashionItems.find(i=>i.slot===part&&i.value===value),locked=!!item&&!owned(item);
          const appearance={...draft,[part]:value};
          return <button type="button" key={value} disabled={busy||locked} aria-pressed={draft[part]===value} onClick={()=>setDraft(appearance)}>
            <Avatar appearance={appearance}/><span>{optionLabels[value]}{locked?' · 상점에서 구매':''}</span>
          </button>;
        })}</div>
        {(['outfit','hair','eyewear','headwear','shoes','accessory'] as string[]).includes(part)&&onShop&&<button type="button" className="button secondary section" onClick={onShop}>상점에서 새 아이템 구경하기</button>}
      </>}
    </section>
  </div>;
}
