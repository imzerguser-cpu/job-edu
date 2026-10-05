import {StorybookStudio} from './StorybookStudio';
import type {StorybookAppearance} from '../../domain/storybook';
import type {AvatarStore} from '../../data/avatarRepository';
import '../../ui/avatar.css';

// 캐릭터 꾸미기·패션 상점 = 동화 캐릭터(D-121). level: 지금 내 레벨(레벨 잠금, D-120).
export function AvatarStudio({onSaved,...props}:{store:AvatarStore;currencySymbol:string;onSaved?:(a:StorybookAppearance)=>void;grade?:number;onShop?:()=>void;shop?:boolean;level?:number|null}){
  return <StorybookStudio key={props.shop?'shop':'wardrobe'} {...props} onSaved={onSaved}/>;
}
