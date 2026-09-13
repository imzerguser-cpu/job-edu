import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreFinance} from '../src/data/financeRepository';
import {pairId,starterJobs} from '../src/domain/jobs';
import {salaryJournalId,ISSUER_ACCOUNT_ID} from '../src/domain/finance';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreFinance(db(c.uid),c)};
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
    // student "one" holds the salaried "bank" job (50000 minor); "two" holds nothing
    await setDoc(doc(db,`schools/${sid}/jobAssignments/${pairId('bank','one')}`),{schoolId:sid,jobId:'bank',studentId:'one',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:`teacher-${sid}`,updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
describe('월급 정산',()=>{
  it('발행 계좌 준비는 여러 번 실행해도 오류 없이 한 번만 생성된다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    await expect(teacher.ensureIssuer()).resolves.not.toThrow();
    const result=await teacher.settleSalary(await teacher.previewSalary('2026-09'));
    expect(result.failed).toBe(0);
  });
  it('아직 지급받은 적 없는 학생은 오류 없이 빈 계좌를 본다',async()=>{
    await assertSucceeds(store('student','a','one').myAccount());
    expect(await store('student','a','one').myAccount()).toBeNull();
  });
  it('자격 있는 학생에게 월급을 지급하면 계좌가 생기고 잔액이 오른다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    const items=await teacher.previewSalary('2026-09');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({jobId:'bank',studentId:'one',amountMinor:50000,alreadyPaid:false});
    const result=await teacher.settleSalary(items);
    expect(result).toEqual({paid:1,skipped:0,failed:0});
    const account=await store('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(50000);
    expect(account?.version).toBe(0);
    const entries=await store('student','a','one').myEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({deltaMinor:50000,balanceAfterMinor:50000,label:'월급'});
  });
  it('같은 달 같은 직업으로 두 번 지급되지 않는다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    let items=await teacher.previewSalary('2026-09');
    await teacher.settleSalary(items);
    items=await teacher.previewSalary('2026-09');
    expect(items[0].alreadyPaid).toBe(true);
    const result=await teacher.settleSalary(items);
    expect(result).toEqual({paid:0,skipped:1,failed:0});
    const account=await store('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(50000); // unchanged, not doubled
  });
  it('다음 달은 별도로 지급할 수 있다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    await teacher.settleSalary(await teacher.previewSalary('2026-09'));
    await teacher.settleSalary(await teacher.previewSalary('2026-10'));
    const account=await store('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(100000);
    expect(account?.version).toBe(1);
  });
  it('직업을 맡지 않은 학생은 미리보기에 나타나지 않고 저널도 만들 수 없다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    const items=await teacher.previewSalary('2026-09');
    expect(items.some(i=>i.studentId==='two')).toBe(false);
    const journalId=salaryJournalId('bank','two','2026-09');
    await assertFails(setDoc(doc(db('teacher-a'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'SALARY',jobId:'bank',studentId:'two',period:'2026-09',debitAccountId:ISSUER_ACCOUNT_ID,creditAccountId:'two',amountMinor:50000,postedBy:'teacher-a',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('직업의 월급과 다른 금액으로는 저널을 만들 수 없다',async()=>{
    await store('teacher').ensureIssuer();
    const journalId=salaryJournalId('bank','one','2026-09');
    await assertFails(setDoc(doc(db('teacher-a'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'SALARY',jobId:'bank',studentId:'one',period:'2026-09',debitAccountId:ISSUER_ACCOUNT_ID,creditAccountId:'one',amountMinor:999999,postedBy:'teacher-a',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('학생은 계좌·저널을 전혀 쓸 수 없고 자기 계좌만 읽을 수 있다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    await teacher.settleSalary(await teacher.previewSalary('2026-09'));
    await assertFails(updateDoc(doc(db('a-one'),'schools/a/accounts/one'),{balanceMinor:999999,version:1,updatedAt:serverTimestamp()}));
    await assertFails(setDoc(doc(db('a-two'),'schools/a/accounts/two'),{schoolId:'a',ownerType:'student',ownerId:'two',balanceMinor:999999,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    await assertFails(deleteDoc(doc(db('teacher-a'),'schools/a/accounts/one')));
    await assertSucceeds(store('student','a','one').myAccount());
    await expect(store('student','a','two').myAccount()).resolves.toBeNull(); // reads own (empty) account, not "one"'s
    await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/journals/'+salaryJournalId('bank','one','2026-09')),{amountMinor:1}));
  });
  it('교사도 저널 없이 계좌 잔액만 직접 바꿀 수 없다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureIssuer();
    await teacher.settleSalary(await teacher.previewSalary('2026-09'));
    await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/accounts/one'),{balanceMinor:1,version:1,lastJournalId:'fake',updatedAt:serverTimestamp()}));
  });
  it('다른 학교 계좌·저널에는 접근할 수 없다',async()=>{
    await store('teacher','a').ensureIssuer();
    await store('teacher','a').settleSalary(await store('teacher','a').previewSalary('2026-09'));
    await assertFails(updateDoc(doc(db('teacher-b'),'schools/a/accounts/one'),{balanceMinor:1}));
    await assertFails(updateDoc(doc(db('a-one'),'schools/b/accounts/one'),{balanceMinor:1}));
  });
});
