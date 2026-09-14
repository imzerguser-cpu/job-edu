// 과태료(§24): 규칙 위반 보고 → 교사 확인 → 과태료 결정 → 시스템 생성 → 학생 납부 → 금융 기록.
// 학생이 임의로 과태료를 부과하지 못하므로, 신고(누구나) 자체는 아무 금융 효과가 없고 교사의
// 결정(decide)만이 실제로 FINE 저널을 만든다 — 소득세/사업세와 같은 신뢰 등급(교사 세션 실행).
export interface ViolationReport {
  id:string;schoolId:string;reporterUid:string;targetStudentId:string;description:string;
  status:'submitted'|'fined'|'dismissed';fineAmountMinor:number|null;decisionNote:string;journalId:string|null;
  schemaVersion:1;
}
export function validateReportDescription(description:string){
  if(!description.trim()||description.length>500)throw new Error('신고 내용을 1~500자로 적어 주세요.');
}
export function validateFineAmount(amountMinor:number){
  if(!Number.isInteger(amountMinor)||amountMinor<=0||amountMinor>100000)throw new Error('과태료 금액을 확인해 주세요.');
}
export function fineJournalId(reportId:string){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(reportId))throw new Error('신고 식별자를 확인해 주세요.');
  return `fine~${reportId}`;
}
export const violationStatusNames:Record<ViolationReport['status'],string>={submitted:'검토 대기',fined:'과태료 부과',dismissed:'기각됨'};
