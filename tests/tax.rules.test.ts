import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreFinance} from '../src/data/financeRepository';
import {openSchool,updateIncomeTaxRate} from '../src/data/schoolRepository';
import {pairId,starterJobs} from '../src/domain/jobs';
import {incomeTaxJournalId} from '../src/domain/finance';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreFinance(db(c.uid),c)};
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
describe('소득세 정산',()=>{
  async function paySalary(sid='a',period='2026-09'){
    const teacher=store('teacher',sid);
    await teacher.ensureIssuer();
    await teacher.settleSalary(await teacher.previewSalary(period));
    return teacher;
  }
  it('공동기금 계좌 준비는 여러 번 실행해도 오류 없이 한 번만 생성된다',async()=>{
    const teacher=store('teacher');
    await teacher.ensureCommunityFund();
    await expect(teacher.ensureCommunityFund()).resolves.not.toThrow();
  });
  it('월급을 받은 학생에게 세율만큼 세금을 걷으면 계좌에서 차감되고 공동기금이 쌓인다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    const items=await teacher.previewIncomeTax('2026-09',500); // 5%
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({studentId:'one',incomeMinor:50000,amountMinor:2500,alreadyPaid:false});
    const result=await teacher.settleIncomeTax(items);
    expect(result).toEqual({paid:1,skipped:0,failed:0});
    const account=await store('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(47500); // 50000 - 2500
    const entries=await store('student','a','one').myEntries();
    expect(entries.find(e=>e.type==='INCOME_TAX')).toMatchObject({deltaMinor:-2500,balanceAfterMinor:47500,label:'소득세'});
  });
  it('세율 0이면 아무도 과세 대상이 되지 않는다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    const items=await teacher.previewIncomeTax('2026-09',0);
    expect(items).toHaveLength(0);
  });
  it('월급을 받지 않은 학생은 과세 대상에 없다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    const items=await teacher.previewIncomeTax('2026-09',500);
    expect(items.some(i=>i.studentId==='two')).toBe(false);
  });
  it('같은 달에 같은 학생에게 세금을 두 번 걷지 않는다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    let items=await teacher.previewIncomeTax('2026-09',500);
    await teacher.settleIncomeTax(items);
    items=await teacher.previewIncomeTax('2026-09',500);
    expect(items[0]?.alreadyPaid).toBe(true);
    const result=await teacher.settleIncomeTax(items);
    expect(result).toEqual({paid:0,skipped:1,failed:0});
    const account=await store('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(47500); // unchanged, not doubled
  });
  it('학생은 소득세 저널을 스스로 만들 수 없다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    const journalId=incomeTaxJournalId('one','2026-09');
    await assertFails(setDoc(doc(db('a-one'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'INCOME_TAX',studentId:'one',period:'2026-09',debitAccountId:'one',creditAccountId:'community-fund',amountMinor:1,postedBy:'a-one',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('잔액보다 큰 세금 저널은 만들 수 없다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    const journalId=incomeTaxJournalId('one','2026-09');
    await assertFails(setDoc(doc(db('teacher-a'),`schools/a/journals/${journalId}`),{schoolId:'a',type:'INCOME_TAX',studentId:'one',period:'2026-09',debitAccountId:'one',creditAccountId:'community-fund',amountMinor:999999,postedBy:'teacher-a',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('교사도 저널 없이 계좌 잔액만 직접 바꿀 수 없다',async()=>{
    const teacher=await paySalary();
    await teacher.ensureCommunityFund();
    await assertFails(updateDoc(doc(db('teacher-a'),'schools/a/accounts/one'),{balanceMinor:1,version:1,lastJournalId:'fake',updatedAt:serverTimestamp()}));
  });
});
describe('세율 설정',()=>{
  async function seedFullSchool(sid='a'){
    await env.withSecurityRulesDisabled(async c=>{
      await setDoc(doc(c.firestore(),`schools/${sid}`),{schoolId:sid,schoolName:'가상학교',communityName:'작은 사회',currencyName:'별',currencySymbol:'S',timezone:'Asia/Seoul',status:'active',schemaVersion:1});
    });
  }
  it('교사가 세율을 설정하면 다른 필드는 그대로 남는다',async()=>{
    await seedFullSchool();
    await updateIncomeTaxRate(db('teacher-a'),context('teacher'),500);
    const {school}=await openSchool(db('teacher-a'),'teacher-a','a');
    expect(school.incomeTaxRateBp).toBe(500);
    expect(school.schoolName).toBe('가상학교');
  });
  it('세율 범위를 벗어나면 거부한다',async()=>{
    await seedFullSchool();
    await expect(updateIncomeTaxRate(db('teacher-a'),context('teacher'),2001)).rejects.toThrow();
    await expect(updateIncomeTaxRate(db('teacher-a'),context('teacher'),-1)).rejects.toThrow();
  });
  it('학생은 세율을 설정할 수 없다',async()=>{
    await seedFullSchool();
    await assertFails(updateDoc(doc(db('a-one'),'schools/a'),{incomeTaxRateBp:500,updatedAt:serverTimestamp()}));
  });
  it('세율 필드 없이 만들어진 기존 학교도 읽으면 0으로 취급된다',async()=>{
    // The suite's own beforeEach seeds school 'a' without schoolName/incomeTaxRateBp at all —
    // this asserts the read-side default (schoolRepository.openSchool), not the update rule.
    const {school}=await openSchool(db('teacher-a'),'teacher-a','a');
    expect(school.incomeTaxRateBp).toBe(0);
  });
});
