import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,serverTimestamp,Timestamp,type Firestore} from 'firebase/firestore';
import {firestoreFinance} from '../src/data/financeRepository';
import {firestoreTasks} from '../src/data/taskRepository';
import {firestoreCommunity} from '../src/data/communityRepository';
import {firestoreCareerProfiles} from '../src/data/careerProfileRepository';
import {pairId,starterJobs} from '../src/domain/jobs';
import {hollandCode,scoreInterest,scoreStrengths,type Discovery} from '../src/domain/careerDiscovery';
import type {SchoolContext} from '../src/domain/model';

let env:RulesTestEnvironment;
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
const ctx=(role:'student'|'teacher',studentId='one'):SchoolContext=>({schoolId:'a',uid:role==='teacher'?'teacher-a':`a-${studentId}`,membership:{schoolId:'a',role,studentId:role==='student'?studentId:null,status:'active'}});
const finance=(role:'student'|'teacher',id='one')=>{const c=ctx(role,id);return firestoreFinance(db(c.uid),c)};
const tasks=(role:'student'|'teacher',id='one')=>{const c=ctx(role,id);return firestoreTasks(db(c.uid),c)};
const community=(role:'student'|'teacher',id='one')=>{const c=ctx(role,id);return firestoreCommunity(db(c.uid),c)};
const profiles=(role:'student'|'teacher',id='one')=>{const c=ctx(role,id);return firestoreCareerProfiles(db(c.uid),c)};
const balance=async(id:string)=>(await finance('student',id).myAccount())?.balanceMinor??0;

beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-little-society',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const d=c.firestore();
  await setDoc(doc(d,'schools/a'),{schoolId:'a',status:'active'});
  await setDoc(doc(d,'schools/a/members/teacher-a'),{schoolId:'a',role:'teacher',studentId:null,status:'active'});
  for(const id of ['one','two','three']){
    await setDoc(doc(d,`schools/a/members/a-${id}`),{schoolId:'a',role:'student',studentId:id,status:'active'});
    await setDoc(doc(d,`schools/a/students/${id}`),{schoolId:'a',name:id,grade:3,status:'active'});
  }
  for(const {id,...j} of starterJobs('a'))await setDoc(doc(d,`schools/a/jobs/${id}`),{...j,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  // "one"은 월급 500(50000)을 받는 은행원, "three"는 기자(업무 보상 테스트용). "two"는 계좌 없음.
  await setDoc(doc(d,`schools/a/jobAssignments/${pairId('bank','one')}`),{schoolId:'a',jobId:'bank',studentId:'one',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:'teacher-a',updatedAt:Timestamp.now()});
  await setDoc(doc(d,`schools/a/jobAssignments/${pairId('reporter','three')}`),{schoolId:'a',jobId:'reporter',studentId:'three',status:'active',schemaVersion:1,startAt:Timestamp.now(),endAt:null,assignedBy:'teacher-a',updatedAt:Timestamp.now()});
})});
afterAll(async()=>{await env.cleanup()});
async function paySalary(){const t=finance('teacher');await t.ensureIssuer();await t.settleSalary(await t.previewSalary('2026-09'))}

