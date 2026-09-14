export interface SavingsProduct {id:string;schoolId:string;kind:'savings';name:string;rateBpsMonthly:number;minMonths:number;maxMonths:number;minMinor:number;maxMinor:number;status:'active'|'closed';schemaVersion:1}
export interface SavingsContract {
  id:string;schoolId:string;studentId:string;productId:string;
  productSnapshot:{name:string;rateBpsMonthly:number};
  principalMinor:number;months:number;startAt:string;maturityAt:string;
  status:'active'|'matured';depositJournalId:string;maturityJournalId:string|null;interestMinor:number|null;
  schemaVersion:1;
}
export interface SavingsMaturityPreviewItem {
  contractId:string;studentId:string;studentName:string;
  principalMinor:number;interestMinor:number;payoutMinor:number;maturityAt:string;
  journalId:string;alreadyPaid:boolean;
}
export function validateSavingsProduct(p:Pick<SavingsProduct,'name'|'rateBpsMonthly'|'minMonths'|'maxMonths'|'minMinor'|'maxMinor'|'status'>){
  if(!p.name.trim()||p.name.length>60)throw new Error('상품 이름을 1~60자로 적어 주세요.');
  if(!Number.isInteger(p.rateBpsMonthly)||p.rateBpsMonthly<0||p.rateBpsMonthly>10000)throw new Error('월이율을 확인해 주세요.');
  if(!Number.isInteger(p.minMonths)||!Number.isInteger(p.maxMonths)||p.minMonths<1||p.maxMonths>120||p.minMonths>p.maxMonths)throw new Error('가입 기간 범위를 확인해 주세요.');
  if(!Number.isInteger(p.minMinor)||!Number.isInteger(p.maxMinor)||p.minMinor<0||p.maxMinor>1_000_000_000||p.minMinor>p.maxMinor)throw new Error('가입 금액 범위를 확인해 주세요.');
  if(!(['active','closed'] as const).includes(p.status))throw new Error('운영 상태를 확인해 주세요.');
}
export function validSavingsAmount(product:SavingsProduct,principalMinor:number){
  return Number.isInteger(principalMinor)&&principalMinor>=product.minMinor&&principalMinor<=product.maxMinor;
}
export function validSavingsMonths(product:SavingsProduct,months:number){
  return Number.isInteger(months)&&months>=product.minMonths&&months<=product.maxMonths;
}
function validSavingsId(id:string){if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('저축 계약 식별자를 확인해 주세요.');return id}
// Deterministic per-contract journal ids: the deposit id lets the client retry a half-failed
// enrollment safely, and the maturity id is the D-18-style idempotency key that makes
// settleMaturities safe to re-run without double-paying interest.
export function savingsDepositJournalId(contractId:string){return `savingsDeposit~${validSavingsId(contractId)}`}
export function savingsInterestJournalId(contractId:string){return `interest~${validSavingsId(contractId)}`}
export function defaultSavingsProducts(schoolId:string):Omit<SavingsProduct,'id'>[]{
  return [
    {schoolId,kind:'savings',name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
    {schoolId,kind:'savings',name:'장기저축',rateBpsMonthly:1000,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
  ];
}
