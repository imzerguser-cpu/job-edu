import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,query,limit,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreCareers} from '../src/data/careerRepository';
import {starterJobs,pairId} from '../src/domain/jobs';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreCareers(db(c.uid),c)};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const sid of ['a','b']){await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,status:'active'});await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});for(const id of ['one','two']){await setDoc(doc(db,`schools/${sid}/members/${sid}-${id}`),{schoolId:sid,role:'student',studentId:id,status:'active'});await setDoc(doc(db,`schools/${sid}/students/${id}`),{schoolId:sid,name:'가상시민',grade:1,status:'active'})}for(const {id,...j} of starterJobs(sid))await setDoc(doc(db,`schools/${sid}/jobs/${id}`),{...j,createdAt:Timestamp.now(),updatedAt:Timestamp.now()})}})});
afterAll(async()=>{await env.cleanup()});
describe('직업 권한과 원자적 배정',()=>{
  it('학생 신청→교사 승인→복수 직업 배정, 중복 배정은 하나',async()=>{const student=store('student'),teacher=store('teacher');await student.apply('bank','은행 일을 배우고 싶어요');await teacher.review((await teacher.load()).applications[0],true,'환영해요');await teacher.assign('garden','one');await teacher.assign('garden','one');const data=await student.load();expect(data.assignments).toHaveLength(2);expect(data.applications[0].status).toBe('approved')});
  it('동시 신청은 한 건만 생성',async()=>{const s=store('student');const result=await Promise.allSettled([s.apply('bank','첫 신청'),s.apply('bank','중복 클릭')]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await s.load()).applications).toHaveLength(1)});
  it('저학년도 권장 고학년 직업 신청 가능',async()=>{await assertSucceeds(store('student').apply('bank','도전하고 싶어요'))});
  it('다른 학생과 다른 학교의 신청·배정 조회 거부',async()=>{await store('student').apply('bank','이유');await assertFails(getDoc(doc(db('a-two'),'schools/a/jobApplications/bank~one')));await assertFails(getDoc(doc(db('teacher-b'),'schools/a/jobApplications/bank~one')));await assertFails(getDoc(doc(db('b-one'),'schools/a/jobs/bank')));await assertFails(getDocs(query(collection(db('a-one'),'schools/a/jobApplications'),limit(100))))});
  it('학생이 직업·배정·승인을 위조할 수 없음',async()=>{await store('student').apply('bank','이유');await assertFails(updateDoc(doc(db('a-one'),'schools/a/jobs/bank'),{status:'active',updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(db('a-one'),'schools/a/jobAssignments/bank~one'),{status:'active'}));await assertFails(updateDoc(doc(db('a-one'),'schools/a/jobApplications/bank~one'),{status:'approved'}))});
  it('신청 승인만 따로 쓰기는 거부',async()=>{await store('student').apply('bank','이유');await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/jobApplications/bank~one'),{status:'approved',reviewNote:'승인',reviewerUid:'teacher-a',reviewedAt:serverTimestamp()}))});
  it('교사도 핵심 해제·삭제·종료 후 수정 불가',async()=>{const t=store('teacher');const bank=(await t.load()).jobs.find(j=>j.id==='bank')!;await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/jobs/bank'),{core:false,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db('teacher-a'),'schools/a/jobs/bank')));await t.save({...bank,status:'closed'});await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/jobs/bank'),{status:'recruiting',updatedAt:serverTimestamp()}));await expect(t.assign('bank','one')).rejects.toThrow();await expect(store('student').apply('bank','신청')).rejects.toThrow();await assertFails(setDoc(doc(db('teacher-a'),'schools/a/jobAssignments/bank~one'),{schoolId:'a',jobId:'bank',studentId:'one',status:'active',schemaVersion:1,startAt:serverTimestamp(),endAt:null,assignedBy:'teacher-a',updatedAt:serverTimestamp()}))});
  it('배정 종료 후 현재 역할에서 빠지고 기록 보존',async()=>{const t=store('teacher');await t.assign('garden','one');const a=(await t.load()).assignments[0];await t.end(a);expect((await t.load()).assignments[0].status).toBe('ended');await assertFails(deleteDoc(doc(db('teacher-a'),`schools/a/jobAssignments/${pairId('garden','one')}`)))});
  it('학교 필드 위조 및 과도한 목록 차단',async()=>{const {id,...j}=starterJobs('b')[0];await assertFails(setDoc(doc(db('teacher-a'),'schools/a/jobs/fake'),{...j,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));await assertFails(getDocs(collection(db('a-one'),'schools/a/jobs')))});
});
describe('직업 정원, 배정/신청 이력 (D-88, D-86)',()=>{
  it('정원이 차면 배정이 거부되고, 종료하면 다시 배정할 수 있다',async()=>{
    const t=store('teacher');
    const garden=(await t.load()).jobs.find(j=>j.id==='garden')!;
    await t.save({...garden,capacity:1});
    await t.assign('garden','one');
    await expect(t.assign('garden','two')).rejects.toThrow();
    expect((await t.load()).jobs.find(j=>j.id==='garden')!.activeAssignmentCount).toBe(1);
    const a=(await t.load()).assignments.find(a=>a.jobId==='garden'&&a.studentId==='one')!;
    await t.end(a);
    expect((await t.load()).jobs.find(j=>j.id==='garden')!.activeAssignmentCount).toBe(0);
    await assertSucceeds(t.assign('garden','two'));
  });
  it('정원 없는 직업 편집이 배정 인원수를 되돌리지 않는다(동시 배정과 편집)',async()=>{
    const t=store('teacher');
    await t.assign('garden','one');
    const garden=(await t.load()).jobs.find(j=>j.id==='garden')!;
    expect(garden.activeAssignmentCount).toBe(1);
    await t.save({...garden,description:'설명 수정'});
    expect((await t.load()).jobs.find(j=>j.id==='garden')!.activeAssignmentCount).toBe(1);
  });
  it('배정 종료 시 이력이 남고, 학생 본인과 교사만 볼 수 있다',async()=>{
    const t=store('teacher');
    await t.assign('garden','one');
    const a=(await t.load()).assignments.find(a=>a.jobId==='garden'&&a.studentId==='one')!;
    await t.end(a);
    const history=await t.assignmentHistory(a.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({jobId:'garden',studentId:'one'});
    expect(new Date(history[0].endAt).getTime()).toBeGreaterThanOrEqual(new Date(history[0].startAt).getTime());
    await assertSucceeds(getDocs(query(collection(db('a-one'),`schools/a/jobAssignments/${a.id}/history`),limit(100))));
    await assertFails(getDocs(query(collection(db('a-two'),`schools/a/jobAssignments/${a.id}/history`),limit(100))));
  });
  it('반려된 신청은 다시 신청할 수 있고, 이전 신청은 이력으로 남는다',async()=>{
    const s=store('student'),t=store('teacher');
    await s.apply('bank','첫 신청');
    await t.review((await t.load()).applications[0],false,'다시 생각해 보세요');
    await expect(s.apply('bank','다시 도전')).resolves.not.toThrow();
    const data=await s.load();
    expect(data.applications.find(a=>a.jobId==='bank')).toMatchObject({status:'submitted',reason:'다시 도전'});
    const history=await s.applicationHistory('bank~one');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({reason:'첫 신청',status:'rejected',reviewNote:'다시 생각해 보세요'});
  });
  it('검토 대기 중이거나 이미 배정받은 직업은 다시 신청할 수 없다',async()=>{
    await store('student').apply('bank','첫 신청');
    await expect(store('student').apply('bank','또 신청')).rejects.toThrow();
    const t=store('teacher');
    await t.review((await t.load()).applications[0],true,'환영');
    await expect(store('student').apply('bank','승인된 직업 재신청')).rejects.toThrow();
  });
  it('정원·카운터 필드가 없는 기존 직업도 활성 배정을 종료할 수 있다(D-92, 마이그레이션 없이)',async()=>{
    // Simulates a job created before capacity/activeAssignmentCount existed, with an active
    // assignment that also predates the feature — both lack the new fields entirely.
    await env.withSecurityRulesDisabled(async c=>{
      const raw=c.firestore();
      await setDoc(doc(raw,'schools/a/jobs/legacy'),{schoolId:'a',departmentId:'life',name:'옛날 직업',description:'설명',core:false,status:'recruiting',recommendedGrades:[1,2,3],icon:'plant_manager',salaryMinor:0,schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
      await setDoc(doc(raw,'schools/a/jobAssignments/legacy~one'),{schoolId:'a',jobId:'legacy',studentId:'one',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:'teacher-a',updatedAt:Timestamp.now()});
    });
    const t=store('teacher');
    const a=(await t.load()).assignments.find(a=>a.jobId==='legacy'&&a.studentId==='one')!;
    await assertSucceeds(t.end(a));
    expect((await t.load()).assignments.find(x=>x.id===a.id)!.status).toBe('ended');
  });
  it('이미 활성 배정을 가진 직업에는 반려된 신청을 재신청할 수 없다',async()=>{
    const s=store('student'),t=store('teacher');
    await s.apply('bank','첫 신청');
    await t.review((await t.load()).applications[0],false,'다시 생각해 보세요');
    await t.assign('bank','one'); // teacher assigns directly, bypassing the application flow
    await expect(s.apply('bank','재신청 시도')).rejects.toThrow();
    await assertFails(updateDoc(doc(db('a-one'),'schools/a/jobApplications/bank~one'),{schoolId:'a',jobId:'bank',studentId:'one',reason:'재신청 시도',status:'submitted',reviewNote:'',reviewerUid:null,reviewedAt:null,submittedAt:serverTimestamp(),schemaVersion:1}));
  });
  it('교사가 아니면 배정 이력을 직접 써넣을 수 없다',async()=>{
    const t=store('teacher');
    await t.assign('garden','one');
    const a=(await t.load()).assignments.find(a=>a.jobId==='garden'&&a.studentId==='one')!;
    await assertFails(setDoc(doc(collection(db('a-one'),`schools/a/jobAssignments/${a.id}/history`)),{schoolId:'a',jobId:'garden',studentId:'one',startAt:serverTimestamp(),endAt:serverTimestamp(),schemaVersion:1}));
  });
});
