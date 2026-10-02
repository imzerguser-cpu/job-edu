import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Avatar} from '../src/features/avatar/Avatar';
import {defaultAvatar,fashionItems,wearItem} from '../src/domain/avatar';

describe('fashion artwork',()=>{
  it('renders a distinct visual for every purchasable design',()=>{
    const baseline=renderToStaticMarkup(<Avatar appearance={defaultAvatar}/>);
    const art=fashionItems.map(item=>renderToStaticMarkup(<Avatar appearance={wearItem(defaultAvatar,item)}/>));
    expect(new Set(art).size).toBe(fashionItems.length);
    for(const svg of art){expect(svg).not.toBe(baseline);expect(svg).not.toContain('undefined');expect(svg).toContain('viewBox="0 0 240 320"')}
  });
});
