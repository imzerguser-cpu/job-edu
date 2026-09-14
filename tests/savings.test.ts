import {describe,it,expect} from 'vitest';
import {simpleInterest} from '../src/domain/money';
import {
  defaultSavingsProducts,savingsDepositJournalId,savingsInterestJournalId,
  validSavingsAmount,validSavingsMonths,validateSavingsProduct,
  type SavingsProduct,
} from '../src/domain/savings';

const product:SavingsProduct={id:'p1',schoolId:'a',kind:'savings',name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:1000,maxMinor:100000,status:'active',schemaVersion:1};

describe('저축 상품 검증',()=>{
  it('기본 단기·장기 상품은 요구사항의 이율·기간을 그대로 담는다',()=>{
    const [short,long]=defaultSavingsProducts('a');
    expect(short).toMatchObject({rateBpsMonthly:500,minMonths:1,maxMonths:3});
    expect(long).toMatchObject({rateBpsMonthly:1000,minMonths:4});
  });
  it('상품 범위를 벗어난 값은 거부한다',()=>{
    expect(()=>validateSavingsProduct({...product,name:''})).toThrow();
    expect(()=>validateSavingsProduct({...product,rateBpsMonthly:10001})).toThrow();
    expect(()=>validateSavingsProduct({...product,minMonths:5,maxMonths:3})).toThrow();
    expect(()=>validateSavingsProduct({...product,minMinor:200000,maxMinor:100000})).toThrow();
    expect(()=>validateSavingsProduct(product)).not.toThrow();
  });
  it('가입 금액·기간이 상품 범위 안인지 판정한다',()=>{
    expect(validSavingsAmount(product,1000)).toBe(true);
    expect(validSavingsAmount(product,999)).toBe(false);
    expect(validSavingsAmount(product,100001)).toBe(false);
    expect(validSavingsMonths(product,3)).toBe(true);
    expect(validSavingsMonths(product,4)).toBe(false);
  });
});
describe('저축 이자(요구사항 예시 재검증)',()=>{
  it('100마동 × 월5% × 3개월 = 15마동',()=>{
    expect(simpleInterest(10000,500,3)).toBe(1500); // minor units: 100원=10000, 15원=1500
  });
  it('100마동 × 월10% × 4개월 = 40마동(장기저축 예시)',()=>{
    expect(simpleInterest(10000,1000,4)).toBe(4000);
  });
});
describe('저축 저널 식별자',()=>{
  it('계약마다 결정적인 가입·만기 식별자를 만든다(중복 방지)',()=>{
    expect(savingsDepositJournalId('c1')).toBe('savingsDeposit~c1');
    expect(savingsInterestJournalId('c1')).toBe('interest~c1');
    expect(savingsDepositJournalId('c1')).not.toBe(savingsDepositJournalId('c2'));
  });
  it('잘못된 계약 식별자는 거부한다',()=>{
    expect(()=>savingsDepositJournalId('c1~x')).toThrow();
  });
});
