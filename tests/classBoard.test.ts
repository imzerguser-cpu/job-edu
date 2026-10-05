import {describe,expect,it} from 'vitest';
import {boardSummary,buildClassBoard} from '../src/domain/classBoard';
import {planBulkAssign,planBulkRestart} from '../src/domain/tasks';

describe('업무 일괄 배정·다시 시작',()=>{
  const assignments=[{jobId:'cafe',studentId:'a',status:'active'},{jobId:'cafe',studentId:'b',status:'active'},{jobId:'cafe',studentId:'c',status:'ended'},{jobId:'bank',studentId:'d',status:'active'}];
  it('그 직업을 맡은 학생 중 이미 진행 중인 학생은 빼고 배정한다(완료된 학생은 다시 배정)',()=>{
    const tasks=[{templateId:'t1',assigneeStudentId:'a',status:'submitted'},{templateId:'t1',assigneeStudentId:'b',status:'approved'}] as never[];
    expect(planBulkAssign({id:'t1',jobId:'cafe'},assignments,tasks)).toEqual({toAssign:['b'],alreadyInProgress:1});
    expect(planBulkAssign({id:'t2',jobId:'bank'},assignments,[])).toEqual({toAssign:['d'],alreadyInProgress:0});
  });
  it('완료된 업무만 다시 시작 대상이 된다',()=>{
    const tasks=[{templateId:'t1',status:'approved'},{templateId:'t1',status:'assigned'},{templateId:'t2',status:'approved'}] as {templateId:string;status:'approved'|'assigned'}[];
    expect(planBulkRestart(tasks)).toHaveLength(2);
    expect(planBulkRestart(tasks,'t2')).toHaveLength(1);
  });
});

describe('학급 현황판',()=>{
  it('학년·번호순으로 줄을 만들고 챙겨 볼 점을 표시한다',()=>{
    const rows=buildClassBoard({
      students:[{id:'b',name:'나',grade:4,number:2,status:'active'},{id:'a',name:'가',grade:4,number:1,status:'active'},{id:'x',name:'졸업',grade:6,number:1,status:'graduated'}],
      jobs:[{id:'cafe',name:'카페 직원'}],
      assignments:[{jobId:'cafe',studentId:'a',status:'active'}],
      tasks:[{assigneeStudentId:'a',status:'submitted',attempt:2}],
      balances:{a:3000},praises:[{toStudentId:'a'},{toStudentId:'a'}],helps:[{helperStudentId:'a',status:'paid'}],profiles:[{studentId:'a',code:'AS'}],
    });
    expect(rows.map(r=>r.student.id)).toEqual(['a','b']);
    expect(rows[0]).toMatchObject({jobs:['카페 직원'],tasksWaiting:1,submissions:2,balanceMinor:3000,praisesReceived:2,helpsGiven:1,discoveryCode:'AS',flags:['검토 대기 1']});
    expect(rows[1].flags).toEqual(['직업 없음','잔액 없음','나를 찾기 전']);
    expect(boardSummary(rows)).toMatchObject({students:2,withJob:1,waiting:1,averageBalanceMinor:3000,discovered:1});
  });
});
