import {useEffect,useState} from 'react';
import {proposalStatusNames,type BusinessProposalFields,type Proposal} from '../../domain/proposals';
import {formatMoney} from '../../domain/money';
import type {Business} from '../../domain/business';
import type {FinancialRequest,LoanContract} from '../../domain/loans';
import type {ProposalStore} from '../../data/proposalRepository';
import type {LoanStore} from '../../data/loanRepository';
import type {BusinessStore} from '../../data/businessRepository';
import type {BuildingId} from '../map/buildings';

// 창업 센터(D-109): 이미 있는 세 흐름 — 시민광장 "새 사업 제안"(투표로 통과되면 사업이 실제로
// 생김), 은행 대출(창업 자금), 사업 운영 학생의 상품 관리 — 을 한 화면에서 단계별로 이어 준다.
// 새 데이터나 Rules 없이, 각 단계가 지금 어디까지 왔는지만 보여 주고 해당 화면으로 보내 준다.
const checklist=['누구에게 무엇을 팔까요? (손님과 상품)','얼마에 팔까요? 재료비보다 비싸야 이익이 나요.','처음에 돈이 얼마나 필요할까요? (창업 자금)','누가 함께 일할까요? (직원)','잘 안 되면 어떻게 할까요? (위험과 대책)'];

export function StartupCenter({studentId,proposalStore,loanStore,businessStore,currencySymbol,onGo}:{studentId:string;proposalStore:ProposalStore;loanStore:LoanStore;businessStore:BusinessStore;currencySymbol:string;onGo:(id:BuildingId,tab?:string)=>void}){
  const [data,setData]=useState<{proposals:Proposal[];requests:FinancialRequest[];loans:LoanContract[];businesses:Business[]}|null>(null);
  useEffect(()=>{
    Promise.allSettled([proposalStore.loadProposals(),loanStore.myRequests(),loanStore.myLoans(),businessStore.loadCatalog()]).then(([p,r,l,c])=>setData({
      proposals:p.status==='fulfilled'?p.value.filter(x=>x.type==='business'&&x.authorStudentId===studentId):[],
      requests:r.status==='fulfilled'?r.value:[],
      loans:l.status==='fulfilled'?l.value:[],
      businesses:c.status==='fulfilled'?c.value.businesses.filter(b=>b.ownerStudentId===studentId&&b.status==='active'):[],
    }));
  },[proposalStore,loanStore,businessStore,studentId]);
  if(!data)return <p role="status">창업 기록을 불러오고 있어요.</p>;
  const approved=data.proposals.some(p=>p.status==='approved')||data.businesses.length>0;
  const funded=data.loans.length>0||data.requests.length>0;
  const open=data.businesses.length>0;
  const steps=[
    {done:data.proposals.some(p=>p.status!=='draft'),title:'1. 사업 아이디어 제안하기',desc:'시민광장에 "새 사업 제안"을 써요. 친구들의 투표로 통과되면 가게가 생겨요.',action:<button type="button" className="button secondary small" onClick={()=>onGo('mypage','civic')}>시민광장으로 ↗</button>,
      detail:data.proposals.length?<ul className="history-list">{data.proposals.map(p=><li key={p.id}>{(p.fields as BusinessProposalFields).name} · {proposalStatusNames[p.status]}</li>)}</ul>:null},
    {done:approved,title:'2. 투표로 통과되기',desc:'선생님이 투표를 열면 친구들이 찬성·반대를 골라요. 통과되면 내가 사장님이 돼요.',action:null,detail:null},
    {done:funded,title:'3. 창업 자금 준비하기(선택)',desc:'모아 둔 돈이 부족하면 은행에서 대출을 신청할 수 있어요. 갚을 계획도 꼭 적어요!',action:<button type="button" className="button secondary small" onClick={()=>onGo('bank','bank')}>은행으로 ↗</button>,
      detail:data.loans.length?<ul className="history-list">{data.loans.map(l=><li key={l.id}>{l.productSnapshot.name} {formatMoney(l.principalMinor,currencySymbol)} · {l.status==='repaid'?'다 갚음':`남은 돈 ${formatMoney(l.totalOwedMinor-l.repaidMinor,currencySymbol)}`}</li>)}</ul>:null},
    {done:open,title:'4. 가게 열고 상품 올리기',desc:'내 가게가 생기면 "카페·매점 이용" 탭에서 상품을 올리고 매출을 확인해요.',action:open?<button type="button" className="button secondary small" onClick={()=>onGo('store','shop')}>내 가게 관리 ↗</button>:null,
      detail:open?<ul className="history-list">{data.businesses.map(b=><li key={b.id}>🏪 {b.name}</li>)}</ul>:null},
  ];
  return <section className="startup">
    <div className="section-heading"><div><h2>🚀 창업 센터</h2><p className="muted">나만의 가게를 열어 친구들에게 필요한 것을 팔아 봐요. 사장님이 되면 매출에 사업 세금도 내요.</p></div></div>
    <ol className="startup-steps">{steps.map(s=><li key={s.title} className={s.done?'done':''}>
      <span className="startup-check" aria-hidden="true">{s.done?'✅':'⬜'}</span>
      <div><b>{s.title}</b><p>{s.desc}</p>{s.detail}</div>
      {s.action}
    </li>)}</ol>
    <section className="panel section"><h3>📝 제안서를 쓰기 전에 생각해 봐요</h3><ul className="next-steps">{checklist.map(c=><li key={c}>{c}</li>)}</ul></section>
  </section>;
}
