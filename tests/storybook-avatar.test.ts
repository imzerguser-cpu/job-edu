import {describe,it,expect} from 'vitest';
import {bodyRig,gradeShapes,cheekExpansion} from '../src/features/avatar/StorybookAvatar';
describe('storybook body proportions',()=>{
  it('keeps the face undistorted and the feet grounded at every slider extreme',()=>{
    for(const height of [0,50,100])for(const build of [0,50,100]){
      const r=bodyRig({height,build});
      expect(r.headScale).toBe(.43);
      expect(r.waistY+632*r.legY).toBeCloseTo(850);
      expect(r.neckY+391*r.torsoY).toBeCloseTo(r.waistY);
      expect(r.neckY+(143-647)*r.headScale).toBeGreaterThan(0);
    }
  });
  it('offers six progressively taller presets using the official growth reference',()=>{
    expect(gradeShapes).toHaveLength(6);
    expect(new Set(gradeShapes.map(s=>s.build)).size).toBeGreaterThan(1);
    for(let i=1;i<6;i++)expect(bodyRig(gradeShapes[i]).neckY).toBeLessThan(bodyRig(gradeShapes[i-1]).neckY);
  });
});

it('smoothly broadens the face with body fullness',()=>{expect(cheekExpansion(450,1)).toBeCloseTo(1.3);expect(cheekExpansion(600,0)).toBe(1);expect(cheekExpansion(600,1)).toBeGreaterThan(cheekExpansion(600,.5));});
