import {describe,it,expect} from 'vitest';
import {
  canVote,canClose,canDecide,passedVote,validateJobFields,validateBusinessFields,validateSimpleFields,validateProposalComment,entityIdOf,
  type JobProposalFields,type BusinessProposalFields,type SimpleProposalFields,type Proposal,
} from '../src/domain/proposals';
const jobFields=(over:Partial<JobProposalFields>={}):JobProposalFields=>({title:'번역가',purpose:'외국 친구를 도와요',tasks:'통역, 번역',beneficiary:'전학생',suggestedSalaryMinor:20000,tools:'사전',reason:'필요해요',...over});
const bizFields=(over:Partial<BusinessProposalFields>={}):BusinessProposalFields=>({name:'분식집',product:'떡볶이',customers:'전교생',price:'500원',capital:'10000',staffNeeded:'2명',expectedRevenue:'많이',expectedCost:'재료비',advantages:'맛있음',risks:'재고 관리',...over});
const proposal=(over:Partial<Proposal>={}):Proposal=>({id:'p1',schoolId:'a',type:'job',authorStudentId:'one',fields:jobFields(),status:'submitted',deadlineAt:null,minParticipation:50,approvalThreshold:50,tallyYes:0,tallyNo:0,tallyTotal:0,decisionNote:'',reviewerUid:null,createdEntityId:null,schemaVersion:1,...over});
describe('제안 필드 검증',()=>{
  it('직업 제안의 필수 항목 누락을 거부한다',()=>{
    expect(()=>validateJobFields(jobFields({title:''}))).toThrow();
    expect(()=>validateJobFields(jobFields({purpose:''}))).toThrow();
    expect(()=>validateJobFields(jobFields({suggestedSalaryMinor:-1}))).toThrow();
  });
  it('올바른 직업 제안은 통과한다',()=>{expect(()=>validateJobFields(jobFields())).not.toThrow()});
  it('사업 제안의 필수 항목 누락을 거부한다',()=>{
    expect(()=>validateBusinessFields(bizFields({name:''}))).toThrow();
    expect(()=>validateBusinessFields(bizFields({product:''}))).toThrow();
  });
  it('올바른 사업 제안은 통과한다',()=>{expect(()=>validateBusinessFields(bizFields())).not.toThrow()});
});
describe('제안 상태 전이',()=>{
  it('투표 중이고 마감 전이어야 투표할 수 있다',()=>{
    expect(canVote(proposal({status:'voting',deadlineAt:new Date(Date.now()+86400000).toISOString()}))).toBe(true);
    expect(canVote(proposal({status:'voting',deadlineAt:new Date(Date.now()-1000).toISOString()}))).toBe(false);
    expect(canVote(proposal({status:'submitted'}))).toBe(false);
  });
  it('마감 시각이 지나야 집계할 수 있다',()=>{
    expect(canClose(proposal({status:'voting',deadlineAt:new Date(Date.now()-1000).toISOString()}))).toBe(true);
    expect(canClose(proposal({status:'voting',deadlineAt:new Date(Date.now()+86400000).toISOString()}))).toBe(false);
  });
  it('집계 완료 상태에서만 결정할 수 있다',()=>{
    expect(canDecide(proposal({status:'closed'}))).toBe(true);
    expect(canDecide(proposal({status:'voting'}))).toBe(false);
  });
});
describe('투표 통과 판정',()=>{
  it('최소 참여율 미달이면 통과하지 않는다',()=>{
    const p=proposal({status:'closed',minParticipation:50,approvalThreshold:50,tallyYes:5,tallyNo:0,tallyTotal:5});
    expect(passedVote(p,40)).toBe(false); // 5/40=12.5% < 50%
  });
  it('참여율은 충족해도 찬성 비율이 기준 미달이면 통과하지 않는다',()=>{
    const p=proposal({status:'closed',minParticipation:10,approvalThreshold:60,tallyYes:5,tallyNo:5,tallyTotal:10});
    expect(passedVote(p,20)).toBe(false); // 50% < 60%
  });
  it('참여율과 찬성 비율을 모두 충족하면 통과한다',()=>{
    const p=proposal({status:'closed',minParticipation:10,approvalThreshold:50,tallyYes:7,tallyNo:3,tallyTotal:10});
    expect(passedVote(p,20)).toBe(true);
  });
});
describe('승인 생성물 식별자',()=>{
  it('제안 ID에서 결정적으로 생성한다',()=>{expect(entityIdOf('p1')).toBe('proposal-p1');expect(entityIdOf('p1')).toBe(entityIdOf('p1'))});
});
describe('규칙/행사/학교개선 제안 필드 검증',()=>{
  const simple=(over:Partial<SimpleProposalFields>={}):SimpleProposalFields=>({title:'실내화 착용 규칙',description:'복도에서도 실내화를 신어요',reason:'안전을 위해',...over});
  it('필수 항목 누락을 거부한다',()=>{
    expect(()=>validateSimpleFields(simple({title:''}))).toThrow();
    expect(()=>validateSimpleFields(simple({description:''}))).toThrow();
    expect(()=>validateSimpleFields(simple({reason:''}))).toThrow();
  });
  it('올바른 제안은 통과한다',()=>{expect(()=>validateSimpleFields(simple())).not.toThrow()});
});
describe('시민 의견(댓글) 검증',()=>{
  it('빈 내용이나 과도한 길이를 거부한다',()=>{
    expect(()=>validateProposalComment('')).toThrow();
    expect(()=>validateProposalComment('x'.repeat(501))).toThrow();
    expect(()=>validateProposalComment('좋은 생각이에요')).not.toThrow();
  });
});
