import {collection,doc,getDocFromServer,getDocsFromServer,limit,query,runTransaction,serverTimestamp,setDoc,updateDoc,Timestamp,type Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {
  canClose,entityIdOf,validateBusinessFields,validateJobFields,validateProposalComment,validateSimpleFields,
  type BusinessProposalFields,type JobProposalFields,type Proposal,type ProposalComment,type ProposalType,type SimpleProposalFields,
} from '../domain/proposals';
export interface JobDecisionExtra {departmentId:string;icon:string;recommendedGrades:number[]}
export interface BusinessDecisionExtra {ownerStudentId:string}
type AnyFields=JobProposalFields|BusinessProposalFields|SimpleProposalFields;
const NO_ENTITY_TYPES:ProposalType[]=['rule','event','community'];
export interface ProposalStore {
  loadProposals():Promise<Proposal[]>;
  submit(type:ProposalType,fields:AnyFields):Promise<void>;
  saveDraft(type:ProposalType,fields:AnyFields):Promise<string>;
  updateDraft(proposalId:string,fields:AnyFields):Promise<void>;
  submitDraft(proposalId:string):Promise<void>;
  openVoting(proposal:Proposal,deadlineDays:number,minParticipation:number,approvalThreshold:number):Promise<void>;
  castVote(proposalId:string,choice:'yes'|'no'):Promise<void>;
  myVote(proposalId:string):Promise<'yes'|'no'|null>;
  tallyVotes(proposal:Proposal):Promise<void>;
  decide(proposal:Proposal,approve:boolean,note:string,extra?:JobDecisionExtra|BusinessDecisionExtra):Promise<void>;
  loadComments(proposalId:string):Promise<ProposalComment[]>;
  postComment(proposalId:string,text:string):Promise<void>;
}
function toProposal(id:string,raw:Record<string,unknown>):Proposal{
  const deadline=raw.deadlineAt as Timestamp|null;
  return {...raw,id,deadlineAt:deadline?deadline.toDate().toISOString():null} as Proposal;
}
function validateFieldsFor(type:ProposalType,fields:AnyFields){
  if(type==='job')validateJobFields(fields as JobProposalFields);
  else if(type==='business')validateBusinessFields(fields as BusinessProposalFields);
  else validateSimpleFields(fields as SimpleProposalFields);
}
export function firestoreProposals(db:Firestore,context:SchoolContext):ProposalStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async loadProposals(){
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'proposals')),limit(100)));
      return snap.docs.map(d=>toProposal(d.id,d.data()));
    },
    async submit(type,fields){
      const studentId=assertApplicant(context);
      validateFieldsFor(type,fields);
      await setDoc(ref('proposals',crypto.randomUUID()),{
        schoolId:context.schoolId,type,authorStudentId:studentId,fields,
        status:'submitted',deadlineAt:null,minParticipation:0,approvalThreshold:50,
        tallyYes:0,tallyNo:0,tallyTotal:0,decisionNote:'',reviewerUid:null,createdEntityId:null,
        schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
      });
    },
    // Drafts (§26 후속): save partial work without entering review — visible to the whole class
    // like any other proposal (no extra Rules complexity for hiding drafts, D-75), just not yet
    // eligible for voting until the author explicitly submits it.
    async saveDraft(type,fields){
      const studentId=assertApplicant(context);
      validateFieldsFor(type,fields);
      const id=crypto.randomUUID();
      await setDoc(ref('proposals',id),{
        schoolId:context.schoolId,type,authorStudentId:studentId,fields,
        status:'draft',deadlineAt:null,minParticipation:0,approvalThreshold:50,
        tallyYes:0,tallyNo:0,tallyTotal:0,decisionNote:'',reviewerUid:null,createdEntityId:null,
        schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
      });
      return id;
    },
    async updateDraft(proposalId,fields){
      const studentId=assertApplicant(context);
      const snap=await getDocFromServer(ref('proposals',proposalId));
      if(!snap.exists()||snap.data().status!=='draft'||snap.data().authorStudentId!==studentId)throw new Error('수정할 수 있는 초안이 아닙니다.');
      validateFieldsFor(snap.data().type as ProposalType,fields);
      await updateDoc(ref('proposals',proposalId),{fields,updatedAt:serverTimestamp()});
    },
    async submitDraft(proposalId){
      const studentId=assertApplicant(context);
      await runTransaction(db,async tx=>{
        const target=ref('proposals',proposalId),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='draft'||old.data().authorStudentId!==studentId)throw new Error('제출할 수 있는 초안이 아닙니다.');
        tx.update(target,{status:'submitted',updatedAt:serverTimestamp()});
      });
    },
    async openVoting(proposal,deadlineDays,minParticipation,approvalThreshold){
      teacher();
      if(!Number.isInteger(deadlineDays)||deadlineDays<1||deadlineDays>60)throw new Error('마감 기한을 1~60일로 설정해 주세요.');
      if(!Number.isInteger(minParticipation)||minParticipation<0||minParticipation>100)throw new Error('최소 참여율을 확인해 주세요.');
      if(!Number.isInteger(approvalThreshold)||approvalThreshold<0||approvalThreshold>100)throw new Error('찬성 기준을 확인해 주세요.');
      const deadlineAt=Timestamp.fromDate(new Date(Date.now()+deadlineDays*86400000));
      await runTransaction(db,async tx=>{
        const target=ref('proposals',proposal.id),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='submitted')throw new Error('검토 대기 중인 제안만 투표를 시작할 수 있습니다.');
        tx.update(target,{status:'voting',deadlineAt,minParticipation,approvalThreshold,updatedAt:serverTimestamp()});
      });
    },
    async castVote(proposalId,choice){
      assertApplicant(context);
      const voteRef=doc(collection(ref('proposals',proposalId),'votes'),context.uid);
      if((await getDocFromServer(voteRef)).exists())throw new Error('이미 투표했습니다.');
      await setDoc(voteRef,{choice,createdAt:serverTimestamp()});
    },
    async myVote(proposalId){
      assertApplicant(context);
      const snap=await getDocFromServer(doc(collection(ref('proposals',proposalId),'votes'),context.uid));
      return snap.exists()?(snap.data().choice as 'yes'|'no'):null;
    },
    async tallyVotes(proposal){
      teacher();
      if(!canClose(proposal))throw new Error('아직 투표를 마감할 수 없습니다.');
      const votesSnap=await getDocsFromServer(query(collection(ref('proposals',proposal.id),'votes'),limit(500)));
      let yes=0,no=0;
      votesSnap.docs.forEach(d=>{if(d.data().choice==='yes')yes++;else no++});
      await runTransaction(db,async tx=>{
        const target=ref('proposals',proposal.id),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='voting')throw new Error('투표 중인 제안만 집계할 수 있습니다.');
        tx.update(target,{status:'closed',tallyYes:yes,tallyNo:no,tallyTotal:yes+no,updatedAt:serverTimestamp()});
      });
    },
    async decide(proposal,approve,note,extra){
      teacher();
      note=note.trim();
      if(!approve&&!note)throw new Error('반려 이유를 적어 주세요.');
      if(note.length>500)throw new Error('의견은 500자 이하로 적어 주세요.');
      const entityId=approve&&!NO_ENTITY_TYPES.includes(proposal.type)?entityIdOf(proposal.id):null;
      await runTransaction(db,async tx=>{
        const target=ref('proposals',proposal.id),old=await tx.get(target);
        if(!old.exists()||old.data().status!=='closed')throw new Error('집계가 끝난 제안만 결정할 수 있습니다.');
        let ownerCheck;
        if(approve&&proposal.type==='business')ownerCheck=await tx.get(ref('students',(extra as BusinessDecisionExtra).ownerStudentId));
        if(approve&&proposal.type==='job'){
          const job=extra as JobDecisionExtra;
          const fields=old.data().fields as JobProposalFields;
          tx.set(ref('jobs',entityId!),{
            schoolId:context.schoolId,departmentId:job.departmentId,name:fields.title,description:fields.purpose,
            core:false,status:'recruiting',recommendedGrades:job.recommendedGrades,icon:job.icon,salaryMinor:fields.suggestedSalaryMinor,
            schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
          });
        }
        if(approve&&proposal.type==='business'){
          const biz=extra as BusinessDecisionExtra;
          if(!ownerCheck?.exists()||ownerCheck.data().status!=='active')throw new Error('활동 중인 학생을 사업 담당으로 선택해 주세요.');
          const fields=old.data().fields as BusinessProposalFields;
          tx.set(ref('businesses',entityId!),{schoolId:context.schoolId,name:fields.name,ownerStudentId:biz.ownerStudentId,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
          tx.set(ref('accounts',entityId!),{schoolId:context.schoolId,ownerType:'business',ownerId:entityId,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        }
        // rule/event/community: nothing to create — the whole class already sees the approved
        // decision on the proposal itself (§26's "제안" is the record, there's no separate entity).
        tx.update(target,{status:approve?'approved':'rejected',decisionNote:note,reviewerUid:context.uid,createdEntityId:entityId,updatedAt:serverTimestamp()});
        tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'proposal_decide',targetType:'proposal',targetId:proposal.id,detail:`${approve?'approved':'rejected'}: ${note}`.slice(0,500),createdAt:serverTimestamp()});
      });
    },
    async loadComments(proposalId){
      const snap=await getDocsFromServer(query(collection(ref('proposals',proposalId),'comments'),limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as ProposalComment));
    },
    async postComment(proposalId,text){
      validateProposalComment(text);
      await setDoc(doc(collection(ref('proposals',proposalId),'comments'),crypto.randomUUID()),{
        schoolId:context.schoolId,authorUid:context.uid,authorStudentId:context.membership.studentId,text:text.trim(),createdAt:serverTimestamp(),
      });
    },
  };
}
