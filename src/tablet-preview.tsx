import {Avatar} from './features/avatar/Avatar';
import {AvatarStudio} from './features/avatar/AvatarStudio';
import {previewAvatarStore} from './data/avatarRepository';
import {defaultAvatar} from './domain/avatar';
import {useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import './ui/theme.css';
import './ui/careers.css';
import './ui/citizen.css';
import './ui/community.css';
import './ui/game.css';
import {StudentMapLayout,type MapPanel} from './features/map/StudentMapLayout';
import {DestinationMenu} from './features/map/CitizenMap';
import {GameWindow} from './features/map/GameWindow';
import {CharacterHud,QuestBoard,GrowthPanel} from './features/map/CitizenGrowth';
import {buildings,type BuildingId} from './features/map/buildings';
import {emptyGrowthStats,quests} from './domain/growth';
import type {Student} from './domain/model';

const citizen:Student={id:'preview',schoolId:'preview',name:'하늘',grade:3,className:'1반',citizenCode:'PREVIEW',schoolYear:2026,status:'active',schemaVersion:1};
const stats={...emptyGrowthStats,tasksOpen:2,tasksRevision:1,openTaskBuilding:'library' as const};
function TabletPreview(){
  const [view,setView]=useState<'map'|MapPanel|BuildingId|'growth'|'character'>(()=>{
    const requested=new URLSearchParams(location.search).get('view');
    return requested==='character'||requested==='store'?requested:'map';
  });
  const [avatar,setAvatar]=useState({...defaultAvatar});
  const [avatarStore]=useState(()=>previewAvatarStore());
  const studio=(shop=false)=><><p className="notice">체험용 화폐 100으로 시작해요. 실제 학교 잔액에는 영향을 주지 않으며 새로고침하면 초기화됩니다.</p><AvatarStudio store={avatarStore} currencySymbol="체험 화폐" shop={shop} onSaved={setAvatar} onShop={()=>setView('store')}/></>;
  const close=()=>setView('map');
  const building=buildings.find(b=>b.id===view);
  let title='',content:ReactNode=null;
  if(view==='quests'){title='지금 할 수 있는 모험';content=<QuestBoard stats={stats} onGo={setView}/>}
  else if(view==='places'){title='건물 목록';content=<DestinationMenu onNavigate={setView}/>}
  else if(view==='profile'){title='내 정보';content=<CharacterHud avatar={avatar} citizen={citizen} community="마동 사회" character="blue" stats={stats} jobCount={0} onGuide={()=>setView('guide')} onGrowth={()=>setView('growth')} onPickCharacter={()=>setView('character')} onDiscover={()=>setView('mypage')}/>}
  else if(view==='growth'){title='나의 성장 기록';content=<GrowthPanel stats={stats}/>}
  else if(view==='character'){title='내 캐릭터';content=studio()}
  else if(view==='store'){title='패션 상점';content=studio(true)}
  else if(view==='mypage'){title='캐릭터 꾸미기';content=studio()}
  else if(view==='goals'){title='우리 반 공동 목표';content=<section className="panel"><h2>친구와 함께 도와주기</h2><p>미리보기용 목표예요. 함께 도움 10번을 모아 봐요!</p><progress value={4} max={10} aria-label="공동 목표 진행률"/><p>4 / 10</p></section>}
  else if(view==='guide'){title='사용 안내서';content=<section className="panel"><h2>지도에서 시작해요</h2><p>건물을 터치하면 지도 위에 창이 열려요. 모험을 고르면 해당 건물로 이동해요. 닫기 버튼을 누르면 지도로 돌아와요.</p><p>이 페이지는 가상 데이터로 태블릿 배치를 확인하는 미리보기입니다.</p></section>}
  else if(building){title=building.label;content=<section className="panel"><h2>{building.label}에 오신 것을 환영해요!</h2><p>{building.subtitle}</p><p>배치 확인용 미리보기입니다. 실제 학생 화면에서는 이 창 안에 해당 건물의 업무와 기능이 표시됩니다.</p><button className="button primary section" onClick={close}>지도로 돌아가기</button></section>}
  return <div className="shell"><header className="header"><div className="brand"><span className="brand-mark">M</span>마동 사회</div><span className="tag">태블릿 미리보기</span></header><main>
    <StudentMapLayout avatar={<Avatar appearance={avatar} className="toolbar-avatar"/>} name={citizen.name} questCount={quests(stats).length} onPanel={setView} onNavigate={setView}>
      {view!=='map'&&<GameWindow key={view} buildingId={building?.id} title={title} subtitle="닫으면 같은 지도로 돌아와요" onClose={close} tabs={[{id:view,icon:'',label:title,content}]}/>}
    </StudentMapLayout>
  </main></div>;
}
const previewRoot=createRoot(document.getElementById('root')!);
previewRoot.render(<TabletPreview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>previewRoot.unmount());
