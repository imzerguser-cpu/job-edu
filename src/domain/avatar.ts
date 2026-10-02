export const avatarOptions={
  skin:['peach','sand','gold','brown','deep','rose'],
  face:['round','oval','soft'],
  eyes:['bright','almond','smile','sparkle'],
  nose:['button','round','small'],
  mouth:['smile','grin','calm','wow'],
  hair:['short','bob','long','curly','ponytail','spiky','twintails','braids','spacebuns','wavy','pixie','bowl','sidebraid','afro','mohawk','halfup'],
  hairColor:['black','brown','chestnut','blond','purple'],
  outfit:['tee','hoodie','overalls','dress','jacket','sailor','tracksuit','raincoat','hanbok','spacesuit','chef','knit','flowerdress'],
  shoes:['basic','sneakers','boots','rainboots','hightops','loafers','sandals','ballet','spaceboots','skates'],
  accessory:['none','bow','headphones','scrunchie','ribbontie','starclip'],
  eyewear:['none','glasses','squareglasses','catglasses','roundshades','sportshades','starshades'],
  headwear:['none','cap','beanie','beret','bucket','crown','catband','flowerband'],
} as const;
export type AvatarPart=keyof typeof avatarOptions;
export type AvatarAppearance={[K in AvatarPart]:(typeof avatarOptions)[K][number]};
export type FashionSlot='outfit'|'shoes'|'accessory'|'hair'|'eyewear'|'headwear';
export const defaultAvatar:AvatarAppearance={skin:'peach',face:'round',eyes:'bright',nose:'button',mouth:'smile',hair:'short',hairColor:'brown',outfit:'tee',shoes:'basic',accessory:'none',eyewear:'none',headwear:'none'};
export const partLabels:Record<AvatarPart,string>={skin:'피부색',face:'얼굴형',eyes:'눈',nose:'코',mouth:'입',hair:'머리 모양',hairColor:'머리 색',outfit:'옷',shoes:'신발',accessory:'머리끈 · 소품',eyewear:'안경 · 선글라스',headwear:'모자 · 머리띠'};
export const optionLabels:Record<string,string>={peach:'밝은 살구',sand:'따뜻한 모래',gold:'햇빛',brown:'갈색',deep:'진한 갈색',rose:'장밋빛',round:'동글동글',oval:'갸름한',soft:'말랑한',bright:'초롱초롱',almond:'아몬드',smile:'방긋',sparkle:'반짝반짝',button:'오똑',small:'작은 코',grin:'활짝',calm:'차분',wow:'와!',short:'짧은 머리',bob:'단발',long:'긴 머리',curly:'곱슬',ponytail:'묶은 머리',spiky:'뾰족 머리',black:'검정',chestnut:'밤색',blond:'금발',purple:'보라',tee:'기본 티셔츠',hoodie:'구름 후드티',overalls:'데님 멜빵',dress:'라벤더 원피스',jacket:'야구 점퍼',basic:'기본 운동화',sneakers:'별빛 운동화',boots:'탐험 부츠',rainboots:'노랑 장화',none:'소품 없음',glasses:'동그란 안경',cap:'햇살 모자',bow:'체리 리본',headphones:'뮤직 헤드폰'};
Object.assign(optionLabels,{"sailor":"마린 세일러복","tracksuit":"스포츠 트레이닝복","raincoat":"개구리 비옷","hanbok":"봄빛 한복","spacesuit":"우주 탐험복","chef":"꼬마 요리사복","knit":"꽈배기 니트","flowerdress":"데이지 원피스","hightops":"컬러 하이탑","loafers":"클래식 로퍼","sandals":"여름 샌들","ballet":"리본 플랫슈즈","spaceboots":"우주 부츠","skates":"롤러스케이트","twintails":"양갈래 머리","braids":"양갈래 땋은 머리","spacebuns":"동글 만두 머리","wavy":"물결 웨이브","pixie":"산뜻한 픽시컷","bowl":"바가지 머리","sidebraid":"옆으로 땋은 머리","afro":"풍성한 둥근 곱슬","mohawk":"로커 모히칸","halfup":"반묶음 머리","squareglasses":"네모 안경","catglasses":"캣아이 안경","roundshades":"동그란 선글라스","sportshades":"스포츠 선글라스","starshades":"별 선글라스","beanie":"방울 비니","beret":"화가 베레모","bucket":"캠핑 버킷햇","crown":"별 왕관","catband":"고양이 머리띠","flowerband":"꽃 머리띠","scrunchie":"무지개 곱창 머리끈","ribbontie":"긴 리본 머리끈","starclip":"별 머리핀"});
export interface FashionItem {id:string;slot:FashionSlot;value:string;name:string;priceMinor:number}
// Prices are in the same minor units as the school bank. Keep Rules in sync;
// clients cannot set prices or grant ownership without the matching ledger post.
export const fashionItems:FashionItem[]=[
  {id:'hoodie',slot:'outfit',value:'hoodie',name:'구름 후드티',priceMinor:1500},
  {id:'overalls',slot:'outfit',value:'overalls',name:'데님 멜빵',priceMinor:2000},
  {id:'dress',slot:'outfit',value:'dress',name:'라벤더 원피스',priceMinor:2000},
  {id:'jacket',slot:'outfit',value:'jacket',name:'야구 점퍼',priceMinor:2500},
  {id:'sneakers',slot:'shoes',value:'sneakers',name:'별빛 운동화',priceMinor:1000},
  {id:'boots',slot:'shoes',value:'boots',name:'탐험 부츠',priceMinor:1500},
  {id:'rainboots',slot:'shoes',value:'rainboots',name:'노랑 장화',priceMinor:1200},
  {id:'glasses',slot:'eyewear',value:'glasses',name:'동그란 안경',priceMinor:800},
  {id:'cap',slot:'headwear',value:'cap',name:'햇살 모자',priceMinor:1000},
  {id:'bow',slot:'accessory',value:'bow',name:'체리 리본',priceMinor:800},
  {id:'headphones',slot:'accessory',value:'headphones',name:'뮤직 헤드폰',priceMinor:1800},
  {"id":"sailor","slot":"outfit","value":"sailor","name":"마린 세일러복","priceMinor":2200},
  {"id":"tracksuit","slot":"outfit","value":"tracksuit","name":"스포츠 트레이닝복","priceMinor":1800},
  {"id":"raincoat","slot":"outfit","value":"raincoat","name":"개구리 비옷","priceMinor":2300},
  {"id":"hanbok","slot":"outfit","value":"hanbok","name":"봄빛 한복","priceMinor":2800},
  {"id":"spacesuit","slot":"outfit","value":"spacesuit","name":"우주 탐험복","priceMinor":3200},
  {"id":"chef","slot":"outfit","value":"chef","name":"꼬마 요리사복","priceMinor":2400},
  {"id":"knit","slot":"outfit","value":"knit","name":"꽈배기 니트","priceMinor":1900},
  {"id":"flowerdress","slot":"outfit","value":"flowerdress","name":"데이지 원피스","priceMinor":2400},
  {"id":"hightops","slot":"shoes","value":"hightops","name":"컬러 하이탑","priceMinor":1400},
  {"id":"loafers","slot":"shoes","value":"loafers","name":"클래식 로퍼","priceMinor":1300},
  {"id":"sandals","slot":"shoes","value":"sandals","name":"여름 샌들","priceMinor":900},
  {"id":"ballet","slot":"shoes","value":"ballet","name":"리본 플랫슈즈","priceMinor":1300},
  {"id":"spaceboots","slot":"shoes","value":"spaceboots","name":"우주 부츠","priceMinor":1800},
  {"id":"skates","slot":"shoes","value":"skates","name":"롤러스케이트","priceMinor":2200},
  {"id":"twintails","slot":"hair","value":"twintails","name":"양갈래 머리","priceMinor":1200},
  {"id":"braids","slot":"hair","value":"braids","name":"양갈래 땋은 머리","priceMinor":1400},
  {"id":"spacebuns","slot":"hair","value":"spacebuns","name":"동글 만두 머리","priceMinor":1500},
  {"id":"wavy","slot":"hair","value":"wavy","name":"물결 웨이브","priceMinor":1600},
  {"id":"pixie","slot":"hair","value":"pixie","name":"산뜻한 픽시컷","priceMinor":1100},
  {"id":"bowl","slot":"hair","value":"bowl","name":"바가지 머리","priceMinor":1000},
  {"id":"sidebraid","slot":"hair","value":"sidebraid","name":"옆으로 땋은 머리","priceMinor":1500},
  {"id":"afro","slot":"hair","value":"afro","name":"풍성한 둥근 곱슬","priceMinor":1600},
  {"id":"mohawk","slot":"hair","value":"mohawk","name":"로커 모히칸","priceMinor":1700},
  {"id":"halfup","slot":"hair","value":"halfup","name":"반묶음 머리","priceMinor":1300},
  {"id":"squareglasses","slot":"eyewear","value":"squareglasses","name":"네모 안경","priceMinor":900},
  {"id":"catglasses","slot":"eyewear","value":"catglasses","name":"캣아이 안경","priceMinor":1200},
  {"id":"roundshades","slot":"eyewear","value":"roundshades","name":"동그란 선글라스","priceMinor":1400},
  {"id":"sportshades","slot":"eyewear","value":"sportshades","name":"스포츠 선글라스","priceMinor":1600},
  {"id":"starshades","slot":"eyewear","value":"starshades","name":"별 선글라스","priceMinor":1700},
  {"id":"beanie","slot":"headwear","value":"beanie","name":"방울 비니","priceMinor":1200},
  {"id":"beret","slot":"headwear","value":"beret","name":"화가 베레모","priceMinor":1400},
  {"id":"bucket","slot":"headwear","value":"bucket","name":"캠핑 버킷햇","priceMinor":1300},
  {"id":"crown","slot":"headwear","value":"crown","name":"별 왕관","priceMinor":2200},
  {"id":"catband","slot":"headwear","value":"catband","name":"고양이 머리띠","priceMinor":1300},
  {"id":"flowerband","slot":"headwear","value":"flowerband","name":"꽃 머리띠","priceMinor":1500},
  {"id":"scrunchie","slot":"accessory","value":"scrunchie","name":"무지개 곱창 머리끈","priceMinor":1000},
  {"id":"ribbontie","slot":"accessory","value":"ribbontie","name":"긴 리본 머리끈","priceMinor":1100},
  {"id":"starclip","slot":"accessory","value":"starclip","name":"별 머리핀","priceMinor":800},
];
export function validateAvatar(value:unknown):asserts value is AvatarAppearance{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('캐릭터 정보를 확인해 주세요.');
  const a=value as Record<string,unknown>;
  if(Object.keys(a).length!==Object.keys(avatarOptions).length)throw new Error('캐릭터 항목을 확인해 주세요.');
  for(const [part,options] of Object.entries(avatarOptions))if(!(options as readonly unknown[]).includes(a[part]))throw new Error('선택할 수 없는 캐릭터 모양이에요.');
}
export function canWear(a:AvatarAppearance,owned:readonly string[]){
  return fashionItems.every(item=>a[item.slot]!==item.value||owned.includes(item.id));
}
export function wearItem(a:AvatarAppearance,item:FashionItem):AvatarAppearance{
  const next={...a,[item.slot]:item.value};validateAvatar(next);return next;
}
export function avatarJournalId(studentId:string,itemId:string){return `avatar~${studentId}~${itemId}`}

// Upgrade the previous single accessory slot without losing purchased items.
export function normalizeAvatar(raw:unknown):AvatarAppearance{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('캐릭터 정보를 확인해 주세요.');
  const next={...defaultAvatar,...raw} as Record<string,unknown>;
  if(next.accessory==='glasses'){next.eyewear='glasses';next.accessory='none'}
  if(next.accessory==='cap'){next.headwear='cap';next.accessory='none'}
  validateAvatar(next);return next;
}
