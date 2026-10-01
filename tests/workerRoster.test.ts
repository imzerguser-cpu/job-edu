import {afterEach,describe,expect,it,vi} from 'vitest';
import {defaultStudentPassword,importRosterFromSheet,updateStudentProfile,type Env} from '../cf-worker/src/index';

// 관리 서버(Worker)의 명단·계정 만들기/학생 수정 로직을 가짜 Google API로 확인한다(실제 계정은 건드리지 않음).
const env:Env={GOOGLE_CLIENT_EMAIL:'x',GOOGLE_PRIVATE_KEY_B64:'x',FIREBASE_PROJECT_ID:'demo',ALLOWED_ORIGIN:'x'};
type Call={url:string;body:any};
function fakeGoogle(opts:{csv:string;students?:{id:string;name:string;grade:number}[];existingEmails?:string[]}){
  const calls:Call[]=[];
  const users=new Map((opts.existingEmails??[]).map((e,i)=>[e,`uid-existing-${i}`]));
  let n=0;
  vi.stubGlobal('fetch',async(url:string,init?:RequestInit)=>{
    const body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body});
    const ok=(data:unknown)=>new Response(JSON.stringify(data),{status:200});
    if(url.includes('docs.google.com'))return new Response(opts.csv,{status:200});
    if(url.includes('/students?pageSize'))return ok({documents:(opts.students??[]).map(s=>({name:`x/students/${s.id}`,fields:{name:{stringValue:s.name},grade:{integerValue:String(s.grade)},status:{stringValue:'active'}}}))});
    if(url.includes('/students/'))return ok({fields:{name:{stringValue:'고지윤'},grade:{integerValue:'1'}}});
    if(url.endsWith('accounts:lookup'))return ok({users:(body.email as string[]).filter(e=>users.has(e)).map(e=>({email:e,localId:users.get(e)}))});
    if(url.endsWith('accounts:signUp')){const id=`uid-new-${n++}`;users.set(body.email,id);return ok({localId:id})}
    if(url.endsWith('accounts:update'))return ok({});
    if(url.endsWith(':commit'))return ok({});
    throw new Error('unexpected '+url);
  });
  return calls;
}
afterEach(()=>vi.unstubAllGlobals());

describe('시트로 명단·계정 만들기',()=>{
  it('새 학생은 명단+계정을 만들고, 이미 있는 학생은 비밀번호만 4자리로 바꾼다',async()=>{
    const calls=fakeGoogle({csv:'학년,이름\n1학년,고지윤\n6,김하늘\n',students:[{id:'s1',name:'고지윤',grade:1}],existingEmails:['마동-1-고지윤@students.jobedu.local']});
    const results=await importRosterFromSheet(env,'tok','school1','마동','마동초등학교','https://docs.google.com/spreadsheets/d/abc/edit');
    expect(results.map(r=>[r.grade,r.name,r.ok,r.status])).toEqual([['1','고지윤',true,'reset'],['6','김하늘',true,'created']]);
    const yy=String(new Date().getFullYear()%100).padStart(2,'0');
    expect(results.map(r=>r.pin)).toEqual([`${yy}0101`,`${yy}0601`]);
    const signUp=calls.find(c=>c.url.endsWith('accounts:signUp'))!;
    expect(signUp.body).toMatchObject({email:'마동-6-김하늘@students.jobedu.local',password:`${yy}0601`});
    const update=calls.find(c=>c.url.endsWith('accounts:update'))!;
    expect(update.body.password).toBe(`${yy}0101`);
    const commit=calls.find(c=>c.url.endsWith(':commit'))!;
    const paths=commit.body.writes.map((w:any)=>w.update.name.split('/documents/')[1]);
    expect(paths.filter((p:string)=>p.includes('/students/'))).toHaveLength(1); // 기존 학생은 명단 문서를 다시 만들지 않는다
    expect(paths.filter((p:string)=>p.includes('/members/'))).toHaveLength(2);
    expect(paths.filter((p:string)=>p.startsWith('userSchools/'))).toHaveLength(2);
  });
  it('시트에 적힌 4자리 비밀번호를 쓰고, 잘못된 행은 실패로 알려 준다',async()=>{
    fakeGoogle({csv:'학년,이름,비밀번호\n3,구름,0427\n7,잘못,1111\n3,바람,12\n'});
    const results=await importRosterFromSheet(env,'tok','school1','마동','마동초등학교','https://docs.google.com/spreadsheets/d/abc/edit');
    expect(results.find(r=>r.name==='구름')).toMatchObject({ok:true,pin:'0427'});
    expect(results.filter(r=>!r.ok)).toHaveLength(2);
  });
  it('학년·이름 열이 없으면 거부한다',async()=>{
    fakeGoogle({csv:'이름,반\n가,1\n'});
    await expect(importRosterFromSheet(env,'tok','school1','마동','마동초등학교','https://docs.google.com/spreadsheets/d/abc/edit')).rejects.toThrow('학년');
  });
});

describe('기본 비밀번호 규칙(연도·학년·번호)',()=>{
  it('2026년 1학년 1번은 260101',()=>{expect(defaultStudentPassword(2026,'1',1)).toBe('260101');expect(defaultStudentPassword(2026,'6',14)).toBe('260614')});
  it('번호 열이 없으면 학년별 시트 순서, 있으면 그 번호를 쓴다',async()=>{
    fakeGoogle({csv:'학년,이름\n4,가\n4,나\n5,다\n'});
    let r=await importRosterFromSheet(env,'tok','s','마동','마동초','https://docs.google.com/spreadsheets/d/abc/edit');
    const yy=String(new Date().getFullYear()%100).padStart(2,'0');
    expect(r.map(x=>[x.name,x.pin])).toEqual([['가',`${yy}0401`],['나',`${yy}0402`],['다',`${yy}0501`]]);
    fakeGoogle({csv:'학년,번호,이름\n4,7,가\n'});
    r=await importRosterFromSheet(env,'tok','s','마동','마동초','https://docs.google.com/spreadsheets/d/abc/edit');
    expect(r[0].pin).toBe(`${yy}0407`);
  });
});

describe('학생 정보 수정',()=>{
  it('학년·이름이 바뀌면 로그인 아이디(이메일)와 비밀번호를 함께 바꾼다',async()=>{
    const calls=fakeGoogle({csv:'',existingEmails:['마동-1-고지윤@students.jobedu.local']});
    await updateStudentProfile(env,'tok','school1','마동',{studentId:'s1',grade:'2',name:'고지윤',password:'1234'});
    const update=calls.find(c=>c.url.endsWith('accounts:update'))!;
    expect(update.body).toMatchObject({email:'마동-2-고지윤@students.jobedu.local',password:'1234-jobedu'});
    const commit=calls.find(c=>c.url.endsWith(':commit'))!;
    expect(commit.body.writes[0].updateMask.fieldPaths).toEqual(['name','grade','updatedAt']);
  });
  it('비밀번호 형식이 틀리면 아무것도 바꾸지 않는다',async()=>{
    const calls=fakeGoogle({csv:''});
    await expect(updateStudentProfile(env,'tok','school1','마동',{studentId:'s1',grade:'2',name:'가',password:'12'})).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
