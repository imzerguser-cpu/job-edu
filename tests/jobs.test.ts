import {describe,it,expect} from 'vitest';
import {starterJobs,pairId,validateCareer,canAssign} from '../src/domain/jobs';
import {demoCareers} from '../src/data/careerRepository';
describe('직업 운영',()=>{
  it('학교 템플릿은 4개 국과 권장 학년을 가진다',()=>{const jobs=starterJobs('school-b');expect(new Set(jobs.map(j=>j.departmentId)).size).toBe(4);for(const j of jobs){expect(j.schoolId).toBe('school-b');expect(()=>validateCareer(j)).not.toThrow()}});
  it('복합 식별자 충돌과 경로 삽입을 막는다',()=>{expect(pairId('a_b','c')).not.toBe(pairId('a','b_c'));expect(()=>pairId('a~b','c')).toThrow();expect(()=>pairId('../x','c')).toThrow()});
  it('학년 권장은 유효한 학년만 받는다',()=>{expect(()=>validateCareer({...starterJobs('s')[0],recommendedGrades:[7]})).toThrow();expect(()=>validateCareer({...starterJobs('s')[0],recommendedGrades:[1,1]})).toThrow()});
  it('종료·일시중지·준비 직업은 배정하지 않는다',()=>{for(const status of ['closed','paused','preparing'] as const)expect(canAssign({...starterJobs('s')[0],status})).toBe(false)});
  it('학생 신청→교사 승인→복수 직업 배정→종료',async()=>{const s=demoCareers('s','citizen');await s.apply('bank','배우고 싶어요');let d=await s.load();await s.review(d.applications[0],true,'함께해요');await s.assign('garden','citizen');d=await s.load();expect(d.assignments.filter(a=>a.status==='active')).toHaveLength(2);await s.assign('garden','citizen');expect((await s.load()).assignments).toHaveLength(2);await s.end(d.assignments[0]);expect((await s.load()).assignments.filter(a=>a.status==='active')).toHaveLength(1)});
  it('중복 신청과 이유 없는 반려를 차단한다',async()=>{const s=demoCareers('s','citizen');await s.apply('bank','이유');await expect(s.apply('bank','중복')).rejects.toThrow();await expect(s.review((await s.load()).applications[0],false,'')).rejects.toThrow()});
});
