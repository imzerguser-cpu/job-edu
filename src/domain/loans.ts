import type {FinancialProduct} from './finance';

export type FinancialRequestStatus='submitted'|'assigned'|'reviewed'|'approved'|'rejected';
export interface FinancialRequest {
  id:string;schoolId:string;studentId:string;operation:'LOAN';productId:string;
  principalMinor:number;months:number;purpose:string;repaymentPlan:string;
  status:FinancialRequestStatus;assignedStudentId:string|null;
  reviewNote:string;decisionNote:string;reviewerUid:string|null;createdEntityId:string|null;
  schemaVersion:1;
}
export interface FinanceReviewChecklist {studentActiveConfirmed:boolean;amountReasonable:boolean;noDuplicateLoan:boolean}
export interface FinanceReview {id:string;schoolId:string;requestId:string;assignedStudentId:string;checklist:FinanceReviewChecklist;note:string;schemaVersion:1}
export interface LoanContract {
  id:string;schoolId:string;studentId:string;productId:string;
  productSnapshot:{name:string;rateBpsMonthly:number};
  principalMinor:number;months:number;interestMinor:number;totalOwedMinor:number;repaidMinor:number;
  status:'active'|'repaid';disbursementJournalId:string;repaymentJournalId:string|null;
  startAt:string;dueAt:string;schemaVersion:1;
}

// Status machine mirrors src/domain/proposals.ts's submitted->voting->closed->approved/rejected:
// a student submits, a teacher gates each forward transition, and rejection is allowed from any
// pre-decision state so an obviously invalid request doesn't have to wait for a wasted review.
export function canAssign(r:FinancialRequest){return r.status==='submitted'}
export function canReview(r:FinancialRequest,studentId:string){return r.status==='assigned'&&r.assignedStudentId===studentId}
export function canDecide(r:FinancialRequest){return r.status==='reviewed'}
export function canReject(r:FinancialRequest){return r.status==='submitted'||r.status==='assigned'||r.status==='reviewed'}

export function validatePurpose(s:string){if(!s.trim()||s.length>500)throw new Error('대출 목적을 1~500자로 적어 주세요.')}
export function validateRepaymentPlan(s:string){if(!s.trim()||s.length>500)throw new Error('상환 계획을 1~500자로 적어 주세요.')}

function validLoanId(id:string){if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('대출 계약 식별자를 확인해 주세요.');return id}
// Deterministic per-contract journal ids, same D-18/D-51 idempotency pattern as savings:
// disbursement can only ever happen once per approved request, repayment only once per contract.
export function loanJournalId(contractId:string){return `loan~${validLoanId(contractId)}`}
export function loanRepaymentJournalId(contractId:string){return `loanRepayment~${validLoanId(contractId)}`}

export function defaultLoanProducts(schoolId:string):Omit<FinancialProduct,'id'>[]{
  return [
    {schoolId,kind:'loan',name:'단기대출',rateBpsMonthly:600,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
    {schoolId,kind:'loan',name:'장기대출',rateBpsMonthly:1200,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active',schemaVersion:1},
  ];
}
