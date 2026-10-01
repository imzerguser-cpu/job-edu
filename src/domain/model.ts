export type Role = 'student' | 'teacher' | 'owner';
export interface School { schoolId:string; schoolName:string; communityName:string; currencyName:string; currencySymbol:string; timezone:string; status:'active'|'inactive'; schemaVersion:1; incomeTaxRateBp:number; businessTaxRateBp:number; departmentNames:Partial<Record<'economy'|'media'|'life'|'culture',string>> }
export interface Membership { schoolId:string; role:Role; studentId:string|null; status:'active'|'inactive' }
export interface SchoolContext { schoolId:string; uid:string; membership:Membership }
// number: 학년 안에서의 번호(출석번호). 이 필드가 생기기 전 학생은 없을 수 있다(D-116).
export interface Student { id:string; schoolId:string; name:string; grade:number; number?:number|null; className:string|null; citizenCode:string; schoolYear:number; status:'active'|'graduated'|'transferred'; schemaVersion:1 }
// 학년순 → 학년 안에서 번호순(번호 없는 학생은 뒤로) → 이름순.
export function compareByGradeNumber(a:Pick<Student,'grade'|'number'|'name'>,b:Pick<Student,'grade'|'number'|'name'>){
  return a.grade-b.grade||(a.number??999)-(b.number??999)||a.name.localeCompare(b.name,'ko');
}
export function studentLabel(s:Pick<Student,'grade'|'number'|'name'>){return `${s.grade}학년 ${s.number?`${s.number}번 `:''}${s.name}`}
export type JobStatus='preparing'|'recruiting'|'active'|'paused'|'closed';
export type VerificationKind='system'|'photo'|'artifact';
export interface Job { id:string; schoolId:string; departmentId:string; name:string; core:boolean; status:JobStatus; recommendedGrades:number[] }
export interface JobAssignment { id:string; schoolId:string; studentId:string; jobId:string; startAt:string; endAt:string|null }
export interface Task { id:string; schoolId:string; jobId:string; templateId:string; assigneeStudentId:string; occurrenceKey:string; verificationKind:VerificationKind; rewardMinor:number; paidJournalId:string|null }
export type JournalType='SALARY'|'DEPOSIT'|'WITHDRAW'|'TRANSFER'|'INTEREST'|'LOAN'|'LOAN_REPAYMENT'|'TAX'|'FINE'|'PURCHASE'|'SALE'|'REFUND'|'ADJUSTMENT';
export interface Journal { id:string; schoolId:string; type:JournalType; debitAccountId:string; creditAccountId:string; amountMinor:number; sourceId:string; policyVersionId:string; reversalOf:string|null }
export function isTeacher(m:Membership){return m.status==='active' && (m.role==='teacher'||m.role==='owner')}
export function validateId(id:string){if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('올바르지 않은 식별자입니다.');return id}
export function schoolPath(context:SchoolContext,collection:string,id?:string){validateId(context.schoolId);validateId(collection);if(id)validateId(id);if(context.membership.schoolId!==context.schoolId||context.membership.status!=='active')throw new Error('학교 접근 권한이 없습니다.');return `schools/${context.schoolId}/${collection}${id?`/${id}`:''}`}
