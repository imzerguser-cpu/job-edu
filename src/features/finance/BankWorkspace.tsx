import {useEffect,useRef,useState} from 'react';
import {formatMoney,currentPeriod} from '../../domain/money';
import {validAmount,validMonths,type Account,type AccountEntry,type FinancialProduct,type SalaryPreviewItem} from '../../domain/finance';
import type {SavingsContract,SavingsMaturityPreviewItem} from '../../domain/savings';
import type {FinanceReviewChecklist,FinancialRequest,LoanContract} from '../../domain/loans';
import type {Student} from '../../domain/model';
import type {FinanceStore} from '../../data/financeRepository';
import type {SavingsStore} from '../../data/savingsRepository';
import type {LoanStore} from '../../data/loanRepository';
import type {FinancialProductStore} from '../../data/financialProductRepository';

interface BankProps {store:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;productStore:FinancialProductStore;teacher:boolean;students?:Student[];currencySymbol?:string}

export function BankWorkspace({store,savingsStore,loanStore,productStore,teacher,students,currencySymbol='마동'}:BankProps){
  if(!teacher)return <StudentBank store={store} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} currencySymbol={currencySymbol}/>;
  return <TeacherBank store={store} savingsStore={savingsStore} loanStore={loanStore} productStore={productStore} students={students??[]} currencySymbol={currencySymbol}/>;
}

function StudentBank({store,savingsStore,loanStore,productStore,currencySymbol}:{store:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;productStore:FinancialProductStore;currencySymbol:string}){
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
    <StudentSavings savingsStore={savingsStore} productStore={productStore} currencySymbol={currencySymbol}/>
    <StudentLoans loanStore={loanStore} productStore={productStore} currencySymbol={currencySymbol}/>
    <StudentReviewAssignments loanStore={loanStore} currencySymbol={currencySymbol}/>
  </section>;
}

function StudentSavings({savingsStore,productStore,currencySymbol}:{savingsStore:SavingsStore;productStore:FinancialProductStore;currencySymbol:string}){
  const [products,setProducts]=useState<FinancialProduct[]>([]);
  const [contracts,setContracts]=useState<SavingsContract[]>([]);
  const [productId,setProductId]=useState('');
  const [principal,setPrincipal]=useState(0),[months,setMonths]=useState(1);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function load(){
    const [p,c]=await Promise.all([productStore.listProducts('savings'),savingsStore.myContracts()]);
    const active=p.filter(x=>x.status==='active');
    setProducts(active);
    setContracts(c);
    if(active.length&&!active.some(x=>x.id===productId)){setProductId(active[0].id);setPrincipal(active[0].minMinor);setMonths(active[0].minMonths)}
  }
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[savingsStore,productStore]);
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
  const amountOk=product?validAmount(product,principal):false;
  const monthsOk=product?validMonths(product,months):false;
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

const loanRequestStatusNames:Record<string,string>={submitted:'검토 대기',assigned:'검토 중',reviewed:'승인 대기',approved:'승인됨',rejected:'반려됨'};

