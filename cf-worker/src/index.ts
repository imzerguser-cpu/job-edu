// Small privileged endpoint the browser app can never be trusted to run itself:
// it lets an authenticated *teacher* reset one of their own school's students'
// login passwords, using a Firebase service-account credential that stays only
// in Cloudflare's secret store (never shipped to the browser). This is Method 2
// from the school's password-management discussion — Firebase Cloud Functions
// would need the Blaze (billing-enabled) plan for this; Cloudflare Workers' free
// tier needs no card at all.
//
// Caller flow: the app sends the teacher's Firebase ID token (proves who they
// are) plus {schoolId, schoolCode, grade, name, password?}. We verify the ID
// token ourselves (Google's public keys), confirm the caller is an active
// teacher/owner of that exact school (Firestore REST, via a service-account
// access token), confirm the school code they're acting on actually belongs to
// that school, resolve the student's synthetic login email the same way the
// app does, and set the new password (Identity Toolkit REST — the same API the
// Admin SDK uses internally).
import {SignJWT,importPKCS8,jwtVerify,createRemoteJWKSet} from 'jose';

export interface Env {
  GOOGLE_CLIENT_EMAIL:string;
  GOOGLE_PRIVATE_KEY_B64:string;
  FIREBASE_PROJECT_ID:string;
  ALLOWED_ORIGIN:string;
}

const firebaseJwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

// Thrown for problems caused by the caller's own input (bad link, too many rows, wrong school...)
// so the top-level handler can reply 400 instead of 500 — a plain Error there still means "we
// don't otherwise know what this is" and stays a 500.
class UserInputError extends Error {}

function corsHeaders(origin:string):Record<string,string>{
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'};
}
function json(data:unknown,status:number,origin:string){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...corsHeaders(origin)}});
}

// Keep in lockstep with src/domain/studentAuth.ts and scripts/admin-bootstrap.mjs.
function normalizePart(v:string){return v.trim().replace(/\s+/g,'')}
function canonicalSchoolCode(v:string){return normalizePart(v).replace(/(초등학교|초등|초)$/,'')}
function studentLoginEmail(schoolCode:string,grade:string,name:string){
  const parts=[canonicalSchoolCode(schoolCode),normalizePart(grade),normalizePart(name)];
  if(parts.some(p=>!p))throw new Error('학교 코드·학년·이름을 모두 입력해 주세요.');
  if(parts.some(p=>p.length>40))throw new Error('입력값이 너무 깁니다.');
  return `${parts.join('-')}@students.jobedu.local`;
}
function randomPassword(){return String(100000+(crypto.getRandomValues(new Uint32Array(1))[0]%900000))}
// 학생 비밀번호는 숫자 4자리(PIN)로 간단하게 쓴다(사용자 요청, D-111). Firebase Auth는 6자 이상만
// 받으므로, 4자리 숫자는 앱·Worker·관리 스크립트가 똑같이 내부 비밀번호로 늘려서 쓴다.
// Keep in lockstep with studentAuthPassword in src/domain/studentAuth.ts and scripts/admin-bootstrap.mjs.
function studentAuthPassword(input:string){const v=input.trim();return /^\d{4}$/.test(v)?`${v}-jobedu`:v}
function randomPin(){return String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0')}
function validStudentPassword(v:string){return /^\d{4}$/.test(v)||v.length>=6}
// 시트로 계정을 만들 때 비밀번호 칸이 비어 있으면 쓰는 기본 비밀번호(사용자 요청, D-113):
// 연도 끝 2자리 + 학년 2자리 + 번호 2자리. 예) 2026년 1학년 1번 → 260101.
export function defaultStudentPassword(year:number,grade:string,number:number){return `${String(year%100).padStart(2,'0')}${grade.padStart(2,'0')}${String(number).padStart(2,'0')}`}
function normalizeGrade(v:string){const m=v.trim().match(/^([1-6])(?:학년)?$/);return m?m[1]:''}

async function verifyCallerUid(idToken:string,projectId:string){
  const {payload}=await jwtVerify(idToken,firebaseJwks,{issuer:`https://securetoken.google.com/${projectId}`,audience:projectId});
  if(!payload.sub)throw new Error('토큰에 사용자 정보가 없습니다.');
  return payload.sub;
}

async function googleAccessToken(env:Env,scope:string){
  const pem=atob(env.GOOGLE_PRIVATE_KEY_B64);
  const key=await importPKCS8(pem,'RS256');
  const now=Math.floor(Date.now()/1000);
  const assertion=await new SignJWT({scope})
    .setProtectedHeader({alg:'RS256'})
    .setIssuer(env.GOOGLE_CLIENT_EMAIL)
    .setSubject(env.GOOGLE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now+3600)
    .sign(key);
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),
  });
  if(!res.ok)throw new Error('구글 인증 토큰 발급 실패: '+await res.text());
  return (await res.json() as {access_token:string}).access_token;
}

