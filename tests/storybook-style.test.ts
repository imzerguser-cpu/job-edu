import {describe,it,expect} from 'vitest';
import {applyStyle,defaultStyle,styleCatalog,type StyleCategory} from '../src/features/avatar/storybookCatalog';
describe('storybook mix and match',()=>{
  it('offers four face shapes and ten choices for other parts',()=>{
    expect(Object.keys(styleCatalog)).toHaveLength(8);
    for(const [key,choices] of Object.entries(styleCatalog))expect(new Set(choices).size).toBe(key==='face'?4:10);
  });
  it('changes each independent part without resetting the other selections',()=>{
    let style={...defaultStyle};
    for(const category of ['face','bottom','hair','eyes','nose','mouth','outfit','shoes'] as const){
      for(let i=0;i<styleCatalog[category].length;i++){
        const updated=applyStyle(style,category,i);
        expect(updated[category]).toBe(i);
        for(const key of Object.keys(style) as (keyof typeof style)[])if(key!==category)expect(updated[key]).toBe(style[key]);
        style=updated;
      }
    }
  });
  it('bounds category selections',()=>{
    for(const key of Object.keys(styleCatalog) as StyleCategory[]){
      expect(applyStyle(defaultStyle,key,-1)).toEqual(applyStyle(defaultStyle,key,0));
      expect(applyStyle(defaultStyle,key,11)).toEqual(applyStyle(defaultStyle,key,styleCatalog[key].length-1));
    }
  });
});
