export interface Business {id:string;schoolId:string;name:string;ownerStudentId:string;status:'active'|'closed';schemaVersion:1}
export interface Product {id:string;schoolId:string;businessId:string;name:string;priceMinor:number;stock:number;lastJournalId:string|null;status:'active'|'paused';schemaVersion:1}
export interface Catalog {businesses:Business[];products:Product[]}
export function validateBusiness(b:Business){
  if(!b.name.trim()||b.name.length>60)throw new Error('사업 이름을 1~60자로 적어 주세요.');
  if(!(['active','closed'] as const).includes(b.status))throw new Error('운영 상태를 확인해 주세요.');
}
export function validateProduct(p:Product){
  if(!p.name.trim()||p.name.length>60)throw new Error('상품 이름을 1~60자로 적어 주세요.');
  if(!Number.isInteger(p.priceMinor)||p.priceMinor<=0||p.priceMinor>100000)throw new Error('가격을 확인해 주세요.');
  if(!Number.isInteger(p.stock)||p.stock<0||p.stock>100000)throw new Error('재고 수량을 확인해 주세요.');
  if(!(['active','paused'] as const).includes(p.status))throw new Error('판매 상태를 확인해 주세요.');
}
export function canBuy(business:Business,product:Product){return business.status==='active'&&product.status==='active'&&product.stock>0}

// 사업 세금(§23) — 소득세(finance.ts)와 같은 설계: 사업 계좌 잔액이 아니라 그 정산월에 실제로
// 발생한 매출(PURCHASE 저널로 사업 계좌에 쌓인 금액)에만 매긴다.
export interface BusinessTaxPreviewItem {businessId:string;businessName:string;revenueMinor:number;amountMinor:number;period:string;journalId:string;alreadyPaid:boolean}
export function validateBusinessTaxRateBp(rateBp:number){
  if(!Number.isInteger(rateBp)||rateBp<0||rateBp>2000)throw new Error('세율은 0~20% 사이로 설정해 주세요.');
}
export function computeBusinessTax(revenueMinor:number,rateBp:number){
  return Math.floor(revenueMinor*rateBp/10000);
}
export function businessTaxJournalId(businessId:string,period:string){
  if(!/^\d{4}-\d{2}$/.test(period))throw new Error('정산 월(YYYY-MM)을 확인해 주세요.');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(businessId))throw new Error('사업 식별자를 확인해 주세요.');
  return `businessTax~${businessId}~${period}`;
}
