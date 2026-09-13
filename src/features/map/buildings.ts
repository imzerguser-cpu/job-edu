export type BuildingId='bank'|'store'|'broadcast'|'art'|'library'|'post'|'environment'|'event'|'culture'|'mypage';
export interface Building {
  id:BuildingId;
  label:string;
  subtitle:string;
  departmentId:'economy'|'media'|'life'|'culture'|null;
  hotspot:{left:number;top:number;width:number;height:number};
}
// Hotspot percentages are recalculated from the source prototype's hand-placed
// coordinates after cropping the decorative top/bottom bars out of the map art
// (see docs/PROTOTYPE_MAPPING.md §2). They describe rough clickable regions over
// the illustrated buildings, not pixel-exact outlines.
export const buildings:Building[]=[
  {id:'bank',label:'은행',subtitle:'임금·출금·납부·대출·세무·회계·사업관리·사업제안서',departmentId:'economy',hotspot:{left:5.5,top:9.2,width:19,height:37}},
  {id:'store',label:'상점',subtitle:'카페·매점',departmentId:'economy',hotspot:{left:22,top:12,width:18,height:32.8}},
  {id:'broadcast',label:'방송부',subtitle:'기자·작가·라디오 DJ',departmentId:'media',hotspot:{left:62,top:9.2,width:18,height:34.2}},
  {id:'art',label:'예술부',subtitle:'사진작가·웹툰작가·화가',departmentId:'media',hotspot:{left:81,top:10.6,width:18,height:34.2}},
  {id:'library',label:'도서부',subtitle:'도서 대출·반납 관리',departmentId:'life',hotspot:{left:4,top:56.2,width:18,height:32.8}},
  {id:'post',label:'우체부',subtitle:'우편관리·택배관리·우유배달',departmentId:'life',hotspot:{left:20,top:56.2,width:17,height:34.2}},
  {id:'environment',label:'환경부',subtitle:'환경관리·식물관리·안전관리·규칙관리·게시판 관리',departmentId:'life',hotspot:{left:31,top:57.6,width:18,height:35.6}},
  {id:'event',label:'행사',subtitle:'행사기획·행사제안·음악·가수·댄서',departmentId:'culture',hotspot:{left:66,top:56.2,width:18,height:34.2}},
  {id:'culture',label:'문화',subtitle:'보드게임',departmentId:'culture',hotspot:{left:82,top:57.6,width:17,height:32.8}},
  {id:'mypage',label:'마이페이지',subtitle:'나의 시민증과 직업',departmentId:null,hotspot:{left:40,top:24.8,width:25,height:39.9}},
];