async function isActiveTeacher(env:Env,accessToken:string,schoolId:string,uid:string){
  const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}/members/${encodeURIComponent(uid)}`;
  const res=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(res.status===404)return false;
  if(!res.ok)throw new Error('교사 권한 확인에 실패했습니다.');
  const doc=await res.json() as {fields?:Record<string,{stringValue?:string}>};
  const role=doc.fields?.role?.stringValue,status=doc.fields?.status?.stringValue;
  return status==='active'&&(role==='teacher'||role==='owner');
}
// Only the school's 'owner' — not every 'teacher' — may create other teacher accounts or reset
// their passwords. Unlike isActiveTeacher(), 'teacher' alone does not qualify here on purpose:
// this app treats 'teacher'/'owner' as equally privileged everywhere else (see firestore.rules'
// teacher() helper), but staff-account management is sensitive enough to keep to the one account
// that bootstrapped the school.
async function isOwner(env:Env,accessToken:string,schoolId:string,uid:string){
  const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}/members/${encodeURIComponent(uid)}`;
  const res=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(res.status===404)return false;
  if(!res.ok)throw new Error('권한 확인에 실패했습니다.');
  const doc=await res.json() as {fields?:Record<string,{stringValue?:string}>};
  return doc.fields?.status?.stringValue==='active'&&doc.fields?.role?.stringValue==='owner';
}

// The teacher-role check above only proves membership in `schoolId` — it says nothing about
// which school code a request is actually acting on. This resolves schoolId's own canonical
// school code so every caller can be checked against the school they were actually authorized
// for, instead of trusting a caller-supplied schoolCode at face value.
async function schoolName(env:Env,accessToken:string,schoolId:string){
  const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}`;
  const res=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!res.ok)throw new Error('학교 정보를 확인하지 못했습니다.');
  const doc=await res.json() as {fields?:Record<string,{stringValue?:string}>};
  const name=doc.fields?.schoolName?.stringValue;
  if(!name)throw new Error('학교 정보를 확인하지 못했습니다.');
  return name;
}
async function schoolCanonicalCode(env:Env,accessToken:string,schoolId:string){
  return canonicalSchoolCode(await schoolName(env,accessToken,schoolId));
}
// Firestore REST's typed-value encoding for a plain field map — only the field types this Worker
// ever needs to write (string/null). PATCH on a specific document path replaces the whole
// document with exactly these fields (matching the SDK's plain tx.set(), not a merge).
function firestoreValueFields(obj:Record<string,string|null>):Record<string,unknown>{
  const fields:Record<string,unknown>={};
  for(const [k,v] of Object.entries(obj))fields[k]=v===null?{nullValue:null}:{stringValue:v};
  return fields;
}
async function firestoreSet(env:Env,accessToken:string,path:string,fields:Record<string,string|null>){
  const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const res=await fetch(url,{method:'PATCH',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({fields:firestoreValueFields(fields)})});
  if(!res.ok)throw new Error('문서 저장에 실패했습니다: '+await res.text());
}
interface TeacherMember {uid:string;email:string;role:string;status:string}
async function listTeacherMembers(env:Env,accessToken:string,schoolId:string):Promise<TeacherMember[]>{
  const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}/members?pageSize=100`;
  const res=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!res.ok)throw new Error('교사 목록을 불러오지 못했습니다.');
  const data=await res.json() as {documents?:{name:string;fields?:Record<string,{stringValue?:string}>}[]};
  return (data.documents??[])
    .map(d=>({uid:d.name.split('/').pop()!,email:d.fields?.email?.stringValue??'',role:d.fields?.role?.stringValue??'',status:d.fields?.status?.stringValue??''}))
    .filter(m=>m.role==='teacher'||m.role==='owner');
}
async function createAuthUser(accessToken:string,email:string,password:string):Promise<string>{
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp',{
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:false}),
  });
  if(res.ok)return (await res.json() as {localId:string}).localId;
  let code='';
  try{code=((await res.json()) as {error?:{message?:string}}).error?.message??''}catch{/* body wasn't JSON */}
  if(code.startsWith('EMAIL_EXISTS'))throw new UserInputError('이미 사용 중인 이메일입니다.');
  if(code.startsWith('WEAK_PASSWORD'))throw new UserInputError('비밀번호가 너무 약합니다. 6자 이상으로 입력해 주세요.');
  if(code.startsWith('INVALID_EMAIL'))throw new UserInputError('올바른 이메일 형식이 아닙니다.');
  throw new Error('계정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

async function lookupUid(accessToken:string,email:string){
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup',{
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({email:[email]}),
  });
  if(!res.ok)throw new Error('학생 계정 조회에 실패했습니다.');
  const data=await res.json() as {users?:{localId:string}[]};
  return data.users?.[0]?.localId;
}