function StudentLoans({loanStore,productStore,currencySymbol}:{loanStore:LoanStore;productStore:FinancialProductStore;currencySymbol:string}){
  const [products,setProducts]=useState<FinancialProduct[]>([]);
  const [requests,setRequests]=useState<FinancialRequest[]>([]);
  const [loans,setLoans]=useState<LoanContract[]>([]);
  const [productId,setProductId]=useState('');
  const [principal,setPrincipal]=useState(0),[months,setMonths]=useState(1);
  const [purpose,setPurpose]=useState(''),[repaymentPlan,setRepaymentPlan]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function load(){
    const [p,r,l]=await Promise.all([productStore.listProducts('loan'),loanStore.myRequests(),loanStore.myLoans()]);
    const active=p.filter(x=>x.status==='active');
    setProducts(active);setRequests(r);setLoans(l);
    if(active.length&&!active.some(x=>x.id===productId)){setProductId(active[0].id);setPrincipal(active[0].minMinor);setMonths(active[0].minMonths)}
  }
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[loanStore,productStore]);
  const product=products.find(p=>p.id===productId);
  async function submit(){
    if(!product)return;
    setBusy(true);setError('');setMessage('');
    try{
      await loanStore.submitRequest({productId:product.id,principalMinor:principal,months,purpose,repaymentPlan});
      setMessage('대출을 신청했어요.');setPurpose('');setRepaymentPlan('');
      await load();
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function repay(contractId:string){
    setBusy(true);setError('');setMessage('');
    try{await loanStore.repay(contractId);setMessage('대출을 상환했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const amountOk=product?validAmount(product,principal):false;
  const monthsOk=product?validMonths(product,months):false;
  return <div className="section">
    <h3>대출</h3>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="success">{message}</p>}
    {!products.length?<p className="empty">아직 신청할 수 있는 대출 상품이 없어요.</p>:<div className="assignment-form">
      <label>상품<select value={productId} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setProductId(e.target.value);if(p){setPrincipal(p.minMinor);setMonths(p.minMonths)}}}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · 월{(p.rateBpsMonthly/100).toFixed(1)}%</option>)}</select></label>
      {product&&<>
        <label>신청 금액({formatMoney(product.minMinor,currencySymbol)}~{formatMoney(product.maxMinor,currencySymbol)})<input type="number" min={product.minMinor/100} max={product.maxMinor/100} value={principal/100} onChange={e=>setPrincipal(Math.round(Number(e.target.value)*100))}/></label>
        <label>기간(월, {product.minMonths}~{product.maxMonths})<input type="number" min={product.minMonths} max={product.maxMonths} value={months} onChange={e=>setMonths(Number(e.target.value))}/></label>
        <label>대출 목적<textarea maxLength={500} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label>
        <label>상환 계획<textarea maxLength={500} value={repaymentPlan} onChange={e=>setRepaymentPlan(e.target.value)}/></label>
      </>}
      <button className="button primary" disabled={busy||!product||!amountOk||!monthsOk||!purpose.trim()||!repaymentPlan.trim()} onClick={submit}>신청하기</button>
    </div>}
    <h4>내 대출 신청</h4>
    {!requests.length?<p className="empty">신청한 대출이 없어요.</p>:<div className="list">{requests.map(r=><article key={r.id} className="task-row"><div className="task-row-head"><b>{formatMoney(r.principalMinor,currencySymbol)} · {r.months}개월</b><span className="badge">{loanRequestStatusNames[r.status]}</span></div>{r.status==='rejected'&&r.decisionNote&&<p className="muted">반려 사유: {r.decisionNote}</p>}</article>)}</div>}
    <h4>내 대출</h4>
    {!loans.length?<p className="empty">실행된 대출이 없어요.</p>:<div className="list">{loans.map(l=><article key={l.id} className="task-row"><div className="task-row-head"><b>{l.productSnapshot.name}</b><span className="badge">{l.status==='repaid'?'상환 완료':'상환 중'}</span></div><p className="muted">원금 {formatMoney(l.principalMinor,currencySymbol)} · 이자 {formatMoney(l.interestMinor,currencySymbol)} · 갚을 금액 {formatMoney(l.totalOwedMinor,currencySymbol)}</p>{l.status==='active'&&<button className="button primary" disabled={busy} onClick={()=>repay(l.id)}>전액 상환하기</button>}</article>)}</div>}
  </div>;
}

