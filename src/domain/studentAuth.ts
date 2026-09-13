// Firebase Auth's email/password sign-in needs an email-shaped identifier, but it never has to
// be a real inbox. Students log in with 학교 코드/학년/이름 instead of an email address; this
// builds the same deterministic "email" the account was created with, from those three values.
// This assumes grade+name is unique school-wide (one class per grade, per this school's own
// roster) — a school with multiple classes per grade and a same-grade name collision would need
// to bring 반 back into the identifier; see docs/DECISIONS.md D-44.
function normalizePart(value:string){return value.trim().replace(/\s+/g,'')}
export function studentLoginEmail(schoolCode:string,grade:string,name:string){
  const parts=[schoolCode,grade,name].map(normalizePart);
  if(parts.some(p=>!p))throw new Error('학교 코드·학년·이름을 모두 입력해 주세요.');
  if(parts.some(p=>p.length>40))throw new Error('입력값이 너무 깁니다.');
  return `${parts.join('-')}@students.jobedu.local`;
}
