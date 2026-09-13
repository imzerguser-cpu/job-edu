import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,deleteDoc,getDoc,setDoc,updateDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreBusiness} from '../src/data/businessRepository';
import {firestoreAudit} from '../src/data/auditRepository';
import {updateStudent} from '../src/data/schoolRepository';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const sid of ['a','b']){
    await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,status:'active'});
    await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});
    await setDoc(doc(db,`schools/${sid}/members/${sid}-one`),{schoolId:sid,role:'student',studentId:'one',status:'active'});
    await setDoc(doc(db,`schools/${sid}/students/one`),{schoolId:sid,name:'가상시민',grade:3,className:'1반',citizenCode:'C-1',schoolYear:2026,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
describe('감사 로그',()=>{
  it('사업을 만들면 감사 로그가 남는다',async()=>{
    const c=context('teacher');
    await firestoreBusiness(db('teacher-a'),c).createBusiness('마동카페','one');
    const logs=await firestoreAudit(db('teacher-a'),c).loadRecent();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({action:'business_create',targetType:'business',detail:'마동카페'});
  });
  it('학생은 감사 로그를 읽거나 쓸 수 없다',async()=>{
    const c=context('teacher');
    await firestoreBusiness(db('teacher-a'),c).createBusiness('마동카페','one');
    await expect(firestoreAudit(db('a-one'),context('student')).loadRecent()).rejects.toThrow();
    await assertFails(setDoc(doc(db('a-one'),'schools/a/auditLogs/fake'),{schoolId:'a',actorUid:'a-one',action:'x',targetType:'x',targetId:'x',detail:'',createdAt:serverTimestamp()}));
  });
  it('감사 로그는 수정·삭제할 수 없다',async()=>{
    const c=context('teacher');
    await firestoreBusiness(db('teacher-a'),c).createBusiness('마동카페','one');
    const logs=await firestoreAudit(db('teacher-a'),c).loadRecent();
    await assertFails(updateDoc(doc(db('teacher-a'),`schools/a/auditLogs/${logs[0].id}`),{detail:'변조'}));
    await assertFails(deleteDoc(doc(db('teacher-a'),`schools/a/auditLogs/${logs[0].id}`)));
  });
  it('다른 학교 감사 로그에는 접근할 수 없다',async()=>{
    await firestoreBusiness(db('teacher-a'),context('teacher')).createBusiness('마동카페','one');
    await expect(firestoreAudit(db('teacher-b'),context('teacher','b')).loadRecent()).resolves.toHaveLength(0);
  });
});
describe('학생 학적 상태 변경',()=>{
  it('교사는 학생을 졸업 처리할 수 있다',async()=>{
    const c=context('teacher');
    await updateStudent(db('teacher-a'),c,{id:'one',schoolId:'a',name:'가상시민',grade:6,className:'1반',citizenCode:'C-1',schoolYear:2026,status:'graduated',schemaVersion:1});
    const snap=await getDoc(doc(db('teacher-a'),'schools/a/students/one'));
    expect(snap.data()?.status).toBe('graduated');
  });
  it('학생은 자기 학적 상태를 바꿀 수 없다',async()=>{
    await expect(updateStudent(db('a-one'),context('student'),{id:'one',schoolId:'a',name:'가상시민',grade:3,className:'1반',citizenCode:'C-1',schoolYear:2026,status:'graduated',schemaVersion:1})).rejects.toThrow();
  });
});
