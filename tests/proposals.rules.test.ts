import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreProposals} from '../src/data/proposalRepository';
import type {SchoolContext} from '../src/domain/model';
import type {JobProposalFields,BusinessProposalFields,SimpleProposalFields} from '../src/domain/proposals';
let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const context=(role:'student'|'teacher',sid='a',studentId='one'):SchoolContext=>({schoolId:sid,uid:role==='teacher'?`teacher-${sid}`:`${sid}-${studentId}`,membership:{schoolId:sid,role,studentId:role==='student'?studentId:null,status:'active'}});
const store=(role:'student'|'teacher',sid='a',studentId='one')=>{const c=context(role,sid,studentId);return firestoreProposals(db(c.uid),c)};
const jobFields:JobProposalFields={title:'번역가',purpose:'외국 친구를 도와요',tasks:'통역, 번역',beneficiary:'전학생',suggestedSalaryMinor:20000,tools:'사전',reason:'필요해요'};
const bizFields:BusinessProposalFields={name:'분식집',product:'떡볶이',customers:'전교생',price:'500원',capital:'10000',staffNeeded:'2명',expectedRevenue:'많이',expectedCost:'재료비',advantages:'맛있음',risks:'재고 관리'};
const ruleFields:SimpleProposalFields={title:'실내화 착용 규칙',description:'복도에서도 실내화를 신어요',reason:'안전을 위해'};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const sid of ['a','b']){
    await setDoc(doc(db,`schools/${sid}`),{schoolId:sid,status:'active'});
    await setDoc(doc(db,`schools/${sid}/members/teacher-${sid}`),{schoolId:sid,role:'teacher',studentId:null,status:'active'});
    for(const id of ['one','two','three']){
      await setDoc(doc(db,`schools/${sid}/members/${sid}-${id}`),{schoolId:sid,role:'student',studentId:id,status:'active'});
      await setDoc(doc(db,`schools/${sid}/students/${id}`),{schoolId:sid,name:'가상시민',grade:1,status:'active'});
    }
  }
})});
afterAll(async()=>{await env.cleanup()});
async function votingJobProposal(deadlineDays=7,minPart=0,threshold=50){
  const student=store('student'),teacher=store('teacher');
  await student.submit('job',jobFields);
  let list=await teacher.loadProposals();
  await teacher.openVoting(list[0],deadlineDays,minPart,threshold);
  list=await teacher.loadProposals();
  return list[0];
}
describe('제안 제출',()=>{
  it('학생이 직업/사업 제안을 올린다',async()=>{
    await store('student').submit('job',jobFields);
    await store('student').submit('business',bizFields);
    const list=await store('teacher').loadProposals();
    expect(list).toHaveLength(2);
    expect(list.every(p=>p.status==='submitted')).toBe(true);
  });
  it('남의 이름으로 제안할 수 없다',async()=>{
    await assertFails(setDoc(doc(db('a-one'),'schools/a/proposals/fake'),{schoolId:'a',type:'job',authorStudentId:'two',fields:jobFields,status:'submitted',deadlineAt:null,minParticipation:0,approvalThreshold:50,tallyYes:0,tallyNo:0,tallyTotal:0,decisionNote:'',reviewerUid:null,createdEntityId:null,schemaVersion:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  });
});
describe('투표 진행',()=>{
  it('교사가 투표를 시작하고 학생이 찬반 투표한다',async()=>{
    const p=await votingJobProposal();
    expect(p.status).toBe('voting');
    await store('student','a','one').castVote(p.id,'yes');
    await store('student','a','two').castVote(p.id,'no');
    expect(await store('student','a','one').myVote(p.id)).toBe('yes');
  });
  it('같은 학생이 두 번 투표할 수 없다',async()=>{
    const p=await votingJobProposal();
    await store('student','a','one').castVote(p.id,'yes');
    await expect(store('student','a','one').castVote(p.id,'no')).rejects.toThrow();
  });
  it('마감 전에는 집계할 수 없다',async()=>{
    const p=await votingJobProposal(7);
    await expect(store('teacher').tallyVotes(p)).rejects.toThrow();
  });
  it('마감된 투표에는 참여할 수 없다',async()=>{
    const p=await votingJobProposal();
    await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`schools/a/proposals/${p.id}`),{deadlineAt:Timestamp.fromMillis(Date.now()-1000)})});
    await expect(store('student','a','one').castVote(p.id,'yes')).rejects.toThrow();
  });
  it('검토 대기 상태가 아니면 투표를 다시 시작할 수 없다',async()=>{
    const p=await votingJobProposal();
    await expect(store('teacher').openVoting(p,7,0,50)).rejects.toThrow();
  });
  it('학생은 다른 학생의 개별 투표를 볼 수 없다',async()=>{
    const p=await votingJobProposal();
    await store('student','a','one').castVote(p.id,'yes');
    await assertFails(getDoc(doc(db('a-two'),`schools/a/proposals/${p.id}/votes/a-one`)));
  });
});
describe('집계와 결정',()=>{
  async function closedJobProposal(){
    const p=await votingJobProposal(7,0,50);
    await store('student','a','one').castVote(p.id,'yes');
    await store('student','a','two').castVote(p.id,'yes');
    await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`schools/a/proposals/${p.id}`),{deadlineAt:Timestamp.fromMillis(Date.now()-1000)})});
    const expired=(await store('teacher').loadProposals())[0];
    await store('teacher').tallyVotes(expired);
    return (await store('teacher').loadProposals())[0];
  }
  it('마감 후 집계하고 승인하면 직업이 실제로 생긴다',async()=>{
    const p=await closedJobProposal();
    expect(p.status).toBe('closed');
    expect(p).toMatchObject({tallyYes:2,tallyNo:0,tallyTotal:2});
    await store('teacher').decide(p,true,'좋은 제안이에요',{departmentId:'culture',icon:'writer',recommendedGrades:[3,4,5,6]});
    const decided=(await store('teacher').loadProposals())[0];
    expect(decided.status).toBe('approved');
    expect(decided.createdEntityId).toBe(`proposal-${p.id}`);
    const jobSnap=await getDoc(doc(db('teacher-a'),`schools/a/jobs/${decided.createdEntityId}`));
    expect(jobSnap.exists()).toBe(true);
    expect(jobSnap.data()).toMatchObject({name:jobFields.title,salaryMinor:jobFields.suggestedSalaryMinor,core:false});
  });
  it('사업 제안을 승인하면 사업과 사업 계좌가 실제로 생긴다',async()=>{
    const student=store('student'),teacher=store('teacher');
    await student.submit('business',bizFields);
    let p=(await teacher.loadProposals())[0];
    await teacher.openVoting(p,7,0,50);
    p=(await teacher.loadProposals())[0];
    await store('student','a','one').castVote(p.id,'yes');
    await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`schools/a/proposals/${p.id}`),{deadlineAt:Timestamp.fromMillis(Date.now()-1000)})});
    p=(await teacher.loadProposals())[0];
    await teacher.tallyVotes(p);
    p=(await teacher.loadProposals())[0];
    await teacher.decide(p,true,'', {ownerStudentId:'one'});
    const decided=(await teacher.loadProposals())[0];
    expect(decided.status).toBe('approved');
    const bizSnap=await getDoc(doc(db('teacher-a'),`schools/a/businesses/${decided.createdEntityId}`));
    const acctSnap=await getDoc(doc(db('teacher-a'),`schools/a/accounts/${decided.createdEntityId}`));
    expect(bizSnap.data()).toMatchObject({name:bizFields.name,ownerStudentId:'one'});
    expect(acctSnap.data()).toMatchObject({ownerType:'business',balanceMinor:0});
  });
  it('반려에는 이유가 필요하고, 반려하면 아무것도 생기지 않는다',async()=>{
    const p=await closedJobProposal();
    await expect(store('teacher').decide(p,false,'')).rejects.toThrow();
    await store('teacher').decide(p,false,'예산이 부족해요');
    const decided=(await store('teacher').loadProposals())[0];
    expect(decided.status).toBe('rejected');
    expect(decided.createdEntityId).toBeNull();
  });
  it('이미 결정된 제안을 다시 승인할 수 없다(재시도 중복 생성 차단)',async()=>{
    const p=await closedJobProposal();
    await store('teacher').decide(p,true,'',{departmentId:'culture',icon:'writer',recommendedGrades:[3,4,5,6]});
    const decided=(await store('teacher').loadProposals())[0];
    await expect(store('teacher').decide(decided,true,'',{departmentId:'culture',icon:'writer',recommendedGrades:[3,4,5,6]})).rejects.toThrow();
  });
  it('학생은 상태를 위조하거나 집계 완료를 건너뛰고 결정할 수 없다',async()=>{
    const p=await votingJobProposal();
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/proposals/${p.id}`),{status:'approved',createdEntityId:'proposal-'+p.id}));
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/proposals/${p.id}`),{tallyYes:999}));
  });
  it('교사도 집계 없이 바로 승인할 수 없다',async()=>{
    const p=await votingJobProposal();
    await assertFails(updateDoc(doc(db('teacher-a'),`schools/a/proposals/${p.id}`),{status:'approved',reviewerUid:'teacher-a',decisionNote:'',createdEntityId:'proposal-'+p.id,updatedAt:serverTimestamp()}));
  });
});
describe('학교 격리',()=>{
  it('다른 학교 제안·투표에 접근할 수 없다',async()=>{
    const p=await votingJobProposal();
    await assertFails(getDoc(doc(db('teacher-b'),`schools/a/proposals/${p.id}`)));
    await assertFails(setDoc(doc(db('b-one'),`schools/a/proposals/${p.id}/votes/b-one`),{choice:'yes',createdAt:serverTimestamp()}));
  });
});
describe('규칙/행사/학교개선 제안(엔터티 생성 없음)',()=>{
  async function closedRuleProposal(){
    const student=store('student'),teacher=store('teacher');
    await student.submit('rule',ruleFields);
    let p=(await teacher.loadProposals())[0];
    await teacher.openVoting(p,7,0,50);
    p=(await teacher.loadProposals())[0];
    await store('student','a','one').castVote(p.id,'yes');
    await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),`schools/a/proposals/${p.id}`),{deadlineAt:Timestamp.fromMillis(Date.now()-1000)})});
    p=(await teacher.loadProposals())[0];
    await teacher.tallyVotes(p);
    return (await teacher.loadProposals())[0];
  }
  it('승인해도 새 직업·사업을 만들지 않고 제안 자체만 승인 상태가 된다',async()=>{
    const p=await closedRuleProposal();
    await store('teacher').decide(p,true,'좋은 규칙이에요');
    const decided=(await store('teacher').loadProposals())[0];
    expect(decided.status).toBe('approved');
    expect(decided.createdEntityId).toBeNull();
  });
  it('반려도 정상 동작한다',async()=>{
    const p=await closedRuleProposal();
    await store('teacher').decide(p,false,'다시 논의해요');
    const decided=(await store('teacher').loadProposals())[0];
    expect(decided.status).toBe('rejected');
  });
});
describe('제안 초안',()=>{
  it('학생이 초안을 저장하고 수정한 뒤 제출할 수 있다',async()=>{
    const student=store('student');
    const id=await student.saveDraft('rule',ruleFields);
    let list=await student.loadProposals();
    expect(list.find(p=>p.id===id)?.status).toBe('draft');
    await student.updateDraft(id,{...ruleFields,title:'수정된 제목'});
    list=await student.loadProposals();
    expect((list.find(p=>p.id===id)?.fields as SimpleProposalFields).title).toBe('수정된 제목');
    await student.submitDraft(id);
    list=await student.loadProposals();
    expect(list.find(p=>p.id===id)?.status).toBe('submitted');
  });
  it('남의 초안은 수정하거나 제출할 수 없다',async()=>{
    const id=await store('student','a','one').saveDraft('rule',ruleFields);
    await expect(store('student','a','two').updateDraft(id,ruleFields)).rejects.toThrow();
    await expect(store('student','a','two').submitDraft(id)).rejects.toThrow();
  });
  it('제출된(초안이 아닌) 제안은 학생이 직접 수정할 수 없다',async()=>{
    const student=store('student');
    await student.submit('rule',ruleFields);
    const [p]=await student.loadProposals();
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/proposals/${p.id}`),{fields:{...ruleFields,title:'몰래 수정'},updatedAt:serverTimestamp()}));
  });
});
describe('시민 의견(댓글)',()=>{
  it('누구나 제안에 댓글을 달고 전체 학급이 읽을 수 있다',async()=>{
    const p=await votingJobProposal();
    await store('student','a','one').postComment(p.id,'좋은 생각이에요');
    await store('teacher').postComment(p.id,'검토해 볼게요');
    const comments=await store('student','a','two').loadComments(p.id);
    expect(comments).toHaveLength(2);
    expect(comments.map(c=>c.text).sort()).toEqual(['검토해 볼게요','좋은 생각이에요']);
  });
  it('댓글은 수정하거나 삭제할 수 없다',async()=>{
    const p=await votingJobProposal();
    await store('student','a','one').postComment(p.id,'좋은 생각이에요');
    const [comment]=await store('teacher').loadComments(p.id);
    await assertFails(updateDoc(doc(db('a-one'),`schools/a/proposals/${p.id}/comments/${comment.id}`),{text:'수정 시도'}));
  });
  it('빈 댓글은 거부된다',async()=>{
    const p=await votingJobProposal();
    await expect(store('student','a','one').postComment(p.id,'')).rejects.toThrow();
  });
});
