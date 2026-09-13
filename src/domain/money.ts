// Pure educational calculations. Production ledger writes stay denied until phase 4.
export function assertMoney(n:number){if(!Number.isSafeInteger(n)||n<0||n>1_000_000_000)throw new Error('금액 범위를 확인해 주세요.');return n}
export function simpleInterest(principalMinor:number,monthlyRateBps:number,months:number):number{
  assertMoney(principalMinor);
  if(!Number.isInteger(monthlyRateBps)||monthlyRateBps<0||monthlyRateBps>10000)throw new Error('월이율 범위를 확인해 주세요.');
  if(!Number.isInteger(months)||months<1||months>120)throw new Error('개월 수를 확인해 주세요.');
  const numerator=BigInt(principalMinor)*BigInt(monthlyRateBps)*BigInt(months);
  return Number((numerator+5000n)/10000n); // half-up at the final minor unit
}
export function addCalendarMonths(date:string,months:number){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(months)||months<1||months>120)throw new Error('날짜와 기간을 확인해 주세요.');
  const [y,m,d]=date.split('-').map(Number),source=new Date(Date.UTC(y,m-1,d));
  if(source.getUTCFullYear()!==y||source.getUTCMonth()!==m-1||source.getUTCDate()!==d)throw new Error('유효하지 않은 날짜입니다.');
  const target=new Date(Date.UTC(y,m-1+months,1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d,last));return target.toISOString().slice(0,10);
}
