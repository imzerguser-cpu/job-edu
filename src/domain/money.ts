// Pure educational calculations. Money is stored as an integer "minor unit" to avoid float drift.
export const CURRENCY_MINOR_SCALE=100;
export function toMinor(major:number){if(!Number.isFinite(major)||major<0)throw new Error('금액을 확인해 주세요.');return Math.round(major*CURRENCY_MINOR_SCALE)}
export function toMajor(minor:number){return minor/CURRENCY_MINOR_SCALE}
// 금액 뒤에 붙는 단위(D-117): 화폐 이름이 "마동"처럼 '동'으로 끝나면 금액에는 "동"만 붙인다
// (300마동 → 300동, 사용자 요청). 화폐 이름 자체(마동)는 안내 문구 등에서 그대로 쓴다.
export function amountUnit(currencyName:string){const name=currencyName.trim();return name.length>1&&name.endsWith('동')?'동':name}
export function formatMoney(minor:number,currencyName='마동'){return `${toMajor(minor).toLocaleString()}${amountUnit(currencyName)}`}
export function currentPeriod(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`}
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
