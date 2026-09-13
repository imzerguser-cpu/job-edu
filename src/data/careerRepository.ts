import {collection,doc,getDocsFromServer,limit,query,where,runTransaction,serverTimestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant,canAssign,pairId,starterJobs,validateCareer,type Career,type Application,type Assignment,type CareerData} from '../domain/jobs';
export interface CareerStore {
  load():Promise<CareerData>;
  save(job:Career):Promise<void>;
  seed():Promise<void>;
  apply(jobId:string,reason:string):Promise<void>;
  review(application:Application,approve:boolean,note:string):Promise<void>;
  assign(jobId:string,studentId:string):Promise<void>;
  end(assignment:Assignment):Promise<void>;
}
export function firestoreCareers(db:Firestore,context:SchoolContext):CareerStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw Error('교사 권한이 필요합니다.')};
  async function assign(jobId:string,studentId:string,application?:Application,note=''){
    teacher();const id=pairId(jobId,studentId);
    await runTransaction(db,async tx=>{
      const jobRef=ref('jobs',jobId),studentRef=ref('students',studentId),assignmentRef=ref('jobAssignments',id);
      const [job,student,old,request]=await Promise.all([tx.get(jobRef),tx.get(studentRef),tx.get(assignmentRef),application?tx.get(ref('jobApplications',application.id)):Promise.resolve(null)]);
      if(!job.exists()||!canAssign(job.data() as Career))throw Error('모집 중이거나 운영 중인 직업만 배정할 수 있습니다.');
      if(!student.exists()||student.data().status!=='active')throw Error('활동 중인 학생을 선택해 주세요.');
      if(application&&(!request?.exists()||request.data().status!=='submitted'||request.data().jobId!==jobId||request.data().studentId!==studentId))throw Error('이미 처리된 신청입니다. 새로고침해 주세요.');
      if(!old.exists()||old.data().status!=='active')tx.set(assignmentRef,{schoolId:context.schoolId,jobId,studentId,status:'active',schemaVersion:1,startAt:serverTimestamp(),endAt:null,assignedBy:context.uid,updatedAt:serverTimestamp()});
      if(application)tx.update(ref('jobApplications',application.id),{status:'approved',reviewNote:note,reviewerUid:context.uid,reviewedAt:serverTimestamp()});
    });
  }
  return {
    async load(){
      async function list<T>(name:string,personal=false){
        const filters=personal&&!isTeacher(context.membership)?[where('studentId','==',assertApplicant(context))]:[];
        const snap=await getDocsFromServer(query(collection(db,schoolPath(context,name)),...filters,limit(100)));
        return snap.docs.map(d=>({...d.data(),id:d.id} as T));
      }
      const [jobs,applications,assignments]=await Promise.all([list<Career>('jobs'),list<Application>('jobApplications',true),list<Assignment>('jobAssignments',true)]);
      return {jobs,applications,assignments};
    },
    async save(job){
      teacher();validateCareer(job);
      await runTransaction(db,async tx=>{
        const target=ref('jobs',job.id),old=await tx.get(target);
        if(old.exists()&&old.data().core&&!job.core)throw Error('핵심 직업 표시를 해제할 수 없습니다.');
        if(old.exists()&&old.data().status==='closed')throw Error('운영 종료 기록은 변경할 수 없습니다. 새 직업으로 등록해 주세요.');
        const {id,...data}=job;
        tx.set(target,{...data,schoolId:context.schoolId,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async seed(){teacher();for(const job of starterJobs(context.schoolId))await runTransaction(db,async tx=>{const target=ref('jobs',job.id),old=await tx.get(target);if(!old.exists()){const {id,...data}=job;tx.set(target,{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})}})},
    async apply(jobId,reason){
      const studentId=assertApplicant(context);reason=reason.trim();if(!reason||reason.length>500)throw Error('신청 이유를 1~500자로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const id=pairId(jobId,studentId),target=ref('jobApplications',id);
        const [job,old,assignment]=await Promise.all([tx.get(ref('jobs',jobId)),tx.get(target),tx.get(ref('jobAssignments',id))]);
        if(!job.exists()||job.data().status!=='recruiting')throw Error('지금은 모집 중인 직업이 아닙니다.');
        if(old.exists())throw Error('이미 신청한 직업입니다. 신청 내역을 확인해 주세요.');
        if(assignment.exists()&&assignment.data().status==='active')throw Error('이미 맡고 있는 직업입니다.');
        tx.set(target,{schoolId:context.schoolId,jobId,studentId,reason,status:'submitted',reviewNote:'',reviewerUid:null,reviewedAt:null,submittedAt:serverTimestamp(),schemaVersion:1});
      });
    },
    async review(application,approve,note){
      teacher();if(note.length>500||(!approve&&!note.trim()))throw Error('반려 이유를 1~500자로 적어 주세요.');
      if(approve)return assign(application.jobId,application.studentId,application,note);
      await runTransaction(db,async tx=>{const target=ref('jobApplications',application.id),old=await tx.get(target);if(!old.exists()||old.data().status!=='submitted')throw Error('이미 처리된 신청입니다.');tx.update(target,{status:'rejected',reviewNote:note,reviewerUid:context.uid,reviewedAt:serverTimestamp()})});
    },
    assign,
    async end(assignment){teacher();await runTransaction(db,async tx=>{const target=ref('jobAssignments',assignment.id),old=await tx.get(target);if(!old.exists()||old.data().status!=='active')throw Error('이미 종료된 배정입니다.');tx.update(target,{status:'ended',endAt:serverTimestamp(),updatedAt:serverTimestamp()})})},
  };
}

// The isolated demo never calls Firebase and disappears when the page reloads.
export function demoCareers(schoolId:string,studentId:string):CareerStore{
  let data:CareerData={jobs:starterJobs(schoolId),applications:[],assignments:[]};
  const getJob=(id:string)=>{const j=data.jobs.find(j=>j.id===id);if(!j)throw Error('직업을 찾을 수 없습니다.');return j};
  const assign=async(jobId:string,sid:string)=>{if(!canAssign(getJob(jobId)))throw Error('현재 배정할 수 없는 직업입니다.');const id=pairId(jobId,sid);data.assignments=[...data.assignments.filter(a=>a.id!==id),{id,schoolId,jobId,studentId:sid,status:'active'}]};
  return {
    async load(){return structuredClone(data)},
    async seed(){for(const job of starterJobs(schoolId))if(!data.jobs.some(j=>j.id===job.id))data.jobs.push(job)},
    async save(job){validateCareer(job);const old=data.jobs.find(j=>j.id===job.id);if(old?.status==='closed'||old?.core&&!job.core)throw Error('보존해야 하는 직업 기록입니다.');data.jobs=[...data.jobs.filter(j=>j.id!==job.id),job]},
    async apply(jobId,reason){const id=pairId(jobId,studentId);if(getJob(jobId).status!=='recruiting'||data.applications.some(a=>a.id===id)||data.assignments.some(a=>a.id===id&&a.status==='active'))throw Error('이미 신청했거나 지금 신청할 수 없는 직업입니다.');if(!reason.trim()||reason.length>500)throw Error('신청 이유를 적어 주세요.');data.applications.push({id,schoolId,jobId,studentId,reason,status:'submitted',reviewNote:'',reviewerUid:null})},
    async review(application,approve,note){const a=data.applications.find(a=>a.id===application.id);if(!a||a.status!=='submitted')throw Error('이미 처리된 신청입니다.');if(!approve&&!note.trim())throw Error('반려 이유를 적어 주세요.');if(approve)await assign(a.jobId,a.studentId);a.status=approve?'approved':'rejected';a.reviewNote=note;a.reviewerUid='demo-teacher'},
    assign,
    async end(assignment){const a=data.assignments.find(a=>a.id===assignment.id);if(a)a.status='ended'},
  };
}
