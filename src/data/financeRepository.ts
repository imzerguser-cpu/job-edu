import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,where} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {COMMUNITY_FUND_ACCOUNT_ID,ISSUER_ACCOUNT_ID,computeIncomeTax,incomeTaxJournalId,salaryJournalId,validateFundExpenseAmount,validateFundExpenseDescription,type Account,type AccountEntry,type EconomicStats,type IncomeTaxPreviewItem,type SalaryPreviewItem} from '../domain/finance';
export interface FinanceStore {
  ensureIssuer():Promise<void>;
  ensureCommunityFund():Promise<void>;
  myAccount():Promise<Account|null>;
  myEntries():Promise<AccountEntry[]>;
  previewSalary(period:string):Promise<SalaryPreviewItem[]>;
  settleSalary(items:SalaryPreviewItem[]):Promise<{paid:number;skipped:number;failed:number}>;
  previewIncomeTax(period:string,rateBp:number):Promise<IncomeTaxPreviewItem[]>;
  settleIncomeTax(items:IncomeTaxPreviewItem[]):Promise<{paid:number;skipped:number;failed:number}>;
  communityFundAccount():Promise<Account|null>;
  communityFundEntries():Promise<AccountEntry[]>;
  spendCommunityFund(description:string,amountMinor:number):Promise<void>;
  economicStats():Promise<EconomicStats>;
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
    async ensureCommunityFund(){
      teacher();
      const target=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID);
      if((await getDocFromServer(target)).exists())return;
      await runTransaction(db,async tx=>{
        if((await tx.get(target)).exists())return;
        tx.set(target,{schoolId:context.schoolId,ownerType:'school',ownerId:COMMUNITY_FUND_ACCOUNT_ID,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
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
    async previewIncomeTax(period,rateBp){
      teacher();
      const [journalsSnap,studentsSnap]=await Promise.all([
        getDocsFromServer(query(collection(db,schoolPath(context,'journals')),where('type','==','SALARY'),where('period','==',period),limit(100))),
        getDocsFromServer(query(collection(db,schoolPath(context,'students')),limit(100))),
      ]);
      const students=studentsSnap.docs.map(d=>({...d.data(),id:d.id} as {id:string;name:string;status:string}));
      const incomeByStudent=new Map<string,number>();
      for(const d of journalsSnap.docs){
        const j=d.data() as {studentId:string;amountMinor:number};
        incomeByStudent.set(j.studentId,(incomeByStudent.get(j.studentId)??0)+j.amountMinor);
      }
      const items:IncomeTaxPreviewItem[]=[];
      for(const [studentId,incomeMinor] of incomeByStudent){
        const student=students.find(s=>s.id===studentId);
        if(!student||student.status!=='active')continue;
        const amountMinor=computeIncomeTax(incomeMinor,rateBp);
        if(amountMinor<=0)continue;
        items.push({studentId,studentName:student.name,incomeMinor,amountMinor,period,journalId:incomeTaxJournalId(studentId,period),alreadyPaid:false});
      }
      const checks=await Promise.all(items.map(it=>getDocFromServer(ref('journals',it.journalId))));
      return items.map((it,i)=>({...it,alreadyPaid:checks[i].exists()}));
    },
    async settleIncomeTax(items){
      teacher();
      let paid=0,skipped=0,failed=0;
      for(const item of items){
        if(item.alreadyPaid){skipped++;continue}
        try{
          await runTransaction(db,async tx=>{
            const journalRef=ref('journals',item.journalId);
            if((await tx.get(journalRef)).exists())return;
            const fundRef=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID),studentRef=ref('accounts',item.studentId);
            const [fund,student]=await Promise.all([tx.get(fundRef),tx.get(studentRef)]);
            if(!fund.exists())throw new Error('공동기금 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
            if(!student.exists()||student.data().balanceMinor<item.amountMinor)throw new Error('잔액이 부족합니다.');
            tx.set(journalRef,{schoolId:context.schoolId,type:'INCOME_TAX',studentId:item.studentId,period:item.period,debitAccountId:item.studentId,creditAccountId:COMMUNITY_FUND_ACCOUNT_ID,amountMinor:item.amountMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
            const studentAfter=student.data().balanceMinor-item.amountMinor;
            tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(studentRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'INCOME_TAX',deltaMinor:-item.amountMinor,balanceAfterMinor:studentAfter,label:'소득세',postedAt:serverTimestamp()});
            const fundAfter=fund.data().balanceMinor+item.amountMinor;
            tx.update(fundRef,{balanceMinor:fundAfter,version:fund.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(fundRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'INCOME_TAX',deltaMinor:item.amountMinor,balanceAfterMinor:fundAfter,label:`소득세 · ${item.studentName}`,postedAt:serverTimestamp()});
            tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'income_tax',targetType:'journal',targetId:item.journalId,detail:`${item.studentName} · ${item.amountMinor}`,createdAt:serverTimestamp()});
          });
          paid++;
        }catch{failed++}
      }
      return {paid,skipped,failed};
    },
    async communityFundAccount(){
      const snap=await getDocFromServer(ref('accounts',COMMUNITY_FUND_ACCOUNT_ID));
      return snap.exists()?({...snap.data(),id:snap.id} as Account):null;
    },
    async communityFundEntries(){
      teacher();
      const snap=await getDocsFromServer(query(collection(ref('accounts',COMMUNITY_FUND_ACCOUNT_ID),'entries'),orderBy('postedAt','desc'),limit(20)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as AccountEntry));
    },
    // One-shot, like buy() (D-24) — a random journal id since repeat spending is expected and
    // there is no natural idempotency key. Money leaves back to system-issuer (D above), not to
    // any tracked recipient, since there is no real-world payee account in this ledger.
    async spendCommunityFund(description,amountMinor){
      teacher();
      validateFundExpenseDescription(description);validateFundExpenseAmount(amountMinor);
      const journalId=`fundExpense~${crypto.randomUUID()}`;
      await runTransaction(db,async tx=>{
        const fundRef=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID),issuerRef=ref('accounts',ISSUER_ACCOUNT_ID);
        const [fund,issuer]=await Promise.all([tx.get(fundRef),tx.get(issuerRef)]);
        if(!fund.exists())throw new Error('공동기금 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
        if(!issuer.exists())throw new Error('발행 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
        if(fund.data().balanceMinor<amountMinor)throw new Error('공동기금 잔액이 부족합니다.');
        const description_=description.trim();
        tx.set(ref('journals',journalId),{schoolId:context.schoolId,type:'FUND_EXPENSE',description:description_,debitAccountId:COMMUNITY_FUND_ACCOUNT_ID,creditAccountId:ISSUER_ACCOUNT_ID,amountMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
        const fundAfter=fund.data().balanceMinor-amountMinor;
        tx.update(fundRef,{balanceMinor:fundAfter,version:fund.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(fundRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'FUND_EXPENSE',deltaMinor:-amountMinor,balanceAfterMinor:fundAfter,label:description_,postedAt:serverTimestamp()});
        const issuerAfter=issuer.data().balanceMinor+amountMinor;
        tx.update(issuerRef,{balanceMinor:issuerAfter,version:issuer.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(issuerRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'FUND_EXPENSE',deltaMinor:amountMinor,balanceAfterMinor:issuerAfter,label:`공동기금 지출 · ${description_}`,postedAt:serverTimestamp()});
        tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'fund_expense',targetType:'journal',targetId:journalId,detail:`${description_} · ${amountMinor}`,createdAt:serverTimestamp()});
      });
    },
    // Reuses the existing accounts.list rule (teacher, bounded) — no new Rules or index needed.
    // 'school'-owned accounts (issuer, community-fund) are institutional, not citizen wealth, so
    // they're excluded from the circulating total.
    async economicStats(){
      teacher();
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'accounts')),limit(100)));
      const accounts=snap.docs.map(d=>d.data() as {ownerType:'student'|'school'|'business';ownerId:string;balanceMinor:number});
      const students=accounts.filter(a=>a.ownerType==='student');
      const businesses=accounts.filter(a=>a.ownerType==='business');
      const studentTotalMinor=students.reduce((sum,a)=>sum+a.balanceMinor,0);
      const businessTotalMinor=businesses.reduce((sum,a)=>sum+a.balanceMinor,0);
      return {
        circulatingMinor:studentTotalMinor+businessTotalMinor,
        studentTotalMinor,businessTotalMinor,
        studentCount:students.length,
        avgStudentBalanceMinor:students.length?Math.round(studentTotalMinor/students.length):0,
        issuerBalanceMinor:accounts.find(a=>a.ownerId===ISSUER_ACCOUNT_ID)?.balanceMinor??0,
        communityFundBalanceMinor:accounts.find(a=>a.ownerId===COMMUNITY_FUND_ACCOUNT_ID)?.balanceMinor??0,
      };
    },
  };
}
