import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp,writeBatch,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreLoans} from '../src/data/loanRepository';
import {firestoreFinance} from '../src/data/financeRepository';
import type {SchoolContext} from '../src/domain/model';

let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const loans=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreLoans(db(c.uid),c)};
const finance=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreFinance(db(c.uid),c)};

// Bypasses loanRepository entirely so a specific rule precondition (missing review, wrong
// amount, wrong actor) can be isolated, the same way savings.rules.test.ts probes SAVINGS_DEPOSIT.
async function rawApproveLoan(uid:string,sid:string,requestId:string,opts:{studentId:string;productId:string;principalMinor:number;months:number;interestMinor:number}){
  const d=db(uid),journalId=`loan~${requestId}`,today='2026-01-01';
  const batch=writeBatch(d);
  batch.set(doc(d,`schools/${sid}/journals/${journalId}`),{schoolId:sid,type:'LOAN',studentId:opts.studentId,contractId:requestId,debitAccountId:'system-issuer',creditAccountId:opts.studentId,amountMinor:opts.principalMinor,postedBy:uid,schemaVersion:1,createdAt:serverTimestamp()});
  batch.set(doc(d,`schools/${sid}/loans/${requestId}`),{schoolId:sid,studentId:opts.studentId,productId:opts.productId,productSnapshot:{name:'단기대출',rateBpsMonthly:600},principalMinor:opts.principalMinor,months:opts.months,interestMinor:opts.interestMinor,totalOwedMinor:opts.principalMinor+opts.interestMinor,repaidMinor:0,status:'active',disbursementJournalId:journalId,repaymentJournalId:null,startAt:today,dueAt:today,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.update(doc(d,`schools/${sid}/financialRequests/${requestId}`),{status:'approved',decisionNote:'승인',reviewerUid:uid,createdEntityId:requestId,updatedAt:serverTimestamp()});
  return batch.commit();
}
async function rawRepayLoan(uid:string,sid:string,contractId:string,studentId:string,opts:{amount:number;index:number;repaidBefore:number;totalOwed:number}){
  const d=db(uid),journalId=`loanRepayment~${contractId}~${opts.index}`;
  const batch=writeBatch(d);
  const repaidAfter=opts.repaidBefore+opts.amount;
  batch.set(doc(d,`schools/${sid}/journals/${journalId}`),{schoolId:sid,type:'LOAN_REPAYMENT',studentId,contractId,debitAccountId:studentId,creditAccountId:'system-issuer',amountMinor:opts.amount,postedBy:studentId,schemaVersion:1,createdAt:serverTimestamp()});
  batch.update(doc(d,`schools/${sid}/loans/${contractId}`),{status:repaidAfter>=opts.totalOwed?'repaid':'active',repaidMinor:repaidAfter,repaymentCount:opts.index+1,repaymentJournalId:journalId,updatedAt:serverTimestamp()});
  return batch.commit();
}
// Replays an ALREADY-EXISTING repayment journal (no new journal write) to try to jump repaidMinor
// forward without any new money moving — this must be blocked (D-92).
async function rawReplayRepayment(uid:string,sid:string,contractId:string,existingJournalId:string,opts:{repaidAfter:number;repaymentCount:number;totalOwed:number}){
  return updateDoc(doc(db(uid),`schools/${sid}/loans/${contractId}`),{
    status:opts.repaidAfter>=opts.totalOwed?'repaid':'active',repaidMinor:opts.repaidAfter,repaymentCount:opts.repaymentCount,repaymentJournalId:existingJournalId,updatedAt:serverTimestamp(),
  });
}

beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const sid of ['a','b']){
    await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,status:'active'});
    await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});
    for(const id of ['one','two','three']){
      await setDoc(doc(db,`schools/${sid}/members/${sid}-${id}`),{schoolId:sid,role:'student',studentId:id,status:'active'});
      await setDoc(doc(db,`schools/${sid}/students/${id}`),{schoolId:sid,name:'가상시민',grade:5,status:'active'});
    }
    await setDoc(doc(db,`schools/${sid}/accounts/system-issuer`),{schoolId:sid,ownerType:'school',ownerId:'system-issuer',balanceMinor:-100000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/accounts/one`),{schoolId:sid,ownerType:'student',ownerId:'one',balanceMinor:5000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/financialProducts/short`),{schoolId:sid,kind:'loan',name:'단기대출',rateBpsMonthly:600,minMonths:1,maxMonths:3,minMinor:1000,maxMinor:100000,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});

