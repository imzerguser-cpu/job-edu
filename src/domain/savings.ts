import type {FinancialProduct} from './finance';

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
function validSavingsId(id:string){if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('저축 계약 식별자를 확인해 주세요.');return id}
// Deterministic per-contract journal ids: the deposit id lets the client retry a half-failed
// enrollment safely, and the maturity id is the D-18-style idempotency key that makes
// settleMaturities safe to re-run without double-paying interest.
export function savingsDepositJournalId(contractId:string){return `savingsDeposit~${validSavingsId(contractId)}`}
export function savingsInterestJournalId(contractId:string){return `interest~${validSavingsId(contractId)}`}
export function defaultSavingsProducts(schoolId:string):Omit<FinancialProduct,'id'>[]{
  return [
    {schoolId,kind:'savings',name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
    {schoolId,kind:'savings',name:'장기저축',rateBpsMonthly:1000,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
  ];
}
