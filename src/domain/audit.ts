export interface AuditLog {id:string;schoolId:string;actorUid:string;action:string;targetType:string;targetId:string;detail:string}
export const auditActionNames:Record<string,string>={
  proposal_decide:'제안 결정',
  business_create:'사업 생성',
  salary_payment:'월급 지급',
  income_tax:'소득세 징수',
  business_tax:'사업 세금 징수',
};
