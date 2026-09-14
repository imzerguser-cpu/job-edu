import {describe,it,expect} from 'vitest';
import {fineJournalId,validateFineAmount,validateReportDescription} from '../src/domain/violations';
describe('과태료 신고 검증',()=>{
  it('빈 내용이나 과도한 길이를 거부한다',()=>{
    expect(()=>validateReportDescription('')).toThrow();
    expect(()=>validateReportDescription('x'.repeat(501))).toThrow();
    expect(()=>validateReportDescription('복도에서 뛰었어요')).not.toThrow();
  });
});
describe('과태료 금액 검증',()=>{
  it('0 이하이거나 상한을 넘으면 거부한다',()=>{
    expect(()=>validateFineAmount(0)).toThrow();
    expect(()=>validateFineAmount(-100)).toThrow();
    expect(()=>validateFineAmount(100001)).toThrow();
    expect(()=>validateFineAmount(1000)).not.toThrow();
  });
});
describe('과태료 저널 식별자',()=>{
  it('같은 신고 건이면 같은 식별자를 만든다(중복 부과 방지)',()=>{
    expect(fineJournalId('report1')).toBe(fineJournalId('report1'));
    expect(fineJournalId('report1')).not.toBe(fineJournalId('report2'));
  });
  it('잘못된 식별자를 거부한다',()=>{expect(()=>fineJournalId('bad id')).toThrow()});
});
