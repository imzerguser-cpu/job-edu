import {describe,expect,it} from 'vitest';
import {purchaseLock,storybookItemLevel} from '../src/domain/fashionLevels';
import {storybookItems} from '../src/domain/storybook';

describe('레벨 잠금 아이템',()=>{
  it('목록 뒤쪽 아이템일수록 높은 레벨(2개마다 1단계, 최대 Lv.5)',()=>{
    expect([1,2,3,4,5,9].map(index=>storybookItemLevel({index}))).toEqual([1,1,2,2,3,5]);
    const levels=new Set(storybookItems.map(storybookItemLevel));
    expect([...levels].sort()).toEqual([1,2,3,4,5]);
  });
  it('내 레벨이 모자라면 잠기고, 레벨을 아직 모르면 "확인 중"으로 잠근다',()=>{
    expect(purchaseLock(3,5)).toEqual({locked:false});
    expect(purchaseLock(3,3)).toEqual({locked:false});
    expect(purchaseLock(4,2)).toMatchObject({locked:true,reason:'Lv.4부터'});
    expect(purchaseLock(1,null)).toMatchObject({locked:true,reason:'레벨 확인 중'});
  });
});
