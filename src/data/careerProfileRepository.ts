import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,type Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {validateDiscovery,type Discovery} from '../domain/careerDiscovery';

export interface CareerProfile extends Discovery {studentId:string;completions:number;updatedAt:string|null}
export interface CareerHistoryEntry extends Discovery {id:string;takenAt:string|null}
export interface CareerProfileStore {
  myProfile():Promise<CareerProfile|null>;
  myHistory():Promise<CareerHistoryEntry[]>;
  save(d:Discovery):Promise<void>;
  classProfiles():Promise<CareerProfile[]>;
}

const iso=(v:unknown)=>(v as {toDate?:()=>Date})?.toDate?.().toISOString()??null;

// 학생 한 명당 최신 결과 1개(careerProfiles/{studentId}) + 할 때마다 쌓이는 이력(history/{회차}).
// 수퍼의 진로발달 관점에서 "지난번의 나와 비교"가 중요해 이력을 지우지 않는다.
// 결과는 본인과 교사만 볼 수 있다(자기이해 자료는 친구들에게 공개하지 않는다).
export function firestoreCareerProfiles(db:Firestore,context:SchoolContext):CareerProfileStore{
  const profileRef=(studentId:string)=>doc(collection(db,schoolPath(context,'careerProfiles')),studentId);
  return {
    async myProfile(){
      const studentId=assertApplicant(context);
      const snap=await getDocFromServer(profileRef(studentId));
      return snap.exists()?({...snap.data(),studentId,updatedAt:iso(snap.data().updatedAt)} as CareerProfile):null;
    },
    async myHistory(){
      const studentId=assertApplicant(context);
      const snap=await getDocsFromServer(query(collection(profileRef(studentId),'history'),orderBy('takenAt','desc'),limit(20)));
      return snap.docs.map(d=>({...d.data(),id:d.id,takenAt:iso(d.data().takenAt)} as CareerHistoryEntry));
    },
    async save(d){
      const studentId=assertApplicant(context);
      validateDiscovery(d);
      const data={band:d.band,interest:d.interest,strengths:d.strengths,values:d.values,code:d.code,reflection:d.reflection.trim()};
      await runTransaction(db,async tx=>{
        const target=profileRef(studentId),old=await tx.get(target);
        const completions=old.exists()?Number(old.data().completions)+1:1;
        tx.set(target,{schoolId:context.schoolId,studentId,...data,completions,schemaVersion:1,createdAt:old.exists()?old.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        tx.set(doc(collection(target,'history'),String(completions)),{schoolId:context.schoolId,...data,takenAt:serverTimestamp()});
      });
    },
    async classProfiles(){
      if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'careerProfiles')),limit(100)));
      return snap.docs.map(d=>({...d.data(),studentId:d.id,updatedAt:iso(d.data().updatedAt)} as CareerProfile));
    },
  };
}
