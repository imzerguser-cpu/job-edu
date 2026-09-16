import {describe,it,expect} from 'vitest';
import {buildings} from '../src/features/map/buildings';
import {jobIcons} from '../src/domain/jobs';

describe('학생 지도 건물',()=>{
  it('모든 건물의 icons는 실제 존재하는 직업 아이콘만 참조한다(오타 방지)',()=>{
    for(const b of buildings){
      for(const icon of b.icons??[])expect(jobIcons,`${b.label}(${b.id})의 아이콘 "${icon}"`).toContain(icon);
    }
  });
  it('마이페이지를 뺀 모든 건물은 icons가 있다(은행·상점은 안내용, 나머지는 실제 화면 스코프용)',()=>{
    for(const b of buildings)if(b.id!=='mypage')expect(b.icons?.length,`${b.label}(${b.id})`).toBeGreaterThan(0);
  });
  it('28개 직업 아이콘 전부가 어느 건물엔가 배정되어 있다(안내서 "이 직업은 어디서" 조회가 항상 성공하도록)',()=>{
    const covered=new Set(buildings.flatMap(b=>b.icons??[]));
    for(const icon of jobIcons)expect(covered.has(icon),`아이콘 "${icon}"을 다루는 건물이 없음`).toBe(true);
  });
  it('같은 부서 안에서도 건물마다 아이콘이 겹치지 않는다(같은 직업이 두 건물에 동시에 나타나지 않도록)',()=>{
    const seen=new Map<string,string>();
    for(const b of buildings)for(const icon of b.icons??[]){
      expect(seen.has(icon),`아이콘 "${icon}"이 ${seen.get(icon)}와 ${b.id} 양쪽에 있음`).toBe(false);
      seen.set(icon,b.id);
    }
  });
});
