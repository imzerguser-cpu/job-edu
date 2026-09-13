import {describe,it,expect} from 'vitest';
import {previewRoster,parseDelimited} from '../src/domain/roster';
import {simpleInterest,addCalendarMonths} from '../src/domain/money';
import {schoolPath,type SchoolContext} from '../src/domain/model';
describe('학교 범위',()=>{
  const context:SchoolContext={schoolId:'school-a',uid:'s1',membership:{schoolId:'school-a',role:'student',studentId:'one',status:'active'}};
  it('임의 경로와 다른 학교 컨텍스트를 거부한다',()=>{expect(schoolPath(context,'students','one')).toBe('schools/school-a/students/one');expect(()=>schoolPath(context,'../school-b')).toThrow();expect(()=>schoolPath({...context,schoolId:'school-b'},'students')).toThrow();expect(()=>schoolPath({...context,membership:{...context.membership,status:'inactive'}},'students')).toThrow()});
});
describe('명단 가져오기',()=>{
  it('학년·이름 시트 형식을 읽고 누락된 반은 확정하지 않는다',()=>{const p=previewRoster('학년\t이름\n1학년\t가상하나\n6학년\t가상둘');expect(p.rows).toHaveLength(2);expect(p.rows[0].className).toBeNull();expect(p.gradeCounts).toEqual({1:1,6:1})});
  it('중복과 잘못된 학년·빈 이름을 알린다',()=>{const p=previewRoster('학년,이름\n1,가상\n1,가상\n7,가상둘\n2,');expect(p.issues).toHaveLength(3);expect(p.rows).toHaveLength(1)});
  it('동명이인을 다른 학년/반이면 자동 병합하지 않는다',()=>{expect(previewRoster('학년,반,이름\n1,A,가상\n1,B,가상\n2,A,가상').rows).toHaveLength(3)});
  it('CSV 따옴표, BOM과 탭을 처리한다',()=>{expect(parseDelimited('\ufeff학년,이름\r\n1,"가상,하나"')[1][1]).toBe('가상,하나');expect(()=>parseDelimited('학년,이름\n1,"열림')).toThrow()});
  it('헤더와 크기를 검증한다',()=>{expect(()=>previewRoster('이름,학년,학년\n가상,1,1')).toThrow();expect(()=>previewRoster('학년,이름')).toThrow();expect(()=>previewRoster('x'.repeat(100001))).toThrow()});
});
describe('금융 단위와 달력',()=>{
  it('원문 단리 예시와 일치한다',()=>{expect(simpleInterest(10000,500,3)).toBe(1500);expect(simpleInterest(10000,600,3)).toBe(1800)});
  it('중간 반올림 없이 최종 최소 단위에서 반올림한다',()=>{expect(simpleInterest(101,500,3)).toBe(15);expect(simpleInterest(10,500,1)).toBe(1)});
  it('음수·소수·무한대·과대 입력을 거부한다',()=>{for(const n of [-1,0.1,Infinity,1e12])expect(()=>simpleInterest(n,500,3)).toThrow();expect(()=>simpleInterest(100,500,0)).toThrow();expect(()=>simpleInterest(100,1.5,3)).toThrow()});
  it('월말과 윤년을 처리한다',()=>{expect(addCalendarMonths('2026-01-31',1)).toBe('2026-02-28');expect(addCalendarMonths('2028-01-31',1)).toBe('2028-02-29');expect(addCalendarMonths('2026-12-31',2)).toBe('2027-02-28');expect(()=>addCalendarMonths('2026-02-30',1)).toThrow()});
});
