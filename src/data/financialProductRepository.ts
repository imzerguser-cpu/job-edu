import {collection,doc,getDocsFromServer,limit,query,runTransaction,serverTimestamp,where} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import {validateFinancialProduct,type FinancialProduct,type FinancialProductKind} from '../domain/finance';

export interface FinancialProductStore {
  listProducts(kind?:FinancialProductKind):Promise<FinancialProduct[]>;
  createProduct(kind:FinancialProductKind,input:Omit<FinancialProduct,'id'|'schoolId'|'kind'|'schemaVersion'>):Promise<void>;
  closeProduct(id:string):Promise<void>;
}

// Shared by savings and loans (they configure the same shape — rate/term/amount range +
// status — see docs/DECISIONS.md D-48/D-52): one collection, filtered by `kind`.
export function firestoreFinancialProducts(db:Firestore,context:SchoolContext):FinancialProductStore{
  const ref=(id:string)=>doc(collection(db,schoolPath(context,'financialProducts')),id);
  const teacher=()=>{if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.')};
  return {
    async listProducts(kind){
      const filters=kind?[where('kind','==',kind)]:[];
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'financialProducts')),...filters,limit(100)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as FinancialProduct));
    },
    async createProduct(kind,input){
      teacher();
      const product={kind,...input};
      validateFinancialProduct(product);
      await runTransaction(db,async tx=>{
        tx.set(ref(crypto.randomUUID()),{schoolId:context.schoolId,...product,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      });
    },
    async closeProduct(id){
      teacher();
      await runTransaction(db,async tx=>{
        const old=await tx.get(ref(id));
        if(!old.exists())throw new Error('상품을 찾을 수 없습니다.');
        tx.update(ref(id),{status:'closed',updatedAt:serverTimestamp()});
      });
    },
  };
}
