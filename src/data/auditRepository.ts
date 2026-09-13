import {collection,getDocsFromServer,limit,orderBy,query} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {isTeacher,schoolPath,type SchoolContext} from '../domain/model';
import type {AuditLog} from '../domain/audit';
export interface AuditStore {
  loadRecent():Promise<AuditLog[]>;
}
export function firestoreAudit(db:Firestore,context:SchoolContext):AuditStore{
  return {
    async loadRecent(){
      if(!isTeacher(context.membership))throw new Error('교사 권한이 필요합니다.');
      const snap=await getDocsFromServer(query(collection(db,schoolPath(context,'auditLogs')),orderBy('createdAt','desc'),limit(50)));
      return snap.docs.map(d=>({...d.data(),id:d.id} as AuditLog));
    },
  };
}