describe('업무 완료 즉시 보상',()=>{
  it('보상이 걸린 업무를 승인하면 그 자리에서 보상이 들어오고, 계좌가 없어도 새로 생긴다',async()=>{
    await finance('teacher').ensureIssuer();
    const teacher=tasks('teacher');
    await teacher.saveTemplate({id:'news',schoolId:'a',jobId:'reporter',title:'기사 쓰기',instructions:'한 편 써요',verificationKind:'artifact',status:'active',rewardMinor:1500,schemaVersion:1});
    await teacher.assign('news','three');
    await tasks('student','three').submit('news~three','기사를 썼어요');
    const [task]=(await teacher.load()).tasks;
    await teacher.review(task,true,'');
    expect(await balance('three')).toBe(1500);
    // 다시 시작 → 다시 제출 → 다시 승인하면 새 시도로 또 받는다
    await teacher.restart({...task,status:'approved'});
    await tasks('student','three').submit('news~three','두 번째 기사');
    await teacher.review((await teacher.load()).tasks[0],true,'');
    expect(await balance('three')).toBe(3000);
  });
  it('보상이 없는(예전) 업무는 승인해도 돈이 움직이지 않는다',async()=>{
    const teacher=tasks('teacher');
    await teacher.saveTemplate({id:'old',schoolId:'a',jobId:'reporter',title:'옛 업무',instructions:'예전 업무',verificationKind:'artifact',status:'active',schemaVersion:1});
    await teacher.assign('old','three');
    await tasks('student','three').submit('old~three','했어요');
    await teacher.review((await teacher.load()).tasks[0],true,'');
    expect(await finance('student','three').myAccount()).toBeNull();
  });
  it('학생은 업무 보상 저널을 스스로 만들 수 없다',async()=>{
    await assertFails(setDoc(doc(db('a-three'),'schools/a/journals/taskReward~x~1'),{schoolId:'a',type:'TASK_REWARD',studentId:'three',taskId:'x',attempt:1,debitAccountId:'system-issuer',creditAccountId:'three',amountMinor:100,postedBy:'a-three',schemaVersion:1,createdAt:serverTimestamp()}));
  });
});

describe('도움 요청 게시판',()=>{
  it('요청 → 맡기 → 완료 → 확인 → 보상 받기: 보상은 맡겨 뒀다가 도와준 친구에게 간다(계좌 없던 친구도)',async()=>{
    await paySalary();
    await community('student','one').postHelp('게시판 꾸미기 도와줘','그림 붙이기',2000);
    expect(await balance('one')).toBe(48000);
    const [req]=await community('student','two').listHelp();
    await expect(community('student','one').acceptHelp(req.id)).rejects.toThrow();
    await community('student','two').acceptHelp(req.id);
    await community('student','two').markHelpDone(req.id,'그림 3장 붙였어요');
    await expect(community('student','two').confirmHelp(req.id)).rejects.toThrow();
    await community('student','one').confirmHelp(req.id);
    await expect(community('student','three').claimHelpReward(req.id)).rejects.toThrow();
    await community('student','two').claimHelpReward(req.id);
    expect(await balance('two')).toBe(2000);
    expect((await community('student','one').listHelp())[0].status).toBe('paid');
    await expect(community('student','two').claimHelpReward(req.id)).rejects.toThrow();
  });
  it('돈이 부족하면 보상을 걸 수 없고, 보상 없는 부탁은 확인하면 바로 끝난다',async()=>{
    await expect(community('student','two').postHelp('도와줘','',100)).rejects.toThrow();
    await community('student','two').postHelp('같이 청소해요','',0);
    const [req]=await community('student','one').listHelp();
    await community('student','one').acceptHelp(req.id);
    await community('student','one').markHelpDone(req.id,'같이 했어요');
    await community('student','two').confirmHelp(req.id);
    expect((await community('student','two').listHelp())[0].status).toBe('paid');
  });
  it('요청자는 아무도 안 맡았을 때만 취소하고, 교사는 진행 중인 부탁도 취소해 환불한다',async()=>{
    await paySalary();
    await community('student','one').postHelp('첫 번째','',1000);
    let [req]=await community('student','one').listHelp();
    await community('student','one').cancelHelp(req.id);
    expect(await balance('one')).toBe(50000);
    await community('student','one').postHelp('두 번째','',1000);
    [req]=(await community('student','one').listHelp()).filter(r=>r.status==='open');
    await community('student','two').acceptHelp(req.id);
    await expect(community('student','one').cancelHelp(req.id)).rejects.toThrow();
    await community('teacher').cancelHelp(req.id);
    expect(await balance('one')).toBe(50000);
  });
  it('보상 없이 상태만 paid로 바꾸거나, 남의 이름으로 맡을 수 없다',async()=>{
    await paySalary();
    await community('student','one').postHelp('부탁','',1000);
    const [req]=await community('student','one').listHelp();
    await assertFails(updateDoc(doc(db('a-two'),`schools/a/helpRequests/${req.id}`),{status:'accepted',helperStudentId:'three',updatedAt:serverTimestamp()}));
    await community('student','two').acceptHelp(req.id);
    await community('student','two').markHelpDone(req.id,'했어요');
    await community('student','one').confirmHelp(req.id);
    await assertFails(updateDoc(doc(db('a-two'),`schools/a/helpRequests/${req.id}`),{status:'paid',updatedAt:serverTimestamp()}));
  });
});

