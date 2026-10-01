import {describe,it,expect} from 'vitest';
import {buildings} from '../src/features/map/buildings';
import {buildingOutlines,mapSize,outlineGeometry} from '../src/features/map/buildingOutlines';

describe('map building outlines',()=>{
  it('has a nonrectangular outline inside the artwork for every destination',()=>{
    for(const {id} of buildings){
      const points=buildingOutlines[id];
      expect(points.length).toBeGreaterThan(4);
      for(const [x,y] of points){
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(mapSize.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(mapSize.height);
      }
    }
  });
  it('uses the same coordinates for the responsive click boundary and visible outline',()=>{
    for(const {id} of buildings){
      const geometry=outlineGeometry(id);
      const [left,top,width,height]=geometry.viewBox.split(' ').map(Number);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      const normalized=geometry.clipPath.slice(8,-1).split(',');
      normalized.forEach((point,index)=>{
        const [x,y]=point.split(' ').map(parseFloat);
        expect(left+x/100*width).toBeCloseTo(buildingOutlines[id][index][0]);
        expect(top+y/100*height).toBeCloseTo(buildingOutlines[id][index][1]);
      });
    }
  });
});
