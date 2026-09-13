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
