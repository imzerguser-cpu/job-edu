import {defaultStorybook,storybookItems} from '../src/domain/storybook';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp,Timestamp,writeBatch,type Firestore} from 'firebase/firestore';
import {firestoreAvatar} from '../src/data/avatarRepository';
import {avatarJournalId,defaultAvatar,fashionItems} from '../src/domain/avatar';
import type {SchoolContext} from '../src/domain/model';
let env:RulesTestEnvironment;
const db=(id='one')=>env.authenticatedContext(`a-${id}`).firestore() as unknown as Firestore;
const context=(id='one'):SchoolContext=>({schoolId:'a',uid:`a-${id}`,membership:{schoolId:'a',studentId:id,role:'student',status:'active'}});
const store=(id='one')=>firestoreAvatar(db(id),context(id));
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const d=c.firestore();await setDoc(doc(d,'schools/a'),{schoolId:'a',status:'active'});
  for(const id of ['one','two']){
    await setDoc(doc(d,`schools/a/members/a-${id}`),{schoolId:'a',studentId:id,role:'student',status:'active'});
    await setDoc(doc(d,`schools/a/students/${id}`),{schoolId:'a',status:'active',grade:3,name:id});
  }
  for(const [id,balance] of [['one',200000],['two',0],['system-issuer',0]] as const)await setDoc(doc(d,`schools/a/accounts/${id}`),{schoolId:'a',ownerId:id,ownerType:id==='system-issuer'?'school':'student',balanceMinor:balance,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
})});
afterAll(async()=>{await env.cleanup()});
describe('avatar ownership and school currency',()=>{
  it('saves a free appearance and reloads it from another store instance',async()=>{
    await store().save({...defaultAvatar,hair:'long',eyes:'sparkle'});
    expect((await store().load()).appearance).toMatchObject({hair:'long',eyes:'sparkle'});
  });
  it('purchases every item at its authoritative price with a balanced immutable receipt',async()=>{
    let total=0;
    for(const item of fashionItems){await store().buy(item.id);total+=item.priceMinor}
    const loaded=await store().load();expect(loaded.balanceMinor).toBe(200000-total);expect(loaded.owned).toHaveLength(fashionItems.length);
    const issuer=await getDoc(doc(db(),'schools/a/accounts/system-issuer'));expect(issuer.data()?.balanceMinor).toBe(total);
    await store().save({...defaultAvatar,outfit:'hoodie',shoes:'boots',eyewear:'glasses',headwear:'catband',hair:'braids',accessory:'scrunchie'});
  });
  it('rejects insufficient funds and charges only once under concurrent requests',async()=>{
    await expect(store('two').buy('hoodie')).rejects.toThrow();
    const result=await Promise.allSettled([store().buy('hoodie'),store().buy('hoodie')]);
    expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await store().load()).balanceMinor).toBe(198500);
  });
  it('cannot equip unowned items or read/write another student or school',async()=>{
    for(const appearance of [{...defaultAvatar,outfit:'hoodie'},{...defaultAvatar,hair:'braids'},{...defaultAvatar,eyewear:'starshades'},{...defaultAvatar,headwear:'catband'},{...defaultAvatar,accessory:'scrunchie'}] as const)await expect(store().save(appearance)).rejects.toThrow();
    await assertFails(getDoc(doc(db(),'schools/a/avatars/two')));
    await assertFails(getDoc(doc(db(),'schools/b/avatars/one')));
    await assertFails(setDoc(doc(db(),'schools/a/avatars/two'),{schoolId:'a',studentId:'two',appearance:defaultAvatar,schemaVersion:1,updatedAt:serverTimestamp()}));
    await assertFails(setDoc(doc(db(),'schools/a/avatars/one'),{schoolId:'a',studentId:'one',appearance:{...defaultAvatar,eyes:'invalid'},schemaVersion:1,updatedAt:serverTimestamp()}));
  });
  it('cannot create free ownership or a standalone purchase journal',async()=>{
    const journalId=avatarJournalId('one','hoodie');
    await assertFails(setDoc(doc(db(),'schools/a/avatars/one/items/hoodie'),{schoolId:'a',studentId:'one',itemId:'hoodie',journalId,createdAt:serverTimestamp()}));
    await assertFails(setDoc(doc(db(),`schools/a/journals/${journalId}`),{schoolId:'a',type:'AVATAR_PURCHASE',studentId:'one',itemId:'hoodie',debitAccountId:'one',creditAccountId:'system-issuer',amountMinor:1500,postedBy:'one',schemaVersion:1,createdAt:serverTimestamp()}));
  });
  it('cannot reuse an old receipt to move school money again',async()=>{
    await store().buy('hoodie');await store().buy('glasses');
    await assertFails(updateDoc(doc(db(),'schools/a/accounts/system-issuer'),{balanceMinor:3800,version:3,lastJournalId:avatarJournalId('one','hoodie'),updatedAt:serverTimestamp()}));
    expect((await getDoc(doc(db(),'schools/a/accounts/system-issuer'))).data()?.balanceMinor).toBe(2300);
  });
  it('rejects tampered price even when accounts, entries and receipt agree with it',async()=>{
    const d=db(),id=avatarJournalId('one','hoodie'),batch=writeBatch(d);
    batch.set(doc(d,`schools/a/journals/${id}`),{schoolId:'a',type:'AVATAR_PURCHASE',studentId:'one',itemId:'hoodie',debitAccountId:'one',creditAccountId:'system-issuer',amountMinor:1,postedBy:'one',schemaVersion:1,createdAt:serverTimestamp()});
    batch.set(doc(d,'schools/a/avatars/one/items/hoodie'),{schoolId:'a',studentId:'one',itemId:'hoodie',journalId:id,createdAt:serverTimestamp()});
    for(const [account,delta,balance] of [['one',-1,199999],['system-issuer',1,1]] as const){
      batch.update(doc(d,`schools/a/accounts/${account}`),{balanceMinor:balance,version:1,lastJournalId:id,updatedAt:serverTimestamp()});
      batch.set(doc(d,`schools/a/accounts/${account}/entries/${id}`),{schoolId:'a',journalId:id,type:'AVATAR_PURCHASE',deltaMinor:delta,balanceAfterMinor:balance,label:'hoodie',postedAt:serverTimestamp()});
    }
    await assertFails(batch.commit());expect((await store().load()).balanceMinor).toBe(200000);
  });
});

