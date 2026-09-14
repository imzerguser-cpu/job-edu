import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,where} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {ISSUER_ACCOUNT_ID,validAmount,validMonths,type FinancialProduct} from '../domain/finance';
import {simpleInterest,addCalendarMonths} from '../domain/money';
import {
  savingsDepositJournalId,savingsInterestJournalId,
  type SavingsContract,type SavingsMaturityPreviewItem,
} from '../domain/savings';

export interface SavingsStore {
  myContracts():Promise<SavingsContract[]>;
  openSavings(input:{productId:string;principalMinor:number;months:number}):Promise<void>;
  previewMaturities():Promise<SavingsMaturityPreviewItem[]>;
  settleMaturities(items:SavingsMaturityPreviewItem[]):Promise<{paid:number;skipped:number;failed:number}>;
}

export function firestoreSavings(db:Firestore,context:SchoolContext):SavingsStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async myContracts(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'savings')),where('studentId','==',studentId),limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as SavingsContract));
    },
    async openSavings({productId,principalMinor,months}){
      const studentId=assertApplicant(context);
      const productSnap=await getDocFromServer(ref('financialProducts',productId));
      if(!productSnap.exists()||productSnap.data().status!=='active')throw new Error('가입할 수 있는 상품이 아닙니다.');
      const product={...productSnap.data(),id:productSnap.id} as FinancialProduct;
      if(!validAmount(product,principalMinor))throw new Error('가입 금액이 상품 범위를 벗어났습니다.');
      if(!validMonths(product,months))throw new Error('가입 기간이 상품 범위를 벗어났습니다.');
      const contractId=crypto.randomUUID();
      const depositJournalId=savingsDepositJournalId(contractId);
      const startAt=new Date().toISOString().slice(0,10);
      const maturityAt=addCalendarMonths(startAt,months);
      await runTransaction(db,async tx=>{
        const studentRef=ref('accounts',studentId),issuerRef=ref('accounts',ISSUER_ACCOUNT_ID);
        const [student,issuer]=await Promise.all([tx.get(studentRef),tx.get(issuerRef)]);
        if(!student.exists()||student.data().balanceMinor<principalMinor)throw new Error('마동이 부족합니다.');
        if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
        tx.set(ref('journals',depositJournalId),{schoolId:context.schoolId,type:'SAVINGS_DEPOSIT',studentId,contractId,debitAccountId:studentId,creditAccountId:ISSUER_ACCOUNT_ID,amountMinor:principalMinor,postedBy:studentId,schemaVersion:1,createdAt:serverTimestamp()});
        const studentAfter=student.data().balanceMinor-principalMinor;
        tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:depositJournalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(studentRef,'entries'),depositJournalId),{schoolId:context.schoolId,journalId:depositJournalId,type:'SAVINGS_DEPOSIT',deltaMinor:-principalMinor,balanceAfterMinor:studentAfter,label:`저축 가입 · ${product.name}`,postedAt:serverTimestamp()});
        const issuerAfter=issuer.data().balanceMinor+principalMinor;
        tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:depositJournalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(issuerRef,'entries'),depositJournalId),{schoolId:context.schoolId,journalId:depositJournalId,type:'SAVINGS_DEPOSIT',deltaMinor:principalMinor,balanceAfterMinor:issuerAfter,label:`저축 수납 · ${product.name}`,postedAt:serverTimestamp()});
        tx.set(ref('savings',contractId),{
          schoolId:context.schoolId,studentId,productId,
          productSnapshot:{name:product.name,rateBpsMonthly:product.rateBpsMonthly},
          principalMinor,months,startAt,maturityAt,
          status:'active',depositJournalId,maturityJournalId:null,interestMinor:null,
          schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
        });
      });
    },
    async previewMaturities(){
      teacher();
      const today=new Date().toISOString().slice(0,10);
      const [contractsSnap,studentsSnap]=await Promise.all([
        getDocsFromServer(query(collection(db,schoolPath(context,'savings')),where('status','==','active'),limit(100))),
        getDocsFromServer(query(collection(db,schoolPath(context,'students')),limit(100))),
      ]);
      const students=studentsSnap.docs.map(d=>({...d.data(),id:d.id} as {id:string;name:string}));
      const items:SavingsMaturityPreviewItem[]=[];
      for(const d of contractsSnap.docs){
        const c={...d.data(),id:d.id} as SavingsContract;
        if(c.maturityAt>today)continue;
        const student=students.find(s=>s.id===c.studentId);
        const interestMinor=simpleInterest(c.principalMinor,c.productSnapshot.rateBpsMonthly,c.months);
        items.push({
          contractId:c.id,studentId:c.studentId,studentName:student?.name??c.studentId,
          principalMinor:c.principalMinor,interestMinor,payoutMinor:c.principalMinor+interestMinor,
          maturityAt:c.maturityAt,journalId:savingsInterestJournalId(c.id),alreadyPaid:false,
        });
      }
      return items;
    },
    async settleMaturities(items){
      teacher();
      let paid=0,skipped=0,failed=0;
      for(const item of items){
        try{
          const outcome=await runTransaction(db,async tx=>{
            const contractRef=ref('savings',item.contractId);
            const contract=await tx.get(contractRef);
            if(!contract.exists()||contract.data().status!=='active')return 'skipped' as const;
            const issuerRef=ref('accounts',ISSUER_ACCOUNT_ID),studentRef=ref('accounts',item.studentId);
            const [issuer,student]=await Promise.all([tx.get(issuerRef),tx.get(studentRef)]);
            if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
            if(!student.exists())throw new Error('학생 계좌가 없습니다.');
            tx.set(ref('journals',item.journalId),{schoolId:context.schoolId,type:'INTEREST',studentId:item.studentId,contractId:item.contractId,debitAccountId:ISSUER_ACCOUNT_ID,creditAccountId:item.studentId,amountMinor:item.payoutMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
            const issuerAfter=issuer.data().balanceMinor-item.payoutMinor;
            tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(issuerRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'INTEREST',deltaMinor:-item.payoutMinor,balanceAfterMinor:issuerAfter,label:'저축 만기 지급',postedAt:serverTimestamp()});
            const studentAfter=student.data().balanceMinor+item.payoutMinor;
            tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(studentRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'INTEREST',deltaMinor:item.payoutMinor,balanceAfterMinor:studentAfter,label:'저축 만기(원금+이자)',postedAt:serverTimestamp()});
            tx.update(contractRef,{status:'matured',maturityJournalId:item.journalId,interestMinor:item.interestMinor,updatedAt:serverTimestamp()});
            tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'savings_maturity',targetType:'journal',targetId:item.journalId,detail:`${item.studentName} · 원금 ${item.principalMinor} · 이자 ${item.interestMinor}`,createdAt:serverTimestamp()});
            return 'paid' as const;
          });
          if(outcome==='paid')paid++;else skipped++;
        }catch{failed++}
      }
      return {paid,skipped,failed};
    },
  };
}
