export const ISSUER_ACCOUNT_ID='system-issuer';
export const COMMUNITY_FUND_ACCOUNT_ID='community-fund';
export type JournalType='SALARY'|'PURCHASE'|'SAVINGS_DEPOSIT'|'INTEREST'|'LOAN'|'LOAN_REPAYMENT'|'INCOME_TAX'|'BUSINESS_TAX'|'FINE';
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

// Shared config shape for both savings and loan products (§17) — one collection
// (financialProducts), distinguished only by `kind`. Generalized here once a second
// concrete case (loans) existed to validate the shape against; see docs/DECISIONS.md D-48.
export type FinancialProductKind='savings'|'loan';
export interface FinancialProduct {id:string;schoolId:string;kind:FinancialProductKind;name:string;rateBpsMonthly:number;minMonths:number;maxMonths:number;minMinor:number;maxMinor:number;status:'active'|'closed';schemaVersion:1}
export function validateFinancialProduct(p:Pick<FinancialProduct,'name'|'rateBpsMonthly'|'minMonths'|'maxMonths'|'minMinor'|'maxMinor'|'status'>){
  if(!p.name.trim()||p.name.length>60)throw new Error('상품 이름을 1~60자로 적어 주세요.');
  if(!Number.isInteger(p.rateBpsMonthly)||p.rateBpsMonthly<0||p.rateBpsMonthly>10000)throw new Error('월이율을 확인해 주세요.');
  if(!Number.isInteger(p.minMonths)||!Number.isInteger(p.maxMonths)||p.minMonths<1||p.maxMonths>120||p.minMonths>p.maxMonths)throw new Error('가입 기간 범위를 확인해 주세요.');
  if(!Number.isInteger(p.minMinor)||!Number.isInteger(p.maxMinor)||p.minMinor<0||p.maxMinor>1_000_000_000||p.minMinor>p.maxMinor)throw new Error('가입 금액 범위를 확인해 주세요.');
  if(!(['active','closed'] as const).includes(p.status))throw new Error('운영 상태를 확인해 주세요.');
}
export function validAmount(product:FinancialProduct,amountMinor:number){
  return Number.isInteger(amountMinor)&&amountMinor>=product.minMinor&&amountMinor<=product.maxMinor;
}
export function validMonths(product:FinancialProduct,months:number){
  return Number.isInteger(months)&&months>=product.minMonths&&months<=product.maxMonths;
}

// 소득세(§23) — a school-wide flat rate (basis points) the teacher sets, applied only to salary
// actually paid in a given period (not to standing balance, which would be a wealth tax instead).
// This reuses SALARY journals already posted for that period as the taxable-income source, so it
// never needs to re-derive "who should have been paid" — it taxes what was, which also means it
// naturally requires salary to have been settled first.
export interface IncomeTaxPreviewItem {studentId:string;studentName:string;incomeMinor:number;amountMinor:number;period:string;journalId:string;alreadyPaid:boolean}
export function validateIncomeTaxRateBp(rateBp:number){
  if(!Number.isInteger(rateBp)||rateBp<0||rateBp>2000)throw new Error('세율은 0~20% 사이로 설정해 주세요.');
}
export function computeIncomeTax(incomeMinor:number,rateBp:number){
  return Math.floor(incomeMinor*rateBp/10000);
}
export function incomeTaxJournalId(studentId:string,period:string){
  if(!periodPattern(period))throw new Error('정산 월(YYYY-MM)을 확인해 주세요.');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(studentId))throw new Error('시민 식별자를 확인해 주세요.');
  return `tax~${studentId}~${period}`;
}
