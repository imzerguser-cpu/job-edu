import {useState} from 'react';
import {achievements,levelInfo,quests,totalXp,xpBreakdown,type GrowthStats} from '../../domain/growth';
import type {Student} from '../../domain/model';
import {buildings,type BuildingId} from './buildings';
import {hollandInfo,type HollandType} from '../../domain/careerDiscovery';

export const characters=['blue','cap','glasses','green','pink','purple','teal','yellow'] as const;
export type CharacterId=typeof characters[number];
export const characterSrc=(id:CharacterId)=>`/assets/characters/student_${id}_character.png`;

// 캐릭터 선택은 이 기기(브라우저)에만 저장한다 — 꾸미기일 뿐 사회 기록이 아니어서
// 새 Firestore 필드/Rules를 늘리지 않았다. 처음엔 학생 id로 정해진 캐릭터를 보여 준다.
function characterKey(studentId:string){return `jobedu-character-${studentId}`}
function defaultCharacter(studentId:string):CharacterId{let h=0;for(const c of studentId)h=(h*31+c.charCodeAt(0))>>>0;return characters[h%characters.length]}
export function loadCharacter(studentId:string):CharacterId{
  try{const saved=localStorage.getItem(characterKey(studentId));if(saved&&(characters as readonly string[]).includes(saved))return saved as CharacterId}catch{/* 저장소를 못 쓰면 기본 캐릭터 */}
  return defaultCharacter(studentId);
}
export function saveCharacter(studentId:string,id:CharacterId){try{localStorage.setItem(characterKey(studentId),id)}catch{/* 이번 화면에서만 바뀐다 */}}

// 레벨 업 알림: 마지막으로 본 레벨보다 올랐으면 한 번 축하해 준다.
function levelKey(studentId:string){return `jobedu-level-seen-${studentId}`}
export function lastSeenLevel(studentId:string){try{const n=Number(localStorage.getItem(levelKey(studentId)));return Number.isInteger(n)&&n>0?n:null}catch{return null}}
export function markLevelSeen(studentId:string,level:number){try{localStorage.setItem(levelKey(studentId),String(level))}catch{/* 다음에 다시 축하해도 괜찮다 */}}

export function CharacterHud({citizen,community,character,stats,jobCount,onGuide,onGrowth,onPickCharacter,onDiscover}:{citizen:Student;community:string;character:CharacterId;stats:GrowthStats|null;jobCount:number|null;onGuide:()=>void;onGrowth:()=>void;onPickCharacter:()=>void;onDiscover:()=>void}){
  const info=stats?levelInfo(totalXp(stats)):null;
  return <aside className="citizen-hud game-hud">
    <button type="button" className="hud-avatar" onClick={onPickCharacter} aria-label="내 캐릭터 바꾸기">
      <img src={characterSrc(character)} alt=""/>
      <span className="hud-level">{info?`Lv.${info.level}`:'Lv.?'}</span>
    </button>
    <div className="hud-main">
      <div className="citizen-hud-top"><span className="citizen-hud-eyebrow">{community}</span><span className="hud-title">{info?.title??'성장 기록 확인 중…'}</span>
        {stats?.discoveryCode&&<button type="button" className="hud-type" onClick={onDiscover} title="나를 찾는 모험 결과 보기">{stats.discoveryCode.split('').map(t=>hollandInfo[t as HollandType].icon+' '+hollandInfo[t as HollandType].name).join(' · ')}</button>}</div>
      <b className="hud-name">{citizen.name} 시민 <small>{citizen.grade}학년 · {citizen.className??'반 미지정'}</small></b>
      <div className="xp-bar" role="progressbar" aria-label="다음 레벨까지 경험치" aria-valuemin={0} aria-valuemax={100} aria-valuenow={info?Math.round(info.progress*100):0}>
        <span style={{width:`${info?Math.round(info.progress*100):0}%`}}/>
      </div>
      <small className="xp-text">{!info?'경험치를 계산하고 있어요':info.next===null?`최고 레벨! 경험치 ${info.xp.toLocaleString()}`:`경험치 ${info.xp.toLocaleString()} · 다음 레벨까지 ${info.toNext.toLocaleString()}`}</small>
    </div>
    <div className="hud-side">
      <div className="citizen-hud-stat"><span>맡은 직업</span><b>{jobCount===null?'…':`${jobCount}개`}</b></div>
      <div className="hud-buttons">
        <button type="button" className="button secondary small" onClick={onDiscover}>🧭 나를 찾기</button>
        <button type="button" className="button secondary small" onClick={onGrowth}>🏅 성장 기록</button>
        <button type="button" className="button quiet small" onClick={onGuide}>📖 설명서</button>
      </div>
    </div>
  </aside>;
}

