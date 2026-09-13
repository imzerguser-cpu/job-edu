import {useEffect,useRef,useState} from 'react';
import {auditActionNames,type AuditLog} from '../../domain/audit';
import type {Student} from '../../domain/model';
import type {AuditStore} from '../../data/auditRepository';
import type {CareerStore} from '../../data/careerRepository';
import type {TaskStore} from '../../data/taskRepository';
import type {BusinessStore} from '../../data/businessRepository';
import type {ProposalStore} from '../../data/proposalRepository';

export function OperationsWorkspace({auditStore,careerStore,taskStore,businessStore,proposalStore,students}:{
  auditStore:AuditStore;careerStore:CareerStore;taskStore:TaskStore;businessStore:BusinessStore;proposalStore:ProposalStore;students:Student[];
}){
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [counts,setCounts]=useState<Record<string,number>|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const mounted=useRef(true);

  useEffect(()=>{
    mounted.current=true;setLoading(true);
    Promise.all([auditStore.loadRecent(),careerStore.load(),taskStore.load(),businessStore.loadCatalog(),proposalStore.loadProposals()])
      .then(([auditLogs,career,tasks,catalog,proposals])=>{
        if(!mounted.current)return;
        setLogs(auditLogs);
        setCounts({
          학생: students.length,
          '활동 중 학생': students.filter(s=>s.status==='active').length,
          직업: career.jobs.length,
          '모집 중 직업': career.jobs.filter(j=>j.status==='recruiting').length,
          업무: tasks.tasks.length,
          '검토 대기 업무': tasks.tasks.filter(t=>t.status==='submitted').length,
          사업: catalog.businesses.length,
          상품: catalog.products.length,
          제안: proposals.length,
          '투표 중 제안': proposals.filter(p=>p.status==='voting').length,
        });
      })
      .catch(e=>setError((e as Error).message))
      .finally(()=>{if(mounted.current)setLoading(false)});
    return()=>{mounted.current=false};
  },[auditStore,careerStore,taskStore,businessStore,proposalStore,students]);

  if(loading)return <p role="status">운영 현황을 불러오고 있어요.</p>;

  return <section className="citizen-tasks">
    <div className="section-heading"><h2>운영 현황</h2></div>
    {error&&<p role="alert" className="error">{error}</p>}
    {counts&&<div className="kpis">{Object.entries(counts).map(([label,value])=><div key={label} className="kpi">{label}<b>{value}</b></div>)}</div>}
    <h3 className="section">최근 주요 활동</h3>
    {!logs.length?<p className="empty">아직 기록된 활동이 없어요.</p>:<div className="list">{logs.map(l=><article key={l.id} className="task-row"><div className="task-row-head"><b>{auditActionNames[l.action]??l.action}</b><span className="badge">{l.targetType}</span></div><p className="muted">{l.detail}</p></article>)}</div>}
  </section>;
}
