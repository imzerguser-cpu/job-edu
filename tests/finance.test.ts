import {describe,it,expect} from 'vitest';
import {toMinor,toMajor,formatMoney} from '../src/domain/money';
import {salaryJournalId,periodPattern} from '../src/domain/finance';
describe('화폐 최소 단위 변환',()=>{
  it('원 단위를 최소 단위(100분의 1)로 변환한다',()=>{expect(toMinor(500)).toBe(50000);expect(toMinor(0)).toBe(0)});
  it('최소 단위를 다시 원 단위로 변환한다',()=>{expect(toMajor(50000)).toBe(500);expect(toMajor(150)).toBe(1.5)});
  it('음수·비정상 값을 거부한다',()=>{expect(()=>toMinor(-1)).toThrow();expect(()=>toMinor(Infinity)).toThrow()});
  it('표시 형식은 천 단위 구분과 화폐 이름을 붙인다',()=>{expect(formatMoney(150000,'마동')).toBe('1,500마동')});
});
describe('월급 정산 식별자',()=>{
  it('직업·학생·월이 같으면 같은 지급 식별자를 만든다(중복 지급 방지)',()=>{
    expect(salaryJournalId('bank','one','2026-09')).toBe(salaryJournalId('bank','one','2026-09'));
    expect(salaryJournalId('bank','one','2026-09')).not.toBe(salaryJournalId('bank','one','2026-10'));
    expect(salaryJournalId('bank','one','2026-09')).not.toBe(salaryJournalId('bank','two','2026-09'));
  });
  it('잘못된 월 형식이나 식별자를 거부한다',()=>{
    expect(()=>salaryJournalId('bank','one','2026-9')).toThrow();
    expect(()=>salaryJournalId('bank~x','one','2026-09')).toThrow();
    expect(periodPattern('2026-09')).toBe(true);
    expect(periodPattern('2026/09')).toBe(false);
  });
});
