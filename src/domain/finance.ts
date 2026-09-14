export const ISSUER_ACCOUNT_ID='system-issuer';
export type JournalType='SALARY'|'PURCHASE'|'SAVINGS_DEPOSIT'|'INTEREST';
export interface Account {id:string;schoolId:string;ownerType:'student'|'school'|'business';ownerId:string;balanceMinor:number;version:number;lastJournalId:string|null;status:'active';schemaVersion:1}
export interface SalaryJournal {id:string;schoolId:string;type:'SALARY';jobId:string;studentId:string;period:string;debitAccountId:string;creditAccountId:string;amountMinor:number;postedBy:string;schemaVersion:1}
export interface AccountEntry {id:string;schoolId:string;journalId:string;type:JournalType;deltaMinor:number;balanceAfterMinor:number;label:string}
export interface SalaryPreviewItem {jobId:string;jobName:string;studentId:string;studentName:string;amountMinor:number;period:string;journalId:string;alreadyPaid:boolean}
export function periodPattern(period:string){return /^\d{4}-\d{2}$/.test(period)}
export function salaryJournalId(jobId:string,studentId:string,period:string){
  if(!periodPattern(period))throw new Error('정산 월(YYYY-MM)을 확인해 주세요.');
  for(const id of [jobId,studentId])if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('직업 또는 시민 식별자를 확인해 주세요.');
  return `salary~${jobId}~${studentId}~${period}`;
}
