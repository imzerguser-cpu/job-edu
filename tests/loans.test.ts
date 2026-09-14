import {describe,it,expect} from 'vitest';
import {simpleInterest} from '../src/domain/money';
import {
  canAssign,canDecide,canReject,canReview,defaultLoanProducts,
  loanJournalId,loanRepaymentJournalId,validatePurpose,validateRepaymentPlan,
  type FinancialRequest,
} from '../src/domain/loans';

function request(overrides:Partial<FinancialRequest> = {}):FinancialRequest{
  return {
    id:'r1',schoolId:'a',studentId:'one',operation:'LOAN',productId:'short',
    principalMinor:10000,months:3,purpose:'교재 구입',repaymentPlan:'매주 용돈으로 상환',
    status:'submitted',assignedStudentId:null,reviewNote:'',decisionNote:'',reviewerUid:null,createdEntityId:null,
    schemaVersion:1,
    ...overrides,
  };
}

describe('대출 신청 상태 전이',()=>{
  it('제출된 요청만 검토자를 배정할 수 있다',()=>{
    expect(canAssign(request({status:'submitted'}))).toBe(true);
    expect(canAssign(request({status:'assigned'}))).toBe(false);
  });
  it('배정된 검토자 본인만, 배정 상태에서만 검토를 제출할 수 있다',()=>{
    const r=request({status:'assigned',assignedStudentId:'two'});
    expect(canReview(r,'two')).toBe(true);
    expect(canReview(r,'three')).toBe(false);
    expect(canReview(request({status:'submitted',assignedStudentId:'two'}),'two')).toBe(false);
  });
  it('은행원 검토가 끝난 요청만 승인할 수 있다',()=>{
    expect(canDecide(request({status:'reviewed'}))).toBe(true);
    expect(canDecide(request({status:'assigned'}))).toBe(false);
  });
  it('결정되지 않은 요청은 어느 단계에서든 반려할 수 있다',()=>{
    expect(canReject(request({status:'submitted'}))).toBe(true);
    expect(canReject(request({status:'assigned'}))).toBe(true);
    expect(canReject(request({status:'reviewed'}))).toBe(true);
    expect(canReject(request({status:'approved'}))).toBe(false);
    expect(canReject(request({status:'rejected'}))).toBe(false);
  });
});
describe('대출 목적·상환계획 검증',()=>{
  it('빈 값이나 너무 긴 값을 거부한다',()=>{
    expect(()=>validatePurpose('')).toThrow();
    expect(()=>validatePurpose('a'.repeat(501))).toThrow();
    expect(()=>validatePurpose('교재 구입')).not.toThrow();
    expect(()=>validateRepaymentPlan('')).toThrow();
    expect(()=>validateRepaymentPlan('매주 용돈으로 상환')).not.toThrow();
  });
});
describe('대출 이자(요구사항 예시 재검증)',()=>{
  it('100마동 × 월6% × 3개월 = 18마동',()=>{
    expect(simpleInterest(10000,600,3)).toBe(1800);
  });
  it('100마동 × 월12% × 4개월 = 48마동(장기대출 예시)',()=>{
    expect(simpleInterest(10000,1200,4)).toBe(4800);
  });
});
describe('기본 대출 상품',()=>{
  it('단기·장기 대출은 요구사항의 이율·기간을 그대로 담는다',()=>{
    const [short,long]=defaultLoanProducts('a');
    expect(short).toMatchObject({kind:'loan',rateBpsMonthly:600,minMonths:1,maxMonths:3});
    expect(long).toMatchObject({kind:'loan',rateBpsMonthly:1200,minMonths:4});
  });
});
describe('대출 저널 식별자',()=>{
  it('계약마다 결정적인 실행·상환 식별자를 만든다(중복 방지)',()=>{
    expect(loanJournalId('c1')).toBe('loan~c1');
    expect(loanRepaymentJournalId('c1')).toBe('loanRepayment~c1');
    expect(loanJournalId('c1')).not.toBe(loanJournalId('c2'));
  });
  it('잘못된 계약 식별자는 거부한다',()=>{
    expect(()=>loanJournalId('c1~x')).toThrow();
  });
});
