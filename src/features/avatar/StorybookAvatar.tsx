import {collectionStyle,collectionFilter,type StudentCollection} from './studentCollections';
import {useId} from 'react';
import {PaintedBottoms} from './PaintedBottoms';
import {PaintedLowerBody} from './PaintedLowerBody';
import {PaintedHead,PaintedOutfit} from './StorybookParts';
import {type CharacterStyle} from './storybookCatalog';
import {growthShape} from '../../domain/studentGrowth';

export interface BodyShape {height:number;build:number}
export const gradeShapes:BodyShape[]=Array.from({length:6},(_,i)=>growthShape(i+1));
export function bodyRig(shape:BodyShape){
  const height=Math.max(0,Math.min(100,shape.height))/100;
  const build=Math.max(0,Math.min(100,shape.build))/100;
  // Total illustrated height follows 110–170 cm proportionally. Head stays
  // isotropic; distribute the remaining stature between torso and legs.
  const stature=(110+height*60)*4.7,headHeight=504*.43;
  const legY=(stature-headHeight)*.62/632,torsoY=(stature-headHeight)*.38/391;
  const waistY=850-632*legY,neckY=waistY-391*torsoY;
  // The former widest setting is now the minimum. Give legs slightly more
  // width growth than the jacket so the limbs keep up with the fuller torso.
  return {legY,torsoY,waistY,neckY,bodyX:.53+build*.29,legX:.52+build*.32,headScale:.43,fullness:build};
}

export function cheekExpansion(_y:number,fullness:number){return 1+.3*Math.max(0,Math.min(1,fullness));}

// Source-space contours isolate each painted part. Art stays immutable;
// transforms use neck/waist anchors, with a separate, smooth face-width adjustment.
const contours={
  head:'M11 354 43 331 60 308Q78 254 156 219Q183 174 224 159Q282 143 317 181Q336 166 368 187L367 223Q448 239 471 310L490 367 481 406 508 422 487 435 495 459 470 466 459 505Q452 551 409 562L382 590 337 613 311 638 331 659Q271 698 205 659L223 637 213 614 177 599 147 581Q103 580 84 545L57 511 37 496 56 478 30 482 42 460 12 458 34 437 11 426 38 409 8 403 37 385Z',
  torso:'M754 246Q651 226 624 278L620 312 603 341 574 381 551 431 520 509 502 566Q491 596 514 626L524 646 518 674 509 694 499 724 500 757 519 779 544 795 562 792 570 777 561 764 578 767 588 752 580 720 565 692 574 668 602 679 654 678 700 688 720 674 810 674 853 676 868 709 883 707 885 682 934 678 970 665 995 666 1001 690 991 724 991 753 1006 768 1018 758 1011 780 1027 795 1045 789 1071 766 1081 740 1078 718 1055 677 1047 649 1067 627 1082 601 1074 570 1049 521 1028 466 1000 409 970 361 948 334 941 310 941 279Q920 234 829 243L829 269Q833 304 794 316Q746 310 744 289Z',
  legs:'M1209 240 1251 249 1308 250 1367 248 1408 238 1420 277 1434 317 1458 353 1469 392 1474 439 1456 468 1431 478 1431 511 1444 552 1458 593 1460 635 1449 679 1460 719 1465 751 1494 781 1514 820 1526 852 1526 877Q1456 908 1388 878L1361 853 1362 822 1374 788 1387 760 1393 726 1380 682 1359 635 1347 582 1332 530 1324 482 1261 484 1254 526 1236 575 1227 619 1210 676 1208 716 1224 747 1226 786 1258 818 1260 843 1247 863 1213 875Q1152 909 1093 874L1093 846 1102 816 1121 791 1143 759 1153 722 1163 676 1164 629 1171 581 1184 538 1192 473 1168 464 1145 447 1159 396 1174 351 1183 303Z',
};
export function StorybookAvatar({shape,style:selection,collection,focusFace=false,label='내 동화풍 캐릭터'}:{shape:BodyShape;style?:CharacterStyle;collection?:StudentCollection;focusFace?:boolean;label?:string}){
  const style=selection&&collection?collectionStyle(collection,selection):selection;
  const filter=(part:'hair'|'outfit'|'bottom'|'shoes')=>collection&&selection?collectionFilter(collection,part,selection[part]):undefined;
  const id=useId().replaceAll(':',''),r=bodyRig(shape);
  const part=(name:keyof typeof contours,transform:string)=><g transform={transform}><g clipPath={`url(#${id}-${name})`}><image href="/assets/avatar-storybook/mint-parts-v1.png" width="1536" height="1024"/></g></g>;
  return <svg viewBox={focusFace?`100 ${r.neckY-295} 400 400`:"0 0 600 920"} role="img" aria-label={label} className="storybook-avatar">
    <defs><clipPath id={`${id}-below-shorts`}><rect x="-300" y="238" width="600" height="500"/></clipPath><clipPath id={`${id}-bare-legs`}><rect x="0" y="0" width="1536" height="749"/></clipPath>{Object.entries(contours).map(([name,d])=><clipPath id={`${id}-${name}`} key={name}><path d={d}/></clipPath>)}<g id={`${id}-head-art`} clipPath={`url(#${id}-head)`}><image href="/assets/avatar-storybook/mint-parts-v1.png" width="1536" height="1024"/></g></defs>
    <ellipse cx="300" cy="861" rx="115" ry="15" fill="#566956" opacity=".12"/>
    {!style&&part('legs',`translate(300 ${r.waistY}) scale(${r.legX} ${r.legY}) translate(-1310 -254)`)}
    {!style&&part('torso',`translate(300 ${r.neckY}) scale(${r.bodyX} ${r.torsoY}) translate(-790 -275)`)}
    {!style&&part('head',`translate(300 ${r.neckY}) scale(${r.headScale*cheekExpansion(0,r.fullness)} ${r.headScale*(1+.06*r.fullness)}) translate(-266 -647)`)}

    {style&&<>
      <g transform={`translate(300 ${r.waistY}) scale(${r.legX} ${r.legY})`}>
        <g clipPath={(style.bottom||selection?.bottom)?`url(#${id}-below-shorts)`:undefined}><PaintedLowerBody index={style.shoes} shoeFilter={filter('shoes')}/></g>{(style.bottom>0||!!selection?.bottom)&&<g style={{filter:filter('bottom')}}><PaintedBottoms index={style.bottom}/></g>}
      </g>
      <g transform={`translate(300 ${r.neckY}) scale(${r.bodyX} ${r.torsoY})`}><PaintedOutfit index={style.outfit} outfitFilter={filter('outfit')}/></g>
      <g transform={`translate(300 ${r.neckY+18}) scale(${r.headScale*cheekExpansion(0,r.fullness)} ${r.headScale*(1+.06*r.fullness)})`}><PaintedHead style={style} hairFilter={filter('hair')} neckScale={37.5*r.bodyX/(41*r.headScale*cheekExpansion(0,r.fullness))}/></g>
    </>}
  </svg>;
}
