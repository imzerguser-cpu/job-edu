import {useId} from 'react';
import {collectionIndex,collectionFilter,type StudentCollection} from './studentCollections';
import {defaultStyle,type CharacterStyle} from './storybookCatalog';
import {PaintedBottoms} from './PaintedBottoms';
import {PaintedLowerBody} from './PaintedLowerBody';

type Rect=readonly [number,number,number,number];
const base='/assets/avatar-storybook/';
// Sprite rectangles are source-image coordinates; SVG viewports keep the
// original alpha and painted pixels intact instead of rewriting the artwork.
const heads:Rect[]=[
 [70,75,290,290],[460,75,295,290],[850,85,295,285],[1235,75,310,300],[1625,55,320,320],
 [40,445,350,295],[445,430,310,310],[835,435,320,310],[1235,440,305,310],[1625,430,320,310],
];
export function AtlasSprite({file,rect,x,y,width,height,contour}:{file:string;rect:Rect;x:number;y:number;width:number;height:number;contour?:string}){
  const clip=useId().replaceAll(':','');
  const dimensions=(file==='outfits-v1.png'||file==='noses-v3.png'||file==='heads-v3.png')?[1983,793]:[1254,1254];
  return <g transform={`translate(${x} ${y}) scale(${width/rect[2]} ${height/rect[3]}) translate(${-rect[0]} ${-rect[1]})`} aria-hidden="true"><defs><clipPath id={clip}>{contour?<path d={contour}/>:<rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]}/>}</clipPath></defs><image clipPath={`url(#${clip})`} href={base+file} x="0" y="0" width={dimensions[0]} height={dimensions[1]}/></g>;
}
export function headLayout(hair:number){
  const rect=heads[hair];
  const centers=[216,604,992,1386,1760,215,603,992,1384,1770];
  const necks=[350,350,350,350,350,704,704,704,704,704];
  const chins=[315,315,315,315,315,668,668,668,668,668];
  const eyeLines=[269,269,268,269,269,623,623,622,623,623];
  const sy=2.05,neck=necks[hair],chin=chins[hair];
  const x=-(centers[hair]-rect[0])*sy,top=20-(neck-rect[1])*sy;
  const landmark=(y:number)=>20+(y-neck)*sy;
  return {rect,x,top,width:rect[2]*sy,height:rect[3]*sy,eyes:landmark(eyeLines[hair])-8,nose:landmark(chin-28),mouth:landmark(chin-12),chin:landmark(chin)};
}
// Width profiles affect cheeks and jaw symmetrically; hairline and neck stay anchored.
export function faceWidthAt(index:number,y:number,chin:number){
  const profiles=[[1,1],[1.15,1.10],[.93,.95],[1.04,1.10]];
  const [cheek,jaw]=profiles[index]??profiles[0];
  const knots=[[-280,1],[-175,cheek],[chin-42,jaw],[chin+18,1]];
  for(let i=1;i<knots.length;i++)if(y<knots[i][0]){const [a,x]=knots[i-1],[b,z]=knots[i];const t=Math.max(0,Math.min(1,(y-a)/(b-a)));return x+(z-x)*t*t*(3-2*t);}
  return 1;
}
function HeadSurface({children,face,chin,neckScale}:{children:React.ReactNode;face:number;chin:number;neckScale:number}){
  const id=useId().replaceAll(':','');
  // Shared source art is sampled in narrow overlapping SVG bands, avoiding hard joins.
  return <g data-face-shape={face}><defs><g id={`${id}-art`}>{children}</g>{Array.from({length:340},(_,i)=><clipPath key={i} id={`${id}-${i}`}><rect x="-500" y={-600+i*2} width="1000" height="4"/></clipPath>)}</defs>{Array.from({length:340},(_,i)=>{
    const y=-600+i*2+1;
    const t=Math.max(0,Math.min(1,(y-chin)/(24)));
    const scale=faceWidthAt(face,y,chin)*(1+(neckScale-1)*t*t*(3-2*t));
    return <g key={i} transform={`scale(${scale} 1)`} clipPath={`url(#${id}-${i})`}><use href={`#${id}-art`}/></g>;
  })}</g>;
}
export function PaintedHead({style=defaultStyle,hairFilter,neckScale=1}:{style?:CharacterStyle;hairFilter?:string;neckScale?:number}){
  const layout=headLayout(style.hair);
  const hairMask=useId().replaceAll(':','');
  return <g data-part="hair" data-choice={style.hair}>
    <HeadSurface face={style.face??0} chin={layout.chin} neckScale={neckScale}><AtlasSprite file="heads-v3.png" rect={layout.rect} x={layout.x} y={layout.top} width={layout.width} height={layout.height}/>
    {hairFilter&&<><defs><filter id={`${hairMask}-blend`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter><mask id={hairMask} maskUnits="userSpaceOnUse" x="-320" y="-600" width="640" height="700"><rect x="-320" y="-600" width="640" height="700" fill="white"/><g filter={`url(#${hairMask}-blend)`}><ellipse cx="0" cy={layout.eyes+18} rx="170" ry="123" fill="black"/><ellipse cx="-180" cy={layout.eyes+35} rx="42" ry="56" fill="black"/><ellipse cx="180" cy={layout.eyes+35} rx="42" ry="56" fill="black"/><rect x="-95" y={layout.chin-20} width="190" height="200" fill="black"/></g></mask></defs><g mask={`url(#${hairMask})`}><g style={{filter:hairFilter}}><AtlasSprite file="heads-v3.png" rect={layout.rect} x={layout.x} y={layout.top} width={layout.width} height={layout.height}/></g></g></>}

    </HeadSurface>
    <FaceFeature kind="eyes" index={style.eyes} centerY={layout.eyes}/>
    <FaceFeature kind="nose" index={style.nose} centerY={layout.nose}/>
    <FaceFeature kind="mouth" index={style.mouth} centerY={layout.mouth}/>
  </g>;
}
const featureBounds:Record<'eyes'|'nose'|'mouth',Rect[]>={
  eyes:[[12,85,235,130],[265,89,236,129],[515,82,238,139],[768,102,227,105],[1013,90,237,132],[9,296,238,120],[267,276,231,142],[513,293,235,121],[767,307,232,117],[1018,282,223,137]],
  nose:[[85,25,225,335],[477,25,233,335],[887,22,228,338],[1268,28,267,332],[1695,24,230,336],[49,396,285,344],[497,398,195,342],[883,396,242,344],[1277,395,256,345],[1698,395,245,345]],
  mouth:[[43,926,198,73],[290,914,177,110],[590,914,75,96],[789,934,174,61],[1033,910,177,112],[40,1071,197,104],[298,1077,188,97],[562,1091,124,77],[788,1091,178,92],[1070,1060,116,144]],
};
export function featureRect(kind:'eyes'|'nose'|'mouth',index:number):Rect{return featureBounds[kind][index]}
export function featureLayout(kind:'eyes'|'nose'|'mouth',index:number,centerY:number){
  const rect=featureRect(kind,index);
  if(kind==='nose'){
    const width=[44,60,41,49,57,68,40,61,52,62][index];
    const height=[47,50,48,46,49,47,50,49,47,48][index];
    const center=[188,594,999,1400,1810,190,597,1000,1405,1815][index];
    return {rect,width,height,x:(rect[0]-center)*width/rect[2],y:centerY-height*.72};
  }
  if(kind==='mouth'){
    const width=[100,94,34,92,100,108,96,54,74,43][index];
    const height=[22,40,36,12,40,33,24,22,17,40][index];
    const center=[142,379,628,876,1121,139,392,624,877,1128][index];
    return {rect,width,height,x:(rect[0]-center)*width/rect[2],y:centerY-height/2};
  }
  const scale=Math.min(275/rect[2],110/rect[3]);
  const originalWidth=rect[2]*scale;
  const width=originalWidth*.82,height=rect[3]*scale*.82;
  const eyeCenter=(originalWidth/4+18)*(index===9?.97:[3,5,8].includes(index)?.85:.94);
  const pupilRatio=[.64,.63,.64,.62,.64,.65,.66,.65,.62,.64][index];
  return {rect,width,height,y:centerY-height*pupilRatio,eyeCenter};
}
export function FaceFeature({kind,index,centerY=0}:{kind:'eyes'|'nose'|'mouth';index:number;centerY?:number}){
  const layout=featureLayout(kind,index,centerY);
  const {rect,width,height,y}=layout;
  const eyeCenter=layout.eyeCenter??0;
  if(kind==='eyes')return <g data-part={kind} data-choice={index}>
    <AtlasSprite file="features-v1.png" rect={[rect[0],rect[1],rect[2]/2,rect[3]]} x={-eyeCenter-width/4} y={y} width={width/2} height={height}/>
    <AtlasSprite file="features-v1.png" rect={[rect[0]+rect[2]/2,rect[1],rect[2]/2,rect[3]]} x={eyeCenter-width/4} y={y} width={width/2} height={height}/>
  </g>;
  return <g data-part={kind} data-choice={index} opacity={kind==='nose'?.84:1} style={kind==='nose'?{filter:'brightness(1.16) saturate(.72)'}:undefined}><AtlasSprite file={kind==='nose'?'noses-v3.png':'features-v1.png'} rect={rect} x={layout.x??-width/2} y={y} width={width} height={height}/></g>;
}
export function PaintedOutfit({index,outfitFilter}:{index:number;outfitFilter?:string}){
  const id=useId().replaceAll(':','');
  const rect=outfitRect(index),center=[227,608,994,1380,1765,226,608,994,1380,1768][index];
  const neckTop=index<5?18:405;
  const art=<AtlasSprite file="outfits-v1.png" rect={rect} x={-(center-rect[0])*1.5} y={(rect[1]-neckTop)*1.36} width={rect[2]*1.5} height={rect[3]*1.36}/>;
  return <g data-part="outfit" data-choice={index}>{art}{outfitFilter&&<><defs><mask id={id} maskUnits="userSpaceOnUse" x="-340" y="-30" width="680" height="570"><rect x="-340" y="-30" width="680" height="570" fill="white"/><path d="M-52 -30H52V25Q64 50 0 78Q-64 50 -52 25Z" fill="black"/><ellipse cx="-244" cy="456" rx="70" ry="86" fill="black"/><ellipse cx="244" cy="456" rx="70" ry="86" fill="black"/></mask></defs><g mask={`url(#${id})`}><g style={{filter:outfitFilter}}>{art}</g></g></>}</g>;
}
function outfitRect(index:number):Rect{
  const rects:Rect[]=[[28,8,395,380],[425,8,371,380],[798,8,386,380],[1182,3,397,385],[1580,7,376,380],[20,394,400,378],[420,395,380,378],[800,395,382,378],[1184,393,390,380],[1575,393,390,380]];
  return rects[index];
}
export function PaintedShoes({index}:{index:number}){
  const [x,y,w,h]=shoeRect(index);
  return <g data-part="shoes" data-choice={index}>
    <AtlasSprite file="shoes-v1.png" rect={[x,y,w/2,h]} x={-217} y={467} width={185} height={173}/>
    <AtlasSprite file="shoes-v1.png" rect={[x+w/2,y,w/2,h]} x={57} y={467} width={185} height={173}/>
  </g>;
}
function shoeRect(index:number):Rect{
  const x=[0,262,499,760,991,0,249,492,757,1008],w=[263,237,262,238,263,251,253,275,257,246];
  const y=[280,288,265,240,280,697,689,716,697,691],bottom=[555,555,558,580,563,1009,999,1011,1012,1010];
  return [x[index],y[index],w[index],bottom[index]-y[index]];
}
export function StyleThumbnail({category,index,collection}:{category:'face'|'hair'|'eyes'|'nose'|'mouth'|'outfit'|'shoes'|'bottom';index:number;collection?:StudentCollection}){
  if(category==='face')return <svg viewBox="-285 -560 570 640" aria-hidden="true"><PaintedHead style={{...defaultStyle,face:index,hair:collection==='girls'?2:0}}/></svg>;
  if(collection&&category==='hair')return <svg viewBox="-285 -560 570 640" aria-hidden="true"><PaintedHead style={{...defaultStyle,hair:collectionIndex(collection,category,index)}} hairFilter={collectionFilter(collection,category,index)}/></svg>;
  if(collection&&category==='outfit')return <svg viewBox="-330 -20 660 550" aria-hidden="true"><PaintedOutfit index={collectionIndex(collection,category,index)} outfitFilter={collectionFilter(collection,category,index)}/></svg>;
  if(collection&&category==='shoes')return <svg viewBox="-240 405 480 255" aria-hidden="true"><PaintedLowerBody index={collectionIndex(collection,category,index)} shoeFilter={collectionFilter(collection,category,index)}/></svg>;
  if(collection)return <div style={{width:'100%',filter:collectionFilter(collection,category,index)}}><StyleThumbnail category={category} index={collectionIndex(collection,category,index)}/></div>;
  if(category==='bottom')return <svg viewBox="0 0 100 100" aria-hidden="true"><PaintedBottoms index={index} thumbnail/></svg>;
  if(category==='hair')return <svg viewBox="-285 -560 570 640" aria-hidden="true"><PaintedHead style={{...defaultStyle,hair:index}}/></svg>;
  if(category==='shoes')return <svg viewBox="-240 405 480 255" aria-hidden="true"><PaintedLowerBody index={index}/></svg>;
  if(category==='nose')return <svg viewBox="-50 -45 100 90" aria-hidden="true"><FaceFeature kind="nose" index={index}/></svg>;
  const file=category==='outfit'?'outfits':'features';
  const rect:Rect=category==='outfit'?outfitRect(index):featureRect(category,index);
  return <svg viewBox="0 0 100 100" aria-hidden="true"><AtlasSprite file={`${file}-v1.png`} rect={rect} x={10} y={5} width={80} height={90}/></svg>;
}