describe('storybook account integration',()=>{
 it('locks the boys/girls choice after the first save but keeps everything else editable',async()=>{
  const a=defaultStorybook();a.collection='girls';
  await store().saveStorybook(a);
  await expect(store().saveStorybook({...a,collection:'boys'})).rejects.toThrow();
  const b={...a,style:{...a.style,face:2,eyes:5}};
  await store().saveStorybook(b);expect((await store().load()).storybook).toEqual(b);
 });
 it('saves free choices and body proportions and reloads from another session',async()=>{
  const a=defaultStorybook();a.collection='girls';a.style.face=3;a.style.eyes=9;a.shape={height:70,build:60};
  await store().saveStorybook(a);expect((await store().load()).storybook).toEqual(a);
 });
 it('buys all catalogue items, keeps more than 100 receipts, equips four paid slots and preserves legacy wardrobe',async()=>{
  for(const item of [...fashionItems,...storybookItems])await store().buy(item.id);
  await store().save({...defaultAvatar,outfit:'hoodie',shoes:'boots',eyewear:'glasses',headwear:'cap',hair:'braids',accessory:'bow'});
  const a=defaultStorybook();a.style={...a.style,hair:9,outfit:9,bottom:9,shoes:9};
  await store().saveStorybook(a);
  const loaded=await store().load();expect(loaded.owned).toHaveLength(121);expect(loaded.storybook).toEqual(a);expect(loaded.appearance.outfit).toBe('hoodie');
  expect(loaded.balanceMinor).toBe(200000-[...fashionItems,...storybookItems].reduce((sum,i)=>sum+i.priceMinor,0));
  // 남/여가 정해진 뒤에는 동화 캐릭터를 지울 수 없다(D-126)
  await expect(store().save(defaultAvatar)).rejects.toThrow();expect((await store().load()).storybook).toEqual(a);expect((await store().load()).owned).toHaveLength(121);
 },60000);
 it('rejects unowned clothing, other collection receipts and malformed direct writes',async()=>{
  const a=defaultStorybook();a.style.outfit=1;
  await expect(store().saveStorybook(a)).rejects.toThrow();
  await store().buy('sb-girls-outfit-1');await expect(store().saveStorybook(a)).rejects.toThrow();
  for(const bad of [{...defaultStorybook(),shape:{height:101,build:50}},{...defaultStorybook(),style:{...defaultStorybook().style,face:4}},{...a,collection:'other'}]){
   await assertFails(setDoc(doc(db(),'schools/a/avatars/one'),{schoolId:'a',studentId:'one',appearance:defaultAvatar,storybook:bad,schemaVersion:1,updatedAt:serverTimestamp()}));
  }
 });
 it('charges new clothing only once and rejects insufficient funds',async()=>{
  await expect(store('two').buy('sb-boys-shoes-3')).rejects.toThrow();
  const result=await Promise.allSettled([store().buy('sb-boys-shoes-3'),store().buy('sb-boys-shoes-3')]);
  expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await store().load()).balanceMinor).toBe(199000);
 });
});

