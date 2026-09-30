export type VerificationKind='artifact'|'photo'|'system';
export type TaskStatus='assigned'|'submitted'|'approved'|'revision_requested';
export interface TaskTemplate {id:string;schoolId:string;jobId:string;title:string;instructions:string;verificationKind:VerificationKind;status:'active'|'archived';schemaVersion:1;
  // 승인 즉시 받는 완료 보상(없으면 0 — 이 필드가 생기기 전에 만든 업무도 0으로 본다).
  rewardMinor?:number}
export interface Task {id:string;schoolId:string;templateId:string;jobId:string;assigneeStudentId:string;verificationKind:VerificationKind;status:TaskStatus;attempt:number;submissionText:string;reviewNote:string;reviewerUid:string|null;schemaVersion:1}
export interface TaskData {templates:TaskTemplate[];tasks:Task[]}
// One immutable snapshot per submit()/submitPhoto() attempt (D-89) — the task doc itself only
// ever keeps the latest submissionText, overwritten on resubmission. Photo bytes are never
// archived here (D-37 keeps those short-lived and deleted at review time); only the caption text.
export interface TaskSubmissionEntry {id:string;schoolId:string;taskId:string;studentId:string;attempt:number;verificationKind:VerificationKind;submissionText:string;submittedAt:string}
export const verificationKindNames:Record<VerificationKind,string>={artifact:'결과물 제출',photo:'사진 인증',system:'자동 인증(다음 단계)'};
export const taskStatusNames:Record<TaskStatus,string>={assigned:'수행 중',submitted:'검토 대기',approved:'완료',revision_requested:'다시 제출'};
export function validateTemplate(t:TaskTemplate){
  if(!t.title.trim()||t.title.length>60)throw new Error('업무 제목을 1~60자로 적어 주세요.');
  if(!t.instructions.trim()||t.instructions.length>1000)throw new Error('안내 내용을 1~1000자로 적어 주세요.');
  if(!(['artifact','photo','system'] as const).includes(t.verificationKind))throw new Error('인증 방식을 선택해 주세요.');
  if(!(['active','archived'] as const).includes(t.status))throw new Error('운영 상태를 확인해 주세요.');
  const reward=t.rewardMinor??0;
  if(!Number.isInteger(reward)||reward<0||reward>100_000)throw new Error('완료 보상은 0~1000 사이로 정해 주세요.');
}
export function taskRewardJournalId(taskId:string,attempt:number){return `taskReward~${taskId}~${attempt}`}
export function validateSubmission(text:string){
  const trimmed=text.trim();
  if(!trimmed||trimmed.length>2000)throw new Error('제출 내용을 1~2000자로 적어 주세요.');
  return trimmed;
}
export function canSubmit(task:Task){return task.status==='assigned'||task.status==='revision_requested'}
export function canRestart(task:Task){return task.status==='approved'}
