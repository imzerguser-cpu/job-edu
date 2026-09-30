import {describe,expect,it} from 'vitest';
import {achievements,emptyGrowthStats,levelInfo,MAX_LEVEL,quests,totalXp,xpForLevel} from '../src/domain/growth';

describe('시민 성장', () => {
  it('레벨 경계값이 한 칸마다 100씩 늘어난다', () => {
    expect([1,2,3,4,5].map(xpForLevel)).toEqual([0,100,300,600,1000]);
    expect(levelInfo(0)).toMatchObject({level:1,title:'새내기 시민',next:100,toNext:100,progress:0});
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(200)).toMatchObject({level:2,progress:0.5,toNext:100});
  });
  it('최고 레벨에서 멈추고 진행도는 가득 찬다', () => {
    const top=levelInfo(1_000_000);
    expect(top.level).toBe(MAX_LEVEL);expect(top.next).toBeNull();expect(top.progress).toBe(1);
  });
  it('음수나 소수 경험치도 안전하게 처리한다', () => {
    expect(levelInfo(-50)).toMatchObject({level:1,xp:0});
    expect(levelInfo(150.9).xp).toBe(150);
  });
  it('기록마다 정해진 경험치를 더한다', () => {
    expect(totalXp(emptyGrowthStats)).toBe(0);
    expect(totalXp({...emptyGrowthStats,activeJobs:1,taskSubmissions:2,salaries:1})).toBe(80+60+50);
  });
  it('업적은 조건을 채운 것만 획득 표시된다', () => {
    const earned=achievements({...emptyGrowthStats,activeJobs:1,purchases:3}).filter(a=>a.earned).map(a=>a.id);
    expect(earned).toEqual(['first-job','first-purchase']);
  });
  it('모험은 급한 일부터 최대 3개만 제안한다', () => {
    const q=quests({...emptyGrowthStats,selfDiscoveries:1,tasksOpen:2,tasksRevision:1,openTaskBuilding:'store'});
    expect(q).toHaveLength(3);
    expect(q[0]).toMatchObject({id:'revise',target:'store'});
    expect(quests(emptyGrowthStats).map(x=>x.id)).toEqual(['discover','apply','shop']);
  });
  it('나를 찾는 모험은 경험치를 3번까지만 준다', () => {
    expect(totalXp({...emptyGrowthStats,selfDiscoveries:10})).toBe(180);
  });
  it('모든 것을 해낸 시민에게는 남은 모험이 없다', () => {
    expect(quests({...emptyGrowthStats,activeJobs:2,applications:2,purchases:1,savingsJoined:1,proposalsSubmitted:1,selfDiscoveries:1,helpsGiven:1})).toEqual([]);
  });
});
