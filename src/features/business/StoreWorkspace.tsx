import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatMoney,currentPeriod} from '../../domain/money';
import type {Business,BusinessTaxPreviewItem,Catalog,Product} from '../../domain/business';
import type {AccountEntry} from '../../domain/finance';
import type {SchoolContext,Student} from '../../domain/model';
import type {BusinessStore} from '../../data/businessRepository';
import {updateBusinessTaxRate} from '../../data/schoolRepository';
import {firebase} from '../../data/firebase';

export function StoreWorkspace({store,teacher,students,currencySymbol='마동',studentId,context,businessTaxRateBp=0}:{store:BusinessStore;teacher:boolean;students:Student[];currencySymbol?:string;studentId?:string;context?:SchoolContext;businessTaxRateBp?:number}){
  const [catalog,setCatalog]=useState<Catalog>({businesses:[],products:[]});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [creatingBusiness,setCreatingBusiness]=useState(false);
  const [addingProductTo,setAddingProductTo]=useState<string|null>(null);
  const [editingProduct,setEditingProduct]=useState<Product|null>(null);
  const mounted=useRef(true);
  async function load(){const c=await store.loadCatalog();if(mounted.current)setCatalog(c)}
  useEffect(()=>{mounted.current=true;setLoading(true);load().catch(e=>setError((e as Error).message)).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[store]);

  async function run(action:()=>Promise<void>,success:string){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await load();if(mounted.current){setMessage(success);setCreatingBusiness(false);setAddingProductTo(null);setEditingProduct(null)}}
    catch(e){if(mounted.current)setError((e as Error).message)}
    finally{if(mounted.current)setBusy(false)}
  }
  const studentName=(id:string)=>students.find(s=>s.id===id)?.name??'현재 명단 밖의 시민';
  const productsOf=(businessId:string)=>catalog.products.filter(p=>p.businessId===businessId);
  const isOwner=(b:Business)=>!!studentId&&b.ownerStudentId===studentId;
  const canManage=(b:Business)=>teacher||isOwner(b);

  if(loading)return <p role="status">상점을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>{teacher?'사업 운영':'마동시장'}</h2>{teacher&&<button className="button primary" onClick={()=>setCreatingBusiness(true)}>+ 사업 만들기</button>}</div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    {creatingBusiness&&<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.createBusiness(String(f.get('name')),String(f.get('owner'))),'사업을 만들었습니다.')}}>
      <label>사업 이름<input autoFocus name="name" required maxLength={60}/></label>
      <label>담당 학생<select name="owner" required><option value="">학생 선택</option>{students.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name} · {s.grade}학년</option>)}</select></label>
      <div className="header-actions"><button className="button primary" disabled={busy}>만들기</button><button type="button" className="button quiet" onClick={()=>setCreatingBusiness(false)}>취소</button></div>
    </form>}
    {!catalog.businesses.length?<p className="empty">{teacher?'아직 만든 사업이 없어요.':'아직 운영 중인 사업이 없어요.'}</p>:<div className="list">
      {catalog.businesses.filter(b=>teacher||b.status==='active'||isOwner(b)).map(b=><article key={b.id} className="task-row">
        <div className="task-row-head"><b>{b.name}</b>{(teacher||isOwner(b))&&<span className="badge">{teacher?`${studentName(b.ownerStudentId)} · `:'내 사업 · '}{b.status==='active'?'운영 중':'종료'}</span>}</div>
        {canManage(b)&&<div className="header-actions"><button className="button quiet" onClick={()=>setAddingProductTo(b.id)}>+ 상품 추가</button>{teacher&&b.status==='active'&&<button className="button quiet" disabled={busy} onClick={()=>run(()=>store.saveBusiness({...b,status:'closed'}),'사업을 종료했습니다.')}>사업 종료</button>}</div>}
        {addingProductTo===b.id&&<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.saveProduct({id:crypto.randomUUID(),schoolId:'',businessId:b.id,name:String(f.get('name')).trim(),priceMinor:Math.round(Number(f.get('price'))*100),stock:Number(f.get('stock')),lastJournalId:null,status:'active',schemaVersion:1}),'상품을 추가했습니다.')}}>
          <label>상품 이름<input autoFocus name="name" required maxLength={60}/></label>
          <label>가격({currencySymbol})<input name="price" type="number" min={1} max={1000} step={1} required/></label>
          <label>재고<input name="stock" type="number" min={0} max={1000} step={1} required/></label>
          <div className="header-actions"><button className="button primary" disabled={busy}>추가</button><button type="button" className="button quiet" onClick={()=>setAddingProductTo(null)}>취소</button></div>
        </form>}
        <div className="list">{productsOf(b.id).filter(p=>canManage(b)||p.status==='active').map(p=>editingProduct?.id===p.id
          ?<form key={p.id} className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.saveProduct({...p,priceMinor:Math.round(Number(f.get('price'))*100),stock:Number(f.get('stock')),status:f.get('status') as Product['status']}),'상품을 수정했습니다.')}}>
            <label>가격({currencySymbol})<input name="price" type="number" min={1} max={1000} step={1} defaultValue={p.priceMinor/100} required/></label>
            <label>재고<input name="stock" type="number" min={0} max={1000} step={1} defaultValue={p.stock} required/></label>
            <label>판매 상태<select name="status" defaultValue={p.status}><option value="active">판매 중</option><option value="paused">판매 중지</option></select></label>
            <div className="header-actions"><button className="button primary" disabled={busy}>저장</button><button type="button" className="button quiet" onClick={()=>setEditingProduct(null)}>취소</button></div>
          </form>
          :<article key={p.id} className="task-row"><div className="task-row-head"><b>{p.name}</b><span className="badge">{formatMoney(p.priceMinor,currencySymbol)}</span></div><p className="muted">재고 {p.stock} · {p.status==='active'?'판매 중':'판매 중지'}</p>
            {canManage(b)?<button className="button quiet" onClick={()=>setEditingProduct(p)}>수정</button>
              :<button className="button primary" disabled={busy||p.status!=='active'||p.stock<1} onClick={()=>run(()=>store.buy(b.id,p.id),`${p.name}을(를) 구매했습니다.`)}>{p.stock<1?'품절':'구매하기'}</button>}
          </article>)}
        </div>
        {canManage(b)&&<BusinessSales store={store} businessId={b.id} currencySymbol={currencySymbol}/>}
      </article>)}
    </div>}
    {teacher&&context&&<TeacherBusinessTax store={store} context={context} initialRateBp={businessTaxRateBp} currencySymbol={currencySymbol}/>}
  </section>;
}

