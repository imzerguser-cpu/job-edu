import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {ISSUER_ACCOUNT_ID,salaryJournalId,type Account,type AccountEntry,type SalaryPreviewItem} from '../domain/finance';
export interface FinanceStore {
  ensureIssuer():Promise<void>;
  myAccount():Promise<Account|null>;
  myEntries():Promise<AccountEntry[]>;
  previewSalary(period:string):Promise<SalaryPreviewItem[]>;
  settleSalary(items:SalaryPreviewItem[]):Promise<{paid:number;skipped:number;failed:number}>;
}
export function firestoreFinance(db:Firestore,context:SchoolContext):FinanceStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async ensureIssuer(){
      teacher();
      const target=ref('accounts',ISSUER_ACCOUNT_ID);
      if((await getDocFromServer(target)).exists())return;
      await runTransaction(db,async tx=>{
        if((await tx.get(target)).exists())return;
        tx.set(target,{schoolId:context.schoolId,ownerType:'school',ownerId:ISSUER_ACCOUNT_ID,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async myAccount(){
      const studentId=assertApplicant(context);
      const snap=await getDocFromServer(ref('accounts',studentId));
      return snap.exists()?({...snap.data(),id:snap.id} as Account):null;
    },
    async myEntries(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(ref('accounts',studentId),'entries'),orderBy('postedAt','desc'),limit(20)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as AccountEntry));
    },
    async previewSalary(period){
      teacher();
      const [jobsSnap,assignSnap,studentsSnap]=await Promise.all([
        getDocsFromServer(query(collection(db,schoolPath(context,'jobs')),limit(100))),
        getDocsFromServer(query(collection(db,schoolPath(context,'jobAssignments')),limit(100))),
        getDocsFromServer(query(collection(db,schoolPath(context,'students')),limit(100))),
      ]);
      const jobs=jobsSnap.docs.map(d=>({...d.data(),id:d.id} as {id:string;name:string;salaryMinor:number}));
      const assignments=assignSnap.docs.map(d=>d.data() as {jobId:string;studentId:string;status:string});
      const students=studentsSnap.docs.map(d=>({...d.data(),id:d.id} as {id:string;name:string;status:string}));
      const items:SalaryPreviewItem[]=[];
      for(const a of assignments){
        if(a.status!=='active')continue;
        const job=jobs.find(j=>j.id===a.jobId);
        if(!job||!(job.salaryMinor>0))continue;
        const student=students.find(s=>s.id===a.studentId);
        if(!student||student.status!=='active')continue;
        items.push({jobId:job.id,jobName:job.name,studentId:a.studentId,studentName:student.name,amountMinor:job.salaryMinor,period,journalId:salaryJournalId(job.id,a.studentId,period),alreadyPaid:false});
      }
      const checks=await Promise.all(items.map(it=>getDocFromServer(ref('journals',it.journalId))));
      return items.map((it,i)=>({...it,alreadyPaid:checks[i].exists()}));
    },
    async settleSalary(items){
      teacher();
      let paid=0,skipped=0,failed=0;
      for(const item of items){
        if(item.alreadyPaid){skipped++;continue}
        try{
          await runTransaction(db,async tx=>{
            const journalRef=ref('journals',item.journalId);
            if((await tx.get(journalRef)).exists())return;
            const issuerRef=ref('accounts',ISSUER_ACCOUNT_ID),studentRef=ref('accounts',item.studentId);
            const [issuer,student]=await Promise.all([tx.get(issuerRef),tx.get(studentRef)]);
            if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
            tx.set(journalRef,{schoolId:context.schoolId,type:'SALARY',jobId:item.jobId,studentId:item.studentId,period:item.period,debitAccountId:ISSUER_ACCOUNT_ID,creditAccountId:item.studentId,amountMinor:item.amountMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
            const issuerAfter=issuer.data().balanceMinor-item.amountMinor;
            tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(issuerRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'SALARY',deltaMinor:-item.amountMinor,balanceAfterMinor:issuerAfter,label:'월급 지급',postedAt:serverTimestamp()});
            const studentBefore=student.exists()?student.data().balanceMinor:0;
            const studentAfter=studentBefore+item.amountMinor;
            if(student.exists())tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            else tx.set(studentRef,{schoolId:context.schoolId,ownerType:'student',ownerId:item.studentId,balanceMinor:studentAfter,version:0,lastJournalId:item.journalId,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
            tx.set(doc(collection(studentRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'SALARY',deltaMinor:item.amountMinor,balanceAfterMinor:studentAfter,label:'월급',postedAt:serverTimestamp()});
            tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'salary_payment',targetType:'journal',targetId:item.journalId,detail:`${item.studentName} · ${item.jobName} · ${item.amountMinor}`,createdAt:serverTimestamp()});
          });
          paid++;
        }catch{failed++}
      }
      return {paid,skipped,failed};
    },
  };
}
