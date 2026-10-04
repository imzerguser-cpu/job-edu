// Ministry of Education, 2025 student health examination sample statistics,
// published 2026-04-28, appendix: height and weight tables, final (2025) columns.
export const growthSource='https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105998&lev=0&m=020402';
export type GrowthReference='midpoint'|'boys'|'girls';
export const studentGrowth=[
  {grade:1,boys:{cm:122.4,kg:25.5},girls:{cm:120.8,kg:24.1}},
  {grade:2,boys:{cm:128.0,kg:28.9},girls:{cm:126.9,kg:27.4}},
  {grade:3,boys:{cm:134.2,kg:34.1},girls:{cm:133.0,kg:31.4}},
  {grade:4,boys:{cm:140.4,kg:39.2},girls:{cm:139.9,kg:36.6}},
  {grade:5,boys:{cm:146.0,kg:44.5},girls:{cm:146.0,kg:40.7}},
  {grade:6,boys:{cm:153.0,kg:50.8},girls:{cm:152.5,kg:46.0}},
] as const;
export function growthReference(grade:number,reference:GrowthReference='midpoint'){
  const row=studentGrowth[Math.max(0,Math.min(5,Math.round(grade)-1))];
  // Midpoint is a design convenience, NOT a weighted national combined mean.
  return reference==='midpoint'?{cm:(row.boys.cm+row.girls.cm)/2,kg:(row.boys.kg+row.girls.kg)/2}:row[reference];
}
export function growthShape(grade:number,reference:GrowthReference='midpoint'){
  const {cm,kg}=growthReference(grade,reference);
  // Art-direction mapping only. No health classification or individual diagnosis.
  return {height:(cm-110)/60*100,build:Math.max(0,Math.min(100,(kg/(cm/100)**2-16)/12*100))};
}