function BusinessSales({store,businessId,currencySymbol}:{store:BusinessStore;businessId:string;currencySymbol:string}){
  const [open,setOpen]=useState(false);
  const [balance,setBalance]=useState<number|null>(null);
  const [entries,setEntries]=useState<AccountEntry[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function toggle(){
    if(open){setOpen(false);return}
    setBusy(true);setError('');
    try{
      const [account,list]=await Promise.all([store.businessAccount(businessId),store.businessEntries(businessId)]);
      setBalance(account?.balanceMinor??0);setEntries(list);setOpen(true);
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  return <div className="section">
    <button className="button quiet" disabled={busy} onClick={toggle}>{open?'매출 숨기기':'매출 보기'}</button>
    {error&&<p role="alert" className="error">{error}</p>}
    {open&&<>
      <p className="muted">사업 계좌 잔액 {formatMoney(balance??0,currencySymbol)}</p>
      {!entries.length?<p className="empty">아직 거래 내역이 없어요.</p>:<div className="list">{entries.map(e=><article key={e.id} className="task-row"><div className="task-row-head"><b>{e.label}</b><span className="badge">{e.deltaMinor>=0?'+':''}{formatMoney(e.deltaMinor,currencySymbol)}</span></div></article>)}</div>}
    </>}
  </div>;
}

function TeacherBusinessTax({store,context,initialRateBp,currencySymbol}:{store:BusinessStore;context:SchoolContext;initialRateBp:number;currencySymbol:string}){
  const [period,setPeriod]=useState(currentPeriod());
  const [rateBp,setRateBp]=useState(initialRateBp);
  const [savingRate,setSavingRate]=useState(false),[rateSaved,setRateSaved]=useState(false);
  const [items,setItems]=useState<BusinessTaxPreviewItem[]|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{paid:number;skipped:number;failed:number}|null>(null);
  useEffect(()=>{store.ensureCommunityFund().catch(e=>setError((e as Error).message))},[store]);
  async function saveRate(){
    if(!firebase)return;
    setSavingRate(true);setError('');setRateSaved(false);
    try{await updateBusinessTaxRate(firebase.db,context,rateBp);setRateSaved(true)}
    catch(e){setError((e as Error).message)}
    finally{setSavingRate(false)}
  }
  async function preview(){
    setBusy(true);setError('');setResult(null);
    try{setItems(await store.previewBusinessTax(period,rateBp))}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function confirm(){
    if(!items)return;
    setBusy(true);setError('');
    try{const r=await store.settleBusinessTax(items);setResult(r);setItems(await store.previewBusinessTax(period,rateBp))}
    catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  const payable=items?.filter(i=>!i.alreadyPaid)??[];
  const total=payable.reduce((sum,i)=>sum+i.amountMinor,0);
  return <div className="section">
    <div className="section-heading"><h2>사업 세금</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {result&&<p role="status" className="success">징수 완료 {result.paid}건 · 이미 징수됨 {result.skipped}건 · 실패 {result.failed}건</p>}
    <div className="assignment-form">
      <label>세율(%, 0~20)<input type="number" min={0} max={20} step={0.1} value={rateBp/100} onChange={e=>{setRateBp(Math.round(Number(e.target.value)*100));setRateSaved(false)}}/></label>
      <button className="button quiet" disabled={savingRate} onClick={saveRate}>세율 저장</button>
      {rateSaved&&<span className="badge">저장됨</span>}
    </div>
    <div className="assignment-form">
      <label>정산 월<input type="month" value={period} onChange={e=>{setPeriod(e.target.value);setItems(null);setResult(null)}}/></label>
      <button className="button primary" disabled={busy} onClick={preview}>미리보기</button>
    </div>
    {items&&<>
      {!items.length?<p className="empty">이번 정산월에 과세할 매출이 있는 사업이 없어요.</p>:<>
        <p className="muted">징수 대상 {payable.length}곳 · 합계 {formatMoney(total,currencySymbol)}</p>
        <div className="list">{items.map(i=><article key={i.journalId} className="task-row"><div className="task-row-head"><b>{i.businessName}</b><span className="badge">{i.alreadyPaid?'징수됨':formatMoney(i.amountMinor,currencySymbol)}</span></div><p className="muted">이번 달 매출 {formatMoney(i.revenueMinor,currencySymbol)}</p></article>)}</div>
        {payable.length>0&&<button className="button primary section" disabled={busy} onClick={confirm}>{payable.length}곳에서 징수 확정</button>}
      </>}
    </>}
    <p className="muted">세율은 교사만 설정할 수 있고 학생은 스스로 세금을 부과할 수 없어요. 걷은 세금은 공동기금 계좌에 모입니다.</p>
  </div>;
}
