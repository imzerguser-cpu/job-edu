import {useEffect,useRef,useState} from 'react';
import {formatMoney,currentPeriod} from '../../domain/money';
import type {Account,AccountEntry,SalaryPreviewItem} from '../../domain/finance';
import type {SavingsContract,SavingsMaturityPreviewItem,SavingsProduct} from '../../domain/savings';
import {validSavingsAmount,validSavingsMonths} from '../../domain/savings';
import type {FinanceStore} from '../../data/financeRepository';
import type {SavingsStore} from '../../data/savingsRepository';

export function BankWorkspace({store,savingsStore,teacher,currencySymbol='마동'}:{store:FinanceStore;savingsStore:SavingsStore;teacher:boolean;currencySymbol?:string}){
  if(!teacher)return <StudentBank store={store} savingsStore={savingsStore} currencySymbol={currencySymbol}/>;
  return <TeacherBank store={store} savingsStore={savingsStore} currencySymbol={currencySymbol}/>;
}

function StudentBank({store,savingsStore,currencySymbol}:{store:FinanceStore;savingsStore:SavingsStore;currencySymbol:string}){
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
    <StudentSavings savingsStore={savingsStore} currencySymbol={currencySymbol}/>
    <p className="muted">대출·상점 이용은 다음 단계에서 연결됩니다.</p>
  </section>;
}

function StudentSavings({savingsStore,currencySymbol}:{savingsStore:SavingsStore;currencySymbol:string}){
  const [products,setProducts]=useState<SavingsProduct[]>([]);
  const [contracts,setContracts]=useState<SavingsContract[]>([]);
  const [productId,setProductId]=useState('');
  const [principal,setPrincipal]=useState(0),[months,setMonths]=useState(1);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function load(){
    const [p,c]=await Promise.all([savingsStore.listProducts(),savingsStore.myContracts()]);
    const active=p.filter(x=>x.status==='active');
    setProducts(active);
    setContracts(c);
    if(active.length&&!active.some(x=>x.id===productId)){setProductId(active[0].id);setPrincipal(active[0].minMinor);setMonths(active[0].minMonths)}
  }
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[savingsStore]);
  const product=products.find(p=>p.id===productId);
  async function enroll(){
    if(!product)return;
    setBusy(true);setError('');setMessage('');
    try{
      await savingsStore.openSavings({productId:product.id,principalMinor:principal,months});
      setMessage('저축에 가입했어요.');
      await load();
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const amountOk=product?validSavingsAmount(product,principal):false;
  const monthsOk=product?validSavingsMonths(product,months):false;
  return <div className="section">
    <h3>저축</h3>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="success">{message}</p>}
    {!products.length?<p className="empty">아직 가입할 수 있는 저축 상품이 없어요.</p>:<>
      <div className="assignment-form">
        <label>상품<select value={productId} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setProductId(e.target.value);if(p){setPrincipal(p.minMinor);setMonths(p.minMonths)}}}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · 월{(p.rateBpsMonthly/100).toFixed(1)}%</option>)}</select></label>
        {product&&<>
          <label>가입 금액({formatMoney(product.minMinor,currencySymbol)}~{formatMoney(product.maxMinor,currencySymbol)})<input type="number" min={product.minMinor/100} max={product.maxMinor/100} value={principal/100} onChange={e=>setPrincipal(Math.round(Number(e.target.value)*100))}/></label>
          <label>가입 기간(월, {product.minMonths}~{product.maxMonths})<input type="number" min={product.minMonths} max={product.maxMonths} value={months} onChange={e=>setMonths(Number(e.target.value))}/></label>
        </>}
        <button className="button primary" disabled={busy||!product||!amountOk||!monthsOk} onClick={enroll}>가입하기</button>
      </div>
    </>}
    <h4>내 저축</h4>
    {!contracts.length?<p className="empty">가입한 저축이 없어요.</p>:<div className="list">{contracts.map(c=><article key={c.id} className="task-row"><div className="task-row-head"><b>{c.productSnapshot.name}</b><span className="badge">{c.status==='matured'?'만기 완료':'진행 중'}</span></div><p className="muted">원금 {formatMoney(c.principalMinor,currencySymbol)} · {c.months}개월 · 만기 {c.maturityAt}{c.status==='matured'&&c.interestMinor!=null?` · 이자 ${formatMoney(c.interestMinor,currencySymbol)}`:''}</p></article>)}</div>}
  </div>;
}

