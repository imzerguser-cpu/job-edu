import {collectionCatalogs,type StudentCollection} from './features/avatar/studentCollections';
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StorybookAvatar,gradeShapes,type BodyShape} from './features/avatar/StorybookAvatar';
import {StyleThumbnail} from './features/avatar/StorybookParts';
import {categoryLabels,defaultStyle,applyStyle,type StyleCategory,type CharacterStyle} from './features/avatar/storybookCatalog';
import {growthReference,growthShape,growthSource,type GrowthReference} from './domain/studentGrowth';
import './ui/character-preview.css';

function Preview(){
  const [collection,setCollection]=useState<StudentCollection>('boys');
  const [savedStyles,setSavedStyles]=useState({boys:{...defaultStyle},girls:{...defaultStyle}});
  const styleCatalog=collectionCatalogs[collection];
  const [focusFace,setFocusFace]=useState(false);
  const [reference,setReference]=useState<GrowthReference>('midpoint');
  const [shape,setShape]=useState<BodyShape>({...gradeShapes[2]});
  const [grade,setGrade]=useState(3);
  const [style,setStyle]=useState<CharacterStyle>({...defaultStyle});
  const [category,setCategory]=useState<StyleCategory>('hair');
  const [message,setMessage]=useState('');
  const stats=growthReference(grade,reference);
  const active=style[category];
  function choose(index:number){setStyle(s=>applyStyle(s,category,index));setMessage(`${styleCatalog[category][index]} 적용했어요.`)}
  return <main className="character-lab"><header><span className="eyebrow">작은 사회 · 나만의 캐릭터 공방</span><h1>오늘은 어떤 모습일까?</h1><p>눈·코·입과 상의·하의·신발을 자유롭게 조합해 보세요.</p></header>
    <div className="character-workspace"><section className="character-stage" aria-label="캐릭터 미리보기"><div className="stage-tag">{styleCatalog.outfit[style.outfit]}</div><button className="focus-face" onClick={()=>setFocusFace(v=>!v)}>{focusFace?'전체 보기':'얼굴 확대'}</button><StorybookAvatar shape={shape} style={style} collection={collection} focusFace={focusFace} label={`${styleCatalog.hair[style.hair]}, ${styleCatalog.outfit[style.outfit]}, ${styleCatalog.shoes[style.shoes]} 캐릭터`}/><div className="stage-caption">{styleCatalog.hair[style.hair]} · {styleCatalog.shoes[style.shoes]}</div></section>
    <section className="character-controls" aria-label="캐릭터 꾸미기"><span className="eyebrow">MY STYLE · 자유롭게 조합해요</span><h2>내가 고르는 나의 모습</h2>
      <div className="grade-buttons" aria-label="캐릭터 선택">{(['boys','girls'] as const).map(value=><button key={value} aria-pressed={collection===value} onClick={()=>{if(value===collection)return;setSavedStyles(previous=>({...previous,[collection]:style}));setStyle(savedStyles[value]);setCollection(value);setMessage('');}}>{value==='boys'?'남학생':'여학생'}</button>)}</div>
      <div className="style-categories" aria-label="꾸미기 종류">{(Object.keys(styleCatalog) as StyleCategory[]).map(key=><button key={key} aria-pressed={category===key} onClick={()=>{setCategory(key);setFocusFace(['face','eyes','nose','mouth'].includes(key))}}>{categoryLabels[key]} <small>{styleCatalog[key].length}</small></button>)}</div>
      <div className="style-heading"><h3>{categoryLabels[category]} 고르기</h3><span>{styleCatalog[category][active]}</span></div>
      <div className="style-grid">{styleCatalog[category].map((name,index)=><button key={`${category}-${index}`} aria-pressed={active===index} onClick={()=>choose(index)} aria-label={name}>
        <StyleThumbnail category={category} index={index} collection={collection}/>
        <span>{name}</span>{active===index&&<b className="selected-mark" aria-hidden="true">✓</b>}
      </button>)}</div>
      <p role="status" className="status">{message||'마음에 드는 카드를 누르면 바로 바뀌어요.'}</p>
      <details className="body-settings"><summary>키·체형 조절 <span>{grade}학년 기준</span></summary>
        <div className="grade-buttons">{gradeShapes.map((_,i)=><button key={i} aria-pressed={grade===i+1} onClick={()=>{setGrade(i+1);setShape(growthShape(i+1,reference))}}>{i+1}학년</button>)}</div>
        <label htmlFor="reference">시작 비율 기준</label><select id="reference" value={reference} onChange={e=>{const value=e.target.value as GrowthReference;setReference(value);setShape(growthShape(grade,value))}}><option value="midpoint">남녀 평균의 중간값</option><option value="boys">남학생 평균</option><option value="girls">여학생 평균</option></select>
        <p className="growth-reference">{grade}학년 기준: {stats.cm.toFixed(1)} cm · {stats.kg.toFixed(1)} kg<br/><a href={growthSource} target="_blank" rel="noreferrer">교육부 2025년 학생 건강검사 표본통계</a><br/>중간값은 남녀 평균을 반씩 합한 참고값이에요.</p>
        <div className="shape-control"><label htmlFor="height">키</label><input id="height" type="range" min="0" max="100" value={shape.height} onChange={e=>setShape(s=>({...s,height:Number(e.target.value)}))}/><div className="range-captions"><span>아담하게</span><span>길쭉하게</span></div></div>
        <div className="shape-control"><label htmlFor="build">체형</label><input id="build" type="range" min="0" max="100" value={shape.build} onChange={e=>setShape(s=>({...s,build:Number(e.target.value)}))}/><div className="range-captions"><span>가늘게</span><span>통통하게</span></div></div>
        <button className="reset-shape" onClick={()=>setShape(growthShape(grade,reference))}>학년 기준 비율로 되돌리기</button>
      </details>
      <button className="reset-shape reset-style" onClick={()=>{setStyle({...defaultStyle});setMessage('꾸미기를 처음 모습으로 되돌렸어요.')}}>꾸미기 처음으로</button>
      <p className="prototype-note">디자인 체험 화면 · 선택한 모습은 학교 계정에 저장되지 않아요. <a href="/">학교 계정으로 로그인해서 저장·구매하기</a></p>
    </section></div>
  </main>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
