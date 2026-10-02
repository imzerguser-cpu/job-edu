import type {AvatarAppearance} from '../../domain/avatar';

const star='m0-12 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z';
function Flower({x,y,color='#fff4c9'}:{x:number;y:number;color?:string}){return <g transform={`translate(${x} ${y})`}><path d="M0-3C-16-18-18 4-5 4C-15 18 7 19 5 5C22 8 15-14 3-5C10-20-11-20 0-3" fill={color}/><circle r="4" fill="#efbb45"/></g>}

export function HairBack({a,color}:{a:AvatarAppearance;color:string}){return <g fill={color}>
  {a.hair==='twintails'&&<><path d="M66 65Q27 44 32 99L22 183Q65 194 72 116Z"/><path d="M174 65Q213 44 208 99L218 183Q175 194 168 116Z"/></>}
  {a.hair==='spacebuns'&&<><circle cx="65" cy="43" r="29"/><circle cx="175" cy="43" r="29"/><path d="M46 40q20-24 36 7M159 35q24-15 34 15" stroke="#ffffff" opacity=".16" strokeWidth="4" fill="none"/></>}
  {(a.hair==='wavy'||a.hair==='halfup')&&<path d="M65 62Q42 76 51 108Q31 132 49 151Q32 178 58 195Q87 211 86 174H155Q151 204 181 195Q206 178 190 156Q211 134 188 111Q198 65 166 45Z"/>}
  {a.hair==='afro'&&Array.from({length:12},(_,i)=><circle key={i} cx={120+65*Math.cos(i*Math.PI/6)} cy={82+50*Math.sin(i*Math.PI/6)} r="25"/>)}
  {a.hair==='braids'&&[60,180].map(x=><g key={x}>{[110,129,148,167,185].map((y,i)=><ellipse key={y} cx={x+(i%2?4:-4)} cy={y} rx="13" ry="14"/>)}<path d={`M${x-11} 192h22l-6 21h-10Z`}/><path d={`M${x-11} 190h22`} stroke="#e990ae" strokeWidth="7"/></g>)}
</g>}

export function HairFront({a,color}:{a:AvatarAppearance;color:string}){return <g fill={color}>
  {a.hair==='pixie'&&<path d="M69 73 64 104 81 90 89 60 115 51 107 82 137 53 174 88Q181 28 121 24Q67 21 60 67Z"/>}
  {a.hair==='bowl'&&<path d="M60 88Q52 21 120 23Q188 21 180 88L162 95V80H78V95Z"/>}
  {a.hair==='mohawk'&&<path d="m104 68-7-27 13 4-1-29 14 10 9-20 10 24 13-7-5 31-18 21Z" stroke={color} strokeWidth="9"/>}
  {a.hair==='halfup'&&<><ellipse cx="120" cy="29" rx="24" ry="19"/><path d="M94 37q26 8 51 0" stroke="#d794b1" strokeWidth="6" fill="none"/></>}
  {a.hair==='wavy'&&<path d="M63 78Q88 21 125 43Q154 80 175 67L178 89Q152 95 126 59Q105 92 68 95Z"/>}
  {a.hair==='sidebraid'&&<><path d="M70 74Q61 22 124 26Q173 25 180 78L147 60Q114 96 72 87Z"/>{[117,138,158,176].map((y,i)=><ellipse key={y} cx={175+(i%2?2:-5)} cy={y} rx="15" ry="16"/>)}<path d="m160 188 25-2-8 26-14-5Z"/><path d="m160 185 23-1" stroke="#6ccdc7" strokeWidth="7"/></>}
</g>}

