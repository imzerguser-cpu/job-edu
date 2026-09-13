import type {SchoolContext} from './model';
export const departments = [
  {id:'economy',name:'경제·관리국',icon:'economic_management'},
  {id:'media',name:'미디어·디지털국',icon:'media_digital'},
  {id:'life',name:'생활·환경국',icon:'life_environment'},
  {id:'culture',name:'문화·기획국',icon:'culture_planning'},
] as const;
export const statuses = {preparing:'준비 중',recruiting:'모집 중',active:'운영 중',paused:'일시 중지',closed:'운영 종료'} as const;
export type JobState=keyof typeof statuses;
export interface Career {id:string;schoolId:string;departmentId:string;name:string;description:string;core:boolean;status:JobState;recommendedGrades:number[];icon:string;salaryMinor:number;schemaVersion:1}
export interface Application {id:string;schoolId:string;jobId:string;studentId:string;reason:string;status:'submitted'|'approved'|'rejected';reviewNote:string;reviewerUid:string|null}
export interface Assignment {id:string;schoolId:string;jobId:string;studentId:string;status:'active'|'ended'}
export interface CareerData {jobs:Career[];applications:Application[];assignments:Assignment[]}
export const jobIcons=['banker','tax_accounting','store_manager','cafe_worker','real_estate','business_manager','journalist','photographer','writer','webtoon_artist','painter','digital_manager','dj','library_manager','environment_manager','plant_manager','safety_manager','rules_manager','milk_delivery','parcel_delivery','school_notice','noticeboard_manager','event_planner','music','singer','dancer','board_game','culture_play'];
export const iconNames:Record<string,string>=Object.fromEntries(jobIcons.map((icon,i)=>[icon,['은행','세무·회계','상점','카페','부동산','사업 관리','기자','사진작가','작가','웹툰작가','화가','디지털 관리','DJ','도서관','환경관리','식물관리','안전관리','규칙관리','우유 배달','택배','가정통신문','게시판','행사기획','음악','가수','댄서','보드게임','문화·놀이'][i]]));
export function pairId(jobId:string,studentId:string){
  for(const id of [jobId,studentId])if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('직업 또는 시민 식별자를 확인해 주세요.');
  return `${jobId}~${studentId}`;
}
export function validateCareer(job:Career){
  if(!departments.some(d=>d.id===job.departmentId)||!Object.hasOwn(statuses,job.status))throw Error('국과 운영 상태를 선택해 주세요.');
  if(!job.name.trim()||job.name.length>60||!job.description.trim()||job.description.length>1000)throw Error('직업 이름과 하는 일을 확인해 주세요.');
  if(!job.recommendedGrades.length||job.recommendedGrades.some(g=>!Number.isInteger(g)||g<1||g>6)||new Set(job.recommendedGrades).size!==job.recommendedGrades.length)throw Error('권장 학년을 한 개 이상 선택해 주세요.');
  if(!jobIcons.includes(job.icon))throw Error('직업 아이콘을 선택해 주세요.');
  if(!Number.isInteger(job.salaryMinor)||job.salaryMinor<0||job.salaryMinor>1_000_000)throw Error('월급 금액을 확인해 주세요.');
}
export function canAssign(job:Career){return job.status==='recruiting'||job.status==='active'}
export function assertApplicant(context:SchoolContext){if(context.membership.status!=='active'||context.membership.role!=='student'||!context.membership.studentId)throw Error('학생 계정으로 신청해 주세요.');return context.membership.studentId}
export function starterJobs(schoolId:string):Career[]{
  const items=[
    ['bank','economy','은행원','거래 내역을 확인하고 친구들의 금융생활을 도와요.','banker',true,[5,6],50000],
    ['reporter','media','기자','학교의 소식을 취재하고 기사를 써요.','journalist',false,[3,4,5,6],30000],
    ['garden','life','식물관리원','화분을 살피고 식물이 잘 자라도록 돌봐요.','plant_manager',true,[1,2,3],20000],
    ['library','life','도서관 관리원','책을 정리하고 책을 빌리는 친구들을 도와요.','library_manager',true,[1,2,3,4],20000],
    ['events','culture','행사기획자','친구들의 의견을 모아 학교 행사를 준비해요.','event_planner',false,[3,4,5,6],30000],
    ['store','economy','상점 관리원','물건을 정리하고 판매 활동을 도와요.','store_manager',false,[3,4,5,6],30000],
  ] as const;
  return items.map(([id,departmentId,name,description,icon,core,grades,salaryMinor])=>({id,schoolId,departmentId,name,description,icon,core,recommendedGrades:[...grades],salaryMinor,status:'recruiting',schemaVersion:1}));
}
