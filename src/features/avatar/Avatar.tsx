import {StorybookAvatar} from './StorybookAvatar';
import type {StorybookAppearance} from '../../domain/storybook';
import type {AvatarAppearance} from '../../domain/avatar';
import {HairBack,HairFront,OutfitDetails,outfitColors,NewShoes,Eyewear,Headwear,HairAccessories} from './FashionLayers';
const skins={peach:'#ffd7b5',sand:'#e9b98c',gold:'#dca46e',brown:'#b87950',deep:'#805037',rose:'#f2c3b5'};
const hairColors={black:'#292939',brown:'#5a3b30',chestnut:'#9c5638',blond:'#e9b74d',purple:'#8a68b7'};

/** Layered vector avatar: a complete body with generous margins, never cropped. */
export function Avatar({appearance:a,storybook,className='',label='내 캐릭터'}:{appearance:AvatarAppearance;storybook?:StorybookAppearance;className?:string;label?:string}){
  if(storybook)return <span className={`avatar-art ${className}`}><StorybookAvatar style={storybook.style} shape={storybook.shape} collection={storybook.collection} label={label}/></span>;
  const skin=skins[a.skin],hair=hairColors[a.hairColor];
  const faceWidth=a.face==='oval'?49:a.face==='soft'?56:59;
  const shirt=outfitColors[a.outfit];
  const skirt=['dress','flowerdress','hanbok'].includes(a.outfit);
  const newShoes=['hightops','loafers','sandals','ballet','spaceboots','skates'].includes(a.shoes);
  return <svg className={`avatar-art ${className}`} viewBox="0 0 240 320" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="120" cy="298" rx="68" ry="10" fill="#375741" opacity=".12"/>
    <HairBack a={a} color={hair}/>{a.hair==='long'&&<path d="M61 86Q62 22 120 25Q181 24 179 87L191 199Q160 218 155 170H84L69 205Q49 192 49 176Z" fill={hair}/>}
    {a.hair==='ponytail'&&<path d="M165 54Q217 35 207 90L193 166Q174 155 171 119Z" fill={hair}/>}
    <path d="M85 220H112L109 280H85ZM127 220H155V280H131Z" fill={skirt?skin:'#475d83'} stroke="#374563" strokeWidth="2"/>
    <path d="M78 171Q63 175 57 218Q57 233 69 232Q78 231 80 209L92 185ZM163 171Q179 175 184 218Q185 233 172 232Q163 231 161 209L149 185Z" fill={skin} stroke="#a26853" strokeWidth="2"/>
    <path d={skirt?'M97 160H143L163 197L176 252Q120 270 64 252L77 197Z':'M97 160H143L169 176L158 200L151 190L160 239Q120 249 80 239L89 190L80 200L69 176Z'} fill={shirt} stroke="#455775" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M108 146H132V167Q120 180 108 167Z" fill={skin}/>
    {a.outfit==='tee'&&<><path d="M105 169Q120 185 135 169" fill="none" stroke="#e5ffff" strokeWidth="5"/><path d="m120 195 5 9 10 2-7 8 1 10-9-5-9 5 1-10-7-8 10-2Z" fill="#ffdb76"/></>}
    {a.outfit==='hoodie'&&<><path d="M95 163Q120 199 145 163M105 181V203M135 181V203" fill="none" stroke="#e7ddff" strokeWidth="4"/><path d="M99 218H141L147 236H93Z" fill="#8067b7"/><circle cx="105" cy="203" r="3" fill="white"/><circle cx="135" cy="203" r="3" fill="white"/></>}
    {a.outfit==='overalls'&&<><path d="M94 168V207H146V168M94 194H146V240H94Z" fill="#426c9e" stroke="#f9cf74" strokeWidth="3"/><rect x="106" y="205" width="28" height="22" rx="4" fill="#81add4"/><circle cx="98" cy="195" r="4" fill="#ffdc77"/><circle cx="142" cy="195" r="4" fill="#ffdc77"/></>}
    {a.outfit==='dress'&&<><path d="M88 201H152" stroke="#ffe2a4" strokeWidth="7"/><path d="m120 201-15-9v18ZM120 201l15-9v18Z" fill="#fff0c9"/><path d="m98 218-5 29m27-28v31m23-32 5 28" stroke="#a674b9" strokeWidth="3"/></>}
    {a.outfit==='jacket'&&<><path d="M120 174V241M98 164l22 17 22-17" stroke="#fff6de" strokeWidth="6"/><text x="135" y="207" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#fff6de">M</text></>}
    <OutfitDetails a={a}/>{(['left','right'] as const).map((side,i)=><g key={side} transform={`translate(${i*47} 0)`}>
      {newShoes?<NewShoes kind={a.shoes} skin={skin}/>:<>{a.shoes==='boots'||a.shoes==='rainboots'?<path d="M82 260H111V281Q117 285 116 294H73Q69 280 82 279Z" fill={a.shoes==='boots'?'#916342':'#ffd45e'} stroke="#514b52" strokeWidth="3"/>:<path d="M82 277H110L116 288Q121 298 108 297H74Q66 293 73 286Z" fill={a.shoes==='sneakers'?'#ec8b8f':'#f4f5ec'} stroke="#514b52" strokeWidth="3"/>}
      <path d="M75 291H111" stroke={a.shoes==='rainboots'?'#c38f31':'#fff'} strokeWidth="4"/>
      {a.shoes==='sneakers'&&<path d="m95 281 2 3 4 1-3 3v3l-3-2-3 2v-3l-3-3 4-1Z" fill="#fff1b8"/>}
    </>}</g>)}
    <ellipse cx="62" cy="106" rx="12" ry="16" fill={skin}/><ellipse cx="178" cy="106" rx="12" ry="16" fill={skin}/>
    <ellipse cx="120" cy="99" rx={faceWidth} ry={a.face==='oval'?66:60} fill={skin} stroke="#a26853" strokeWidth="2"/>
    <path d="M67 84Q57 33 111 28Q170 19 178 80L154 66Q144 58 137 52Q112 80 67 84Z" fill={hair}/>
    {a.hair==='bob'&&<path d="M67 61Q51 98 64 141L81 147L75 87ZM171 61Q190 94 178 146L160 147L167 87Z" fill={hair}/>}
    {a.hair==='spiky'&&<path d="m63 74 1-40 23 12 8-27 21 19 18-23 12 24 27-7-5 35Z" fill={hair}/>}
    {a.hair==='curly'&&[72,91,112,135,156,170].map((x,i)=><circle key={x} cx={x} cy={i===0||i===5?65:43} r="20" fill={hair}/>)}
    <HairFront a={a} color={hair}/>
    <path d="M86 88q10-6 19-1M135 87q10-5 19 1" stroke={hair} strokeWidth="4" fill="none" strokeLinecap="round"/>
    {[96,144].map(x=><g key={x}>
      {a.eyes==='smile'?<path d={`M${x-7} 107q7-12 14 0`} fill="none" stroke="#303342" strokeWidth="4" strokeLinecap="round"/>:a.eyes==='almond'?<><path d={`M${x-10} 103q10-12 20 0-10 12-20 0`} fill="white"/><circle cx={x} cy="103" r="6" fill="#303342"/></>:<><ellipse cx={x} cy="104" rx={a.eyes==='sparkle'?10:8} ry="12" fill="#303342"/><circle cx={x-2} cy="100" r="3.5" fill="white"/>{a.eyes==='sparkle'&&<circle cx={x+4} cy="110" r="2.5" fill="#fbe58d"/>}</>}
    </g>)}
    <ellipse cx="80" cy="122" rx="9" ry="5" fill="#ef9b91" opacity=".55"/><ellipse cx="160" cy="122" rx="9" ry="5" fill="#ef9b91" opacity=".55"/>
    {a.nose==='round'?<ellipse cx="120" cy="119" rx="6" ry="5" fill="#cf8d70"/>:a.nose==='small'?<path d="M117 121h6" stroke="#a26853" strokeWidth="3" strokeLinecap="round"/>:<path d="m120 111-4 10h7" fill="none" stroke="#a26853" strokeWidth="2.5" strokeLinecap="round"/>}
    {a.mouth==='smile'?<path d="M109 135q11 13 22 0" fill="none" stroke="#8f4b4d" strokeWidth="3" strokeLinecap="round"/>:a.mouth==='grin'?<><path d="M106 132h28q-1 21-14 19-12 0-14-19" fill="#9c4e59"/><path d="M110 134h20v5h-20Z" fill="white"/></>:a.mouth==='wow'?<ellipse cx="120" cy="139" rx="6" ry="8" fill="#9c4e59"/>:<path d="M112 137h16" stroke="#8f4b4d" strokeWidth="3" strokeLinecap="round"/>}
    <Eyewear kind={a.eyewear}/>
    {a.headwear==='cap'&&<><path d="M64 63Q67 14 123 19Q174 21 176 66Z" fill="#f2c452" stroke="#b48535" strokeWidth="3"/><path d="M63 61Q123 44 187 65Q201 80 161 78L64 73Z" fill="#e2ae34"/><path d="m120 29 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" fill="#fff6cd"/></>}
    <Headwear kind={a.headwear}/><HairAccessories kind={a.accessory}/>
    {a.accessory==='bow'&&<g fill="#e77794" stroke="#b64c6e" strokeWidth="2"><path d="M152 51Q124 22 129 57Q135 70 152 57ZM155 51Q179 21 181 53Q180 67 155 57Z"/><circle cx="153" cy="53" r="8"/></g>}
    {a.accessory==='headphones'&&<g fill="#8274d5" stroke="#504288" strokeWidth="4"><path d="M57 108V81a63 63 0 0 1 126 0v27" fill="none" strokeWidth="9"/><rect x="50" y="93" width="17" height="34" rx="7"/><rect x="173" y="93" width="17" height="34" rx="7"/></g>}
  </svg>;
}