function TeacherBank({store,savingsStore,currencySymbol}:{store:FinanceStore;savingsStore:SavingsStore;currencySymbol:string}){
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
    <TeacherSavings savingsStore={savingsStore} currencySymbol={currencySymbol}/>
  </section>;
}

function TeacherSavings({savingsStore,currencySymbol}:{savingsStore:SavingsStore;currencySymbol:string}){
  const [products,setProducts]=useState<SavingsProduct[]>([]);
  const [items,setItems]=useState<SavingsMaturityPreviewItem[]|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{paid:number;skipped:number;failed:number}|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;savingsStore.listProducts().then(p=>{if(mounted.current)setProducts(p)}).catch(e=>setError((e as Error).message));return()=>{mounted.current=false}},[savingsStore]);

  async function seedDefaults(){
    setBusy(true);setError('');
    try{
      await savingsStore.createProduct({name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      await savingsStore.createProduct({name:'장기저축',rateBpsMonthly:1000,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      if(mounted.current)setProducts(await savingsStore.listProducts());
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function closeProduct(id:string){
    setBusy(true);setError('');
    try{await savingsStore.closeProduct(id);if(mounted.current)setProducts(await savingsStore.listProducts())}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function previewMaturities(){
    setBusy(true);setError('');setResult(null);
    try{const list=await savingsStore.previewMaturities();if(mounted.current)setItems(list)}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function confirmMaturities(){
    if(!items)return;
    setBusy(true);setError('');
    try{const r=await savingsStore.settleMaturities(items);if(mounted.current){setResult(r);setItems(await savingsStore.previewMaturities())}}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const activeProducts=products.filter(p=>p.status==='active');
  const total=items?.reduce((sum,i)=>sum+i.payoutMinor,0)??0;

  return <div className="section">
    <div className="section-heading"><h2>저축 상품 관리</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {!products.length&&<button className="button primary" disabled={busy} onClick={seedDefaults}>기본 상품(단기·장기) 만들기</button>}
    {!!products.length&&<div className="list">{products.map(p=><article key={p.id} className="task-row"><div className="task-row-head"><b>{p.name}</b><span className="badge">{p.status==='active'?`월 ${(p.rateBpsMonthly/100).toFixed(1)}%`:'닫힘'}</span></div><p className="muted">{p.minMonths}~{p.maxMonths}개월 · {formatMoney(p.minMinor,currencySymbol)}~{formatMoney(p.maxMinor,currencySymbol)}{p.status==='active'&&<button className="button quiet" disabled={busy} onClick={()=>closeProduct(p.id)}>닫기</button>}</p></article>)}</div>}
    {!activeProducts.length&&!!products.length&&<p className="muted">운영 중인 저축 상품이 없어요.</p>}

    <div className="section-heading"><h2>저축 만기 정산</h2></div>
    {result&&<p role="status" className="success">지급 완료 {result.paid}건 · 이미 처리됨 {result.skipped}건 · 실패 {result.failed}건</p>}
    <button className="button primary" disabled={busy} onClick={previewMaturities}>만기 도래 계약 미리보기</button>
    {items&&<>
      {!items.length?<p className="empty">지금 정산할 만기 계약이 없어요.</p>:<>
        <p className="muted">정산 대상 {items.length}건 · 합계(원금+이자) {formatMoney(total,currencySymbol)}</p>
        <div className="list">{items.map(i=><article key={i.contractId} className="task-row"><div className="task-row-head"><b>{i.studentName}</b><span className="badge">{formatMoney(i.payoutMinor,currencySymbol)}</span></div><p className="muted">원금 {formatMoney(i.principalMinor,currencySymbol)} · 이자 {formatMoney(i.interestMinor,currencySymbol)} · 만기 {i.maturityAt}</p></article>)}</div>
        <button className="button primary section" disabled={busy} onClick={confirmMaturities}>{items.length}건 정산 확정</button>
      </>}
    </>}
  </div>;
}
