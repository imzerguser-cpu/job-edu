import {collection,doc,getDocFromServer,getDocsFromServer,limit,query,serverTimestamp,setDoc,where,type Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {checkinId,kstDateKey} from '../domain/checkin';

export interface CheckinStore {
  myDates():Promise<string[]>;
  checkIn():Promise<void>;
  datesFor(studentId:string):Promise<string[]>; // 교사용(성장 보고서)
}
// 출근 도장(D-122). 문서 id = 학생id~한국날짜 → 하루 한 번만(Rules가 같은 id를 다시 계산해 검사).
export function firestoreCheckins(db:Firestore,context:SchoolContext):CheckinStore{
  const col=()=>collection(db,schoolPath(context,'checkins'));
  async function list(studentId:string){
    const snap=await getDocsFromServer(query(col(),where('studentId','==',studentId),limit(400)));
    return snap.docs.map(d=>String(d.data().date));
  }
  return {
    myDates:()=>list(assertApplicant(context)),
    async checkIn(){
      const studentId=assertApplicant(context),date=kstDateKey();
      const ref=doc(col(),checkinId(studentId,date));
      if((await getDocFromServer(ref)).exists())throw new Error('오늘은 이미 출근 도장을 찍었어요!');
      await setDoc(ref,{schoolId:context.schoolId,studentId,date,createdAt:serverTimestamp()});
    },
    async datesFor(studentId){
      if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
      return list(studentId);
    },
  };
}
