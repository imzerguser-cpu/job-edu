import {describe,expect,it} from 'vitest';
import {bandForGrade,hollandCode,iconProfiles,interestItems,jobFit,recommendJobs,recommendWorldCareers,scoreInterest,scoreStrengths,strengthItems,topStrengths,validateDiscovery,type HollandType} from '../src/domain/careerDiscovery';
import {jobIcons} from '../src/domain/jobs';
import {taskPresets} from '../src/domain/taskPresets';

const all=(band:'low'|'mid'|'high',pick:(type:HollandType)=>number)=>Object.fromEntries(interestItems(band).map(i=>[i.id,pick(i.type)]));

describe('나를 찾는 모험 — 문항',()=>{
  it('학년대별로 문항 수가 늘어나고 모든 문항에 글이 있다',()=>{
    expect(interestItems('low')).toHaveLength(12);
    expect(interestItems('mid')).toHaveLength(18);
    expect(interestItems('high')).toHaveLength(24);
    expect(strengthItems('low')).toHaveLength(8);
    expect(strengthItems('high')).toHaveLength(16);
    for(const band of ['low','mid','high'] as const)expect(interestItems(band).every(i=>i.text.length>0)).toBe(true);
  });
  it('학년을 학년대로 나눈다',()=>{expect([1,2,3,4,5,6].map(bandForGrade)).toEqual(['low','low','mid','mid','high','high'])});
  it('28개 직업 아이콘 모두에 흥미 유형과 추천 업무가 있다',()=>{
    for(const icon of jobIcons){expect(iconProfiles[icon],icon).toBeDefined();expect(taskPresets[icon]?.length,icon).toBeGreaterThan(0)}
  });
});

describe('나를 찾는 모험 — 채점과 추천',()=>{
  it('모두 "좋아요"면 100, 모두 "별로"면 0, 안 고른 문항은 0으로 본다',()=>{
    expect(scoreInterest('low',all('low',()=>2)).R).toBe(100);
    expect(scoreInterest('low',all('low',()=>0)).C).toBe(0);
    expect(scoreInterest('mid',{}).A).toBe(0);
  });
  it('가장 높은 두 유형이 흥미 코드가 되고, 두 번째가 낮으면 한 글자만',()=>{
    const interest=scoreInterest('high',all('high',t=>t==='A'?2:t==='S'?1:0));
    expect(hollandCode(interest)).toBe('AS');
    expect(hollandCode({R:0,I:0,A:100,S:0,E:0,C:0})).toBe('A');
    expect(hollandCode({R:50,I:50,A:0,S:0,E:0,C:0})).toBe('RI'); // 동점은 RIASEC 순서
  });
  it('강점 상위 3개를 고른다',()=>{
    expect(topStrengths(scoreStrengths('low',{music0:2,body0:2,people0:1}))).toEqual(['body','music','people']);
  });
  it('흥미가 맞는 직업이 먼저 추천되고, 한 유형은 최대 2개까지만',()=>{
    const d={interest:{R:0,I:0,A:100,S:40,E:0,C:0},strengths:scoreStrengths('low',{music0:2}),values:[] as never[]};
    const jobs=jobIcons.map(icon=>({icon}));
    const picks=recommendJobs(d,jobs,4);
    expect(picks).toHaveLength(4);
    expect(picks.filter(p=>iconProfiles[p.job.icon].types[0]==='A').length).toBeLessThanOrEqual(2);
    expect(jobFit(d,'singer')).toBeGreaterThan(jobFit(d,'banker'));
    expect(recommendWorldCareers(d).map(c=>c.type)).toEqual(['A','A','A','A','S','S']);
  });
  it('저장 전 검사: 가치는 3개까지, 코드는 RIASEC 글자만',()=>{
    const base={band:'high' as const,interest:{R:0,I:0,A:0,S:0,E:0,C:0},strengths:scoreStrengths('high',{}),values:[] as ('help')[],code:'R',reflection:''};
    expect(()=>validateDiscovery(base)).not.toThrow();
    expect(()=>validateDiscovery({...base,code:'XZ'})).toThrow();
    expect(()=>validateDiscovery({...base,values:['help','help'] as never})).toThrow();
  });
});