async function setPassword(accessToken:string,uid:string,password:string){
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update',{
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({localId:uid,password,returnSecureToken:false}),
  });
  if(res.ok)return;
  // Identity Toolkit's error body is raw API/English JSON — never forward it as-is into a
  // Korean UI. Only translate the one code we can act on; everything else gets one generic,
  // fully-Korean message.
  let code='';
  try{code=((await res.json()) as {error?:{message?:string}}).error?.message??''}catch{/* body wasn't JSON */}
  if(code.startsWith('WEAK_PASSWORD'))throw new Error('비밀번호가 너무 약합니다. 6자 이상 다른 값으로 다시 입력해 주세요.');
  throw new Error('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

// Only docs.google.com links are ever fetched — the Worker must never become a general-purpose
// server-side fetch proxy for caller-supplied URLs (SSRF). Recognizes a normal "share" edit link
// (.../spreadsheets/d/<id>/edit...), a "publish to web" link (.../spreadsheets/d/e/<id>/pubhtml),
// and an already-CSV export link (has output=csv or format=csv), and always returns a CSV export
// URL. Anything else — a non-Google host, or a Google Sheets URL shape we don't recognize —
// throws instead of being fetched blindly.
function normalizeSheetUrl(raw:string):string{
  let url:URL;
  try{url=new URL(raw)}catch{throw new UserInputError('올바른 링크 형식이 아닙니다. 구글 시트 링크를 붙여넣어 주세요.')}
  if(url.hostname!=='docs.google.com')throw new UserInputError('구글 시트(docs.google.com) 링크만 사용할 수 있습니다.');
  if(/[?&](output|format)=csv/i.test(url.search))return url.toString();
  const published=url.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if(published)return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv`;
  const shared=url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if(shared)return `https://docs.google.com/spreadsheets/d/${shared[1]}/export?format=csv`;
  throw new UserInputError('구글 시트 링크에서 문서를 찾을 수 없습니다. 공유 링크를 다시 확인해 주세요.');
}
async function fetchSheetCsv(sheetUrl:string):Promise<string>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10_000);
  let res:Response;
  try{
    res=await fetch(normalizeSheetUrl(sheetUrl),{signal:controller.signal});
  }catch(err){
    if(err instanceof Error&&err.name==='AbortError')throw new UserInputError('시트를 불러오는 데 시간이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.');
    throw err;
  }finally{
    clearTimeout(timer);
  }
  if(!res.ok)throw new UserInputError('시트를 불러오지 못했습니다. 링크 공유 설정(보기 권한)을 확인해 주세요.');
  return res.text();
}
// Minimal CSV parser: handles quoted fields (with escaped "" and embedded commas/newlines),
// strips a UTF-8 BOM, normalizes CRLF/CR/LF line endings. Good enough for the small,
// teacher-authored sheets this endpoint expects — not a general-purpose CSV library. Does not
// assume a header row — see stripHeaderRow, which decides that from the data itself.
function parseCsv(text:string):string[][]{
  const rows:string[][]=[];let field='',row:string[]=[],inQuotes=false;
  const s=text.replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(inQuotes){
      if(c==='"'){if(s[i+1]==='"'){field+='"';i++}else inQuotes=false}
      else field+=c;
    }else if(c==='"')inQuotes=true;
    else if(c===','){row.push(field);field=''}
    else if(c==='\n'){row.push(field);rows.push(row);row=[];field=''}
    else field+=c;
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  return rows.filter(r=>r.some(c=>c.trim().length>0));
}
// The sheet format is {이름,학년,학교코드,비밀번호}. Rather than assume row 0 is always a title
// row (silently discarding a real student if the teacher skipped the header), this looks at
// whether row 0's 학년 cell actually looks like a grade — if it does, nothing looks like a
// header and every row is kept.
function stripHeaderRow(rows:string[][]):string[][]{
  const firstGradeCell=(rows[0]?.[1]??'').trim();
  return /^[1-6](?:학년)?$/.test(firstGradeCell)?rows:rows.slice(1);
}
interface BulkRowResult {name:string;grade:string;ok:boolean;password?:string;error?:string}
// Same {이름,학년,학교코드,비밀번호} column order as scripts/admin-bootstrap.mjs's own
// student-accounts.csv output — a teacher can literally take that file, edit it in Sheets
// (change some passwords, leave others blank to auto-generate), share the link, and paste it
// here instead of re-running the offline script per student.
// Keep BulkRowResult in lockstep with the identical interface in src/app/App.tsx.
const MAX_BULK_ROWS=20;
async function bulkResetPasswords(accessToken:string,sheetUrl:string,expectedSchoolCode:string):Promise<BulkRowResult[]>{
  const rows=stripHeaderRow(parseCsv(await fetchSheetCsv(sheetUrl)));
  if(!rows.length)throw new UserInputError('시트에서 학생 행을 찾지 못했습니다.');
  // Cloudflare's free tier caps subrequests per invocation (~50); each row costs two fetches
  // (lookup + set password) plus a few fixed calls (OAuth token, teacher check, school-code
  // check, the sheet itself), so this stays comfortably under that with room to spare. Split
  // larger rosters into more than one paste.
  if(rows.length>MAX_BULK_ROWS)throw new UserInputError(`한 번에 최대 ${MAX_BULK_ROWS}명까지 처리할 수 있습니다. 명단을 나눠서 올려 주세요.`);
  const results:BulkRowResult[]=[];
  for(const cols of rows){
    const [name,grade,schoolCode,passwordCol]=cols.map(c=>c.trim());
    if(!name||!grade||!schoolCode){results.push({name:name||'(이름 없음)',grade:grade||'',ok:false,error:'이름·학년·학교코드를 확인해 주세요.'});continue}
    // Each row carries its own school code, so — unlike the caller-level teacher check — this
    // has to be re-verified per row: nothing else stops a sheet from mixing in another school's
    // students.
    if(canonicalSchoolCode(schoolCode)!==expectedSchoolCode){results.push({name,grade,ok:false,error:'다른 학교 학생은 여기서 변경할 수 없습니다.'});continue}
    try{
      const email=studentLoginEmail(schoolCode,normalizeGrade(grade)||grade,name);
      const targetUid=await lookupUid(accessToken,email);
      if(!targetUid){results.push({name,grade,ok:false,error:'계정을 찾을 수 없습니다.'});continue}
      const password=passwordCol||randomPin();
      if(!validStudentPassword(password)){results.push({name,grade,ok:false,error:'비밀번호는 숫자 4자리 또는 6자 이상이어야 합니다.'});continue}
      await setPassword(accessToken,targetUid,studentAuthPassword(password));
      results.push({name,grade,ok:true,password});
    }catch(err){
      results.push({name,grade,ok:false,error:err instanceof Error?err.message:'처리 실패'});
    }
  }
  return results;
}

