import {collection,deleteDoc,doc,documentId,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,setDoc,startAfter,updateDoc,where,type DocumentData,type DocumentSnapshot,type QuerySnapshot,type Firestore,type QueryConstraint} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {ISSUER_ACCOUNT_ID} from '../domain/finance';
import {helpEscrowJournalId,helpRefundJournalId,helpRewardJournalId,praiseId,validateGoal,validateHelpRequest,validatePraise,type ClassGoal,type GoalMetric,type HelpRequest,type Praise,type PraiseCategory} from '../domain/community';

export interface CommunityStore {
  listHelp():Promise<HelpRequest[]>;
  postHelp(title:string,description:string,rewardMinor:number):Promise<void>;
  acceptHelp(id:string):Promise<void>;
  giveUpHelp(id:string):Promise<void>;
  markHelpDone(id:string,note:string):Promise<void>;
  confirmHelp(id:string):Promise<void>;
  sendBackHelp(id:string):Promise<void>;
  claimHelpReward(id:string):Promise<void>;
  cancelHelp(id:string):Promise<void>;
  listPraises():Promise<Praise[]>;
  praisesReceived(studentId:string):Promise<number>;
  sendPraise(toStudentId:string,category:PraiseCategory,message:string):Promise<void>;
  deletePraise(id:string):Promise<void>;
  listGoals():Promise<ClassGoal[]>;
  createGoal(input:{title:string;metric:GoalMetric;target:number;rewardText:string}):Promise<void>;
  setGoalStatus(goal:ClassGoal,status:ClassGoal['status']):Promise<void>;
  setManualProgress(goal:ClassGoal,progress:number):Promise<void>;
  refreshGoals():Promise<void>;
}

