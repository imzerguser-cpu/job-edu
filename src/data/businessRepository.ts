import {collection,doc,getDocsFromServer,limit,query,runTransaction,serverTimestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {validateBusiness,validateProduct,type Business,type Catalog,type Product} from '../domain/business';
export interface BusinessStore {
  loadCatalog():Promise<Catalog>;
  createBusiness(name:string,ownerStudentId:string):Promise<void>;
  saveBusiness(b:Business):Promise<void>;
  saveProduct(p:Product):Promise<void>;
  buy(businessId:string,productId:string):Promise<void>;
}
export function firestoreBusiness(db:Firestore,context:SchoolContext):BusinessStore{
  const ref=(name:string,id:string)=>doc(collection(db,schoolPath(context,name)),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async loadCatalog(){
      const [bSnap,pSnap]=await Promise.all([
        getDocsFromServer(query(collection(db,schoolPath(context,'businesses')),limit(100))),
        getDocsFromServer(query(collection(db,schoolPath(context,'products')),limit(100))),
      ]);
      return {
        businesses:bSnap.docs.map(d=>({...d.data(),id:d.id} as Business)),
        products:pSnap.docs.map(d=>({...d.data(),id:d.id} as Product)),
      };
    },
    async createBusiness(name,ownerStudentId){
      teacher();
      const business:Business={id:crypto.randomUUID(),schoolId:context.schoolId,name:name.trim(),ownerStudentId,status:'active',schemaVersion:1};
      validateBusiness(business);
      await runTransaction(db,async tx=>{
        const student=await tx.get(ref('students',ownerStudentId));
        if(!student.exists()||student.data().status!=='active')throw new Error('활동 중인 학생을 사업 담당으로 선택해 주세요.');
        const {id,...data}=business;
        tx.set(ref('businesses',id),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        tx.set(ref('accounts',id),{schoolId:context.schoolId,ownerType:'business',ownerId:id,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'business_create',targetType:'business',targetId:id,detail:data.name,createdAt:serverTimestamp()});
      });
    },
    async saveBusiness(b){
      teacher();validateBusiness(b);
      await runTransaction(db,async tx=>{
        const old=await tx.get(ref('businesses',b.id));
        if(!old.exists())throw new Error('사업을 찾을 수 없습니다.');
        const {id,...data}=b;
        tx.update(ref('businesses',id),{...data,updatedAt:serverTimestamp()});
      });
    },
    async saveProduct(p){
      teacher();validateProduct(p);
      await runTransaction(db,async tx=>{
        const [business,old]=await Promise.all([tx.get(ref('businesses',p.businessId)),tx.get(ref('products',p.id))]);
        if(!business.exists())throw new Error('사업을 먼저 만들어 주세요.');
        const {id,...data}=p;
        if(old.exists())tx.update(ref('products',id),{...data,lastJournalId:old.data().lastJournalId,updatedAt:serverTimestamp()});
        else tx.set(ref('products',id),{...data,lastJournalId:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async buy(businessId,productId){
      const studentId=assertApplicant(context);
      await runTransaction(db,async tx=>{
        const businessRef=ref('businesses',businessId),productRef=ref('products',productId),buyerRef=ref('accounts',studentId),businessAccountRef=ref('accounts',businessId);
        const [business,product,buyer,businessAccount]=await Promise.all([tx.get(businessRef),tx.get(productRef),tx.get(buyerRef),tx.get(businessAccountRef)]);
        if(!business.exists()||business.data().status!=='active')throw new Error('운영 중인 사업이 아닙니다.');
        if(!product.exists()||product.data().businessId!==businessId||product.data().status!=='active')throw new Error('판매 중인 상품이 아닙니다.');
        if(!(product.data().stock>=1))throw new Error('재고가 없습니다.');
        if(!buyer.exists()||buyer.data().balanceMinor<product.data().priceMinor)throw new Error('마동이 부족합니다.');
        if(!businessAccount.exists())throw new Error('사업 계좌가 준비되지 않았습니다.');
        const price=product.data().priceMinor;
        const journalId=crypto.randomUUID();
        tx.set(ref('journals',journalId),{schoolId:context.schoolId,type:'PURCHASE',businessId,productId,buyerStudentId:studentId,debitAccountId:studentId,creditAccountId:businessId,amountMinor:price,postedBy:studentId,schemaVersion:1,createdAt:serverTimestamp()});
        const buyerAfter=buyer.data().balanceMinor-price;
        tx.update(buyerRef,{balanceMinor:buyerAfter,version:buyer.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(buyerRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'PURCHASE',deltaMinor:-price,balanceAfterMinor:buyerAfter,label:product.data().name,postedAt:serverTimestamp()});
        const businessAfter=businessAccount.data().balanceMinor+price;
        tx.update(businessAccountRef,{balanceMinor:businessAfter,version:businessAccount.data().version+1,lastJournalId:journalId,updatedAt:serverTimestamp()});
        tx.set(doc(collection(businessAccountRef,'entries'),journalId),{schoolId:context.schoolId,journalId,type:'PURCHASE',deltaMinor:price,balanceAfterMinor:businessAfter,label:'판매: '+product.data().name,postedAt:serverTimestamp()});
        tx.update(productRef,{stock:product.data().stock-1,lastJournalId:journalId,updatedAt:serverTimestamp()});
      });
    },
  };
}
