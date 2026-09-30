// 학생끼리 서로 돕고 칭찬하고 함께 목표를 이루는 "작은 사회" 기능의 규칙.

// ── 도움 요청 게시판(의뢰) ──
// open(모집 중) → accepted(누가 맡음) → done(해냈다고 알림) → confirmed(요청자가 확인) → paid(보상 받음)
// 보상이 0이면 confirmed를 건너뛰고 바로 paid. 요청자는 open일 때, 교사는 paid/confirmed 전까지 취소(환불).
// 보상금은 요청을 올리는 순간 발행 계좌에 맡겨 둔다(에스크로) — 돈이 없으면 요청할 수 없고,
// 요청자가 나중에 돈을 다 써 버려서 도와준 친구가 못 받는 일이 생기지 않는다.
export type HelpStatus='open'|'accepted'|'done'|'confirmed'|'paid'|'cancelled';
export interface HelpRequest {id:string;schoolId:string;requesterStudentId:string;title:string;description:string;rewardMinor:number;status:HelpStatus;helperStudentId:string|null;doneNote:string;schemaVersion:1;createdAt?:string}
export const helpStatusNames:Record<HelpStatus,string>={open:'도와줄 친구 찾는 중',accepted:'친구가 돕는 중',done:'확인 기다리는 중',confirmed:'보상 받을 수 있음',paid:'완료',cancelled:'취소됨'};
export const MAX_HELP_REWARD_MINOR=100_000; // 1,000(화폐 단위)
export function validateHelpRequest(title:string,description:string,rewardMinor:number){
  if(!title.trim()||title.trim().length>60)throw new Error('부탁 제목을 1~60자로 적어 주세요.');
  if(description.trim().length>500)throw new Error('자세한 설명은 500자 이하로 적어 주세요.');
  if(!Number.isInteger(rewardMinor)||rewardMinor<0||rewardMinor>MAX_HELP_REWARD_MINOR)throw new Error('보상은 0~1,000 사이로 정해 주세요.');
}
export function helpEscrowJournalId(id:string){return `helpEscrow~${id}`}
export function helpRefundJournalId(id:string){return `helpRefund~${id}`}
export function helpRewardJournalId(id:string){return `helpReward~${id}`}

// ── 칭찬 스티커 ──
// 같은 친구에게는 하루 한 번(UTC 날짜 기준 — Rules가 request.time으로 같은 id를 다시 계산한다).
export const praiseCategories={help:{icon:'🤝',name:'도와줘서 고마워'},kind:{icon:'💗',name:'친절해요'},effort:{icon:'💪',name:'열심히 해요'},idea:{icon:'💡',name:'좋은 생각이에요'},teamwork:{icon:'👫',name:'협동을 잘해요'}} as const;
export type PraiseCategory=keyof typeof praiseCategories;
export interface Praise {id:string;schoolId:string;fromStudentId:string;toStudentId:string;category:PraiseCategory;message:string;schemaVersion:1}
export function praiseId(from:string,to:string,now=new Date()){return `${from}~${to}~${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()}`}
export function validatePraise(from:string,to:string,category:string,message:string){
  if(!to)throw new Error('칭찬할 친구를 골라 주세요.');
  if(from===to)throw new Error('나 자신에게는 칭찬 스티커를 보낼 수 없어요.');
  if(!Object.hasOwn(praiseCategories,category))throw new Error('칭찬 종류를 골라 주세요.');
  if(!message.trim()||message.trim().length>100)throw new Error('칭찬 한마디를 1~100자로 적어 주세요.');
}

// ── 학급 공동 목표 ──
// 진행도는 교사가 "진행도 새로 계산"을 누를 때 전체 기록에서 다시 센다(학생은 다른 친구 기록을
// 못 읽으므로). 목표를 만든 시점의 값을 baseline으로 저장해, 그 뒤에 쌓인 것만 센다.
export const goalMetrics={taskSubmissions:'업무 제출 횟수',praises:'칭찬 스티커 수',helpsCompleted:'도움 완료 수',manual:'선생님이 직접 입력'} as const;
export type GoalMetric=keyof typeof goalMetrics;
export interface ClassGoal {id:string;schoolId:string;title:string;metric:GoalMetric;target:number;baseline:number;progress:number;rewardText:string;status:'active'|'achieved'|'archived';schemaVersion:1}
export function validateGoal(g:Pick<ClassGoal,'title'|'metric'|'target'|'rewardText'>){
  if(!g.title.trim()||g.title.trim().length>60)throw new Error('목표 이름을 1~60자로 적어 주세요.');
  if(!Object.hasOwn(goalMetrics,g.metric))throw new Error('무엇을 셀지 골라 주세요.');
  if(!Number.isInteger(g.target)||g.target<1||g.target>100000)throw new Error('목표 숫자는 1~100000 사이여야 해요.');
  if(g.rewardText.trim().length>100)throw new Error('달성 보상은 100자 이하로 적어 주세요.');
}
export function goalProgress(g:Pick<ClassGoal,'progress'|'target'>){return Math.max(0,Math.min(1,g.progress/g.target))}