describe('대출 신청',()=>{
  it('상품 범위 안에서 신청하면 대기 상태로 생성된다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const requests=await student.myRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({status:'submitted',principalMinor:5000,months:2,assignedStudentId:null});
  });
  it('상품 범위를 벗어난 금액·기간은 신청할 수 없다',async()=>{
    const student=loans('student','a','one');
    await expect(student.submitRequest({productId:'short',principalMinor:500,months:2,purpose:'x',repaymentPlan:'y'})).rejects.toThrow(); // < minMinor 1000
    await expect(student.submitRequest({productId:'short',principalMinor:5000,months:5,purpose:'x',repaymentPlan:'y'})).rejects.toThrow(); // > maxMonths 3
  });
  it('목적이나 상환계획을 비워둔 신청은 거부된다',async()=>{
    const student=loans('student','a','one');
    await expect(student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'',repaymentPlan:'y'})).rejects.toThrow();
    await expect(student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'x',repaymentPlan:''})).rejects.toThrow();
  });
  it('상품 범위를 벗어난 신청은 규칙에서도 거부된다(클라이언트 우회 시도)',async()=>{
    await assertFails(setDoc(doc(db('a-one'),'schools/a/financialRequests/bad1'),{schoolId:'a',studentId:'one',operation:'LOAN',productId:'short',principalMinor:500,months:2,purpose:'x',repaymentPlan:'y',status:'submitted',assignedStudentId:null,reviewNote:'',decisionNote:'',reviewerUid:null,createdEntityId:null,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});

describe('대출 신청 → 검토 → 승인 → 상환 전체 흐름',()=>{
  it('전체 흐름이 성공하면 원금이 계좌에 들어오고 양쪽 계좌가 대사된다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    const teacher=loans('teacher');
    await teacher.assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'문제 없음');
    await teacher.decide(req.id,true,'승인');

    const account=await finance('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(5000+5000); // funded 5000 + principal 5000
    const [loan]=await student.myLoans();
    expect(loan).toMatchObject({principalMinor:5000,months:2,interestMinor:600,totalOwedMinor:5600,status:'active'}); // 5000*6%*2=600
    await env.withSecurityRulesDisabled(async c=>{
      const issuerDoc=await c.firestore().doc('schools/a/accounts/system-issuer').get();
      expect(issuerDoc.data()?.balanceMinor).toBe(-100000-5000); // issuer paid 5000 out
    });

    await student.repay(loan.id);
    const afterRepay=await finance('student','a','one').myAccount();
    expect(afterRepay?.balanceMinor).toBe(10000-5600);
    const [repaidLoan]=await student.myLoans();
    expect(repaidLoan).toMatchObject({status:'repaid',repaidMinor:5600});
    await env.withSecurityRulesDisabled(async c=>{
      const issuerDoc=await c.firestore().doc('schools/a/accounts/system-issuer').get();
      expect(issuerDoc.data()?.balanceMinor).toBe(-100000-5000+5600); // issuer received the payoff back
    });
  });
  it('은행원 검토를 거치지 않고 바로 승인할 수 없다(규칙 우회 시도)',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two'); // status is 'assigned', not 'reviewed'
    await assertFails(rawApproveLoan('teacher-a','a',req.id,{studentId:'one',productId:'short',principalMinor:5000,months:2,interestMinor:600}));
  });
  it('교사가 아니면 검토자를 배정하거나 승인/반려할 수 없다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await expect(loans('student','a','two').assignReviewer(req.id,'two')).rejects.toThrow();
    await assertFails(setDoc(doc(db('a-one'),`schools/a/financialRequests/${req.id}`),{status:'assigned',assignedStudentId:'one',updatedAt:serverTimestamp()},{merge:true})); // self-assign
  });
  it('배정된 검토자 본인이 아니면 검토를 제출할 수 없다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await expect(loans('student','a','three').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'')).rejects.toThrow();
  });
  it('제출 단계에서도 바로 반려할 수 있다(검토를 기다리지 않음)',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').decide(req.id,false,'예산 부족');
    const [after]=await student.myRequests();
    expect(after).toMatchObject({status:'rejected',decisionNote:'예산 부족'});
    expect(await student.myLoans()).toHaveLength(0);
  });
  it('상환 저널 금액을 위조할 수 없고, 완제 후에는 다시 상환할 수 없다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'');
    await loans('teacher').decide(req.id,true,'승인');
    const [loan]=await student.myLoans();
    // journal says 1 was paid but repaidMinor jumps by 5600 -> the amounts don't match, rejected
    await assertFails(rawRepayLoan('a-one','a',loan.id,'one',{amount:1,index:0,repaidBefore:5600,totalOwed:5600}));
    await student.repay(loan.id); // legitimate full payoff in one call
    await assertFails(rawRepayLoan('a-one','a',loan.id,'one',{amount:5600,index:1,repaidBefore:0,totalOwed:5600})); // already 'repaid' — status precondition blocks it
    await expect(student.repay(loan.id)).rejects.toThrow(); // app-level guard too
  });
  it('여러 번에 나눠 상환할 수 있고, 다 갚으면 완제로 바뀐다(D-91)',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'');
    await loans('teacher').decide(req.id,true,'승인');
    const [loan]=await student.myLoans();
    await student.repay(loan.id,2000);
    let [after]=await student.myLoans();
    expect(after).toMatchObject({status:'active',repaidMinor:2000});
    await student.repay(loan.id,3600); // remaining exactly -> completes payoff
    [after]=await student.myLoans();
    expect(after).toMatchObject({status:'repaid',repaidMinor:5600});
    const account=await finance('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(10000-5600);
  });
  it('이미 존재하는 상환 저널을 재사용해 새 돈이 오가지 않고 완제로 위조할 수 없다(D-92)',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'');
    await loans('teacher').decide(req.id,true,'승인');
    const [loan]=await student.myLoans();
    await student.repay(loan.id,2000); // legitimate partial payment -> creates loanRepayment~{id}~0
    const afterFirst=await student.myLoans();
    const existingJournalId=afterFirst[0].repaymentJournalId!;
    // Replay that same, already-real journal to try to jump straight to full payoff with no new
    // money moving — !exists(journalPath(...)) must reject this even though every field looks
    // internally consistent (the journal's own amount was legitimate for the FIRST payment).
    await assertFails(rawReplayRepayment('a-one','a',loan.id,existingJournalId,{repaidAfter:5600,repaymentCount:2,totalOwed:5600}));
    const stillActive=await student.myLoans();
    expect(stillActive[0]).toMatchObject({status:'active',repaidMinor:2000}); // untouched by the replay attempt
  });
  it('남은 금액보다 많이 상환할 수 없다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'');
    await loans('teacher').decide(req.id,true,'승인');
    const [loan]=await student.myLoans();
    await expect(student.repay(loan.id,6000)).rejects.toThrow();
  });
  it('다른 학교 신청·검토·대출에는 접근할 수 없다',async()=>{
    await assertFails(setDoc(doc(db('teacher-a'),'schools/b/financialRequests/hack'),{schoolId:'b',studentId:'one',operation:'LOAN',productId:'short',principalMinor:5000,months:2,purpose:'x',repaymentPlan:'y',status:'submitted',assignedStudentId:null,reviewNote:'',decisionNote:'',reviewerUid:null,createdEntityId:null,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});

describe('은행원 검토 체크리스트 공개 범위',()=>{
  it('검토자와 교사만 체크리스트를 볼 수 있고, 신청자 본인은 볼 수 없다',async()=>{
    const student=loans('student','a','one');
    await student.submitRequest({productId:'short',principalMinor:5000,months:2,purpose:'교재 구입',repaymentPlan:'용돈으로 상환'});
    const [req]=await student.myRequests();
    await loans('teacher').assignReviewer(req.id,'two');
    await loans('student','a','two').submitReview(req.id,{studentActiveConfirmed:true,amountReasonable:true,noDuplicateLoan:true},'문제 없음');
    await assertSucceeds(getDoc(doc(db('a-two'),`schools/a/financeReviews/${req.id}`)));
    await assertSucceeds(getDoc(doc(db('teacher-a'),`schools/a/financeReviews/${req.id}`)));
    await assertFails(getDoc(doc(db('a-one'),`schools/a/financeReviews/${req.id}`)));
  });
});
