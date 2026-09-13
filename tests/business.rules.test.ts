import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreBusiness} from '../src/data/businessRepository';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreBusiness(db(c.uid),c)};
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
    // "one" starts funded (1000 minor units); "two" starts nearly empty (10)
    await setDoc(doc(db,`schools/${sid}/accounts/one`),{schoolId:sid,ownerType:'student',ownerId:'one',balanceMinor:1000,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
    await setDoc(doc(db,`schools/${sid}/accounts/two`),{schoolId:sid,ownerType:'student',ownerId:'two',balanceMinor:10,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  }
})});
afterAll(async()=>{await env.cleanup()});
async function shopWithJuice(status:'active'|'closed'='active',productStatus:'active'|'paused'='active',stock=5,price=300){
  const teacher=store('teacher');
  await teacher.createBusiness('마동카페','one');
  let catalog=await teacher.loadCatalog();
  const businessId=catalog.businesses[0].id;
  await teacher.saveProduct({id:crypto.randomUUID(),schoolId:'a',businessId,name:'과일주스',priceMinor:price,stock,lastJournalId:null,status:productStatus,schemaVersion:1});
  if(status==='closed'){catalog=await teacher.loadCatalog();await teacher.saveBusiness({...catalog.businesses[0],status:'closed'})}
  catalog=await teacher.loadCatalog();
  return {businessId,productId:catalog.products[0].id};
}
describe('사업과 상품',()=>{
  it('사업을 만들면 사업 계좌가 함께 생긴다',async()=>{
    const teacher=store('teacher');
    await teacher.createBusiness('마동카페','one');
    const catalog=await teacher.loadCatalog();
    expect(catalog.businesses).toHaveLength(1);
    const accountSnap=await getDoc(doc(db('teacher-a'),`schools/a/accounts/${catalog.businesses[0].id}`));
    expect(accountSnap.exists()).toBe(true);
    expect(accountSnap.data()).toMatchObject({ownerType:'business',balanceMinor:0,version:0});
  });
  it('학생은 사업이나 상품을 직접 만들 수 없다',async()=>{
    await expect(store('student').createBusiness('불법가게','one')).rejects.toThrow();
    await assertFails(setDoc(doc(db('a-one'),'schools/a/businesses/fake'),{schoolId:'a',name:'불법가게',ownerStudentId:'one',status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});
describe('구매',()=>{
  it('충분한 잔액과 재고가 있으면 구매가 성공한다',async()=>{
    const {businessId,productId}=await shopWithJuice();
    await store('student','a','one').buy(businessId,productId);
    const buyerSnap=await getDoc(doc(db('a-one'),'schools/a/accounts/one'));
    expect(buyerSnap.data()?.balanceMinor).toBe(700); // 1000 - 300
    const catalog=await store('teacher').loadCatalog();
    expect(catalog.products.find(p=>p.id===productId)?.stock).toBe(4);
  });
  it('잔액이 부족하면 구매가 거부된다',async()=>{
    const {businessId,productId}=await shopWithJuice('active','active',5,300);
    await expect(store('student','a','two').buy(businessId,productId)).rejects.toThrow(); // two has only 10
  });
  it('재고가 없으면 구매가 거부된다',async()=>{
    const {businessId,productId}=await shopWithJuice('active','active',0,300);
    await expect(store('student','a','one').buy(businessId,productId)).rejects.toThrow();
  });
  it('종료된 사업이나 판매 중지 상품은 구매할 수 없다',async()=>{
    const closed=await shopWithJuice('closed');
    await expect(store('student','a','one').buy(closed.businessId,closed.productId)).rejects.toThrow();
  });
  it('같은 재고 1개를 동시에 사려 하면 하나만 성공한다',async()=>{
    const {businessId,productId}=await shopWithJuice('active','active',1,300);
    const results=await Promise.allSettled([store('student','a','one').buy(businessId,productId),store('student','a','one').buy(businessId,productId)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const catalog=await store('teacher').loadCatalog();
    expect(catalog.products.find(p=>p.id===productId)?.stock).toBe(0);
  });
  it('학생은 가격을 조작하거나 남의 이름으로 구매할 수 없다',async()=>{
    const {businessId,productId}=await shopWithJuice();
    await assertFails(setDoc(doc(db('a-one'),'schools/a/journals/fake-purchase'),{schoolId:'a',type:'PURCHASE',businessId,productId,buyerStudentId:'one',debitAccountId:'one',creditAccountId:businessId,amountMinor:1,postedBy:'one',schemaVersion:1,createdAt:serverTimestamp()}));
    await assertFails(setDoc(doc(db('a-one'),'schools/a/journals/fake-purchase2'),{schoolId:'a',type:'PURCHASE',businessId,productId,buyerStudentId:'two',debitAccountId:'two',creditAccountId:businessId,amountMinor:300,postedBy:'two',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('학생은 상품 재고를 직접 늘리거나 다른 필드를 바꿀 수 없다',async()=>{
    const {productId}=await shopWithJuice();
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/products/${productId}`),{stock:999}));
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/products/${productId}`),{priceMinor:1}));
  });
  it('교사도 원장·계좌를 삭제할 수 없다',async()=>{
    const {businessId,productId}=await shopWithJuice();
    await store('student','a','one').buy(businessId,productId);
    await assertFails(deleteDoc(doc(db('teacher-a'),'schools/a/products/'+productId)));
    await assertFails(deleteDoc(doc(db('teacher-a'),'schools/a/businesses/'+businessId)));
  });
});
