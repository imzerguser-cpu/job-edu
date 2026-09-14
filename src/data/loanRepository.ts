import {collection,doc,getDocFromServer,getDocsFromServer,limit,query,runTransaction,serverTimestamp,setDoc,where} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {ISSUER_ACCOUNT_ID,validAmount,validMonths,type FinancialProduct} from '../domain/finance';
import {addCalendarMonths,simpleInterest} from '../domain/money';
import {
  canAssign,canDecide,canReject,canReview,loanJournalId,loanRepaymentJournalId,validatePurpose,validateRepaymentPlan,
  type FinanceReviewChecklist,type FinancialRequest,type LoanContract,
} from '../domain/loans';

export interface LoanStore {
  submitRequest(input:{productId:string;principalMinor:number;months:number;purpose:string;repaymentPlan:string}):Promise<void>;
  myRequests():Promise<FinancialRequest[]>;
  myLoans():Promise<LoanContract[]>;
  repay(contractId:string):Promise<void>;
  myReviewAssignments():Promise<FinancialRequest[]>;
  submitReview(requestId:string,checklist:FinanceReviewChecklist,note:string):Promise<void>;
  allRequests():Promise<FinancialRequest[]>;
  assignReviewer(requestId:string,studentId:string):Promise<void>;
  decide(requestId:string,approve:boolean,note:string):Promise<void>;
}