export function QuestBoard({stats,onGo}:{stats:GrowthStats|null;onGo:(id:BuildingId,tab?:string)=>void}){
  if(!stats)return null;
  const list=quests(stats);
  const place=(id:BuildingId)=>buildings.find(b=>b.id===id)?.label??'';
  return <section className="quest-board" aria-label="지금 할 수 있는 모험">
    <h2>⚔️ 지금 할 수 있는 모험</h2>
    {!list.length?<p className="quest-empty">대단해요! 지금 할 모험을 모두 끝냈어요. 친구를 도와 볼까요?</p>
      :<div className="quest-list">{list.map(q=><button key={q.id} type="button" className="quest-card" onClick={()=>onGo(q.target,q.tab)}>
        <span className="quest-icon" aria-hidden="true">{q.icon}</span>
        <span className="quest-text"><b>{q.title}</b><small>{q.desc}</small></span>
        <span className="quest-reward">+{q.xp} XP<small>{place(q.target)}로 ↗</small></span>
      </button>)}</div>}
  </section>;
}

export function GrowthPanel({stats}:{stats:GrowthStats|null}){
  if(!stats)return <p role="status">성장 기록을 불러오고 있어요.</p>;
  const info=levelInfo(totalXp(stats)),rows=xpBreakdown(stats),badges=achievements(stats);
  return <div className="growth-panel">
    <section className="panel growth-level">
      <span className="growth-level-num">Lv.{info.level}</span>
      <div><h2>{info.title}</h2><p>{info.next===null?'최고 레벨에 도달했어요! 이제 친구들을 이끌어 주세요.':`다음 레벨까지 경험치 ${info.toNext.toLocaleString()}가 남았어요.`}</p>
        <div className="xp-bar big"><span style={{width:`${Math.round(info.progress*100)}%`}}/></div></div>
    </section>
    <section className="panel section">
      <h2>🏅 업적 배지 <small className="muted">{badges.filter(b=>b.earned).length}/{badges.length}</small></h2>
      <div className="badge-grid">{badges.map(b=><div key={b.id} className={`achievement${b.earned?' earned':''}`} title={b.desc}>
        <span aria-hidden="true">{b.earned?b.icon:'🔒'}</span><b>{b.title}</b><small>{b.desc}</small>
      </div>)}</div>
    </section>
    <section className="panel section">
      <h2>✨ 경험치는 이렇게 모여요</h2>
      <div className="table-scroll"><table><thead><tr><th>한 일</th><th>한 번에</th><th>내 기록</th><th>얻은 경험치</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.key}><td>{r.label}</td><td>+{r.xp}</td><td>{r.count}번</td><td><b>{r.total.toLocaleString()}</b></td></tr>)}</tbody></table></div>
      <p className="muted">경험치는 선생님이 확인한 실제 기록으로만 계산돼요. 열심히 일하고, 아껴 쓰고, 의견을 내면 레벨이 올라요.</p>
    </section>
  </div>;
}

export function CharacterPicker({current,onPick,onClose}:{current:CharacterId;onPick:(id:CharacterId)=>void;onClose:()=>void}){
  const [choice,setChoice]=useState(current);
  return <div className="character-picker">
    <p>마음에 드는 캐릭터를 골라요. 이 기기에서 내 캐릭터로 보여요.</p>
    <div className="character-grid">{characters.map(id=><button key={id} type="button" aria-pressed={choice===id} onClick={()=>setChoice(id)}><img src={characterSrc(id)} alt=""/></button>)}</div>
    <div className="header-actions section"><button type="button" className="button primary" onClick={()=>{onPick(choice);onClose()}}>이 캐릭터로 할래요</button><button type="button" className="button quiet" onClick={onClose}>닫기</button></div>
  </div>;
}

export function LevelUpToast({level,title,onClose}:{level:number;title:string;onClose:()=>void}){
  return <div className="levelup-toast" role="status">
    <span className="levelup-burst" aria-hidden="true">🎉</span>
    <div><b>레벨 업! Lv.{level}</b><small>이제 <strong>{title}</strong>이에요.</small></div>
    <button type="button" className="button quiet small" onClick={onClose}>좋아요!</button>
  </div>;
}
