import {describe,it,expect} from 'vitest';
import {businessTaxJournalId,computeBusinessTax,validateBusiness,validateBusinessTaxRateBp,validateProduct,canBuy,type Business,type Product} from '../src/domain/business';
const business=(over:Partial<Business>={}):Business=>({id:'shop1',schoolId:'a',name:'마동카페',ownerStudentId:'one',status:'active',schemaVersion:1,...over});
const product=(over:Partial<Product>={}):Product=>({id:'p1',schoolId:'a',businessId:'shop1',name:'과일주스',priceMinor:3000,stock:5,lastJournalId:null,status:'active',schemaVersion:1,...over});
describe('사업 검증',()=>{
  it('빈 이름이나 과도한 길이를 거부한다',()=>{expect(()=>validateBusiness(business({name:''}))).toThrow();expect(()=>validateBusiness(business({name:'x'.repeat(61)}))).toThrow()});
  it('올바른 사업은 통과한다',()=>{expect(()=>validateBusiness(business())).not.toThrow()});
});
describe('상품 검증',()=>{
  it('가격이 0 이하거나 상한을 넘으면 거부한다',()=>{expect(()=>validateProduct(product({priceMinor:0}))).toThrow();expect(()=>validateProduct(product({priceMinor:100001}))).toThrow()});
  it('재고가 음수면 거부한다',()=>{expect(()=>validateProduct(product({stock:-1}))).toThrow()});
  it('올바른 상품은 통과한다',()=>{expect(()=>validateProduct(product())).not.toThrow()});
});
describe('구매 가능 여부',()=>{
  it('사업과 상품이 모두 활성 상태이고 재고가 있어야 구매할 수 있다',()=>{
    expect(canBuy(business(),product())).toBe(true);
    expect(canBuy(business({status:'closed'}),product())).toBe(false);
    expect(canBuy(business(),product({status:'paused'}))).toBe(false);
    expect(canBuy(business(),product({stock:0}))).toBe(false);
  });
});
describe('사업 세금',()=>{
  it('세율(basis point)로 세금을 계산한다',()=>{
    expect(computeBusinessTax(50000,500)).toBe(2500); // 5%
    expect(computeBusinessTax(50000,0)).toBe(0);
  });
  it('세율은 0~20% 사이만 허용한다',()=>{
    expect(()=>validateBusinessTaxRateBp(-1)).toThrow();
    expect(()=>validateBusinessTaxRateBp(2001)).toThrow();
    expect(()=>validateBusinessTaxRateBp(2000)).not.toThrow();
  });
  it('사업·월이 같으면 같은 정산 식별자를 만든다(중복 징수 방지)',()=>{
    expect(businessTaxJournalId('shop1','2026-09')).toBe(businessTaxJournalId('shop1','2026-09'));
    expect(businessTaxJournalId('shop1','2026-09')).not.toBe(businessTaxJournalId('shop1','2026-10'));
    expect(businessTaxJournalId('shop1','2026-09')).not.toBe(businessTaxJournalId('shop2','2026-09'));
  });
});