export function firestoreLoans(db:Firestore,context:SchoolContext):LoanStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  const toRequest=(id:string,raw:Record<string,unknown>)=>({...raw,id} as FinancialRequest);
  return {
    async submitRequest({productId,principalMinor,months,purpose,repaymentPlan}){
      const studentId=assertApplicant(context);
      validatePurpose(purpose);validateRepaymentPlan(repaymentPlan);
      const productSnap=await getDocFromServer(ref('financialProducts',productId));
      if(!productSnap.exists()||productSnap.data().status!=='active'||productSnap.data().kind!=='loan')throw new Error('신청할 수 있는 상품이 아닙니다.');
      const product={...productSnap.data(),id:productSnap.id} as FinancialProduct;
      if(!validAmount(product,principalMinor))throw new Error('신청 금액이 상품 범위를 벗어났습니다.');
      if(!validMonths(product,months))throw new Error('신청 기간이 상품 범위를 벗어났습니다.');
      await setDoc(ref('financialRequests',crypto.randomUUID()),{
        schoolId:context.schoolId,studentId,operation:'LOAN',productId,
        principalMinor,months,purpose:purpose.trim(),repaymentPlan:repaymentPlan.trim(),
        status:'submitted',assignedStudentId:null,reviewNote:'',decisionNote:'',reviewerUid:null,createdEntityId:null,
        schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
      });
    },
    async myRequests(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'financialRequests')),where('studentId','==',studentId),limit(100)));
      return snap.docs.map(d=>toRequest(d.id,d.data()));
    },
    async myLoans(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'loans')),where('studentId','==',studentId),limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as LoanContract));
    },
    async repay(contractId){
      const studentId=assertApplicant(context);
      const repaymentJournalId=loanRepaymentJournalId(contractId);
      await runTransaction(db,async tx=>{
        const contractRef=ref('loans',contractId);
        const contract=await tx.get(contractRef);
        if(!contract.exists()||contract.data().studentId!==studentId)throw new Error('내 대출만 상환할 수 있습니다.');
        if(contract.data().status!=='active')throw new Error('이미 상환된 대출입니다.');
        const amount=contract.data().totalOwedMinor as number;
        const studentRef=ref('accounts',studentId),issuerRef=ref('accounts',ISSUER_ACCOUNT_ID);
        const [student,issuer]=await Promise.all([tx.get(studentRef),tx.get(issuerRef)]);
        if(!student.exists()||student.data().balanceMinor<amount)throw new Error('마동이 부족합니다.');
        if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다.');
        tx.set(ref('journals',repaymentJournalId),{schoolId:context.schoolId,type:'LOAN_REPAYMENT',studentId,contractId,debitAccountId:studentId,creditAccountId:ISSUER_ACCOUNT_ID,amountMinor:amount,postedBy:studentId,schemaVersion:1,createdAt:serverTimestamp()});
        const studentAfter=student.data().balanceMinor-amount;
        tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:repaymentJournalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(studentRef,'entries'),repaymentJournalId),{schoolId:context.schoolId,journalId:repaymentJournalId,type:'LOAN_REPAYMENT',deltaMinor:-amount,balanceAfterMinor:studentAfter,label:'대출 상환',postedAt:serverTimestamp()});
        const issuerAfter=issuer.data().balanceMinor+amount;
        tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:repaymentJournalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(issuerRef,'entries'),repaymentJournalId),{schoolId:context.schoolId,journalId:repaymentJournalId,type:'LOAN_REPAYMENT',deltaMinor:amount,balanceAfterMinor:issuerAfter,label:'대출 상환 수납',postedAt:serverTimestamp()});
        tx.update(contractRef,{status:'repaid',repaidMinor:amount,repaymentJournalId,updatedAt:serverTimestamp()});
      });
    },
    async myReviewAssignments(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'financialRequests')),where('assignedStudentId','==',studentId),limit(100)));
      return snap.docs.map(d=>toRequest(d.id,d.data()));
    },
    async submitReview(requestId,checklist,note){
      const studentId=assertApplicant(context);
      note=note.trim();
      if(note.length>500)throw new Error('의견은 500자 이하로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const requestRef=ref('financialRequests',requestId);
        const old=await tx.get(requestRef);
        if(!old.exists())throw new Error('요청을 찾을 수 없습니다.');
        const request=toRequest(requestId,old.data());
        if(!canReview(request,studentId))throw new Error('배정된 검토만 제출할 수 있습니다.');
        tx.set(ref('financeReviews',requestId),{schoolId:context.schoolId,requestId,assignedStudentId:studentId,checklist,note,schemaVersion:1,createdAt:serverTimestamp()});
        tx.update(requestRef,{status:'reviewed',reviewNote:note,updatedAt:serverTimestamp()});
      });
    },
    async allRequests(){
      teacher();
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'financialRequests')),limit(100)));
      return snap.docs.map(d=>toRequest(d.id,d.data()));
    },
    async assignReviewer(requestId,studentId){
      teacher();
      await runTransaction(db,async tx=>{
        const requestRef=ref('financialRequests',requestId);
        const old=await tx.get(requestRef);
        if(!old.exists()||!canAssign(toRequest(requestId,old.data())))throw new Error('검토 대기 중인 요청만 배정할 수 있습니다.');
        const reviewer=await tx.get(ref('students',studentId));
        if(!reviewer.exists()||reviewer.data().status!=='active')throw new Error('활동 중인 학생을 검토자로 지정해 주세요.');
        tx.update(requestRef,{status:'assigned',assignedStudentId:studentId,updatedAt:serverTimestamp()});
      });
    },
    async decide(requestId,approve,note){
      teacher();
      note=note.trim();
      if(!approve&&!note)throw new Error('반려 이유를 적어 주세요.');
      if(note.length>500)throw new Error('의견은 500자 이하로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const requestRef=ref('financialRequests',requestId);
        const old=await tx.get(requestRef);
        if(!old.exists())throw new Error('요청을 찾을 수 없습니다.');
        const request=toRequest(requestId,old.data());
        if(approve){
          if(!canDecide(request))throw new Error('은행원 검토가 끝난 요청만 승인할 수 있습니다.');
          const productSnap=await tx.get(ref('financialProducts',request.productId));
          if(!productSnap.exists())throw new Error('대출 상품을 찾을 수 없습니다.');
          const product={...productSnap.data(),id:productSnap.id} as FinancialProduct;
          const studentRef=ref('accounts',request.studentId),issuerRef=ref('accounts',ISSUER_ACCOUNT_ID);
          const [student,issuer]=await Promise.all([tx.get(studentRef),tx.get(issuerRef)]);
          if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
          const interestMinor=simpleInterest(request.principalMinor,product.rateBpsMonthly,request.months);
          const totalOwedMinor=request.principalMinor+interestMinor;
          const journalId=loanJournalId(requestId);
          const today=new Date().toISOString().slice(0,10);
          const dueAt=addCalendarMonths(today,request.months);
          tx.set(ref('journals',journalId),{schoolId:context.schoolId,type:'LOAN',studentId:request.studentId,contractId:requestId,debitAccountId:ISSUER_ACCOUNT_ID,creditAccountId:request.studentId,amountMinor:request.principalMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
          const issuerAfter=issuer.data().balanceMinor-request.principalMinor;
          tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
          tx.set(doc(collection(issuerRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'LOAN',deltaMinor:-request.principalMinor,balanceAfterMinor:issuerAfter,label:'대출 실행',postedAt:serverTimestamp()});
          const studentBefore=student.exists()?student.data().balanceMinor:0;
          const studentAfter=studentBefore+request.principalMinor;
          if(student.exists())tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
          else tx.set(studentRef,{schoolId:context.schoolId,ownerType:'student',ownerId:request.studentId,balanceMinor:studentAfter,version:0,lastJournalId:journalId,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
          tx.set(doc(collection(studentRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'LOAN',deltaMinor:request.principalMinor,balanceAfterMinor:studentAfter,label:`대출 실행 · ${product.name}`,postedAt:serverTimestamp()});
          tx.set(ref('loans',requestId),{
            schoolId:context.schoolId,studentId:request.studentId,productId:request.productId,
            productSnapshot:{name:product.name,rateBpsMonthly:product.rateBpsMonthly},
            principalMinor:request.principalMinor,months:request.months,interestMinor,totalOwedMinor,repaidMinor:0,
            status:'active',disbursementJournalId:journalId,repaymentJournalId:null,
            startAt:today,dueAt,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
          });
          tx.update(requestRef,{status:'approved',decisionNote:note,reviewerUid:context.uid,createdEntityId:requestId,updatedAt:serverTimestamp()});
          tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'loan_approve',targetType:'loan',targetId:requestId,detail:`${request.studentId} · 원금 ${request.principalMinor} · 이자 ${interestMinor}`,createdAt:serverTimestamp()});
        }else{
          if(!canReject(request))throw new Error('이미 결정된 요청입니다.');
          tx.update(requestRef,{status:'rejected',decisionNote:note,reviewerUid:context.uid,createdEntityId:null,updatedAt:serverTimestamp()});
        }
      });
    },
  };
}
