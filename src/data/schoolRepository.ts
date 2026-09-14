import {collection,doc,getDocFromServer,getDocsFromServer,query,limit,orderBy,runTransaction,serverTimestamp,updateDoc} from 'firebase/firestore';
import type {Firestore,QueryDocumentSnapshot,DocumentData} from 'firebase/firestore';
import {isTeacher,schoolPath,validateId,type Membership,type School,type SchoolContext,type Student} from '../domain/model';
import {validateIncomeTaxRateBp} from '../domain/finance';
import type {RosterRow} from '../domain/roster';
export async function listSchools(db:Firestore,uid:string){
  validateId(uid);const snap=await getDocsFromServer(query(collection(db,`userSchools/${uid}/links`),limit(50)));
  return snap.docs.map(d=>({schoolId:d.id,schoolName:String(d.data().schoolName??d.id)}));
}
export async function openSchool(db:Firestore,uid:string,schoolId:string){
  validateId(uid);validateId(schoolId);
  const member=await getDocFromServer(doc(db,`schools/${schoolId}/members/${uid}`));
  if(!member.exists())throw new Error('이 학교에 등록된 계정이 아닙니다.');
  const membership=member.data() as Membership;
  if(membership.status!=='active'||membership.schoolId!==schoolId||!['student','teacher','owner'].includes(membership.role))throw new Error('학교 이용 권한이 없습니다.');
  const school=await getDocFromServer(doc(db,`schools/${schoolId}`));
  if(!school.exists()||school.data().status!=='active')throw new Error('현재 이용할 수 없는 학교입니다.');
  return {context:{schoolId,uid,membership} satisfies SchoolContext,school:{...school.data(),incomeTaxRateBp:school.data().incomeTaxRateBp??0} as School};
}
export async function getCitizen(db:Firestore,context:SchoolContext){
  const id=context.membership.studentId;if(!id)throw new Error('연결된 시민 프로필이 없습니다.');
  const s=await getDocFromServer(doc(db,schoolPath(context,'students',id)));
  if(!s.exists())throw new Error('시민 프로필을 찾을 수 없습니다.');return {...s.data(),id:s.id} as Student;
}
export async function listStudents(db:Firestore,context:SchoolContext){
  if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
  const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'students')),orderBy('name'),limit(100)));
  return snap.docs.map(d=>({...d.data(),id:d.id} as Student));
}
// Enrollment lifecycle only (grade/class/status) — never touches citizenCode, financial data,
// or login access (membership provisioning stays outside the app, see D-5).
export async function updateStudent(db:Firestore,context:SchoolContext,student:Student){
  if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
  if(!Number.isInteger(student.grade)||student.grade<1||student.grade>6)throw new Error('학년을 확인해 주세요.');
  if(student.className&&student.className.length>20)throw new Error('반 이름은 20자 이하로 입력해 주세요.');
  if(!(['active','graduated','transferred'] as const).includes(student.status))throw new Error('상태를 확인해 주세요.');
  await updateDoc(doc(db,schoolPath(context,'students',student.id)),{
    name:student.name,grade:student.grade,className:student.className,schoolYear:student.schoolYear,status:student.status,updatedAt:serverTimestamp(),
  });
}
export async function updateIncomeTaxRate(db:Firestore,context:SchoolContext,rateBp:number){
  if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
  validateId(context.schoolId);validateIncomeTaxRateBp(rateBp);
  await updateDoc(doc(db,`schools/${context.schoolId}`),{incomeTaxRateBp:rateBp,updatedAt:serverTimestamp()});
}
export interface PlannedStudent extends RosterRow {id:string;citizenCode:string}
export function planImport(rows:RosterRow[]):PlannedStudent[]{return rows.map(r=>{const id=crypto.randomUUID();return {...r,id,citizenCode:`C-${id}`}})}
// A batch is intentionally bounded. Retrying the same batch ID returns its prior result.
// Role and field checks are enforced by Firestore Rules, not this client check alone.
export async function importStudents(db:Firestore,context:SchoolContext,batchId:string,rows:PlannedStudent[],schoolYear:number){
  if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
  validateId(batchId);if(!rows.length||rows.length>50||!Number.isInteger(schoolYear)||schoolYear<2020||schoolYear>2100)throw new Error('한 번에 1~50명, 올바른 학년도로 등록해 주세요.');
  const batchRef=doc(db,schoolPath(context,'importBatches',batchId));
  return runTransaction(db,async tx=>{
    const old=await tx.get(batchRef);if(old.exists())return {count:old.data().acceptedCount as number,reused:true};
    const refs=rows.map(r=>doc(db,schoolPath(context,'students',r.id)));
    const existing=await Promise.all(refs.map(r=>tx.get(r)));
    if(existing.some(s=>s.exists()))throw new Error('이미 존재하는 학생 ID입니다. 명단을 다시 확인해 주세요.');
    rows.forEach((r,i)=>tx.set(refs[i],{schoolId:context.schoolId,name:r.name,grade:r.grade,className:r.className,citizenCode:r.citizenCode,schoolYear,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    tx.set(batchRef,{schoolId:context.schoolId,actorUid:context.uid,acceptedCount:rows.length,status:'completed',createdAt:serverTimestamp(),schemaVersion:1});
    return {count:rows.length,reused:false};
  });
}