export function firestoreCommunity(db:Firestore,context:SchoolContext):CommunityStore{
  const col=(name:string)=>collection(db,schoolPath(context,name));
  const ref=(name:string,id:string)=>doc(col(name),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  const issuerRef=()=>ref('accounts',ISSUER_ACCOUNT_ID);
  // 발행 계좌 ↔ 학생 계좌 사이 한 번의 이동(저널 + 양쪽 잔액 + 양쪽 거래 내역). 모든 읽기는 호출 전에 끝나 있어야 한다.
  type Tx=Parameters<Parameters<typeof runTransaction>[1]>[0];
  type Snap=DocumentSnapshot<DocumentData>;
  function move(tx:Tx,{journalId,type,studentId,requestId,amount,toStudent,student,issuer,label,postedBy}:{journalId:string;type:'HELP_ESCROW'|'HELP_REFUND'|'HELP_REWARD';studentId:string;requestId:string;amount:number;toStudent:boolean;student:Snap;issuer:Snap;label:string;postedBy:string}){
    if(!issuer.exists())throw new Error('발행 계좌가 아직 준비되지 않았어요. 선생님께 알려 주세요.');
    const studentRef=ref('accounts',studentId);
    tx.set(ref('journals',journalId),{schoolId:context.schoolId,type,studentId,contractId:requestId,debitAccountId:toStudent?ISSUER_ACCOUNT_ID:studentId,creditAccountId:toStudent?studentId:ISSUER_ACCOUNT_ID,amountMinor:amount,postedBy,schemaVersion:1,createdAt:serverTimestamp()});
    const studentAfter=(student.exists()?student.data()!.balanceMinor:0)+(toStudent?amount:-amount);
    const issuerAfter=issuer.data()!.balanceMinor+(toStudent?-amount:amount);
    if(student.exists())tx.update(studentRef,{balanceMinor:studentAfter,version:student.data()!.version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
    else tx.set(studentRef,{schoolId:context.schoolId,ownerType:'student',ownerId:studentId,balanceMinor:studentAfter,version:0,lastJournalId:journalId,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    tx.set(doc(collection(studentRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type,deltaMinor:toStudent?amount:-amount,balanceAfterMinor:studentAfter,label,postedAt:serverTimestamp()});
    tx.update(issuerRef(),{balanceMinor:issuerAfter,version:issuer.data()!.version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
    tx.set(doc(collection(issuerRef(),'entries'),journalId),{schoolId:context.schoolId,journalId,type,deltaMinor:toStudent?-amount:amount,balanceAfterMinor:issuerAfter,label:`도움 게시판 · ${label}`.slice(0,60),postedAt:serverTimestamp()});
  }
  async function transition(id:string,check:(r:HelpRequest,me:string|null)=>void,patch:Record<string,unknown>){
    const me=isTeacher(context.membership)?null:assertApplicant(context);
    await runTransaction(db,async tx=>{
      const snap=await tx.get(ref('helpRequests',id));
      if(!snap.exists())throw new Error('부탁을 찾을 수 없어요.');
      check({...snap.data(),id} as HelpRequest,me);
      tx.update(ref('helpRequests',id),{...patch,updatedAt:serverTimestamp()});
    });
  }
  // 100건씩 끝까지 넘겨 가며 센다(교사 전용 — 학급 공동 목표 진행도 계산).
  async function pageAll(name:string,filters:QueryConstraint[],each:(d:DocumentData)=>void){
    let cursor:string|null=null;
    for(;;){
      const snap:QuerySnapshot<DocumentData>=await getDocsFromServer(query(col(name),...filters,orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(100)));
      snap.docs.forEach(d=>each(d.data()));
      if(snap.size<100)return;
      cursor=snap.docs[snap.docs.length-1].id;
    }
  }
  async function metricValue(metric:GoalMetric){
    let n=0;
    if(metric==='taskSubmissions')await pageAll('tasks',[],d=>{n+=Number(d.attempt)||0});
    else if(metric==='praises')await pageAll('praises',[],()=>{n++});
    else if(metric==='helpsCompleted')await pageAll('helpRequests',[where('status','==','paid')],()=>{n++});
    return n;
  }
  async function listGoals(){
    const snap=await getDocsFromServer(query(col('classGoals'),limit(100)));
    return snap.docs.map(d=>({...d.data(),id:d.id} as ClassGoal));
  }
  return {
    async listHelp(){
      const snap=await getDocsFromServer(query(col('helpRequests'),orderBy('createdAt','desc'),limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id,createdAt:d.data().createdAt?.toDate?.().toISOString()} as HelpRequest));
    },
    async postHelp(title,description,rewardMinor){
      const studentId=assertApplicant(context);
      validateHelpRequest(title,description,rewardMinor);
      const id=crypto.randomUUID();
      await runTransaction(db,async tx=>{
        if(rewardMinor>0){
          const [student,issuer]=await Promise.all([tx.get(ref('accounts',studentId)),tx.get(issuerRef())]);
          if(!student.exists()||student.data().balanceMinor<rewardMinor)throw new Error('보상으로 걸 돈이 부족해요.');
          move(tx,{journalId:helpEscrowJournalId(id),type:'HELP_ESCROW',studentId,requestId:id,amount:rewardMinor,toStudent:false,student,issuer,label:`부탁 보상 맡김 · ${title.trim()}`.slice(0,60),postedBy:studentId});
        }
        tx.set(ref('helpRequests',id),{schoolId:context.schoolId,requesterStudentId:studentId,title:title.trim(),description:description.trim(),rewardMinor,status:'open',helperStudentId:null,doneNote:'',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    acceptHelp:id=>transition(id,(r,me)=>{if(!me||r.status!=='open')throw new Error('지금은 맡을 수 없는 부탁이에요.');if(r.requesterStudentId===me)throw new Error('내 부탁은 내가 맡을 수 없어요.')},{status:'accepted',helperStudentId:assertApplicant(context)}),
    giveUpHelp:id=>transition(id,(r,me)=>{if(r.status!=='accepted'||r.helperStudentId!==me)throw new Error('내가 맡은 부탁만 그만둘 수 있어요.')},{status:'open',helperStudentId:null,doneNote:''}),
    async markHelpDone(id,note){
      const trimmed=note.trim();if(!trimmed||trimmed.length>500)throw new Error('어떻게 도왔는지 1~500자로 적어 주세요.');
      await transition(id,(r,me)=>{if(r.status!=='accepted'||r.helperStudentId!==me)throw new Error('내가 맡은 부탁만 완료할 수 있어요.')},{status:'done',doneNote:trimmed});
    },
    async confirmHelp(id){
      const snap=await getDocFromServer(ref('helpRequests',id));
      const reward=Number(snap.data()?.rewardMinor??0);
      await transition(id,(r,me)=>{if(r.status!=='done'||r.requesterStudentId!==me)throw new Error('내 부탁만 확인할 수 있어요.')},{status:reward>0?'confirmed':'paid'});
    },
    sendBackHelp:id=>transition(id,(r,me)=>{if(r.status!=='done'||r.requesterStudentId!==me)throw new Error('내 부탁만 다시 요청할 수 있어요.')},{status:'accepted'}),
    async claimHelpReward(id){
      const studentId=assertApplicant(context);
      await runTransaction(db,async tx=>{
        const reqRef=ref('helpRequests',id);
        const [req,student,issuer]=await Promise.all([tx.get(reqRef),tx.get(ref('accounts',studentId)),tx.get(issuerRef())]);
        if(!req.exists()||req.data().status!=='confirmed'||req.data().helperStudentId!==studentId)throw new Error('받을 수 있는 보상이 아니에요.');
        move(tx,{journalId:helpRewardJournalId(id),type:'HELP_REWARD',studentId,requestId:id,amount:req.data().rewardMinor,toStudent:true,student,issuer,label:`도움 보상 · ${req.data().title}`.slice(0,60),postedBy:context.uid});
        tx.update(reqRef,{status:'paid',updatedAt:serverTimestamp()});
      });
    },
    async cancelHelp(id){
      const me=isTeacher(context.membership)?null:assertApplicant(context);
      await runTransaction(db,async tx=>{
        const reqRef=ref('helpRequests',id),req=await tx.get(reqRef);
        if(!req.exists())throw new Error('부탁을 찾을 수 없어요.');
        const r=req.data();
        if(me?(r.requesterStudentId!==me||r.status!=='open'):!['open','accepted','done'].includes(r.status))throw new Error(me?'아직 아무도 맡지 않은 내 부탁만 취소할 수 있어요.':'이미 끝났거나 보상 확정된 부탁은 취소할 수 없어요.');
        if(r.rewardMinor>0){
          const [student,issuer]=await Promise.all([tx.get(ref('accounts',r.requesterStudentId)),tx.get(issuerRef())]);
          move(tx,{journalId:helpRefundJournalId(id),type:'HELP_REFUND',studentId:r.requesterStudentId,requestId:id,amount:r.rewardMinor,toStudent:true,student,issuer,label:`부탁 취소 환불 · ${r.title}`.slice(0,60),postedBy:context.uid});
        }
        tx.update(reqRef,{status:'cancelled',updatedAt:serverTimestamp()});
      });
    },
    async listPraises(){
      const snap=await getDocsFromServer(query(col('praises'),orderBy('createdAt','desc'),limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as Praise));
    },
    async praisesReceived(studentId){
      const snap=await getDocsFromServer(query(col('praises'),where('toStudentId','==',studentId),limit(100)));
      return snap.size;
    },
    async sendPraise(toStudentId,category,message){
      const from=assertApplicant(context);
      validatePraise(from,toStudentId,category,message);
      const id=praiseId(from,toStudentId);
      if((await getDocFromServer(ref('praises',id))).exists())throw new Error('오늘은 이 친구에게 이미 칭찬 스티커를 보냈어요. 내일 또 보내 주세요!');
      await setDoc(ref('praises',id),{schoolId:context.schoolId,fromStudentId:from,toStudentId,category,message:message.trim(),schemaVersion:1,createdAt:serverTimestamp()});
    },
    async deletePraise(id){teacher();await deleteDoc(ref('praises',id))},
    listGoals,
    async createGoal(input){
      teacher();validateGoal(input);
      const baseline=input.metric==='manual'?0:await metricValue(input.metric);
      await setDoc(ref('classGoals',crypto.randomUUID()),{schoolId:context.schoolId,title:input.title.trim(),metric:input.metric,target:input.target,baseline,progress:0,rewardText:input.rewardText.trim(),status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    },
    async setGoalStatus(goal,status){teacher();await updateDoc(ref('classGoals',goal.id),{status,updatedAt:serverTimestamp()})},
    async setManualProgress(goal,progress){
      teacher();if(!Number.isInteger(progress)||progress<0||progress>1_000_000)throw new Error('진행도를 확인해 주세요.');
      await updateDoc(ref('classGoals',goal.id),{progress,status:goal.status==='archived'?'archived':progress>=goal.target?'achieved':'active',updatedAt:serverTimestamp()});
    },
    async refreshGoals(){
      teacher();
      const goals=(await listGoals()).filter(g=>g.status!=='archived'&&g.metric!=='manual');
      const cache=new Map<GoalMetric,number>();
      for(const g of goals){
        if(!cache.has(g.metric))cache.set(g.metric,await metricValue(g.metric));
        const progress=Math.max(0,cache.get(g.metric)!-g.baseline);
        await updateDoc(ref('classGoals',g.id),{progress,status:progress>=g.target?'achieved':'active',updatedAt:serverTimestamp()});
      }
    },
  };
}
