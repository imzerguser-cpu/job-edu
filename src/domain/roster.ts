export interface RosterRow {sourceRow:number;name:string;grade:number;className:string|null}
export interface RosterIssue {row:number;message:string}
export interface RosterPreview {rows:RosterRow[];issues:RosterIssue[];gradeCounts:Record<number,number>}
// Accept copied Sheets TSV or CSV. Quoted delimiters, line breaks and escaped quotes are handled.
export function parseDelimited(input:string):string[][]{
  const text=input.replace(/^\uFEFF/,'');
  if(text.length>100_000)throw new Error('한 번에 100KB 이하의 명단만 확인해 주세요.');
  const delimiter=text.split(/\r?\n/,1)[0].includes('\t')?'\t':',';
  const out:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(quoted){quoted=false}else if(!cell){quoted=true}else{cell+=c}}
    else if(c===delimiter&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);out.push(row);row=[];cell=''}
    else cell+=c;
  }
  if(quoted)throw new Error('따옴표가 닫히지 않은 행이 있습니다.');
  if(cell||row.length){row.push(cell);out.push(row)}
  return out;
}
export function previewRoster(input:string,defaultClass:string|null=null):RosterPreview{
  const parsed=parseDelimited(input),header=parsed[0]?.map(v=>v.trim())??[];
  if(header.filter(h=>h==='학년').length!==1||header.filter(h=>h==='이름').length!==1)throw new Error('첫 줄에 학년, 이름 열이 각각 하나씩 필요합니다.');
  const gi=header.indexOf('학년'),ni=header.indexOf('이름'),ci=header.indexOf('반');
  const rows:RosterRow[]=[],issues:RosterIssue[]=[],seen=new Set<string>(),gradeCounts:Record<number,number>={};
  if(parsed.length>501)throw new Error('한 번에 최대 500명까지 확인할 수 있습니다.');
  parsed.slice(1).forEach((r,index)=>{
    if(!r.some(v=>v.trim()))return;
    const sourceRow=index+2,name=(r[ni]??'').trim().normalize('NFC'),rawGrade=(r[gi]??'').trim();
    const grade=/^[1-6](?:학년)?$/.test(rawGrade)?Number(rawGrade[0]):NaN;
    const className=((ci>=0?r[ci]:defaultClass)??'').trim()||null;
    if(!name||name.length>40||/[\u0000-\u001f]/.test(name)){issues.push({row:sourceRow,message:'이름을 확인해 주세요.'});return}
    if(!Number.isInteger(grade)){issues.push({row:sourceRow,message:'학년은 1~6 또는 1학년~6학년이어야 합니다.'});return}
    if(className&&className.length>20){issues.push({row:sourceRow,message:'반 이름은 20자 이하로 입력해 주세요.'});return}
    const key=JSON.stringify([grade,className,name]);
    if(seen.has(key)){issues.push({row:sourceRow,message:'같은 학년·반·이름이 중복됩니다. 동일인인지 확인해 주세요.'});return}
    seen.add(key);rows.push({sourceRow,name,grade,className});gradeCounts[grade]=(gradeCounts[grade]??0)+1;
  });
  if(!rows.length&&!issues.length)throw new Error('학생 데이터가 없습니다.');
  return {rows,issues,gradeCounts};
}
