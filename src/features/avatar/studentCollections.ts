import {styleCatalog,type CharacterStyle,type StyleCategory} from './storybookCatalog';
export type StudentCollection='boys'|'girls';
export const collectionMaps={
 boys:{hair:[0,1,6,9,0,1,6,9,0,1],outfit:[0,1,2,3,5,6,8,9,2,5],bottom:[0,1,2,3,4,0,1,2,3,4],shoes:[0,1,2,3,4,6,7,8,0,1]},
 girls:{hair:[2,3,4,5,7,8,2,3,4,8],outfit:[4,7,0,1,2,3,5,6,8,9],bottom:[5,6,7,8,9,0,1,2,3,4],shoes:[5,9,0,1,2,3,4,6,7,8]}
} as const;
export const collectionCatalogs={
 boys:{...styleCatalog,hair:['별빛 숏컷','단정한 가르마','몽글 곱슬머리','가벼운 픽시컷','밤색 숏컷','밤색 가르마','밤색 곱슬머리','밤색 픽시컷','검정 숏컷','검정 가르마'],outfit:['민트 별빛 후드','크림 니트 조끼','네이비 야구 점퍼','노란 레인코트','파란 데님 재킷','초록 탐험 조끼','빨간 체크 셔츠','하늘색 트랙 재킷','버건디 야구 점퍼','보라 데님 재킷'],bottom:['네이비 반바지','파란 청바지','베이지 면바지','초록 카고바지','네이비 조거팬츠','와인 반바지','회색 청바지','카키 면바지','브라운 카고바지','보라 조거팬츠'],shoes:['별빛 스니커즈','네이비 캔버스화','빨간 하이탑','노란 장화','갈색 로퍼','초록 트레킹화','보라 벨크로 운동화','파란 샌들','오렌지 스니커즈','회색 캔버스화']},
 girls:{...styleCatalog,hair:['둥근 단발','차분한 긴 머리','높은 포니테일','양갈래 묶음','두 갈래 만두머리','양갈래 땋은 머리','밤색 단발','밤색 긴 머리','밤색 포니테일','밤색 땋은 머리'],outfit:['핑크 하트 맨투맨','라벤더 세일러','민트 별빛 후드','크림 니트 조끼','네이비 야구 점퍼','노란 레인코트','파란 데님 재킷','초록 탐험 조끼','빨간 체크 셔츠','하늘색 트랙 재킷'],bottom:['핑크 주름치마','데님 A라인 치마','라벤더 캉캉치마','빨간 체크치마','크림 꽃자수 치마','네이비 반바지','파란 청바지','베이지 면바지','초록 카고바지','네이비 조거팬츠'],shoes:['핑크 메리제인','베이지 털부츠','별빛 스니커즈','네이비 캔버스화','빨간 하이탑','노란 장화','갈색 로퍼','초록 트레킹화','보라 벨크로 운동화','파란 샌들']}
};
export function collectionIndex(collection:StudentCollection,category:StyleCategory,index:number){
 const map=collectionMaps[collection];return category in map?map[category as keyof typeof map][index]:index;
}
export function collectionFilter(collection:StudentCollection,category:StyleCategory,index:number){
 if(category==='hair'&&index>=(collection==='boys'?4:6))return index>=8&&collection==='boys'?'brightness(.58) saturate(.3)':'brightness(.78) saturate(.7)';
 if(collection==='boys'&&category==='shoes'&&index>=8)return index===8?'sepia(.7) saturate(2.2) hue-rotate(345deg)':'grayscale(1) brightness(1.15)';
 if(collection==='boys'&&((category==='bottom'&&index>=5)||(category==='outfit'&&index>=8)||(category==='shoes'&&index>=8)))return index%2?'hue-rotate(65deg) saturate(.7)':'hue-rotate(150deg)';
 return undefined;
}
export function collectionStyle(collection:StudentCollection,style:CharacterStyle):CharacterStyle{return Object.fromEntries(Object.entries(style).map(([key,value])=>[key,collectionIndex(collection,key as StyleCategory,value)])) as CharacterStyle;}
