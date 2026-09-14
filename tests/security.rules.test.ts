import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,query,limit,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {importStudents} from '../src/data/schoolRepository';
let env:RulesTestEnvironment;
const projectId='demo-little-society';
const profile=(sid:string)=>({schoolId:sid,name:'가상학생',grade:1,className:null,citizenCode:'C-demo',schoolYear:2026,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
beforeAll(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();for(const sid of ['a','b']){await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,schoolName:'가상학교',communityName:'작은 사회',currencyName:'별',currencySymbol:'S',timezone:'Asia/Seoul',status:'active',schemaVersion:1});
    await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});
    for(const id of ['one','two']){await setDoc(doc(db,`schools/${sid}/members/${sid}-${id}`),{schoolId:sid,role:'student',studentId:id,status:'active'});await setDoc(doc(db,`schools/${sid}/students/${id}`),profile(sid))}}
  await setDoc(doc(db,'schools/a/members/inactive'),{schoolId:'a',role:'teacher',studentId:null,status:'inactive'});
  await setDoc(doc(db,'schools/a/journals/j1'),{amountMinor:100});await setDoc(doc(db,'schools/a/accounts/one'),{balanceMinor:100});
  await setDoc(doc(db,'userSchools/a-one/links/a'),{schoolId:'a',schoolName:'가상학교'});
})});
afterAll(async()=>{await env.cleanup()});
// The test harness returns the compat wrapper; modular Firebase APIs accept it at runtime.
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
describe('멀티스쿨·개인정보 권한',()=>{
  it('미로그인 데이터 접근 거부',async()=>{await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'schools/a')))});
  it('학생 자기 프로필만 허용',async()=>{await assertSucceeds(getDoc(doc(db('a-one'),'schools/a/students/one')));await assertFails(getDoc(doc(db('a-one'),'schools/a/students/two')))});
  it('학생도 한도 내 명단 조회는 가능하지만(§24 신고 대상 선택용), 한도 없는 전체 쿼리는 여전히 거부',async()=>{
    await assertSucceeds(getDocs(query(collection(db('a-one'),'schools/a/students'),limit(100))));
    await assertFails(getDocs(collection(db('a-one'),'schools/a/students')));
    await assertFails(getDocs(query(collection(db('a-one'),'schools/a/students'),limit(101))));
  });
  it('교사 자기 학교만 허용',async()=>{await assertSucceeds(getDocs(query(collection(db('teacher-a'),'schools/a/students'),limit(100))));await assertFails(getDoc(doc(db('teacher-a'),'schools/b/students/one')))});
  it('학생의 다른 학교 접근과 필드 위조 거부',async()=>{await assertFails(getDoc(doc(db('a-one'),'schools/b')));await assertFails(setDoc(doc(db('teacher-a'),'schools/a/students/three'),{...profile('b'),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))});
  it('학생과 교사의 역할 승격을 모두 거부',async()=>{await assertFails(updateDoc(doc(db('a-one'),'schools/a/members/a-one'),{role:'teacher'}));await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/members/a-one'),{role:'teacher'}));await assertFails(setDoc(doc(db('stranger'),'schools/a/members/stranger'),{schoolId:'a',role:'owner',status:'active'}))});
  it('비활성 멤버 접근 거부',async()=>{await assertFails(getDoc(doc(db('inactive'),'schools/a/students/one')))});
  it('학교 선택 인덱스는 본인만 읽고 직접 만들 수 없다',async()=>{await assertSucceeds(getDoc(doc(db('a-one'),'userSchools/a-one/links/a')));await assertFails(getDoc(doc(db('a-two'),'userSchools/a-one/links/a')));await assertFails(setDoc(doc(db('a-one'),'userSchools/a-one/links/b'),{schoolId:'b'}))});
  it('학생 프로필 변경과 과도한 교사 쿼리를 거부한다',async()=>{await assertFails(updateDoc(doc(db('a-one'),'schools/a/students/one'),{grade:6,updatedAt:serverTimestamp()}));await assertFails(getDocs(collection(db('teacher-a'),'schools/a/students')));await assertFails(getDocs(query(collection(db('teacher-a'),'schools/a/students'),limit(101))))});
});
describe('금융 안전 기본값',()=>{
  it('학생이 잔액·원장·승인을 변경할 수 없다',async()=>{for(const path of ['accounts/one','journals/j1','financialRequests/fake','tasks/fake'])await assertFails(setDoc(doc(db('a-one'),`schools/a/${path}`),{balanceMinor:999999,status:'approved'}))});
  it('교사도 미구현 원장 수정·삭제는 금지',async()=>{await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/journals/j1'),{amountMinor:999}));await assertFails(deleteDoc(doc(db('teacher-a'),'schools/a/journals/j1')))});
  it('프로필에 금융/권한 필드 삽입 금지',async()=>{await assertFails(setDoc(doc(db('teacher-a'),'schools/a/students/x'),{...profile('a'),balanceMinor:100,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))});
});
describe('명단 등록',()=>{
  it('같은 배치 재실행은 중복 학생을 만들지 않는다',async()=>{
    const context={schoolId:'a',uid:'teacher-a',membership:{schoolId:'a',role:'teacher' as const,studentId:null,status:'active' as const}};
    const rows=[{id:'new-student',citizenCode:'C-new',sourceRow:2,name:'가상신입',grade:2,className:null}];
    expect((await importStudents(db('teacher-a'),context,'batch-1',rows,2026)).reused).toBe(false);
    expect((await importStudents(db('teacher-a'),context,'batch-1',rows,2026)).reused).toBe(true);
    expect((await getDocs(query(collection(db('teacher-a'),'schools/a/students'),limit(100)))).size).toBe(3);
  });
  it('서버 시각, 필드 종류, 학년 범위를 강제',async()=>{await assertFails(setDoc(doc(db('teacher-a'),'schools/a/students/x'),profile('a')));await assertFails(setDoc(doc(db('teacher-a'),'schools/a/students/x'),{...profile('a'),grade:7,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))});
});