// ── 시트로 명단 + 계정 한꺼번에 만들기 / 학생 정보 수정 (D-111, D-112) ──
const MAX_IMPORT_ROWS=40; // 무료 요금제 하위 요청 한도(~50): 학생당 1회(계정 생성/변경) + 고정 약 7회
const FS=(env:Env)=>`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const docName=(env:Env,path:string)=>`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
type FsValue={stringValue?:string;integerValue?:string;nullValue?:null;timestampValue?:string};
async function listStudents(env:Env,accessToken:string,schoolId:string){
  const out:{id:string;name:string;grade:number;status:string}[]=[];let pageToken='';
  for(let i=0;i<5;i++){
    const res=await fetch(`${FS(env)}/schools/${encodeURIComponent(schoolId)}/students?pageSize=300${pageToken?`&pageToken=${pageToken}`:''}`,{headers:{Authorization:`Bearer ${accessToken}`}});
    if(!res.ok)throw new Error('학생 명단을 불러오지 못했습니다.');
    const data=await res.json() as {documents?:{name:string;fields?:Record<string,FsValue>}[];nextPageToken?:string};
    for(const d of data.documents??[])out.push({id:d.name.split('/').pop()!,name:d.fields?.name?.stringValue??'',grade:Number(d.fields?.grade?.integerValue??0),status:d.fields?.status?.stringValue??''});
    if(!data.nextPageToken)break;pageToken=encodeURIComponent(data.nextPageToken);
  }
  return out;
}
async function lookupUids(accessToken:string,emails:string[]){
  const map=new Map<string,string>();if(!emails.length)return map;
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({email:emails})});
  if(!res.ok)throw new Error('학생 계정 조회에 실패했습니다.');
  const data=await res.json() as {users?:{localId:string;email:string}[]};
  for(const u of data.users??[])map.set(u.email.toLowerCase(),u.localId);
  return map;
}
async function firestoreCommit(env:Env,accessToken:string,writes:{path:string;fields:Record<string,FsValue>;mask?:string[];mustNotExist?:boolean}[]){
  if(!writes.length)return;
  const res=await fetch(`${FS(env)}:commit`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({writes:writes.map(w=>({
    update:{name:docName(env,w.path),fields:w.fields},
    ...(w.mask?{updateMask:{fieldPaths:w.mask}}:{}),
    ...(w.mustNotExist?{currentDocument:{exists:false}}:{}),
  }))})});
  if(!res.ok)throw new Error('명단 저장에 실패했습니다: '+(await res.text()).slice(0,200));
}
const str=(v:string|null):FsValue=>v===null?{nullValue:null}:{stringValue:v};
interface ImportRowResult {grade:string;name:string;ok:boolean;pin?:string;status?:'created'|'reset';error?:string}
export async function importRosterFromSheet(env:Env,accessToken:string,schoolId:string,schoolCode:string,schoolDisplayName:string,sheetUrl:string):Promise<ImportRowResult[]>{
  const rows=parseCsv(await fetchSheetCsv(sheetUrl));
  const header=(rows[0]??[]).map(c=>c.trim());
  const gi=header.indexOf('학년'),ni=header.indexOf('이름'),pi=header.indexOf('비밀번호'),bi=header.indexOf('번호');
  if(gi<0||ni<0)throw new UserInputError('시트 첫 줄에 "학년"과 "이름" 열이 있어야 합니다.');
  const body=rows.slice(1);
  if(!body.length)throw new UserInputError('시트에서 학생 행을 찾지 못했습니다.');
  if(body.length>MAX_IMPORT_ROWS)throw new UserInputError(`한 번에 최대 ${MAX_IMPORT_ROWS}명까지 처리할 수 있습니다. 시트를 나눠서 올려 주세요.`);
  const existing=await listStudents(env,accessToken,schoolId);
  const results:ImportRowResult[]=[];
  const planned:{grade:string;name:string;pin:string;email:string;studentId:string;isNew:boolean}[]=[];
  const seen=new Set<string>();
  // 번호: 시트에 "번호" 열이 있으면 그 값, 없으면 시트에서 그 학년의 몇 번째 학생인지.
  const orderInGrade=new Map<string,number>();
  const thisYear=new Date().getFullYear();
  for(const cols of body){
    const grade=normalizeGrade(cols[gi]??''),name=(cols[ni]??'').trim().normalize('NFC'),rawPin=pi>=0?(cols[pi]??'').trim():'';
    if(!grade||!name||name.length>40){results.push({grade:cols[gi]??'',name:name||'(이름 없음)',ok:false,error:'학년(1~6)과 이름을 확인해 주세요.'});continue}
    if(seen.has(grade+'|'+name)){results.push({grade,name,ok:false,error:'같은 학년·이름이 시트에 두 번 있어요.'});continue}
    seen.add(grade+'|'+name);
    const order=(orderInGrade.get(grade)??0)+1;orderInGrade.set(grade,order);
    const rawNumber=bi>=0?Number((cols[bi]??'').trim()):NaN;
    const number=Number.isInteger(rawNumber)&&rawNumber>=1&&rawNumber<=99?rawNumber:order;
    const pin=rawPin||defaultStudentPassword(thisYear,grade,number);
    if(!validStudentPassword(pin)){results.push({grade,name,ok:false,error:'비밀번호는 숫자 4자리 또는 6자 이상이어야 합니다.'});continue}
    const matches=existing.filter(s=>s.name===name&&String(s.grade)===grade&&s.status==='active');
    if(matches.length>1){results.push({grade,name,ok:false,error:'명단에 같은 학년·이름이 여러 명 있어요. 한 명씩 수정해 주세요.'});continue}
    planned.push({grade,name,pin,email:studentLoginEmail(schoolCode,grade,name),studentId:matches[0]?.id??crypto.randomUUID(),isNew:!matches.length});
  }
  const uids=await lookupUids(accessToken,planned.map(p=>p.email));
  const now=new Date().toISOString(),year=String(new Date().getFullYear());
  const writes:Parameters<typeof firestoreCommit>[2]=[];
  for(const p of planned){
    try{
      let uid=uids.get(p.email.toLowerCase());
      const status:ImportRowResult['status']=uid?'reset':'created';
      if(uid)await setPassword(accessToken,uid,studentAuthPassword(p.pin));
      else uid=await createAuthUser(accessToken,p.email,studentAuthPassword(p.pin));
      if(p.isNew)writes.push({path:`schools/${schoolId}/students/${p.studentId}`,mustNotExist:true,fields:{schoolId:str(schoolId),name:str(p.name),grade:{integerValue:p.grade},className:str(null),citizenCode:str(`C-${p.studentId}`),schoolYear:{integerValue:year},status:str('active'),schemaVersion:{integerValue:'1'},createdAt:{timestampValue:now},updatedAt:{timestampValue:now}}});
      writes.push({path:`schools/${schoolId}/members/${uid}`,fields:{schoolId:str(schoolId),role:str('student'),studentId:str(p.studentId),status:str('active')}});
      writes.push({path:`userSchools/${uid}/links/${schoolId}`,fields:{schoolId:str(schoolId),schoolName:str(schoolDisplayName)}});
      results.push({grade:p.grade,name:p.name,ok:true,pin:p.pin,status});
    }catch(err){results.push({grade:p.grade,name:p.name,ok:false,error:err instanceof Error?err.message:'처리 실패'})}
  }
  await firestoreCommit(env,accessToken,writes);
  return results.sort((a,b)=>Number(a.grade)-Number(b.grade)||a.name.localeCompare(b.name,'ko'));
}
async function updateAuthAccount(accessToken:string,uid:string,patch:{email?:string;password?:string}){
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({localId:uid,...patch,returnSecureToken:false})});
  if(res.ok)return;
  let code='';try{code=((await res.json()) as {error?:{message?:string}}).error?.message??''}catch{/* not JSON */}
  if(code.startsWith('EMAIL_EXISTS'))throw new UserInputError('같은 학년에 같은 이름의 학생 계정이 이미 있어요.');
  throw new Error('계정 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}
// 학년·이름이 바뀌면 로그인 아이디(합성 이메일)도 바뀌어야 하므로 명단 문서와 로그인 계정을 함께 고친다.
export async function updateStudentProfile(env:Env,accessToken:string,schoolId:string,schoolCode:string,input:{studentId:string;grade:string;name:string;password:string}){
  const grade=normalizeGrade(input.grade),name=input.name.trim().normalize('NFC'),pin=input.password.trim();
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(input.studentId))throw new UserInputError('학생을 확인해 주세요.');
  if(!grade||!name||name.length>40)throw new UserInputError('학년(1~6)과 이름(40자 이하)을 확인해 주세요.');
  if(pin&&!validStudentPassword(pin))throw new UserInputError('비밀번호는 숫자 4자리 또는 6자 이상이어야 합니다.');
  const res=await fetch(`${FS(env)}/schools/${encodeURIComponent(schoolId)}/students/${input.studentId}`,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!res.ok)throw new UserInputError('학생을 찾을 수 없습니다.');
  const doc=await res.json() as {fields?:Record<string,FsValue>};
  const oldName=doc.fields?.name?.stringValue??'',oldGrade=String(doc.fields?.grade?.integerValue??'');
  const oldEmail=studentLoginEmail(schoolCode,oldGrade,oldName),newEmail=studentLoginEmail(schoolCode,grade,name);
  const uid=await lookupUid(accessToken,oldEmail);
  if(uid&&(oldEmail!==newEmail||pin))await updateAuthAccount(accessToken,uid,{...(oldEmail!==newEmail?{email:newEmail}:{}),...(pin?{password:studentAuthPassword(pin)}:{})});
  await firestoreCommit(env,accessToken,[{path:`schools/${schoolId}/students/${input.studentId}`,mask:['name','grade','updatedAt'],fields:{name:str(name),grade:{integerValue:grade},updatedAt:{timestampValue:new Date().toISOString()}}}]);
  return {hasAccount:!!uid,grade,name,password:pin||null};
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=env.ALLOWED_ORIGIN;
    if(request.method==='OPTIONS')return new Response(null,{headers:corsHeaders(origin)});
    if(request.method!=='POST')return json({error:'허용되지 않은 요청입니다.'},405,origin);
    try{
      const idToken=(request.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'');
      if(!idToken)return json({error:'로그인이 필요합니다.'},401,origin);
      const uid=await verifyCallerUid(idToken,env.FIREBASE_PROJECT_ID);

      const body=await request.json() as {schoolId?:string;schoolCode?:string;grade?:string;name?:string;password?:string;sheetUrl?:string;action?:string;email?:string;studentId?:string};
      const {schoolId,sheetUrl,action}=body;
      if(!schoolId)return json({error:'학교 정보가 없습니다.'},400,origin);

      // Owner-only staff-account management (D-95) — dispatched on an explicit action field
      // rather than implicit body shape, since these three never overlap with the student-facing
      // fields the rest of this handler infers from.
      if(action==='createTeacher'||action==='resetTeacherPassword'||action==='listTeachers'){
        const email=(body.email??'').trim().toLowerCase();
        if(action!=='listTeachers'&&!email)return json({error:'이메일을 입력해 주세요.'},400,origin);
        let newPassword='';
        if(action==='createTeacher'||action==='resetTeacherPassword'){
          newPassword=(body.password??'').trim()||randomPassword();
          if(newPassword.length<6)return json({error:'비밀번호는 6자 이상이어야 합니다.'},400,origin);
        }
        const accessToken=await googleAccessToken(env,'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore');
        if(!await isOwner(env,accessToken,schoolId,uid))return json({error:'최고 관리자만 사용할 수 있습니다.'},403,origin);

        if(action==='listTeachers')return json({teachers:await listTeacherMembers(env,accessToken,schoolId)},200,origin);

        if(action==='createTeacher'){
          const newUid=await createAuthUser(accessToken,email,newPassword);
          const name=await schoolName(env,accessToken,schoolId);
          await firestoreSet(env,accessToken,`schools/${schoolId}/members/${newUid}`,{schoolId,role:'teacher',studentId:null,status:'active',email});
          await firestoreSet(env,accessToken,`userSchools/${newUid}/links/${schoolId}`,{schoolId,schoolName:name});
          return json({uid:newUid,email,password:newPassword},200,origin);
        }

        // resetTeacherPassword
        const targetUid=await lookupUid(accessToken,email);
        if(!targetUid)return json({error:'해당 이메일의 계정을 찾을 수 없습니다.'},404,origin);
        if(!await isActiveTeacher(env,accessToken,schoolId,targetUid))return json({error:'해당 계정은 이 학교의 교사가 아닙니다.'},403,origin);
        await setPassword(accessToken,targetUid,newPassword);
        return json({email,password:newPassword},200,origin);
      }

      if(action==='importRoster'||action==='updateStudent'){
        const accessToken=await googleAccessToken(env,'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore');
        if(!await isActiveTeacher(env,accessToken,schoolId,uid))return json({error:'교사 권한이 필요합니다.'},403,origin);
        const displayName=await schoolName(env,accessToken,schoolId),code=canonicalSchoolCode(displayName);
        if(action==='importRoster'){
          if(!sheetUrl)return json({error:'구글 시트 링크를 붙여넣어 주세요.'},400,origin);
          const results=await importRosterFromSheet(env,accessToken,schoolId,code,displayName,sheetUrl);
          return json({results,schoolCode:code},200,origin);
        }
        return json(await updateStudentProfile(env,accessToken,schoolId,code,{studentId:body.studentId??'',grade:body.grade??'',name:body.name??'',password:body.password??''}),200,origin);
      }

      // Validate the request shape before spending any subrequests on it.
      let password='';
      if(!sheetUrl){
        const {schoolCode,grade,name}=body;
        if(!schoolCode||!grade||!name)return json({error:'학교 코드·학년·이름을 모두 입력해 주세요.'},400,origin);
        password=(body.password??'').trim()||randomPin();
        if(!validStudentPassword(password))return json({error:'비밀번호는 숫자 4자리 또는 6자 이상이어야 합니다.'},400,origin);
      }

      const accessToken=await googleAccessToken(env,'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore');
      if(!await isActiveTeacher(env,accessToken,schoolId,uid))return json({error:'교사 권한이 필요합니다.'},403,origin);
      const expectedSchoolCode=await schoolCanonicalCode(env,accessToken,schoolId);

      if(sheetUrl){
        const results=await bulkResetPasswords(accessToken,sheetUrl,expectedSchoolCode);
        return json({results,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length},200,origin);
      }

      const {schoolCode,grade,name}=body as {schoolCode:string;grade:string;name:string};
      if(canonicalSchoolCode(schoolCode)!==expectedSchoolCode)return json({error:'다른 학교 학생의 비밀번호는 변경할 수 없습니다.'},403,origin);

      const email=studentLoginEmail(schoolCode,grade,name);
      const targetUid=await lookupUid(accessToken,email);
      if(!targetUid)return json({error:'해당 학생 계정을 찾을 수 없습니다. 학년·이름을 확인해 주세요.'},404,origin);

      await setPassword(accessToken,targetUid,studentAuthPassword(password));
      return json({email,password},200,origin);
    }catch(err){
      const status=err instanceof UserInputError?400:500;
      return json({error:err instanceof Error?err.message:'처리 중 오류가 발생했습니다.'},status,origin);
    }
  },
};
