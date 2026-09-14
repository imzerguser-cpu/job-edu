import {collection,deleteDoc,doc,getDocFromServer,getDocsFromServer,limit,query,where,runTransaction,serverTimestamp,Timestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant,pairId} from '../domain/jobs';
import {canRestart,canSubmit,validateSubmission,validateTemplate,type Task,type TaskData,type TaskTemplate} from '../domain/tasks';
import {EVIDENCE_EXPIRY_HOURS,validateEvidence,type Evidence} from '../domain/evidence';
export interface TaskStore {
  load():Promise<TaskData>;
  saveTemplate(t:TaskTemplate):Promise<void>;
  assign(templateId:string,studentId:string):Promise<void>;
  submit(taskId:string,text:string):Promise<void>;
  submitPhoto(taskId:string,mimeType:'image/jpeg',base64:string,caption:string):Promise<void>;
  getEvidence(taskId:string):Promise<Evidence|null>;
  review(task:Task,approve:boolean,note:string):Promise<void>;
  restart(task:Task):Promise<void>;
  purgeExpiredEvidence():Promise<number>;
}
export function firestoreTasks(db:Firestore,context:SchoolContext):TaskStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async load(){
      async function list<T>(name:string,personal=false){
        const filters=personal&&!isTeacher(context.membership)?[where('assigneeStudentId','==',assertApplicant(context))]:[];
        const snap=await getDocsFromServer(query(collection(db,schoolPath(context,name)),...filters,limit(100)));
        return snap.docs.map(d=>({...d.data(),id:d.id} as T));
      }
      const [templates,tasks]=await Promise.all([list<TaskTemplate>('taskTemplates'),list<Task>('tasks',true)]);
      return {templates,tasks};
    },
    async saveTemplate(t){
      teacher();validateTemplate(t);
      await runTransaction(db,async tx=>{
        const jobRef=ref('jobs',t.jobId),job=await tx.get(jobRef);
        if(!job.exists())throw new Error('존재하는 직업을 선택해 주세요.');
        const target=ref('taskTemplates',t.id),old=await tx.get(target);
        const {id,...data}=t;
        tx.set(target,{...data,schoolId:context.schoolId,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async assign(templateId,studentId){
      teacher();const id=pairId(templateId,studentId);
      await runTransaction(db,async tx=>{
        const templateRef=ref('taskTemplates',templateId),target=ref('tasks',id);
        const [template,old]=await Promise.all([tx.get(templateRef),tx.get(target)]);
        if(!template.exists()||template.data().status!=='active')throw new Error('운영 중인 업무만 배정할 수 있습니다.');
        const jobId=template.data().jobId as string;
        const assignment=await tx.get(ref('jobAssignments',pairId(jobId,studentId)));
        if(!assignment.exists()||assignment.data().status!=='active')throw new Error('해당 직업을 맡고 있는 학생만 배정할 수 있습니다.');
        if(old.exists()&&old.data().status!=='approved')throw new Error('이미 진행 중인 업무입니다.');
        tx.set(target,{
          schoolId:context.schoolId,templateId,jobId,assigneeStudentId:studentId,verificationKind:template.data().verificationKind,
          status:'assigned',attempt:old.exists()?old.data().attempt:0,submissionText:'',reviewNote:'',reviewerUid:null,schemaVersion:1,
          createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
        });
      });
    },
    async submit(taskId,text){
      const studentId=assertApplicant(context);const trimmed=validateSubmission(text);
      await runTransaction(db,async tx=>{
        const target=ref('tasks',taskId),old=await tx.get(target);
        if(!old.exists()||old.data().assigneeStudentId!==studentId)throw new Error('내 업무만 제출할 수 있습니다.');
        if(!canSubmit(old.data() as Task))throw new Error('지금 제출할 수 있는 상태가 아닙니다.');
        tx.update(target,{status:'submitted',attempt:old.data().attempt+1,submissionText:trimmed,reviewNote:'',reviewerUid:null,updatedAt:serverTimestamp()});
      });
    },
    async submitPhoto(taskId,mimeType,base64,caption){
      const studentId=assertApplicant(context);
      const trimmed=validateSubmission(caption);
      validateEvidence(mimeType,base64);
      const expiresAt=Timestamp.fromMillis(Date.now()+EVIDENCE_EXPIRY_HOURS*3600*1000);
      await runTransaction(db,async tx=>{
        const target=ref('tasks',taskId),old=await tx.get(target);
        if(!old.exists()||old.data().assigneeStudentId!==studentId)throw new Error('내 업무만 제출할 수 있습니다.');
        if(old.data().verificationKind!=='photo')throw new Error('사진 인증 업무가 아닙니다.');
        if(!canSubmit(old.data() as Task))throw new Error('지금 제출할 수 있는 상태가 아닙니다.');
        tx.set(ref('evidence',taskId),{schoolId:context.schoolId,studentId,taskId,mimeType,payloadBase64:base64,expiresAt,createdAt:serverTimestamp()});
        tx.update(target,{status:'submitted',attempt:old.data().attempt+1,submissionText:trimmed,reviewNote:'',reviewerUid:null,updatedAt:serverTimestamp()});
      });
    },
    async getEvidence(taskId){
      // A missing, expired, or already-reviewed (deleted) photo all deny the read the same way
      // rules-side (see D-20/evidence get rule) since ownership can't be checked from the path
      // alone here; treat any read failure the same as "no photo to show".
      try{
        const snap=await getDocFromServer(ref('evidence',taskId));
        return snap.exists()?({...snap.data(),id:snap.id} as Evidence):null;
      }catch{return null}
    },
    async review(task,approve,note){
      teacher();note=note.trim();
      if(!approve&&!note)throw new Error('다시 제출을 요청하려면 이유를 적어 주세요.');
      if(note.length>500)throw new Error('의견은 500자 이하로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const target=ref('tasks',task.id),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='submitted')throw new Error('이미 처리되었거나 제출되지 않은 업무입니다.');
        if(old.data().verificationKind==='photo'){
          tx.delete(ref('evidence',task.id));
          // 사진은 원본을 지우지만(개인정보 최소 보관, D-37) "언제 몇 번째 시도가 어떻게
          // 심사됐는지"는 이미 있는 auditLogs를 재사용해 기록에 남긴다 — 새 컬렉션/Rules 없이
          // 기존 감사 로그 인프라와 화면(운영 현황 "최근 주요 활동")을 그대로 쓴다.
          tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'photo_review',targetType:'task',targetId:task.id,detail:`${task.assigneeStudentId} · 시도 ${old.data().attempt} · ${approve?'승인':'다시 제출 요청'}${note?': '+note:''}`.slice(0,500),createdAt:serverTimestamp()});
        }
        tx.update(target,{status:approve?'approved':'revision_requested',reviewNote:note,reviewerUid:context.uid,updatedAt:serverTimestamp()});
      });
    },
    async restart(task){
      teacher();
      await runTransaction(db,async tx=>{
        const target=ref('tasks',task.id),old=await tx.get(target);
        if(!old.exists()||!canRestart(old.data() as Task))throw new Error('완료된 업무만 다시 시작할 수 있습니다.');
        const template=await tx.get(ref('taskTemplates',old.data().templateId));
        if(!template.exists()||template.data().status!=='active')throw new Error('운영 중인 업무만 다시 시작할 수 있습니다.');
        const assignment=await tx.get(ref('jobAssignments',pairId(old.data().jobId,old.data().assigneeStudentId)));
        if(!assignment.exists()||assignment.data().status!=='active')throw new Error('직업을 유지하고 있는 학생만 다시 시작할 수 있습니다.');
        tx.update(target,{status:'assigned',submissionText:'',reviewNote:'',reviewerUid:null,updatedAt:serverTimestamp()});
      });
    },
    async purgeExpiredEvidence(){
      teacher();
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'evidence')),where('expiresAt','<',Timestamp.now()),limit(20)));
      await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
      return snap.docs.length;
    },
  };
}
