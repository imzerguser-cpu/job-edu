import {describe,it,expect} from 'vitest';
import {validateTemplate,validateSubmission,canSubmit,canRestart,type Task,type TaskTemplate} from '../src/domain/tasks';
const template=(over:Partial<TaskTemplate>={}):TaskTemplate=>({id:'t1',schoolId:'s',jobId:'bank',title:'제목',instructions:'안내',verificationKind:'artifact',status:'active',schemaVersion:1,...over});
const task=(over:Partial<Task>={}):Task=>({id:'t1~one',schoolId:'s',templateId:'t1',jobId:'bank',assigneeStudentId:'one',verificationKind:'artifact',status:'assigned',attempt:0,submissionText:'',reviewNote:'',reviewerUid:null,schemaVersion:1,...over});
describe('업무 템플릿 검증',()=>{
  it('빈 제목·안내나 과도한 길이를 거부한다',()=>{
    expect(()=>validateTemplate(template({title:''}))).toThrow();
    expect(()=>validateTemplate(template({title:'x'.repeat(61)}))).toThrow();
    expect(()=>validateTemplate(template({instructions:''}))).toThrow();
    expect(()=>validateTemplate(template({instructions:'x'.repeat(1001)}))).toThrow();
  });
  it('올바른 템플릿은 통과한다',()=>{expect(()=>validateTemplate(template())).not.toThrow()});
});
describe('제출 검증',()=>{
  it('빈 내용이나 2000자 초과를 거부한다',()=>{
    expect(()=>validateSubmission('   ')).toThrow();
    expect(()=>validateSubmission('x'.repeat(2001))).toThrow();
  });
  it('앞뒤 공백을 정리한다',()=>{expect(validateSubmission('  안녕  ')).toBe('안녕')});
});
describe('업무 상태 전이',()=>{
  it('assigned·revision_requested에서만 제출할 수 있다',()=>{
    for(const status of ['assigned','revision_requested'] as const)expect(canSubmit(task({status}))).toBe(true);
    for(const status of ['submitted','approved'] as const)expect(canSubmit(task({status}))).toBe(false);
  });
  it('approved 상태에서만 다시 시작할 수 있다',()=>{
    expect(canRestart(task({status:'approved'}))).toBe(true);
    for(const status of ['assigned','submitted','revision_requested'] as const)expect(canRestart(task({status}))).toBe(false);
  });
});
