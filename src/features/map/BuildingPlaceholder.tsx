export function BuildingPlaceholder({label}:{label:string}){
  return <div className="citizen-placeholder">
    <p><b>{label}</b> 업무 화면은 다음 개발 단계에서 연결됩니다.</p>
    <p className="muted">지금은 지도 이동과 마이페이지(직업 둘러보기·신청·내 직업)만 실제로 동작합니다.</p>
  </div>;
}
