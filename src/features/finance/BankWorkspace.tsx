import {useEffect,useRef,useState} from 'react';
import {formatMoney,currentPeriod} from '../../domain/money';
import type {Account,AccountEntry,SalaryPreviewItem} from '../../domain/finance';
import type {FinanceStore} from '../../data/financeRepository';

export function BankWorkspace({store,teacher,currencySymbol='마동'}:{store:FinanceStore;teacher:boolean;currencySymbol?:string}){
  if(!teacher)return <StudentBank store={store} currencySymbol={currencySymbol}/>;
  return <TeacherBank store={store} currencySymbol={currencySymbol}/>;
}

function StudentBank({store,currencySymbol}:{store:FinanceStore;currencySymbol:string}){
  const [account,setAccount]=useState<Account|null>(null);
  const [entries,setEntries]=useState<AccountEntry[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setLoading(true);
    Promise.all([store.myAccount(),store.myEntries()]).then(([a,e])=>{if(alive){setAccount(a);setEntries(e)}}).catch(err=>{if(alive)setError((err as Error).message)}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[store]);
  if(loading)return <p role="status">계좌를 불러오고 있어요.</p>;
  return <section className="citizen-tasks">
    <h2>내 마동 계좌</h2>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="task-row"><div className="task-row-head"><b>현재 잔액</b><span className="badge">{formatMoney(account?.balanceMinor??0,currencySymbol)}</span></div>
      {!account&&<p className="muted">아직 지급된 월급이 없어요. 직업을 맡고 교사의 월급 정산을 기다려 주세요.</p>}</div>
    <h3>최근 거래</h3>
    {!entries.length?<p className="empty">아직 거래 내역이 없어요.</p>:<div className="list">{entries.map(e=><article key={e.id} className="task-row"><div className="task-row-head"><b>{e.label}</b><span className={e.deltaMinor>=0?'badge':'badge'}>{e.deltaMinor>=0?'+':''}{formatMoney(e.deltaMinor,currencySymbol)}</span></div><p className="muted">잔액 {formatMoney(e.balanceAfterMinor,currencySymbol)}</p></article>)}</div>}
    <p className="muted">저축·대출·상점 이용은 다음 단계에서 연결됩니다.</p>
  </section>;
}

function TeacherBank({store,currencySymbol}:{store:FinanceStore;currencySymbol:string}){
  const [period,setPeriod]=useState(currentPeriod());
  const [items,setItems]=useState<SalaryPreviewItem[]|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{paid:number;skipped:number;failed:number}|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;store.ensureIssuer().catch(e=>setError((e as Error).message));return()=>{mounted.current=false}},[store]);

  async function preview(){
    setBusy(true);setError('');setResult(null);
    try{const list=await store.previewSalary(period);if(mounted.current)setItems(list)}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  async function confirm(){
    if(!items)return;
    setBusy(true);setError('');
    try{const r=await store.settleSalary(items);if(mounted.current){setResult(r);setItems(await store.previewSalary(period))}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  const payable=items?.filter(i=>!i.alreadyPaid)??[];
  const total=payable.reduce((sum,i)=>sum+i.amountMinor,0);

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>월급 정산</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {result&&<p role="status" className="success">지급 완료 {result.paid}건 · 이미 지급됨 {result.skipped}건 · 실패 {result.failed}건</p>}
    <div className="assignment-form">
      <label>정산 월<input type="month" value={period} onChange={e=>{setPeriod(e.target.value);setItems(null);setResult(null)}}/></label>
      <button className="button primary" disabled={busy} onClick={preview}>미리보기</button>
    </div>
    {items&&<>
      {!items.length?<p className="empty">월급이 설정된 직업을 맡고 있는 학생이 없어요.</p>:<>
        <p className="muted">지급 대상 {payable.length}명 · 합계 {formatMoney(total,currencySymbol)}</p>
        <div className="list">{items.map(i=><article key={i.journalId} className="task-row"><div className="task-row-head"><b>{i.studentName} · {i.jobName}</b><span className="badge">{i.alreadyPaid?'지급됨':formatMoney(i.amountMinor,currencySymbol)}</span></div></article>)}</div>
        {payable.length>0&&<button className="button primary section" disabled={busy} onClick={confirm}>{payable.length}명에게 지급 확정</button>}
      </>}
    </>}
    <p className="muted">가입한 학생 계좌는 첫 월급 지급 때 자동으로 만들어집니다. 같은 달에 같은 직업으로 두 번 지급되지 않습니다.</p>
  </section>;
}
