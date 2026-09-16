import {DestinationIcon} from '../features/map/DestinationIcon';
const sources={
  bank:'/assets/icons/bank-v2.png',
  savings:'/assets/icons/savings-v2.png',
  loan:'/assets/icons/loan-v2.png',
  ledger:'/assets/finance_civic/transaction_ledger_icon.png',
  salary:'/assets/finance_civic/madong_currency_icon.png',
  tax:'/assets/finance_civic/tax_icon.png',
  fund:'/assets/finance_civic/citizen_square_icon.png',
  product:'/assets/finance_civic/financial_product_icon.png',
  store:'/assets/jobs/store_manager_job_icon.png',
  task:'/assets/finance_civic/result_submission_icon.png',
} as const;

/** Text beside the icon carries its accessible name. */
export function FunctionIcon({name}:{name:keyof typeof sources}){
  if(name==='store')return <DestinationIcon id="store" className="function-icon"/>;
  return <img className="function-icon" src={sources[name]} width={44} height={44} alt="" loading="lazy"/>;
}
