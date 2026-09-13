export const EVIDENCE_MAX_BASE64_LENGTH=90_000; // ~60KB binary * 4/3 plus margin
export const EVIDENCE_EXPIRY_HOURS=24;
export interface Evidence {id:string;schoolId:string;studentId:string;taskId:string;mimeType:'image/jpeg';payloadBase64:string;expiresAt:string;schemaVersion:1}
export function validateEvidence(mimeType:string,payloadBase64:string){
  if(mimeType!=='image/jpeg')throw new Error('사진 형식을 확인해 주세요.');
  if(!payloadBase64||payloadBase64.length>EVIDENCE_MAX_BASE64_LENGTH)throw new Error('사진 용량이 너무 큽니다. 다시 촬영해 주세요.');
}
