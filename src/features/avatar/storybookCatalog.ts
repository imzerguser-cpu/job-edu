export const styleCatalog = {
  face: ['기본형','통통','길쭉','부드러운 사각형'],
  hair: ['별빛 숏컷','단정한 가르마','둥근 단발','차분한 긴 머리','높은 포니테일','양갈래 묶음','몽글 곱슬머리','두 갈래 만두머리','양갈래 땋은 머리','가벼운 픽시컷'],
  eyes: ['둥근 갈색 눈','검은 아몬드 눈','맑은 헤이즐 눈','웃는 눈','윙크하는 눈','나른한 눈','놀란 눈','씩씩한 눈','다정한 눈','반짝이는 눈'],
  nose: ['작은 코','동그란 코','부드러운 타원 코','납작한 둥근 코','살짝 들린 코','넓고 부드러운 코','타원 코','주근깨 코','둥근 코끝','은은한 콧방울'],
  mouth: ['작은 미소','활짝 미소','동그란 입','차분한 입','깔깔 웃음','이를 보인 미소','장난스러운 미소','삐죽 입','수줍은 입','놀란 입'],
  outfit: ['민트 별빛 후드','크림 니트 가디건','네이비 야구 점퍼','노란 레인코트','핑크 하트 맨투맨','파란 데님 재킷','초록 탐험 셔츠','라벤더 세일러','빨간 체크 셔츠','하늘색 트랙 재킷'],
  bottom: ['네이비 반바지','파란 청바지','베이지 면바지','초록 카고바지','네이비 조거팬츠','핑크 주름치마','데님 A라인 치마','라벤더 캉캉치마','빨간 체크치마','크림 꽃자수 치마'],
  shoes: ['별빛 스니커즈','네이비 캔버스화','빨간 하이탑','노란 장화','갈색 로퍼','핑크 메리제인','초록 트레킹화','보라 벨크로 운동화','파란 샌들','포근한 부츠'],
} as const;
export type StyleCategory=keyof typeof styleCatalog;
export type CharacterStyle=Record<StyleCategory,number>;
export const categoryLabels:Record<StyleCategory,string>={face:'얼굴형',bottom:'하의',hair:'머리',eyes:'눈',nose:'코',mouth:'입',outfit:'상의',shoes:'신발'};
export const defaultStyle:CharacterStyle={face:0,bottom:0,hair:0,eyes:0,nose:0,mouth:0,outfit:0,shoes:0};
export function applyStyle(style:CharacterStyle,category:StyleCategory,index:number):CharacterStyle{
  const choice=Math.max(0,Math.min(styleCatalog[category].length-1,Math.round(index)));
  return {...style,[category]:choice};
}
