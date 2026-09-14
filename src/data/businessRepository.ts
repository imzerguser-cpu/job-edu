import {collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,type Timestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {assertApplicant} from '../domain/jobs';
import {businessTaxJournalId,computeBusinessTax,validateBusiness,validateProduct,type Business,type BusinessTaxPreviewItem,type Catalog,type Product} from '../domain/business';
import {COMMUNITY_FUND_ACCOUNT_ID,type Account,type AccountEntry} from '../domain/finance';
export interface BusinessStore {
  loadCatalog():Promise<Catalog>;
  createBusiness(name:string,ownerStudentId:string):Promise<void>;
  saveBusiness(b:Business):Promise<void>;
  saveProduct(p:Product):Promise<void>;
  buy(businessId:string,productId:string):Promise<void>;
  businessAccount(businessId:string):Promise<Account|null>;
  businessEntries(businessId:string):Promise<AccountEntry[]>;
  ensureCommunityFund():Promise<void>;
  previewBusinessTax(period:string,rateBp:number):Promise<BusinessTaxPreviewItem[]>;
  settleBusinessTax(items:BusinessTaxPreviewItem[]):Promise<{paid:number;skipped:number;failed:number}>;
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
    // Teacher, or the student who owns this product's business (§25) — enforced by Rules
    // (ownBusiness), not pre-checked here, the same trust pattern buy() already uses below.
    async saveProduct(p){
      validateProduct(p);
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
    // Business account balance is already open to any active member (D-25 — it's shared/school
    // information like the issuer account, not private student data). Entries (sale-by-sale
    // history) are restricted to the teacher and the business's own owner (ownBusiness in Rules).
    async businessAccount(businessId){
      const snap=await getDocFromServer(ref('accounts',businessId));
      return snap.exists()?({...snap.data(),id:snap.id} as Account):null;
    },
    async businessEntries(businessId){
      const snap=await getDocsFromServer(query(collection(ref('accounts',businessId),'entries'),orderBy('postedAt','desc'),limit(20)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as AccountEntry));
    },
    // Shared with financeRepository's own ensureCommunityFund (same fixed account id) — each
    // store independently ensures the same account, whichever runs first creates it (D-63-adjacent
    // reasoning to D-17: not worth a shared module for one three-line idempotent bootstrap).
    async ensureCommunityFund(){
      teacher();
      const target=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID);
      if((await getDocFromServer(target)).exists())return;
      await runTransaction(db,async tx=>{
        if((await tx.get(target)).exists())return;
        tx.set(target,{schoolId:context.schoolId,ownerType:'school',ownerId:COMMUNITY_FUND_ACCOUNT_ID,balanceMinor:0,version:0,lastJournalId:null,status:'active',schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    // Business tax (§23) taxes revenue, not balance — the same reasoning as income tax
    // (finance.ts computeIncomeTax). PURCHASE journals have no `period` field (unlike SALARY), so
    // this reads each business's own entries subcollection (already scoped small, D-65) rather
    // than querying the whole school's journals, and buckets by postedAt's calendar month.
    async previewBusinessTax(period,rateBp){
      teacher();
      const businessesSnap=await getDocsFromServer(query(collection(db,schoolPath(context,'businesses')),limit(100)));
      const businesses=businessesSnap.docs.map(d=>({...d.data(),id:d.id} as Business));
      const items:BusinessTaxPreviewItem[]=[];
      for(const b of businesses){
        const entriesSnap=await getDocsFromServer(query(collection(ref('accounts',b.id),'entries'),orderBy('postedAt','desc'),limit(100)));
        let revenueMinor=0;
        for(const d of entriesSnap.docs){
          const e=d.data() as {type:string;deltaMinor:number;postedAt:Timestamp};
          if(e.type!=='PURCHASE'||e.deltaMinor<=0)continue;
          const dt=e.postedAt.toDate();
          if(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`===period)revenueMinor+=e.deltaMinor;
        }
        if(revenueMinor<=0)continue;
        const amountMinor=computeBusinessTax(revenueMinor,rateBp);
        if(amountMinor<=0)continue;
        items.push({businessId:b.id,businessName:b.name,revenueMinor,amountMinor,period,journalId:businessTaxJournalId(b.id,period),alreadyPaid:false});
      }
      const checks=await Promise.all(items.map(it=>getDocFromServer(ref('journals',it.journalId))));
      return items.map((it,i)=>({...it,alreadyPaid:checks[i].exists()}));
    },
    async settleBusinessTax(items){
      teacher();
      let paid=0,skipped=0,failed=0;
      for(const item of items){
        if(item.alreadyPaid){skipped++;continue}
        try{
          await runTransaction(db,async tx=>{
            const journalRef=ref('journals',item.journalId);
            if((await tx.get(journalRef)).exists())return;
            const fundRef=ref('accounts',COMMUNITY_FUND_ACCOUNT_ID),businessAccountRef=ref('accounts',item.businessId);
            const [fund,businessAccount]=await Promise.all([tx.get(fundRef),tx.get(businessAccountRef)]);
            if(!fund.exists())throw new Error('공동기금 계좌가 준비되지 않았습니다. 먼저 계좌를 준비해 주세요.');
            if(!businessAccount.exists()||businessAccount.data().balanceMinor<item.amountMinor)throw new Error('잔액이 부족합니다.');
            tx.set(journalRef,{schoolId:context.schoolId,type:'BUSINESS_TAX',businessId:item.businessId,period:item.period,debitAccountId:item.businessId,creditAccountId:COMMUNITY_FUND_ACCOUNT_ID,amountMinor:item.amountMinor,postedBy:context.uid,schemaVersion:1,createdAt:serverTimestamp()});
            const businessAfter=businessAccount.data().balanceMinor-item.amountMinor;
            tx.update(businessAccountRef,{balanceMinor:businessAfter,version:businessAccount.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(businessAccountRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'BUSINESS_TAX',deltaMinor:-item.amountMinor,balanceAfterMinor:businessAfter,label:'사업 세금',postedAt:serverTimestamp()});
            const fundAfter=fund.data().balanceMinor+item.amountMinor;
            tx.update(fundRef,{balanceMinor:fundAfter,version:fund.data().version+1,lastJournalId:item.journalId,updatedAt:serverTimestamp()});
            tx.set(doc(collection(fundRef,'entries'),item.journalId),{schoolId:context.schoolId,journalId:item.journalId,type:'BUSINESS_TAX',deltaMinor:item.amountMinor,balanceAfterMinor:fundAfter,label:`사업 세금 · ${item.businessName}`,postedAt:serverTimestamp()});
            tx.set(ref('auditLogs',crypto.randomUUID()),{schoolId:context.schoolId,actorUid:context.uid,action:'business_tax',targetType:'journal',targetId:item.journalId,detail:`${item.businessName} · ${item.amountMinor}`,createdAt:serverTimestamp()});
          });
          paid++;
        }catch{failed++}
      }
      return {paid,skipped,failed};
    },
  };
}
