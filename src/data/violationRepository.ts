import {collection,doc,getDocFromServer,getDocsFromServer,limit,query,runTransaction,serverTimestamp,where} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {COMMUNITY_FUND_ACCOUNT_ID} from '../domain/finance';
import {fineJournalId,validateFineAmount,validateReportDescription,type ViolationReport} from '../domain/violations';
export interface ViolationStore {
  ensureCommunityFund():Promise<void>;
  submitReport(targetStudentId:string,description:string):Promise<void>;
  myReports():Promise<ViolationReport[]>;
  allReports():Promise<ViolationReport[]>;
  decide(reportId:string,fineAmountMinor:number|null,decisionNote:string):Promise<void>;
}
function toReport(id:string,d:Record<string,unknown>):ViolationReport{
  return {id,schoolId:d.schoolId as string,reporterUid:d.reporterUid as string,targetStudentId:d.targetStudentId as string,
    description:d.description as string,status:d.status as ViolationReport['status'],
    fineAmountMinor:(d.fineAmountMinor as number|null)??null,decisionNote:(d.decisionNote as string)??'',
    journalId:(d.journalId as string|null)??null,schemaVersion:1};
}
export function firestoreViolations(db:Firestore,context:SchoolContext):ViolationStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async ensureCommunityFund(){
      teacher();
      const target=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID);
      if((await getDocFromServer(target)).exists())return;
      await runTransaction(db,async tx=>{
        if((await tx.get(target)).exists())return;
        tx.set(target,{schoolId:context.schoolId,ownerType:'school',ownerId:COMMUNITY_FUND_ACCOUNT_ID,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async submitReport(targetStudentId,description){
      if(context.membership.status!=='active')throw new Error('학교 이용 권한이 없습니다.');
      if(context.membership.role==='student'&&context.membership.studentId===targetStudentId)throw new Error('자기 자신을 신고할 수 없습니다.');
      validateReportDescription(description);
      const reportId=crypto.randomUUID();
      await runTransaction(db,async tx=>{
        tx.set(ref('violationReports',reportId),{schoolId:context.schoolId,reporterUid:context.uid,targetStudentId,description:description.trim(),status:'submitted',fineAmountMinor:null,decisionNote:'',journalId:null,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async myReports(){
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'violationReports')),where('reporterUid','==',context.uid),limit(100)));
      return snap.docs.map(d=>toReport(d.id,d.data()));
    },
    async allReports(){
      teacher();
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'violationReports')),limit(100)));
      return snap.docs.map(d=>toReport(d.id,d.data()));
    },
    async decide(reportId,fineAmountMinor,decisionNote){
      teacher();
      if(fineAmountMinor==null&&!decisionNote.trim())throw new Error('기각 사유를 입력해 주세요.');
      await runTransaction(db,async tx=>{
        const reportRef=ref('violationReports',reportId);
        const report=await tx.get(reportRef);
        if(!report.exists()||report.data().status!=='submitted')throw new Error('이미 처리된 신고입니다.');
        if(fineAmountMinor==null){
          tx.update(reportRef,{status:'dismissed',decisionNote:decisionNote.trim(),updatedAt:serverTimestamp()});
          return;
        }
        validateFineAmount(fineAmountMinor);
        const targetStudentId=report.data().targetStudentId as string;
        const journalId=fineJournalId(reportId);
        const fundRef=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID),studentRef=ref('accounts',targetStudentId);
        const [fund,student]=await Promise.all([tx.get(fundRef),tx.get(studentRef)]);
        if(!fund.exists())throw new Error('공동기금 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
        if(!student.exists()||student.data().balanceMinor<fineAmountMinor)throw new Error('학생 잔액이 부족합니다.');
        tx.set(ref('journals',journalId),{schoolId:context.schoolId,type:'FINE',studentId:targetStudentId,reportId,debitAccountId:targetStudentId,creditAccountId:COMMUNITY_FUND_ACCOUNT_ID,amountMinor:fineAmountMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
        const studentAfter=student.data().balanceMinor-fineAmountMinor;
        tx.update(studentRef,{balanceMinor:studentAfter,version:student.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(studentRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'FINE',deltaMinor:-fineAmountMinor,balanceAfterMinor:studentAfter,label:'과태료',postedAt:serverTimestamp()});
        const fundAfter=fund.data().balanceMinor+fineAmountMinor;
        tx.update(fundRef,{balanceMinor:fundAfter,version:fund.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(fundRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'FINE',deltaMinor:fineAmountMinor,balanceAfterMinor:fundAfter,label:'과태료 징수',postedAt:serverTimestamp()});
        tx.update(reportRef,{status:'fined',fineAmountMinor,decisionNote:decisionNote.trim(),journalId,updatedAt:serverTimestamp()});
        tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'fine_issued',targetType:'journal',targetId:journalId,detail:`${targetStudentId} · ${fineAmountMinor}`,createdAt:serverTimestamp()});
      });
    },
  };
}