function StudentReviewAssignments({loanStore,currencySymbol}:{loanStore:LoanStore;currencySymbol:string}){
  const [assignments,setAssignments]=useState<FinancialRequest[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [checklists,setChecklists]=useState<Record<string,FinanceReviewChecklist>>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  async function load(){setAssignments(await loanStore.myReviewAssignments())}
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[loanStore]);
  const pending=assignments.filter(r=>r.status==='assigned');
  function checklistFor(id:string):FinanceReviewChecklist{return checklists[id]??{studentActiveConfirmed:false,amountReasonable:false,noDuplicateLoan:false}}
  async function submit(requestId:string){
    setBusy(true);setError('');setMessage('');
    try{await loanStore.submitReview(requestId,checklistFor(requestId),notes[requestId]??'');setMessage('검토를 제출했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  if(!pending.length)return null;
  return <div className="section">
    <h3>은행원 검토 배정</h3>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="success">{message}</p>}
    <div className="list">{pending.map(r=>{const c=checklistFor(r.id);return <article key={r.id} className="task-row">
      <div className="task-row-head"><b>{formatMoney(r.principalMinor,currencySymbol)} · {r.months}개월</b></div>
      <p className="muted">목적: {r.purpose}</p>
      <p className="muted">상환 계획: {r.repaymentPlan}</p>
      <label><input type="checkbox" checked={c.studentActiveConfirmed} onChange={e=>setChecklists({...checklists,[r.id]:{...c,studentActiveConfirmed:e.target.checked}})}/> 신청 학생이 활동 중인지 확인했어요</label>
      <label><input type="checkbox" checked={c.amountReasonable} onChange={e=>setChecklists({...checklists,[r.id]:{...c,amountReasonable:e.target.checked}})}/> 신청 금액이 적절한지 확인했어요</label>
      <label><input type="checkbox" checked={c.noDuplicateLoan} onChange={e=>setChecklists({...checklists,[r.id]:{...c,noDuplicateLoan:e.target.checked}})}/> 중복 대출이 아닌지 확인했어요</label>
      <label>의견<textarea maxLength={500} value={notes[r.id]??''} onChange={e=>setNotes({...notes,[r.id]:e.target.value})}/></label>
      <button className="button primary" disabled={busy||!c.studentActiveConfirmed||!c.amountReasonable||!c.noDuplicateLoan} onClick={()=>submit(r.id)}>검토 제출</button>
    </article>})}</div>
  </div>;
}

function TeacherBank({store,savingsStore,loanStore,productStore,students,currencySymbol}:{store:FinanceStore;savingsStore:SavingsStore;loanStore:LoanStore;productStore:FinancialProductStore;students:Student[];currencySymbol:string}){
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
    <TeacherProducts productStore={productStore} currencySymbol={currencySymbol}/>
    <TeacherSavingsMaturities savingsStore={savingsStore} currencySymbol={currencySymbol}/>
    <TeacherLoanRequests loanStore={loanStore} students={students} currencySymbol={currencySymbol}/>
  </section>;
}

function TeacherProducts({productStore,currencySymbol}:{productStore:FinancialProductStore;currencySymbol:string}){
  const [products,setProducts]=useState<FinancialProduct[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function load(){setProducts(await productStore.listProducts())}
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[productStore]);
  async function seedDefaults(){
    setBusy(true);setError('');
    try{
      await productStore.createProduct('savings',{name:'단기저축',rateBpsMonthly:500,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      await productStore.createProduct('savings',{name:'장기저축',rateBpsMonthly:1000,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      await productStore.createProduct('loan',{name:'단기대출',rateBpsMonthly:600,minMonths:1,maxMonths:3,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      await productStore.createProduct('loan',{name:'장기대출',rateBpsMonthly:1200,minMonths:4,maxMonths:12,minMinor:0,maxMinor:1_000_000_000,status:'active'});
      await load();
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function closeProduct(id:string){
    setBusy(true);setError('');
    try{await productStore.closeProduct(id);await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const kindNames:Record<string,string>={savings:'저축',loan:'대출'};
  return <div className="section">
    <div className="section-heading"><h2>금융상품 관리</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {!products.length&&<button className="button primary" disabled={busy} onClick={seedDefaults}>기본 상품(저축·대출 각 단기·장기) 만들기</button>}
    {!!products.length&&<div className="list">{products.map(p=><article key={p.id} className="task-row"><div className="task-row-head"><b>{kindNames[p.kind]} · {p.name}</b><span className="badge">{p.status==='active'?`월 ${(p.rateBpsMonthly/100).toFixed(1)}%`:'닫힘'}</span></div><p className="muted">{p.minMonths}~{p.maxMonths}개월 · {formatMoney(p.minMinor,currencySymbol)}~{formatMoney(p.maxMinor,currencySymbol)}{p.status==='active'&&<button className="button quiet" disabled={busy} onClick={()=>closeProduct(p.id)}>닫기</button>}</p></article>)}</div>}
  </div>;
}

function TeacherSavingsMaturities({savingsStore,currencySymbol}:{savingsStore:SavingsStore;currencySymbol:string}){
  const [items,setItems]=useState<SavingsMaturityPreviewItem[]|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{paid:number;skipped:number;failed:number}|null>(null);
  async function previewMaturities(){
    setBusy(true);setError('');setResult(null);
    try{setItems(await savingsStore.previewMaturities())}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function confirmMaturities(){
    if(!items)return;
    setBusy(true);setError('');
    try{const r=await savingsStore.settleMaturities(items);setResult(r);setItems(await savingsStore.previewMaturities())}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const total=items?.reduce((sum,i)=>sum+i.payoutMinor,0)??0;
  return <div className="section">
    <div className="section-heading"><h2>저축 만기 정산</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
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

function TeacherLoanRequests({loanStore,students,currencySymbol}:{loanStore:LoanStore;students:Student[];currencySymbol:string}){
  const [requests,setRequests]=useState<FinancialRequest[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [reviewerChoice,setReviewerChoice]=useState<Record<string,string>>({});
  const [decisionNote,setDecisionNote]=useState<Record<string,string>>({});
  async function load(){setRequests(await loanStore.allRequests())}
  useEffect(()=>{load().catch(e=>setError((e as Error).message))},[loanStore]);
  const pending=requests.filter(r=>r.status==='submitted');
  const reviewed=requests.filter(r=>r.status==='reviewed');
  const decided=requests.filter(r=>r.status==='approved'||r.status==='rejected');
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??id;
  async function assign(requestId:string){
    const reviewerId=reviewerChoice[requestId];
    if(!reviewerId)return;
    setBusy(true);setError('');setMessage('');
    try{await loanStore.assignReviewer(requestId,reviewerId);setMessage('검토자를 지정했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function decide(requestId:string,approve:boolean){
    setBusy(true);setError('');setMessage('');
    try{await loanStore.decide(requestId,approve,decisionNote[requestId]??'');setMessage(approve?'대출을 승인했어요.':'대출을 반려했어요.');await load()}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  return <div className="section">
    <div className="section-heading"><h2>대출 신청 검토</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="success">{message}</p>}
    <h3>검토자 배정 대기 ({pending.length})</h3>
    {!pending.length?<p className="empty">배정할 신청이 없어요.</p>:<div className="list">{pending.map(r=><article key={r.id} className="task-row">
      <div className="task-row-head"><b>{studentName(r.studentId)} · {formatMoney(r.principalMinor,currencySymbol)} · {r.months}개월</b></div>
      <p className="muted">목적: {r.purpose}</p>
      <div className="assignment-form">
        <label>검토자<select value={reviewerChoice[r.id]??''} onChange={e=>setReviewerChoice({...reviewerChoice,[r.id]:e.target.value})}><option value="">선택</option>{students.filter(s=>s.status==='active'&&s.id!==r.studentId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <button className="button primary" disabled={busy||!reviewerChoice[r.id]} onClick={()=>assign(r.id)}>배정</button>
      </div>
    </article>)}</div>}
    <h3>승인/반려 대기 ({reviewed.length})</h3>
    {!reviewed.length?<p className="empty">결정할 신청이 없어요.</p>:<div className="list">{reviewed.map(r=><article key={r.id} className="task-row">
      <div className="task-row-head"><b>{studentName(r.studentId)} · {formatMoney(r.principalMinor,currencySymbol)} · {r.months}개월</b></div>
      <p className="muted">검토자 의견: {r.reviewNote||'(없음)'}</p>
      <label>결정 사유(반려 시 필수)<textarea maxLength={500} value={decisionNote[r.id]??''} onChange={e=>setDecisionNote({...decisionNote,[r.id]:e.target.value})}/></label>
      <div className="header-actions"><button className="button primary" disabled={busy} onClick={()=>decide(r.id,true)}>승인(대출 실행)</button><button className="button quiet" disabled={busy||!(decisionNote[r.id]??'').trim()} onClick={()=>decide(r.id,false)}>반려</button></div>
    </article>)}</div>}
    {!!decided.length&&<p className="muted">결정 완료 {decided.length}건</p>}
  </div>;
}
