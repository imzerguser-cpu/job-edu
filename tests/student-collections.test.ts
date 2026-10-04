import {describe,it,expect} from 'vitest';
import {collectionCatalogs,collectionMaps,collectionStyle} from '../src/features/avatar/studentCollections';
import {defaultStyle} from '../src/features/avatar/storybookCatalog';
describe('student collections',()=>{
 it('provides four face shapes and ten other choices in both collections',()=>{for(const catalog of Object.values(collectionCatalogs)){expect(Object.keys(catalog)).toHaveLength(8);for(const [key,names] of Object.entries(catalog)){const count=key==='face'?4:10;expect(names).toHaveLength(count);expect(new Set(names).size).toBe(count);}}});
 it('keeps skirts, long hair and Mary Janes out of the boys collection',()=>{expect(collectionMaps.boys.bottom.every(i=>i<5)).toBe(true);expect(collectionMaps.boys.hair.every(i=>[0,1,6,9].includes(i))).toBe(true);expect(collectionMaps.boys.shoes.some(i=>[5,9].includes(i))).toBe(false);});
 it('maps girls starting outfit to a skirt and preserves independently chosen facial features',()=>{const value=collectionStyle('girls',{...defaultStyle,eyes:5,nose:8,mouth:9});expect(value.bottom).toBe(5);expect(value.eyes).toBe(5);expect(value.nose).toBe(8);expect(value.mouth).toBe(9);});
});
