import {defaultStyle,styleCatalog,type CharacterStyle,type StyleCategory} from '../features/avatar/storybookCatalog';
import {collectionCatalogs,type StudentCollection} from '../features/avatar/studentCollections';
import {growthShape} from './studentGrowth';
export interface StorybookAppearance {collection:StudentCollection;style:CharacterStyle;shape:{height:number;build:number}}
export const defaultStorybook=(grade=3):StorybookAppearance=>({collection:'boys',style:{...defaultStyle},shape:growthShape(grade)});
export const paidParts=['hair','outfit','bottom','shoes'] as const;
export type StorybookSlot=typeof paidParts[number];
export const storybookItemId=(collection:StudentCollection,slot:StorybookSlot,index:number)=>`sb-${collection}-${slot}-${index}`;
const prices={hair:1200,outfit:1800,bottom:1200,shoes:1000};
export const storybookItems=(['boys','girls'] as const).flatMap(collection=>paidParts.flatMap(slot=>collectionCatalogs[collection][slot].slice(1).map((name,i)=>({id:storybookItemId(collection,slot,i+1),collection,slot,index:i+1,name,priceMinor:prices[slot]}))));
export type StorybookItem=typeof storybookItems[number];
export function validateStorybook(value:unknown):asserts value is StorybookAppearance{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('캐릭터 정보를 확인해 주세요.');
  const a=value as StorybookAppearance;
  if(Object.keys(a).sort().join(',')!=='collection,shape,style'||!['boys','girls'].includes(a.collection)||!a.style||!a.shape)throw new Error('캐릭터 정보를 확인해 주세요.');
  if(Object.keys(a.style).length!==Object.keys(styleCatalog).length)throw new Error('꾸미기 항목을 확인해 주세요.');
  for(const key of Object.keys(styleCatalog) as StyleCategory[])if(!Number.isInteger(a.style[key])||a.style[key]<0||a.style[key]>=styleCatalog[key].length)throw new Error('선택할 수 없는 캐릭터 모양이에요.');
  if(Object.keys(a.shape).sort().join(',')!=='build,height'||![a.shape.height,a.shape.build].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100))throw new Error('키와 체형을 확인해 주세요.');
}
export function canWearStorybook(a:StorybookAppearance,owned:readonly string[]){return paidParts.every(slot=>a.style[slot]===0||owned.includes(storybookItemId(a.collection,slot,a.style[slot])));}
