import {collection,doc,getDocsFromServer,limit,query,where,runTransaction,serverTimestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant,pairId} from '../domain/jobs';
import {canRestart,canSubmit,validateSubmission,validateTemplate,type Task,type TaskData,type TaskTemplate} from '../domain/tasks';
export interface TaskStore {
  load():Promise<TaskData>;
  saveTemplate(t:TaskTemplate):Promise<void>;
  assign(templateId:string,studentId:string):Promise<void>;
  submit(taskId:string,text:string):Promise<void>;
  review(task:Task,approve:boolean,note:string):Promise<void>;
  restart(task:Task):Promise<void>;
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
    async review(task,approve,note){
      teacher();note=note.trim();
      if(!approve&&!note)throw new Error('다시 제출을 요청하려면 이유를 적어 주세요.');
      if(note.length>500)throw new Error('의견은 500자 이하로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const target=ref('tasks',task.id),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='submitted')throw new Error('이미 처리되었거나 제출되지 않은 업무입니다.');
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
  };
}