export const outfitColors:Record<AvatarAppearance['outfit'],string>={tee:'#63bccc',hoodie:'#9a80d4',overalls:'#6799c9',dress:'#bf8fd2',jacket:'#df7a64',sailor:'#f5f8fc',tracksuit:'#4eb4a0',raincoat:'#98ca54',hanbok:'#ef9fbb',spacesuit:'#e4eaf3',chef:'#fff8e9',knit:'#dc9e5f',flowerdress:'#8ebfdf'};
export function OutfitDetails({a}:{a:AvatarAppearance}){return <g strokeLinejoin="round">
  {a.outfit==='sailor'&&<><path d="m93 163 27 28 27-28 8 21-35 24-35-24Z" fill="#375c96"/><path d="m99 172 21 23 22-23" fill="none" stroke="white" strokeWidth="3"/><path d="m120 192-12 10 10 18 12-18Z" fill="#e77787"/><path d="M85 230h70" stroke="#375c96" strokeWidth="7"/></>}
  {a.outfit==='tracksuit'&&<><path d="M120 171v70M80 174l14 14M160 174l-14 14" stroke="white" strokeWidth="5"/><path d="m98 213-8 12m52-12 8 12" stroke="#247e77" strokeWidth="4"/><path d="M90 245v30m53-30v30" stroke="#a5e4dc" strokeWidth="5"/></>}
  {a.outfit==='raincoat'&&<><path d="M95 161q-10 27 25 25 34 0 25-25M120 187v55" fill="none" stroke="#609637" strokeWidth="5"/>{[199,214,230].map(y=><circle key={y} cx="120" cy={y} r="3" fill="#f5e466"/>)}<path d="M88 212h21v16H88ZM131 212h21v16h-21Z" fill="#cce77f"/><circle cx="94" cy="210" r="5" fill="white"/><circle cx="103" cy="210" r="5" fill="white"/><path d="M94 210h1m8 0h1" stroke="#395733" strokeWidth="3"/></>}
  {a.outfit==='hanbok'&&<><path d="M82 200h76l18 53q-55 24-112 0Z" fill="#7aaeb4"/><path d="m100 162 38 38m2-38-31 37" stroke="#fff6df" strokeWidth="8"/><path d="M83 201h75" stroke="#bc507b" strokeWidth="8"/><path d="m128 201-10 36 15-9 9 9-5-36 19 12-1-21Z" fill="#bc507b"/></>}
  {a.outfit==='spacesuit'&&<><path d="M99 166q21 19 42 0M84 235h72M79 178l11 8m71-8-11 8" fill="none" stroke="#6895b9" strokeWidth="6"/><rect x="100" y="193" width="40" height="29" rx="5" fill="#506887"/><rect x="106" y="199" width="17" height="10" fill="#90e2dc"/><circle cx="132" cy="201" r="3" fill="#ee9b6e"/><path d="M106 215h26" stroke="white" strokeWidth="3"/><path d="M94 249v22m48-22v22" stroke="#c5d8e8" strokeWidth="13"/></>}
  {a.outfit==='chef'&&<><path d="m101 164 19 21 19-21M120 185v56" stroke="#cdcac3" strokeWidth="3" fill="none"/>{[199,215,231].flatMap(y=>[109,131].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#4a5662"/>))}<path d="m112 170 8 15 8-15-8 4Z" fill="#e27966"/><path d="M83 237h74" stroke="#4a5662" strokeWidth="7"/></>}
  {a.outfit==='knit'&&<><path d="M99 166q21 17 42 0M86 236h68" fill="none" stroke="#aa703c" strokeWidth="8"/>{[99,120,141].map(x=><path key={x} d={`M${x} 189q-12 9 0 17t0 17m0-34q12 9 0 17t0 17`} fill="none" stroke="#f6d7a8" strokeWidth="3"/>)}</>}
  {a.outfit==='flowerdress'&&<><path d="M88 201h64" stroke="#fff2b7" strokeWidth="6"/>{[[103,184],[87,226],[135,221],[116,246],[155,245]].map(([x,y])=><g key={x} transform={`translate(${x} ${y}) scale(.5)`}><Flower x={0} y={0}/></g>)}<path d="M69 250q50 16 102 0" stroke="#e4f3f9" strokeWidth="5" fill="none"/></>}
</g>}

export function NewShoes({kind,skin}:{kind:AvatarAppearance['shoes'];skin:string}){
  const colors:Record<string,string>={hightops:'#83a9e2',loafers:'#835441',sandals:'#e1a766',ballet:'#edaac1',spaceboots:'#d0e2eb',skates:'#a492dc'};
  if(!colors[kind])return null;
  return <g stroke="#514b52" strokeWidth="2.5" strokeLinejoin="round">
    <path d={['hightops','spaceboots','skates'].includes(kind)?'M82 261H111V280L118 289Q122 297 108 297H74Q65 294 74 282L82 280Z':'M82 278H109L117 288Q123 297 108 297H74Q66 294 73 284Z'} fill={kind==='sandals'?skin:colors[kind]}/>
    {kind==='hightops'&&<><path d="M83 265h27M85 272h19m-20 6h18m-23 15h34" stroke="white" strokeWidth="4"/><path d="m85 283 12 3" stroke="#e0a178" strokeWidth="5"/></>}
    {kind==='loafers'&&<><path d="M77 286h33" stroke="#be8c67" strokeWidth="7"/><rect x="90" y="282" width="10" height="7" rx="1" fill="#f7d175" stroke="none"/></>}
    {kind==='sandals'&&<path d="m83 280 23 10m-4-10-23 10m-7 5h41" stroke="#9d714a" strokeWidth="6"/>}
    {kind==='ballet'&&<><path d="M84 278q10 16 22 0" fill={skin}/><path d="m95 287-9-5v9Zm0 0 9-5v9Z" fill="#bc6485" stroke="none"/></>}
    {kind==='spaceboots'&&<><path d="M81 268h29m-32 25h36" stroke="#6383a0" strokeWidth="7"/><path d="M88 278h18" stroke="#7bcec9" strokeWidth="5"/></>}
    {kind==='skates'&&<><path d="M85 270h20m-23 7h21" stroke="#fff1b8" strokeWidth="4"/><circle cx="81" cy="300" r="6" fill="#ea98ba"/><circle cx="107" cy="300" r="6" fill="#ea98ba"/></>}
  </g>;
}

export function Eyewear({kind}:{kind:AvatarAppearance['eyewear']}){
  if(kind==='none')return null;
  const shades=kind.endsWith('shades');
  return <g stroke={shades?'#424461':'#815984'} strokeWidth="4" fill={shades?'#526982':'none'} strokeLinejoin="round">
    <path d="M113 104h14M78 103H66M161 103h12" fill="none"/>
    {(kind==='glasses'||kind==='roundshades')&&<><circle cx="96" cy="106" r="17"/><circle cx="144" cy="106" r="17"/></>}
    {kind==='squareglasses'&&<><rect x="77" y="92" width="36" height="28" rx="5"/><rect x="127" y="92" width="36" height="28" rx="5"/></>}
    {kind==='catglasses'&&<><path d="M75 88 113 98Q118 124 91 119Z"/><path d="M165 88 127 98Q122 124 149 119Z"/></>}
    {kind==='sportshades'&&<path d="M73 93h94l-6 23-23 3-18-11-18 11-23-3Z" fill="#66bac3"/>}
    {kind==='starshades'&&[95,145].map(x=><path key={x} d={star} transform={`translate(${x} 106) scale(1.7)`} stroke="#e2b454"/>)}
    {shades&&<path d="m85 99 10 10m40-10 10 10" stroke="#ffffff" opacity=".45" strokeWidth="3"/>}
  </g>;
}

export function Headwear({kind}:{kind:AvatarAppearance['headwear']}){return <g strokeLinejoin="round">
  {kind==='beanie'&&<><path d="M64 65Q64 15 120 18Q178 15 176 65Z" fill="#ed99b3"/><circle cx="120" cy="15" r="13" fill="#ffdaaf"/><path d="M69 61h101" stroke="#c1648b" strokeWidth="17" strokeLinecap="round"/>{[83,102,121,140,159].map(x=><path key={x} d={`M${x} 55v12`} stroke="#ffd9e5" strokeWidth="3"/>)}</>}
  {kind==='beret'&&<><path d="M60 50Q47 21 111 20Q177 9 185 44Q179 70 70 61Z" fill="#bb675f"/><path d="M75 60q44 8 91-4" stroke="#83453f" strokeWidth="9"/><path d="m118 20 5-13" stroke="#83453f" strokeWidth="6"/></>}
  {kind==='bucket'&&<><path d="m79 26 77 0 13 41H66Z" fill="#76b4ad" stroke="#417e77" strokeWidth="3"/><path d="M66 59 48 79Q120 94 192 79L169 59Z" fill="#8fc9b8" stroke="#417e77" strokeWidth="3"/><path d="M73 49h87" stroke="#fff1c2" strokeWidth="7"/></>}
  {kind==='crown'&&<><path d="m74 62-8-38 32 18 22-31 23 31 31-18-8 38Z" fill="#f4cd61" stroke="#c19538" strokeWidth="3"/><path d={star} transform="translate(120 44) scale(.7)" fill="#e88aa3"/><path d="M78 62h85" stroke="#e4a74e" strokeWidth="8"/></>}
  {kind==='catband'&&<><path d="M66 80Q72 19 120 29Q170 19 177 80" stroke="#a57ca8" strokeWidth="9" fill="none"/><path d="M70 52 67 13 100 36ZM142 35 175 13 173 55Z" fill="#a57ca8" stroke="#72527b" strokeWidth="3"/><path d="m75 38-1-14 14 12m65 0 14-12-1 14" stroke="#edbed1" strokeWidth="7"/></>}
  {kind==='flowerband'&&<><path d="M65 76Q75 23 120 32Q169 27 175 77" stroke="#639870" strokeWidth="8" fill="none"/>{[[74,57],[94,37],[120,32],[148,39],[169,58]].map(([x,y],i)=><g key={x} transform={`translate(${x} ${y}) scale(.65)`}><Flower x={0} y={0} color={i%2?'#f6b6ca':'#fff2bf'}/></g>)}</>}
</g>}

export function HairAccessories({kind}:{kind:AvatarAppearance['accessory']}){return <g>
  {kind==='scrunchie'&&<g transform="translate(176 74)">{Array.from({length:8},(_,i)=><circle key={i} cx={10*Math.cos(i*Math.PI/4)} cy={10*Math.sin(i*Math.PI/4)} r="6" fill={['#ed98b4','#eccc75','#89cbbd','#a48ad2'][i%4]}/>)}<circle r="5" fill="#674537"/></g>}
  {kind==='ribbontie'&&<g fill="#67bfc9" stroke="#388d9b" strokeWidth="2"><path d="m170 75-13 44 14-5 6 9 1-48 16 37 5-12 10 1-29-32Z"/><path d="M172 74q-33-28-26 0 6 10 26 4m3-4q20-30 27-7 1 15-27 12Z"/><circle cx="174" cy="77" r="6"/></g>}
  {kind==='starclip'&&<g transform="translate(157 72) rotate(18)"><path d="M-15 2h30" stroke="#b9788f" strokeWidth="7" strokeLinecap="round"/><path d={star} fill="#f7d267" stroke="#d6a344" strokeWidth="2"/></g>}
</g>}
