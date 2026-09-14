import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreViolations} from '../src/data/violationRepository';
import {listActiveStudents} from '../src/data/schoolRepository';
import {fineJournalId} from '../src/domain/violations';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreViolations(db(c.uid),c)};
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
    // "one" starts funded (1000 minor units)
    await setDoc(doc(db,`schools/${sid}/accounts/one`),{schoolId:sid,ownerType:'student',ownerId:'one',balanceMinor:1000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
describe('과태료 신고와 결정',()=>{
  it('학생이 다른 학생을 신고하면 대기 상태로 생성되고, 아무 금융 효과도 없다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','복도에서 뛰었어요');
    const reports=await reporter.myReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({targetStudentId:'one',status:'submitted',fineAmountMinor:null});
    const account=await getDoc(doc(db('teacher-a'),'schools/a/accounts/one'));
    expect(account.data()?.balanceMinor).toBe(1000); // unchanged
  });
  it('자기 자신은 신고할 수 없다',async()=>{
    await expect(store('student','a','one').submitReport('one','자기 신고')).rejects.toThrow();
  });
  it('교사가 과태료를 부과하면 계좌에서 차감되고 공동기금이 쌓인다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','복도에서 뛰었어요');
    const [report]=await reporter.myReports();
    const teacher=store('teacher');
    await teacher.ensureCommunityFund();
    await teacher.decide(report.id,200,'규칙 위반 확인');
    const account=await getDoc(doc(db('teacher-a'),'schools/a/accounts/one'));
    expect(account.data()?.balanceMinor).toBe(800); // 1000 - 200
    const reports=await teacher.allReports();
    expect(reports.find(r=>r.id===report.id)).toMatchObject({status:'fined',fineAmountMinor:200});
  });
  it('교사가 신고를 기각하면 아무 금융 효과도 없다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','오해였어요');
    const [report]=await reporter.myReports();
    const teacher=store('teacher');
    await teacher.decide(report.id,null,'근거 부족으로 기각');
    const account=await getDoc(doc(db('teacher-a'),'schools/a/accounts/one'));
    expect(account.data()?.balanceMinor).toBe(1000);
  });
  it('기각 사유 없이는 기각할 수 없다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','오해였어요');
    const [report]=await reporter.myReports();
    await expect(store('teacher').decide(report.id,null,'')).rejects.toThrow();
  });
  it('이미 처리된 신고는 다시 결정할 수 없다(중복 부과 방지)',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','복도에서 뛰었어요');
    const [report]=await reporter.myReports();
    const teacher=store('teacher');
    await teacher.ensureCommunityFund();
    await teacher.decide(report.id,200,'확인');
    await expect(teacher.decide(report.id,200,'다시')).rejects.toThrow();
    const account=await getDoc(doc(db('teacher-a'),'schools/a/accounts/one'));
    expect(account.data()?.balanceMinor).toBe(800); // still just one deduction
  });
  it('학생은 과태료를 스스로 부과할 수 없다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','복도에서 뛰었어요');
    const [report]=await reporter.myReports();
    await expect(store('student','a','two').decide(report.id,200,'내가 결정')).rejects.toThrow();
    const journalId=fineJournalId(report.id);
    await assertFails(setDoc(doc(db('a-two'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'FINE',studentId:'one',reportId:report.id,debitAccountId:'one',creditAccountId:'community-fund',amountMinor:1,postedBy:'a-two',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('신고자 본인과 교사만 신고 원문을 볼 수 있다 — 대상 학생이나 남은 볼 수 없다',async()=>{
    const reporter=store('student','a','two');
    await reporter.submitReport('one','복도에서 뛰었어요');
    const [report]=await reporter.myReports();
    await assertSucceeds(getDoc(doc(db('a-two'),`schools/a/violationReports/${report.id}`)));
    await assertSucceeds(getDoc(doc(db('teacher-a'),`schools/a/violationReports/${report.id}`)));
    await assertFails(getDoc(doc(db('a-one'),`schools/a/violationReports/${report.id}`)));
  });
  it('다른 학교 신고에는 접근할 수 없다',async()=>{
    await store('student','a','two').submitReport('one','복도에서 뛰었어요');
    const [report]=await store('student','a','two').myReports();
    await assertFails(getDoc(doc(db('teacher-b'),`schools/a/violationReports/${report.id}`)));
    const journalId=fineJournalId(report.id);
    await assertFails(setDoc(doc(db('teacher-b'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'FINE',studentId:'one',reportId:report.id,debitAccountId:'one',creditAccountId:'community-fund',amountMinor:200,postedBy:'teacher-b',schemaVersion:1,createdAt:serverTimestamp()}));
  });
});
describe('학생의 명단 조회(신고 대상 선택용)',()=>{
  it('학생도 같은 학교 활동 중인 학생 명단을 볼 수 있다',async()=>{
    const list=await listActiveStudents(db('a-two'),context('student','a','two'));
    expect(list.map(s=>s.id).sort()).toEqual(['one','two']);
  });
  it('다른 학교 명단은 볼 수 없다',async()=>{
    await expect(listActiveStudents(db('a-two'),{...context('student','a','two'),schoolId:'b'})).rejects.toThrow();
  });
});
