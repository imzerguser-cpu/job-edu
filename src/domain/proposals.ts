export type ProposalType='job'|'business'|'rule'|'event'|'community';
export type ProposalStatus='draft'|'submitted'|'voting'|'closed'|'approved'|'rejected';
export interface JobProposalFields {title:string;purpose:string;tasks:string;beneficiary:string;suggestedSalaryMinor:number;tools:string;reason:string}
export interface BusinessProposalFields {name:string;product:string;customers:string;price:string;capital:string;staffNeeded:string;expectedRevenue:string;expectedCost:string;advantages:string;risks:string}
// RULE/EVENT/COMMUNITY proposals don't create a new system entity on approval (no job/business
// document to fill in) — they're a "the class adopts this idea" decision, so they share one
// simple shape instead of each inventing operational fields nothing will ever read.
export interface SimpleProposalFields {title:string;description:string;reason:string}
export interface Proposal {
  id:string;schoolId:string;type:ProposalType;authorStudentId:string;
  fields:JobProposalFields|BusinessProposalFields|SimpleProposalFields;
  status:ProposalStatus;
  deadlineAt:string|null;minParticipation:number;approvalThreshold:number;
  tallyYes:number;tallyNo:number;tallyTotal:number;
  decisionNote:string;reviewerUid:string|null;createdEntityId:string|null;
  schemaVersion:1;
}
export interface ProposalComment {id:string;schoolId:string;authorUid:string;authorStudentId:string|null;text:string}
export const proposalTypeNames:Record<ProposalType,string>={job:'새 직업 제안',business:'새 사업 제안',rule:'새 규칙 제안',event:'행사 제안',community:'학교 개선 제안'};
export const proposalStatusNames:Record<ProposalStatus,string>={draft:'초안',submitted:'검토 대기',voting:'투표 중',closed:'집계 완료',approved:'승인',rejected:'반려'};
export function entityIdOf(proposalId:string){return `proposal-${proposalId}`}
function nonEmpty(s:string,max:number){return typeof s==='string'&&s.trim().length>0&&s.length<=max}
function within(s:string,max:number){return typeof s==='string'&&s.length<=max}
export function validateJobFields(f:JobProposalFields){
  if(!nonEmpty(f.title,60))throw new Error('직업 이름을 1~60자로 적어 주세요.');
  if(!nonEmpty(f.purpose,1000))throw new Error('어떤 일을 하는지 1~1000자로 적어 주세요.');
  if(!nonEmpty(f.tasks,1000))throw new Error('구체적인 업무를 1~1000자로 적어 주세요.');
  if(!within(f.beneficiary,500))throw new Error('누구에게 도움이 되는지 500자 이하로 적어 주세요.');
  if(!Number.isInteger(f.suggestedSalaryMinor)||f.suggestedSalaryMinor<0||f.suggestedSalaryMinor>1_000_000)throw new Error('예상 급여를 확인해 주세요.');
  if(!within(f.tools,500))throw new Error('필요한 도구를 500자 이하로 적어 주세요.');
  if(!nonEmpty(f.reason,1000))throw new Error('추천 이유를 1~1000자로 적어 주세요.');
}
export function validateBusinessFields(f:BusinessProposalFields){
  if(!nonEmpty(f.name,60))throw new Error('사업 이름을 1~60자로 적어 주세요.');
  if(!nonEmpty(f.product,500))throw new Error('상품/서비스를 1~500자로 적어 주세요.');
  for(const [k,max] of [['customers',500],['price',200],['capital',200],['staffNeeded',200],['expectedRevenue',500],['expectedCost',500],['advantages',1000],['risks',1000]] as const)
    if(!within((f as unknown as Record<string,string>)[k],max))throw new Error('입력한 내용의 길이를 확인해 주세요.');
}
export function validateSimpleFields(f:SimpleProposalFields){
  if(!nonEmpty(f.title,60))throw new Error('제목을 1~60자로 적어 주세요.');
  if(!nonEmpty(f.description,1000))throw new Error('내용을 1~1000자로 적어 주세요.');
  if(!nonEmpty(f.reason,1000))throw new Error('제안 이유를 1~1000자로 적어 주세요.');
}
export function validateProposalComment(text:string){
  if(!text.trim()||text.length>500)throw new Error('의견을 1~500자로 적어 주세요.');
}
export function canVote(p:Proposal){return p.status==='voting'&&(!p.deadlineAt||Date.now()<new Date(p.deadlineAt).getTime())}
export function canClose(p:Proposal){return p.status==='voting'&&!!p.deadlineAt&&Date.now()>=new Date(p.deadlineAt).getTime()}
export function canDecide(p:Proposal){return p.status==='closed'}
export function passedVote(p:Proposal,eligibleVoters:number){
  if(eligibleVoters<=0)return false;
  const participation=Math.round((p.tallyTotal/eligibleVoters)*100);
  if(participation<p.minParticipation)return false;
  const approval=p.tallyTotal>0?Math.round((p.tallyYes/p.tallyTotal)*100):0;
  return approval>=p.approvalThreshold;
}
