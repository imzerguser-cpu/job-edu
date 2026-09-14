import {describe,it,expect} from 'vitest';
import {studentLoginEmail} from '../src/domain/studentAuth';
describe('학생 로그인 이메일 합성',()=>{
  it('학교 코드·학년·이름으로 결정적인 이메일을 만든다',()=>{
    const a=studentLoginEmail('jobedu','4','김민준');
    const b=studentLoginEmail('jobedu','4','김민준');
    expect(a).toBe(b);
    expect(a).toMatch(/^jobedu-4-김민준@students\.jobedu\.local$/);
  });
  it('공백을 제거해 같은 사람으로 인식한다',()=>{
    expect(studentLoginEmail(' jobedu ','4',' 김민준 ')).toBe(studentLoginEmail('jobedu','4','김민준'));
  });
  it('학년이 다르면 다른 이메일이 된다',()=>{
    expect(studentLoginEmail('jobedu','4','김민준')).not.toBe(studentLoginEmail('jobedu','5','김민준'));
  });
  it('학교가 다르면 같은 학년·이름이어도 다른 이메일이 된다',()=>{
    expect(studentLoginEmail('jobedu','4','김민준')).not.toBe(studentLoginEmail('other','4','김민준'));
  });
  it('학교 코드·학년·이름이 비어 있으면 거부한다',()=>{
    expect(()=>studentLoginEmail('','4','김민준')).toThrow();
    expect(()=>studentLoginEmail('jobedu','','김민준')).toThrow();
    expect(()=>studentLoginEmail('jobedu','4','')).toThrow();
  });
  it('과도하게 긴 입력을 거부한다',()=>{expect(()=>studentLoginEmail('x'.repeat(41),'4','김민준')).toThrow()});
  it('학교 코드는 초/초등/초등학교를 붙이거나 떼도 같은 학교로 인식한다',()=>{
    const base=studentLoginEmail('마동','4','김민준');
    expect(studentLoginEmail('마동초','4','김민준')).toBe(base);
    expect(studentLoginEmail('마동초등학교','4','김민준')).toBe(base);
    expect(studentLoginEmail(' 마동초등학교 ','4','김민준')).toBe(base);
  });
});
