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
