import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreTasks} from '../src/data/taskRepository';
import {pairId,starterJobs} from '../src/domain/jobs';
import type {SchoolContext} from '../src/domain/model';
import type {Task,TaskTemplate} from '../src/domain/tasks';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreTasks(db(c.uid),c)};
const template=(id:string,over:Partial<TaskTemplate>={}):TaskTemplate=>({id,schoolId:'a',jobId:'bank',title:'거래 확인',instructions:'오늘 거래 내역을 확인해요.',verificationKind:'artifact',status:'active',schemaVersion:1,...over});
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firebase/firestore.rules','utf8')}})});
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
    // student "one" holds the bank job in every school; "two" holds nothing
    await setDoc(doc(db,`schools/${sid}/jobAssignments/${pairId('bank','one')}`),{schoolId:sid,jobId:'bank',studentId:'one',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:`teacher-${sid}`,updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
describe('업무 템플릿과 배정',()=>{
  it('교사가 템플릿을 만들고 자격 있는 학생에게 배정한다',async()=>{
    const teacher=store('teacher');
    await teacher.saveTemplate(template('tpl1'));
    await teacher.assign('tpl1','one');
    const data=await teacher.load();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].status).toBe('assigned');
  });
  it('직업을 맡지 않은 학생에게는 배정을 거부한다',async()=>{
    const teacher=store('teacher');
    await teacher.saveTemplate(template('tpl1'));
    await expect(teacher.assign('tpl1','two')).rejects.toThrow();
  });
  it('보관 상태 템플릿으로는 배정할 수 없다',async()=>{
    const teacher=store('teacher');
    await teacher.saveTemplate(template('tpl1',{status:'archived'}));
    await expect(teacher.assign('tpl1','one')).rejects.toThrow();
  });
  it('학생은 템플릿을 만들거나 배정할 수 없다',async()=>{
    await expect(store('student').saveTemplate(template('tpl1'))).rejects.toThrow();
    const {id:_omit,...data}=template('tpl1');
    await assertFails(setDoc(doc(db('a-one'),'schools/a/taskTemplates/tpl1'),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});
describe('제출과 검토',()=>{
  async function assigned(){
    const teacher=store('teacher');
    await teacher.saveTemplate(template('tpl1'));
    await teacher.assign('tpl1','one');
    return pairId('tpl1','one');
  }
  it('학생 제출→교사 승인 흐름',async()=>{
    const taskId=await assigned();
    await store('student').submit(taskId,'오늘 확인한 내용입니다.');
    let data=await store('teacher').load();
    expect(data.tasks[0].status).toBe('submitted');
    await store('teacher').review(data.tasks[0],true,'잘했어요');
    data=await store('teacher').load();
    expect(data.tasks[0].status).toBe('approved');
  });
  it('다시 제출 요청 후 재제출·승인',async()=>{
    const taskId=await assigned();
    await store('student').submit(taskId,'초안');
    let data=await store('teacher').load();
    await store('teacher').review(data.tasks[0],false,'조금 더 자세히 적어 주세요');
    data=await store('student').load();
    expect(data.tasks[0].status).toBe('revision_requested');
    await store('student').submit(taskId,'다시 적었습니다.');
    data=await store('teacher').load();
    expect(data.tasks[0].status).toBe('submitted');
    expect(data.tasks[0].attempt).toBe(2);
  });
  it('완료된 업무는 교사가 다시 시작할 수 있다',async()=>{
    const taskId=await assigned();
    await store('student').submit(taskId,'제출');
    let data=await store('teacher').load();
    await store('teacher').review(data.tasks[0],true,'');
    data=await store('teacher').load();
    await store('teacher').restart(data.tasks[0]);
    data=await store('teacher').load();
    expect(data.tasks[0].status).toBe('assigned');
    expect(data.tasks[0].submissionText).toBe('');
  });
  it('본인 업무가 아니면 제출할 수 없다',async()=>{
    const taskId=await assigned();
    await expect(store('student','a','two').submit(taskId,'남의 업무')).rejects.toThrow();
  });
  it('제출하지 않은 업무를 승인할 수 없다',async()=>{
    const taskId=await assigned();
    await expect(store('teacher').review({id:taskId} as unknown as Task,true,'')).rejects.toThrow();
  });
  it('이유 없는 다시 제출 요청은 거부한다',async()=>{
    const taskId=await assigned();
    await store('student').submit(taskId,'제출');
    const data=await store('teacher').load();
    await expect(store('teacher').review(data.tasks[0],false,'')).rejects.toThrow();
  });
  it('학생이 상태나 점검 필드를 위조할 수 없다',async()=>{
    const taskId=await assigned();
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/tasks/${taskId}`),{status:'approved',updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/tasks/${taskId}`),{status:'submitted',attempt:99,submissionText:'해킹',reviewNote:'',reviewerUid:null,updatedAt:serverTimestamp()}));
  });
  it('교사도 업무 문서를 삭제할 수 없고 다른 학교 업무를 볼 수 없다',async()=>{
    const taskId=await assigned();
    await assertFails(deleteDoc(doc(db('teacher-a'),`schools/a/tasks/${taskId}`)));
    await expect(store('teacher','b').load().then(d=>d.tasks)).resolves.toHaveLength(0);
  });
});
