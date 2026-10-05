import {collection,deleteField,doc,getDocFromServer,getDocsFromServer,limit,query,runTransaction,serverTimestamp,setDoc,where,type Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';

// 남학생/여학생 다시 고르기(D-127). 남/여는 한 번 정하면 학생이 바꿀 수 없으므로(D-126)
// 학생은 이유를 적어 요청하고, 교사가 허용하면(또는 교사가 직접) 그 학생 캐릭터의 남/여 선택만 지운다.
// 지우면 다음 로그인 때 처음 캐릭터 만들기가 다시 나온다. 산 아이템·잔액은 그대로다.
export type ResetStatus='pending'|'approved'|'rejected';
export interface AvatarResetRequest {studentId:string;reason:string;status:ResetStatus;note:string}
export interface AvatarResetStore {
  myRequest():Promise<AvatarResetRequest|null>;
  request(reason:string):Promise<void>;
  pending():Promise<AvatarResetRequest[]>;
  approve(studentId:string):Promise<void>;
  reject(studentId:string,note:string):Promise<void>;
  resetNow(studentId:string):Promise<void>;
}
export function firestoreAvatarResets(db:Firestore,context:SchoolContext):AvatarResetStore{
  const reqRef=(studentId:string)=>doc(collection(db,schoolPath(context,'avatarResetRequests')),studentId);
  const avatarRef=(studentId:string)=>doc(collection(db,schoolPath(context,'avatars')),studentId);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  // 교사 쪽 되돌리기: 아바타의 storybook만 지우고, 요청이 있으면 결과를 함께 기록한다(한 트랜잭션).
  async function clear(studentId:string,decide:'approved'|null){
    teacher();
    await runTransaction(db,async tx=>{
      const [avatar,req]=await Promise.all([tx.get(avatarRef(studentId)),tx.get(reqRef(studentId))]);
      if(decide&&(!req.exists()||req.data().status!=='pending'))throw new Error('처리할 요청이 없어요.');
      if(avatar.exists()&&avatar.data().storybook)tx.update(avatarRef(studentId),{storybook:deleteField(),updatedAt:serverTimestamp()});
      if(req.exists()&&req.data().status==='pending')tx.update(reqRef(studentId),{status:'approved',note:'',decidedBy:context.uid,updatedAt:serverTimestamp()});
    });
  }
  return {
    async myRequest(){
      const snap=await getDocFromServer(reqRef(assertApplicant(context)));
      return snap.exists()?({...snap.data(),studentId:snap.id} as AvatarResetRequest):null;
    },
    async request(reason){
      const studentId=assertApplicant(context),trimmed=reason.trim();
      if(!trimmed||trimmed.length>200)throw new Error('이유를 1~200자로 적어 주세요.');
      const old=await getDocFromServer(reqRef(studentId));
      if(old.exists()&&old.data().status==='pending')throw new Error('이미 요청했어요. 선생님의 답을 기다려 주세요.');
      await setDoc(reqRef(studentId),{schoolId:context.schoolId,studentId,reason:trimmed,status:'pending',note:'',decidedBy:null,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    },
    async pending(){
      teacher();
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'avatarResetRequests')),where('status','==','pending'),limit(100)));
      return snap.docs.map(d=>({...d.data(),studentId:d.id} as AvatarResetRequest));
    },
    approve:studentId=>clear(studentId,'approved'),
    async reject(studentId,note){
      teacher();const trimmed=note.trim();
      if(trimmed.length>200)throw new Error('의견은 200자 이하로 적어 주세요.');
      await runTransaction(db,async tx=>{
        const req=await tx.get(reqRef(studentId));
        if(!req.exists()||req.data().status!=='pending')throw new Error('처리할 요청이 없어요.');
        tx.update(reqRef(studentId),{status:'rejected',note:trimmed,decidedBy:context.uid,updatedAt:serverTimestamp()});
      });
    },
    resetNow:studentId=>clear(studentId,null),
  };
}
