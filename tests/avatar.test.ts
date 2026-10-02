import {describe,it,expect} from 'vitest';
import {avatarOptions,canWear,defaultAvatar,fashionItems,validateAvatar,wearItem,normalizeAvatar} from '../src/domain/avatar';
import {previewAvatarStore} from '../src/data/avatarRepository';

describe('avatar wardrobe',()=>{
  it('allows all supported face and hair choices without paid items',()=>{
    for(const [part,values] of Object.entries(avatarOptions))for(const value of values){
      const a={...defaultAvatar,[part]:value};expect(()=>validateAvatar(a)).not.toThrow();
      expect(canWear(a,[])).toBe(!fashionItems.some(i=>i.slot===part&&i.value===value));
    }
  });
  it('migrates the old accessory slot and combines independent accessories',()=>{
    const {eyewear,headwear,...old}=defaultAvatar;
    expect(normalizeAvatar({...old,accessory:'glasses'})).toEqual({...defaultAvatar,eyewear:'glasses'});
    expect(normalizeAvatar({...old,accessory:'cap'})).toEqual({...defaultAvatar,headwear:'cap'});
    expect(canWear({...defaultAvatar,eyewear:'starshades',headwear:'catband',accessory:'ribbontie',hair:'twintails'},['starshades','catband','ribbontie','twintails'])).toBe(true);
    expect(fashionItems).toHaveLength(49);
  });
  it('rejects malformed or unsupported appearances',()=>{
    for(const a of [null,{},[],{...defaultAvatar,eyes:'url(bad)'},{...defaultAvatar,admin:true}])expect(()=>validateAvatar(a)).toThrow();
  });
  it('requires ownership in every equipped slot',()=>{
    const a={...defaultAvatar,outfit:'hoodie',shoes:'boots',eyewear:'glasses'} as const;
    expect(canWear(a,['hoodie','boots'])).toBe(false);expect(canWear(a,['hoodie','boots','glasses'])).toBe(true);
    expect(new Set(fashionItems.map(i=>i.id)).size).toBe(fashionItems.length);
    for(const item of fashionItems){expect(canWear(wearItem(defaultAvatar,item),[])).toBe(false);expect(canWear(wearItem(defaultAvatar,item),[item.id])).toBe(true)}
  });
  it('preview supports buying, equipping and rejects duplicate or unaffordable purchases',async()=>{
    const store=previewAvatarStore(1500);
    await expect(store.save({...defaultAvatar,outfit:'hoodie'})).rejects.toThrow();
    await store.buy('hoodie');await store.save({...defaultAvatar,outfit:'hoodie'});
    expect(await store.load()).toMatchObject({balanceMinor:0,owned:['hoodie'],appearance:{outfit:'hoodie'}});
    await expect(store.buy('hoodie')).rejects.toThrow();await expect(store.buy('glasses')).rejects.toThrow();
  });
});
