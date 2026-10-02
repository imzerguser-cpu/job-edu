import {collection,doc,getDocFromServer,getDocsFromServer,limit,query,runTransaction,serverTimestamp,setDoc,type Firestore} from 'firebase/firestore';
import {assertApplicant} from '../domain/jobs';
import {schoolPath,type SchoolContext} from '../domain/model';
import {ISSUER_ACCOUNT_ID} from '../domain/finance';
import {avatarJournalId,canWear,defaultAvatar,fashionItems,validateAvatar,normalizeAvatar,type AvatarAppearance} from '../domain/avatar';

export interface AvatarSnapshot {appearance:AvatarAppearance;owned:string[];balanceMinor:number}
export interface AvatarStore {
  load():Promise<AvatarSnapshot>;
  save(appearance:AvatarAppearance):Promise<void>;
  buy(itemId:string):Promise<void>;
}
export function firestoreAvatar(db:Firestore,context:SchoolContext):AvatarStore{
  const studentId=assertApplicant(context);
  const profile=doc(db,schoolPath(context,'avatars',studentId));
  const account=doc(db,schoolPath(context,'accounts',studentId));
  return {
    async load(){
      const [p,items,money]=await Promise.all([getDocFromServer(profile),getDocsFromServer(query(collection(profile,'items'),limit(100))),getDocFromServer(account)]);
      const appearance=p.exists()?normalizeAvatar(p.data().appearance):{...defaultAvatar};
      validateAvatar(appearance);
      return {appearance,owned:items.docs.map(d=>d.id),balanceMinor:money.exists()?money.data().balanceMinor:0};
    },
    async save(appearance){
      validateAvatar(appearance);
      await setDoc(profile,{schoolId:context.schoolId,studentId,appearance,schemaVersion:1,updatedAt:serverTimestamp()});
    },
    async buy(itemId){
      const item=fashionItems.find(i=>i.id===itemId);
      if(!item)throw new Error('판매 중인 아이템이 아니에요.');
      const receipt=doc(collection(profile,'items'),item.id);
      const issuer=doc(db,schoolPath(context,'accounts',ISSUER_ACCOUNT_ID));
      const journalId=avatarJournalId(studentId,item.id);
      const journal=doc(collection(db,schoolPath(context,'journals')),journalId);
      await runTransaction(db,async tx=>{
        const [owned,buyer,fund]=await Promise.all([tx.get(receipt),tx.get(account),tx.get(issuer)]);
        if(owned.exists())throw new Error('이미 가지고 있는 아이템이에요. 옷장에서 입어 보세요.');
        if(!buyer.exists()||buyer.data().balanceMinor<item.priceMinor)throw new Error('학교 화폐 잔액이 부족해요. 모험으로 화폐를 모아 보세요.');
        if(!fund.exists())throw new Error('선생님이 은행에서 학교 계좌를 먼저 준비해야 해요.');
        const buyerAfter=buyer.data().balanceMinor-item.priceMinor,fundAfter=fund.data().balanceMinor+item.priceMinor;
        tx.set(journal,{schoolId:context.schoolId,type:'AVATAR_PURCHASE',studentId,itemId:item.id,debitAccountId:studentId,creditAccountId:ISSUER_ACCOUNT_ID,amountMinor:item.priceMinor,postedBy:studentId,schemaVersion:1,createdAt:serverTimestamp()});
        tx.update(account,{balanceMinor:buyerAfter,version:buyer.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.update(issuer,{balanceMinor:fundAfter,version:fund.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(account,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'AVATAR_PURCHASE',deltaMinor:-item.priceMinor,balanceAfterMinor:buyerAfter,label:item.name,postedAt:serverTimestamp()});
        tx.set(doc(collection(issuer,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'AVATAR_PURCHASE',deltaMinor:item.priceMinor,balanceAfterMinor:fundAfter,label:'꾸미기: '+item.name,postedAt:serverTimestamp()});
        tx.set(receipt,{schoolId:context.schoolId,studentId,itemId:item.id,journalId,createdAt:serverTimestamp()});
      });
    },
  };
}

// Explicitly used only by the standalone preview; never a production fallback.
export function previewAvatarStore(initialBalance=10000):AvatarStore{
  let snapshot:AvatarSnapshot={appearance:{...defaultAvatar},owned:[],balanceMinor:initialBalance};
  return {
    async load(){return structuredClone(snapshot)},
    async save(a){validateAvatar(a);if(!canWear(a,snapshot.owned))throw new Error('구매한 아이템만 저장할 수 있어요.');snapshot={...snapshot,appearance:{...a}}},
    async buy(id){const item=fashionItems.find(i=>i.id===id);if(!item)throw new Error('없는 아이템이에요.');if(snapshot.owned.includes(id))throw new Error('이미 가지고 있어요.');if(snapshot.balanceMinor<item.priceMinor)throw new Error('잔액이 부족해요.');snapshot={...snapshot,balanceMinor:snapshot.balanceMinor-item.priceMinor,owned:[...snapshot.owned,id]}},
  };
}
