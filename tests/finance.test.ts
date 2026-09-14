import {describe,it,expect} from 'vitest';
import {toMinor,toMajor,formatMoney} from '../src/domain/money';
import {computeIncomeTax,incomeTaxJournalId,salaryJournalId,periodPattern,validateFundExpenseAmount,validateFundExpenseDescription,validateIncomeTaxRateBp} from '../src/domain/finance';
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
describe('소득세',()=>{
  it('세율(basis point)로 세금을 계산한다',()=>{
    expect(computeIncomeTax(50000,500)).toBe(2500); // 5%
    expect(computeIncomeTax(50000,0)).toBe(0);
    expect(computeIncomeTax(1,500)).toBe(0); // 반올림 내림
  });
  it('세율은 0~20% 사이만 허용한다',()=>{
    expect(()=>validateIncomeTaxRateBp(-1)).toThrow();
    expect(()=>validateIncomeTaxRateBp(2001)).toThrow();
    expect(()=>validateIncomeTaxRateBp(1.5)).toThrow();
    expect(()=>validateIncomeTaxRateBp(2000)).not.toThrow();
  });
  it('학생·월이 같으면 같은 정산 식별자를 만든다(중복 징수 방지)',()=>{
    expect(incomeTaxJournalId('one','2026-09')).toBe(incomeTaxJournalId('one','2026-09'));
    expect(incomeTaxJournalId('one','2026-09')).not.toBe(incomeTaxJournalId('one','2026-10'));
    expect(incomeTaxJournalId('one','2026-09')).not.toBe(incomeTaxJournalId('two','2026-09'));
  });
});
describe('공동기금 지출 검증',()=>{
  it('빈 내용이나 과도한 길이를 거부한다',()=>{
    expect(()=>validateFundExpenseDescription('')).toThrow();
    expect(()=>validateFundExpenseDescription('x'.repeat(201))).toThrow();
    expect(()=>validateFundExpenseDescription('학급 행사 간식')).not.toThrow();
  });
  it('0 이하이거나 상한을 넘으면 거부한다',()=>{
    expect(()=>validateFundExpenseAmount(0)).toThrow();
    expect(()=>validateFundExpenseAmount(-1)).toThrow();
    expect(()=>validateFundExpenseAmount(1000001)).toThrow();
    expect(()=>validateFundExpenseAmount(1000)).not.toThrow();
  });
});