describe('칭찬 스티커',()=>{
  it('친구에게 하루 한 번 보낼 수 있고, 모두가 칭찬 나무를 본다',async()=>{
    await community('student','one').sendPraise('two','help','도와줘서 고마워!');
    await expect(community('student','one').sendPraise('two','kind','또 고마워')).rejects.toThrow();
    await community('student','three').sendPraise('two','effort','최고야');
    expect(await community('student','two').praisesReceived('two')).toBe(2);
    expect(await community('student','three').listPraises()).toHaveLength(2);
  });
  it('나 자신에게 보내거나 id 날짜를 속일 수 없다',async()=>{
    await expect(community('student','one').sendPraise('one','help','나 최고')).rejects.toThrow();
    await assertFails(setDoc(doc(db('a-one'),'schools/a/praises/one~two~2000-1-1'),{schoolId:'a',fromStudentId:'one',toStudentId:'two',category:'help',message:'옛날 칭찬',schemaVersion:1,createdAt:serverTimestamp()}));
  });
});

describe('학급 공동 목표',()=>{
  it('교사가 만들면 목표 뒤에 쌓인 것만 세고, 학생은 보기만 한다',async()=>{
    await community('student','one').sendPraise('two','help','미리 보낸 칭찬');
    await community('teacher').createGoal({title:'칭찬 2개 모으기',metric:'praises',target:2,rewardText:'칭찬 파티'});
    await expect(community('student','one').createGoal({title:'x',metric:'manual',target:1,rewardText:''})).rejects.toThrow();
    await community('student','two').sendPraise('one','kind','고마워');
    await community('student','three').sendPraise('one','idea','좋은 생각');
    await community('teacher').refreshGoals();
    const [goal]=await community('student','one').listGoals();
    expect(goal).toMatchObject({baseline:1,progress:2,status:'achieved'});
  });
});

describe('나를 찾는 모험(진로 자기이해)',()=>{
  const sample=():Discovery=>{
    const answers=Object.fromEntries(['R0','I0','A0','S0','E0','C0','R1','I1','A1','S1','E1','C1'].map(id=>[id,id.startsWith('A')?2:id.startsWith('S')?1:0]));
    const interest=scoreInterest('low',answers);
    return {band:'low',interest,strengths:scoreStrengths('low',{music0:2}),values:[],code:hollandCode(interest),reflection:'노래가 좋아요'};
  };
  it('할 때마다 회차가 늘고 이력이 쌓이며, 본인과 교사만 본다',async()=>{
    const me=profiles('student','one');
    await me.save(sample());
    await me.save({...sample(),reflection:'그림도 좋아요'});
    const profile=await me.myProfile();
    expect(profile).toMatchObject({code:'AS',completions:2,reflection:'그림도 좋아요'});
    expect(await me.myHistory()).toHaveLength(2);
    await assertFails(getDoc(doc(db('a-two'),'schools/a/careerProfiles/one')));
    expect(await profiles('teacher').classProfiles()).toHaveLength(1);
  });
  it('회차를 건너뛰거나 이력 없이 결과만 바꿀 수 없다',async()=>{
    await profiles('student','one').save(sample());
    const s=sample();
    await assertFails(setDoc(doc(db('a-one'),'schools/a/careerProfiles/one'),{schoolId:'a',studentId:'one',...s,completions:5,schemaVersion:1,createdAt:Timestamp.now(),updatedAt:serverTimestamp()}));
  });
});
