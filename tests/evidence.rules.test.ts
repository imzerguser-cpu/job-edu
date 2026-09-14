import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,deleteDoc,getDoc,setDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreTasks} from '../src/data/taskRepository';
import {firestoreAudit} from '../src/data/auditRepository';
import {pairId,starterJobs} from '../src/domain/jobs';
import type {SchoolContext} from '../src/domain/model';
import type {TaskTemplate} from '../src/domain/tasks';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreTasks(db(c.uid),c)};
const template=(id:string,over:Partial<TaskTemplate>={}):TaskTemplate=>({id,schoolId:'a',jobId:'bank',title:'화분 물주기',instructions:'화분에 물을 주고 사진을 찍어요.',verificationKind:'photo',status:'active',schemaVersion:1,...over});
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const sid of ['a','b']){
    await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,status:'active'});
    await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});
    for(const id of ['one','two']){
      await setDoc(doc(db,`schools/${sid}/members/${sid}-${id}`),{schoolId:sid,role:'student',studentId:id,status:'active'});
      await setDoc(doc(db,`schools/${sid}/students/${id}`),{schoolId:sid,name:'가상시민',grade:1,status:'active'});
    }
    for(const {id,...j} of starterJobs(sid))await setDoc(doc(db,`schools/${sid}/jobs/${id}`),{...j,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/jobAssignments/${pairId('bank','one')}`),{schoolId:sid,jobId:'bank',studentId:'one',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:`teacher-${sid}`,updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
async function photoTask(){
  const teacher=store('teacher');
  await teacher.saveTemplate(template('tpl1'));
  await teacher.assign('tpl1','one');
  return pairId('tpl1','one');
}
const smallJpeg='x'.repeat(200);
describe('사진 제출',()=>{
  it('사진과 설명을 제출하면 증빙이 생기고 업무가 검토 대기로 바뀐다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'물을 줬어요');
    const task=(await store('teacher').load()).tasks[0];
    expect(task.status).toBe('submitted');
    const evidence=await store('teacher').getEvidence(taskId);
    expect(evidence).toMatchObject({mimeType:'image/jpeg',payloadBase64:smallJpeg});
  });
  it('결과물 제출(artifact) 업무에는 사진을 제출할 수 없다',async()=>{
    const teacher=store('teacher');
    await teacher.saveTemplate(template('tpl2',{verificationKind:'artifact'}));
    await teacher.assign('tpl2','one');
    const taskId=pairId('tpl2','one');
    await expect(store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명')).rejects.toThrow();
  });
  it('남의 업무에는 사진을 제출할 수 없다',async()=>{
    const taskId=await photoTask();
    await expect(store('student','a','two').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명')).rejects.toThrow();
  });
  it('승인하면 증빙이 삭제된다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    const task=(await store('teacher').load()).tasks[0];
    await store('teacher').review(task,true,'');
    await assertFails(getDoc(doc(db('teacher-a'),`schools/a/evidence/${taskId}`)));
    expect(await store('teacher').getEvidence(taskId)).toBeNull();
  });
  it('반려해도 증빙이 삭제된다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    const task=(await store('teacher').load()).tasks[0];
    await store('teacher').review(task,false,'다시 찍어 주세요');
    expect(await store('teacher').getEvidence(taskId)).toBeNull();
  });
  it('사진이 삭제된 뒤에도 몇 번째 시도가 어떻게 심사됐는지 감사 로그에 남는다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    let task=(await store('teacher').load()).tasks[0];
    await store('teacher').review(task,false,'다시 찍어 주세요');
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'다시 제출');
    task=(await store('teacher').load()).tasks[0];
    await store('teacher').review(task,true,'');
    const logs=await firestoreAudit(db('teacher-a'),context('teacher')).loadRecent();
    const photoLogs=logs.filter(l=>l.action==='photo_review');
    expect(photoLogs).toHaveLength(2);
    expect(photoLogs.some(l=>l.detail.includes('시도 1')&&l.detail.includes('다시 제출 요청'))).toBe(true);
    expect(photoLogs.some(l=>l.detail.includes('시도 2')&&l.detail.includes('승인'))).toBe(true);
  });
});
describe('사진 접근 권한',()=>{
  it('다른 학생은 남의 사진을 볼 수 없다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    await assertFails(getDoc(doc(db('a-two'),`schools/a/evidence/${taskId}`)));
  });
  it('본인과 교사는 사진을 볼 수 있다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    await assertSucceeds(getDoc(doc(db('a-one'),`schools/a/evidence/${taskId}`)));
    await assertSucceeds(getDoc(doc(db('teacher-a'),`schools/a/evidence/${taskId}`)));
  });
  it('만료된 사진은 조회할 수 없다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,`schools/a/evidence/${taskId}`),{schoolId:'a',studentId:'one',taskId,mimeType:'image/jpeg',payloadBase64:smallJpeg,expiresAt:Timestamp.fromMillis(Date.now()-1000),createdAt:serverTimestamp()})});
    await assertFails(getDoc(doc(db('a-one'),`schools/a/evidence/${taskId}`)));
    await assertFails(getDoc(doc(db('teacher-a'),`schools/a/evidence/${taskId}`)));
  });
  it('학생은 자기 사진을 직접 지울 수 있다',async()=>{
    const taskId=await photoTask();
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    await assertSucceeds(deleteDoc(doc(db('a-one'),`schools/a/evidence/${taskId}`)));
  });
  it('학생이 사진 데이터를 위조하거나 다른 학교에서 접근할 수 없다',async()=>{
    const taskId=await photoTask();
    await assertFails(setDoc(doc(db('a-one'),`schools/a/evidence/${taskId}`),{schoolId:'a',studentId:'one',taskId,mimeType:'image/png',payloadBase64:smallJpeg,expiresAt:Timestamp.fromMillis(Date.now()+3600000),createdAt:serverTimestamp()}));
    await store('student','a','one').submitPhoto(taskId,'image/jpeg',smallJpeg,'설명');
    await assertFails(getDoc(doc(db('teacher-b'),`schools/a/evidence/${taskId}`)));
  });
});
