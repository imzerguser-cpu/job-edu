import {useEffect,useRef,useState} from 'react';
import type {AvatarSnapshot,AvatarStore} from '../../data/avatarRepository';
import {defaultStorybook,canWearStorybook,paidParts,storybookItems,storybookItemId,type StorybookAppearance,type StorybookItem,type StorybookSlot} from '../../domain/storybook';
import {formatMoney} from '../../domain/money';
import {growthShape} from '../../domain/studentGrowth';
import {StorybookAvatar} from './StorybookAvatar';
import {StyleThumbnail} from './StorybookParts';
import {categoryLabels,type StyleCategory} from './storybookCatalog';
import {collectionCatalogs} from './studentCollections';
import '../../ui/avatar.css';
export function StorybookStudio({store,currencySymbol,shop=false,grade=3,onSaved,onShop}:{store:AvatarStore;currencySymbol:string;shop?:boolean;grade?:number;onSaved?:(a:StorybookAppearance)=>void;onShop?:()=>void}){
  const [data,setData]=useState<AvatarSnapshot|null>(null),[draft,setDraft]=useState(()=>defaultStorybook(grade));
  const [category,setCategory]=useState<StyleCategory>(shop?'outfit':'face'),[pending,setPending]=useState<StorybookItem|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(0);
  const working=useRef(false),generation=useRef(0);
  useEffect(()=>{const current=++generation.current;setData(null);setError('');store.load().then(d=>{if(current===generation.current){setData(d);setDraft(d.storybook??defaultStorybook(grade));}}).catch(e=>{if(current===generation.current)setError(e.message)});return()=>{generation.current++}},[store,grade,attempt]);
  async function save(){if(working.current||!data)return;const selected=structuredClone(draft),current=generation.current;working.current=true;setBusy(true);setError('');setMessage('');try{await store.saveStorybook(selected);if(current===generation.current){setData({...data,storybook:selected});onSaved?.(selected);setMessage(store.preview?'체험 화면에 저장했어요. 새로고침하면 초기화돼요.':'학교 계정에 저장했어요. 다음 로그인에도 이 모습으로 만나요.')}}catch(e){if(current===generation.current)setError((e as Error).message)}finally{working.current=false;if(current===generation.current)setBusy(false)}}
  async function buy(){if(working.current||!pending||!data)return;const item=pending,current=generation.current;working.current=true;setBusy(true);setError('');setMessage('');let purchased=false;try{await store.buy(item.id);purchased=true;if(current===generation.current){setPending(null);setData(d=>d?{...d,owned:[...new Set([...d.owned,item.id])],balanceMinor:d.balanceMinor-item.priceMinor}:d);setMessage('구매 완료! 내 모습 저장을 누르면 착용한 모습도 저장돼요.')}const fresh=await store.load();if(current===generation.current)setData(fresh)}catch(e){if(current===generation.current)setError(purchased?'구매는 완료됐지만 잔액을 다시 불러오지 못했어요. 창을 다시 열어 확인해 주세요.':(e as Error).message)}finally{working.current=false;if(current===generation.current)setBusy(false)}}
  if(!data)return <div>{error?<><p role="alert" className="error">{error}</p><button className="button" onClick={()=>setAttempt(v=>v+1)}>다시 불러오기</button></>:<p role="status">내 캐릭터와 옷장을 불러오고 있어요.</p>}</div>;
  const catalog=collectionCatalogs[draft.collection],wearable=canWearStorybook(draft,data.owned);
  const categories:readonly StyleCategory[]=shop?paidParts:Object.keys(catalog) as StyleCategory[];
  const change=(index:number)=>{setDraft(d=>({...d,style:{...d.style,[category]:index}}));setPending(null);setMessage('')};
  return <div className="avatar-studio storybook-studio"><aside className="avatar-preview">
    <StorybookAvatar shape={draft.shape} style={draft.style} collection={draft.collection} label="꾸미는 중인 내 캐릭터"/>
    <button className="button primary" disabled={busy||!wearable} onClick={save}>{busy?'처리 중…':'내 모습 저장'}</button>
    <button className="button quiet" disabled={busy} onClick={()=>{setDraft(data.storybook??defaultStorybook(grade));setPending(null);setMessage('')}}>저장된 모습으로</button>
    <p>{wearable?'저장하면 마을과 내 정보에도 반영돼요.':'구매 전 미리 입어 보는 중이에요. 구매해야 저장할 수 있어요.'}</p>
  </aside><section className="avatar-options" aria-label={shop?'동화 캐릭터 상점':'동화 캐릭터 꾸미기'}>
    <div className="section-heading"><h2>{shop?'머리·상의·하의·신발 상점':'나만의 캐릭터'}</h2><span className="tag">잔액 {formatMoney(data.balanceMinor,currencySymbol)}</span></div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    <fieldset disabled={busy} className="storybook-controls"><legend className="sr-only">캐릭터 선택</legend>
    <div className="avatar-tabs">{(['boys','girls'] as const).map(c=><button key={c} aria-pressed={draft.collection===c} onClick={()=>{if(c===draft.collection)return;setDraft(d=>({...d,collection:c,style:{...d.style,hair:0,outfit:0,bottom:0,shoes:0}}));setPending(null);setMessage('')}}>{c==='boys'?'남학생':'여학생'}</button>)}</div>
    <div className="avatar-tabs">{categories.map(k=><button key={k} aria-pressed={category===k} onClick={()=>{setCategory(k);setPending(null)}}>{categoryLabels[k]} {catalog[k].length}</button>)}</div>
    {pending&&<section className="avatar-confirm" aria-label="구매 확인"><h3>{pending.name}</h3><p>{formatMoney(pending.priceMinor,currencySymbol)} 사용 · 구매 후 잔액 {formatMoney(data.balanceMinor-pending.priceMinor,currencySymbol)}</p><button className="button primary" disabled={data.balanceMinor<pending.priceMinor} onClick={buy}>학교 화폐로 구매 확정</button><button className="button quiet" onClick={()=>setPending(null)}>취소</button></section>}
    <div className="fashion-grid">{catalog[category].map((name,index)=>{
      const paid=(paidParts as readonly string[]).includes(category)&&index>0;
      const item=paid?storybookItems.find(i=>i.id===storybookItemId(draft.collection,category as StorybookSlot,index)):undefined;
      const owned=!item||data.owned.includes(item.id);
      return <article className="fashion-card" key={`${draft.collection}-${category}-${index}`}>
        <div className="storybook-thumbnail"><StyleThumbnail category={category} index={index} collection={draft.collection}/></div><b>{name}</b><span>{item?(owned?'보유 중':formatMoney(item.priceMinor,currencySymbol)):'무료'}</span>
        <button className="button secondary" aria-pressed={draft.style[category]===index} onClick={()=>change(index)}>{draft.style[category]===index?'선택됨':owned?'선택하기':'미리 입기'}</button>
        {item&&!owned&&<button className="button primary" disabled={data.balanceMinor<item.priceMinor} onClick={()=>{change(index);setPending(item)}}>{data.balanceMinor<item.priceMinor?'잔액 부족':'구매하기'}</button>}
      </article>;
    })}</div>
    {!shop&&<><details className="section"><summary>키·체형 조절</summary><div className="avatar-tabs">{[1,2,3,4,5,6].map(g=><button key={g} onClick={()=>setDraft(d=>({...d,shape:growthShape(g)}))}>{g}학년 평균</button>)}</div>{(['height','build'] as const).map(k=><label key={k} className="storybook-range">{k==='height'?'키':'체형'}<input type="range" min="0" max="100" value={draft.shape[k]} onChange={e=>setDraft(d=>({...d,shape:{...d.shape,[k]:Number(e.target.value)}}))}/></label>)}</details>{onShop&&<button className="button secondary section" onClick={onShop}>패션 상점 열기</button>}</>}
    </fieldset>
  </section></div>;
}
