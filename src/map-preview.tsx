import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CitizenMap} from './features/map/CitizenMap';
import {buildings} from './features/map/buildings';
import './ui/citizen.css';
import './ui/community.css';

function Preview(){
  const [all,setAll]=useState(false);
  const [selected,setSelected]=useState('');
  return <main className={all?'show-outlines':''}>
    <h1>건물 선택 윤곽 미리보기</h1>
    <p>건물 위에 마우스를 올리거나 Tab 키로 이동해 흰색 선택 테두리를 확인하세요.</p>
    <label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> 모든 윤곽선 보기</label>
    <p role="status">{selected?`${selected} 선택됨`:'건물을 클릭하면 선택한 이름이 여기에 표시됩니다.'}</p>
    <CitizenMap onNavigate={id=>setSelected(buildings.find(b=>b.id===id)!.label)}/>
  </main>;
}
const style=document.createElement('style');
style.textContent='*{box-sizing:border-box}body{margin:0;background:#f5f6ef;color:#253e30;font-family:system-ui,sans-serif}main{max-width:1400px;margin:32px auto;padding:0 24px}h1{font-size:26px}p{line-height:1.6}label{cursor:pointer}.show-outlines .citizen-hotspot polygon{stroke:white;fill:#ffffff12}.map-intro,.destination-grid{display:none}';
document.head.append(style);
createRoot(document.getElementById('root')!).render(<Preview/>);
