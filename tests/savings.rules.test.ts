import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,serverTimestamp,writeBatch,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreSavings} from '../src/data/savingsRepository';
import {firestoreFinance} from '../src/data/financeRepository';
import {firestoreFinancialProducts} from '../src/data/financialProductRepository';
import type {SchoolContext} from '../src/domain/model';

let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const savings=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreSavings(db(c.uid),c)};
const finance=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreFinance(db(c.uid),c)};
const products=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreFinancialProducts(db(c.uid),c)};

// Bypasses savingsRepository.openSavings entirely so an intentionally invalid field (an
// out-of-range amount, a forged rate, a mismatched student) can be isolated and checked
// against the Rules directly, the same way business.rules.test.ts probes PURCHASE.
async function rawOpenSavings(uid:string,sid:string,contractId:string,opts:{studentId:string;productId:string;principalMinor:number;months:number;rateBpsMonthly:number}){
  const d=db(uid),depositJournalId=`savingsDeposit~${contractId}`,today='2026-01-01';
  const batch=writeBatch(d);
  batch.set(doc(d,`schools/${sid}/journals/${depositJournalId}`),{schoolId:sid,type:'SAVINGS_DEPOSIT',studentId:opts.studentId,contractId,debitAccountId:opts.studentId,creditAccountId:'system-issuer',amountMinor:opts.principalMinor,postedBy:opts.studentId,schemaVersion:1,createdAt:serverTimestamp()});
  batch.set(doc(d,`schools/${sid}/savings/${contractId}`),{schoolId:sid,studentId:opts.studentId,productId:opts.productId,productSnapshot:{name:'단기저축',rateBpsMonthly:opts.rateBpsMonthly},principalMinor:opts.principalMinor,months:opts.months,startAt:today,maturityAt:today,status:'active',depositJournalId,maturityJournalId:null,interestMinor:null,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return batch.commit();
}

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
    // "one" starts funded (100,000 minor) so savings enrollment has something to spend.
    await setDoc(doc(db,`schools/${sid}/accounts/system-issuer`),{schoolId:sid,ownerType:'school',ownerId:'system-issuer',balanceMinor:-100000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/accounts/one`),{schoolId:sid,ownerType:'student',ownerId:'one',balanceMinor:100000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/financialProducts/short`),{schoolId:sid,kind:'savings',name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:1000,maxMinor:100000,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});

describe('저축 상품',()=>{
  it('교사만 상품을 만들 수 있고, 학생은 조회만 가능하다',async()=>{
    const teacher=products('teacher');
    await teacher.createProduct('savings',{name:'장기저축',rateBpsMonthly:1000,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active'});
    const list=await assertSucceeds(products('student','a','one').listProducts());
    expect(list.length).toBe(2);
    await assertFails(setDoc(doc(db('a-one'),'schools/a/financialProducts/hack'),{schoolId:'a',kind:'savings',name:'x',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1000,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
  it('상품은 상태 전이로만 닫히고 하드 삭제되지 않는다',async()=>{
    await products('teacher').closeProduct('short');
    const list=await products('student','a','one').listProducts();
    expect(list.find(p=>p.id==='short')?.status).toBe('closed');
  });
  it('다른 학교 상품에는 접근할 수 없다',async()=>{
    await assertFails(setDoc(doc(db('teacher-a'),'schools/b/financialProducts/hack'),{schoolId:'b',kind:'savings',name:'x',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1000,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});

describe('저축 가입',()=>{
  it('상품 범위 안의 금액·기간으로 가입하면 원금이 계좌에서 빠지고(양쪽 계좌가 대사되어) 계약이 생긴다',async()=>{
    await savings('student','a','one').openSavings({productId:'short',principalMinor:50000,months:3});
    const account=await finance('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(50000);
    const contracts=await savings('student','a','one').myContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({principalMinor:50000,months:3,status:'active',productSnapshot:{rateBpsMonthly:500}});
    await env.withSecurityRulesDisabled(async c=>{
      const issuerDoc=await c.firestore().doc('schools/a/accounts/system-issuer').get();
      expect(issuerDoc.data()?.balanceMinor).toBe(-50000); // started at -100000, credited 50000 by the deposit
    });
  });
  it('잔액보다 큰 금액은 가입할 수 없다',async()=>{
    await products('teacher').createProduct('savings',{name:'무제한저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active'});
    const list=await products('teacher').listProducts();
    const big=list.find(p=>p.name==='무제한저축')!.id;
    await expect(savings('student','a','one').openSavings({productId:big,principalMinor:200000,months:1})).rejects.toThrow();
  });
  it('상품 범위를 벗어난 금액·기간의 가입은 규칙에서 거부된다(클라이언트 우회 시도)',async()=>{
    await assertFails(rawOpenSavings('a-one','a','c-lowamount',{studentId:'one',productId:'short',principalMinor:500,months:2,rateBpsMonthly:500})); // < minMinor 1000
    await assertFails(rawOpenSavings('a-one','a','c-highamount',{studentId:'one',productId:'short',principalMinor:200000,months:2,rateBpsMonthly:500})); // > maxMinor 100000
    await assertFails(rawOpenSavings('a-one','a','c-months',{studentId:'one',productId:'short',principalMinor:5000,months:5,rateBpsMonthly:500})); // > maxMonths 3
  });
  it('상품의 실제 이율과 다른 이율을 써서 가입할 수 없다(이율 위조 거부)',async()=>{
    await assertFails(rawOpenSavings('a-one','a','c-fakerate',{studentId:'one',productId:'short',principalMinor:5000,months:2,rateBpsMonthly:9999}));
  });
  it('다른 학생 명의로 가입할 수 없다',async()=>{
    await assertFails(rawOpenSavings('a-one','a','c-other',{studentId:'two',productId:'short',principalMinor:5000,months:2,rateBpsMonthly:500}));
  });
});

describe('저축 만기 정산',()=>{
  async function seedMaturedContract(){
    await env.withSecurityRulesDisabled(async c=>{
      const db=c.firestore();
      await setDoc(doc(db,'schools/a/savings/ready'),{schoolId:'a',studentId:'one',productId:'short',productSnapshot:{name:'단기저축',rateBpsMonthly:500},principalMinor:10000,months:3,startAt:'2020-01-01',maturityAt:'2020-04-01',status:'active',depositJournalId:'savingsDeposit~ready',maturityJournalId:null,interestMinor:null,schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    });
  }
  it('만기가 지난 계약을 정산하면 원금+이자가 계좌에 들어오고 두 번 지급되지 않는다',async()=>{
    await seedMaturedContract();
    const teacher=savings('teacher');
    let items=await teacher.previewMaturities();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({principalMinor:10000,interestMinor:1500,payoutMinor:11500}); // 100*5%*3=15 example, minor units
    const result=await teacher.settleMaturities(items);
    expect(result).toEqual({paid:1,skipped:0,failed:0});
    const account=await finance('student','a','one').myAccount();
    expect(account?.balanceMinor).toBe(111500); // funded 100000 + payout 11500
    items=await teacher.previewMaturities();
    expect(items).toHaveLength(0); // matured contracts drop out of the preview
    const retry=await teacher.settleMaturities([{contractId:'ready',studentId:'one',studentName:'가상시민',principalMinor:10000,interestMinor:1500,payoutMinor:11500,maturityAt:'2020-04-01',journalId:'interest~ready',alreadyPaid:false}]);
    expect(retry).toEqual({paid:0,skipped:1,failed:0}); // idempotency key (interest~ready) blocks the double payout
  });
  it('학생은 만기 정산을 실행할 수 없다',async()=>{
    await seedMaturedContract();
    await expect(savings('student','a','one').previewMaturities()).rejects.toThrow();
  });
  it('다른 학교 계약에는 접근할 수 없다',async()=>{
    await seedMaturedContract();
    await assertFails(setDoc(doc(db('teacher-b'),'schools/a/savings/ready'),{status:'matured'},{merge:true}));
  });
});
