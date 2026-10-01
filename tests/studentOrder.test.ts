import {describe,expect,it} from 'vitest';
import {compareByGradeNumber,studentLabel} from '../src/domain/model';

describe('학생 정렬(학년순 → 번호순)',()=>{
  it('학년이 먼저, 학년 안에서는 번호, 번호 없는 학생은 뒤에서 이름순',()=>{
    const list=[{grade:4,number:3,name:'권윤호'},{grade:1,number:2,name:'고지호'},{grade:4,number:null,name:'가나'},{grade:4,number:1,name:'구민준'},{grade:1,number:1,name:'고지윤'}];
    expect([...list].sort(compareByGradeNumber).map(s=>s.name)).toEqual(['고지윤','고지호','구민준','권윤호','가나']);
  });
  it('번호가 있으면 "4학년 3번 이름", 없으면 "4학년 이름"',()=>{
    expect(studentLabel({grade:4,number:3,name:'권윤호'})).toBe('4학년 3번 권윤호');
    expect(studentLabel({grade:4,number:null,name:'가나'})).toBe('4학년 가나');
  });
});
