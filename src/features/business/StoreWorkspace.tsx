import {useEffect,useRef,useState,type FormEvent} from 'react';
import {formatMoney} from '../../domain/money';
import type {Business,Catalog,Product} from '../../domain/business';
import type {Student} from '../../domain/model';
import type {BusinessStore} from '../../data/businessRepository';

export function StoreWorkspace({store,teacher,students,currencySymbol='마동'}:{store:BusinessStore;teacher:boolean;students:Student[];currencySymbol?:string}){
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
      {catalog.businesses.filter(b=>teacher||b.status==='active').map(b=><article key={b.id} className="task-row">
        <div className="task-row-head"><b>{b.name}</b>{teacher&&<span className="badge">{studentName(b.ownerStudentId)} · {b.status==='active'?'운영 중':'종료'}</span>}</div>
        {teacher&&<div className="header-actions"><button className="button quiet" onClick={()=>setAddingProductTo(b.id)}>+ 상품 추가</button>{b.status==='active'&&<button className="button quiet" disabled={busy} onClick={()=>run(()=>store.saveBusiness({...b,status:'closed'}),'사업을 종료했습니다.')}>사업 종료</button>}</div>}
        {addingProductTo===b.id&&<form className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.saveProduct({id:crypto.randomUUID(),schoolId:'',businessId:b.id,name:String(f.get('name')).trim(),priceMinor:Math.round(Number(f.get('price'))*100),stock:Number(f.get('stock')),lastJournalId:null,status:'active',schemaVersion:1}),'상품을 추가했습니다.')}}>
          <label>상품 이름<input autoFocus name="name" required maxLength={60}/></label>
          <label>가격({currencySymbol})<input name="price" type="number" min={1} max={1000} step={1} required/></label>
          <label>재고<input name="stock" type="number" min={0} max={1000} step={1} required/></label>
          <div className="header-actions"><button className="button primary" disabled={busy}>추가</button><button type="button" className="button quiet" onClick={()=>setAddingProductTo(null)}>취소</button></div>
        </form>}
        <div className="list">{productsOf(b.id).filter(p=>teacher||p.status==='active').map(p=>editingProduct?.id===p.id
          ?<form key={p.id} className="action-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>store.saveProduct({...p,priceMinor:Math.round(Number(f.get('price'))*100),stock:Number(f.get('stock')),status:f.get('status') as Product['status']}),'상품을 수정했습니다.')}}>
            <label>가격({currencySymbol})<input name="price" type="number" min={1} max={1000} step={1} defaultValue={p.priceMinor/100} required/></label>
            <label>재고<input name="stock" type="number" min={0} max={1000} step={1} defaultValue={p.stock} required/></label>
            <label>판매 상태<select name="status" defaultValue={p.status}><option value="active">판매 중</option><option value="paused">판매 중지</option></select></label>
            <div className="header-actions"><button className="button primary" disabled={busy}>저장</button><button type="button" className="button quiet" onClick={()=>setEditingProduct(null)}>취소</button></div>
          </form>
          :<article key={p.id} className="task-row"><div className="task-row-head"><b>{p.name}</b><span className="badge">{formatMoney(p.priceMinor,currencySymbol)}</span></div><p className="muted">재고 {p.stock} · {p.status==='active'?'판매 중':'판매 중지'}</p>
            {teacher?<button className="button quiet" onClick={()=>setEditingProduct(p)}>수정</button>
              :<button className="button primary" disabled={busy||p.status!=='active'||p.stock<1} onClick={()=>run(()=>store.buy(b.id,p.id),`${p.name}을(를) 구매했습니다.`)}>{p.stock<1?'품절':'구매하기'}</button>}
          </article>)}
        </div>
      </article>)}
    </div>}
  </section>;
}