describe('남학생/여학생 다시 고르기(D-127)',()=>{
  const teacherDb=()=>env.authenticatedContext('teacher-a').firestore() as unknown as Firestore;
  const teacherCtx:SchoolContext={schoolId:'a',uid:'teacher-a',membership:{schoolId:'a',studentId:null,role:'teacher',status:'active'}};
  const resets=async(who:'one'|'teacher')=>{const {firestoreAvatarResets}=await import('../src/data/avatarResetRepository');return who==='teacher'?firestoreAvatarResets(teacherDb(),teacherCtx):firestoreAvatarResets(db('one'),context('one'))};
  beforeEach(async()=>{await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'schools/a/members/teacher-a'),{schoolId:'a',studentId:null,role:'teacher',status:'active'})})});
  it('학생이 요청하고 교사가 허용하면 남/여 선택만 지워져 다시 고를 수 있다',async()=>{
    const a=defaultStorybook();a.collection='girls';a.style.face=2;
    await store().saveStorybook(a);
    const student=await resets('one');
    await student.request('실수로 잘못 골랐어요');
    await expect(student.request('또 요청')).rejects.toThrow();
    const teacher=await resets('teacher');
    expect((await teacher.pending()).map(r=>r.studentId)).toEqual(['one']);
    await teacher.approve('one');
    expect((await store().load()).storybook).toBeUndefined();
    expect((await student.myRequest())?.status).toBe('approved');
    await store().saveStorybook({...a,collection:'boys'});
    expect((await store().load()).storybook?.collection).toBe('boys');
  });
  it('교사는 요청 없이도 되돌릴 수 있고 거절도 할 수 있다. 학생은 남의 요청·되돌리기를 못 한다',async()=>{
    await store().saveStorybook(defaultStorybook());
    const teacher=await resets('teacher');
    await teacher.resetNow('one');
    expect((await store().load()).storybook).toBeUndefined();
    await store().saveStorybook(defaultStorybook());
    const student=await resets('one');await student.request('바꾸고 싶어요');
    await teacher.reject('one','잘 어울려요');
    expect(await student.myRequest()).toMatchObject({status:'rejected',note:'잘 어울려요'});
    await assertFails(updateDoc(doc(db('two'),'schools/a/avatars/one'),{storybook:null,updatedAt:serverTimestamp()}));
    await assertFails(setDoc(doc(db('two'),'schools/a/avatarResetRequests/one'),{schoolId:'a',studentId:'one',reason:'x',status:'pending',note:'',decidedBy:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(db('one'),'schools/a/avatarResetRequests/one'),{status:'approved',decidedBy:'a-one',updatedAt:serverTimestamp()}));
  });
});
