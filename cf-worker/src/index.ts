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
// access token), resolve the student's synthetic login email the same way the
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
  return `${[canonicalSchoolCode(schoolCode),normalizePart(grade),normalizePart(name)].join('-')}@students.jobedu.local`;
}
function randomPassword(){return String(100000+(crypto.getRandomValues(new Uint32Array(1))[0]%900000))}

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
  if(!res.ok)throw new Error('비밀번호 변경에 실패했습니다: '+await res.text());
}

// Accepts a normal "share" link (uses the doc id to build the CSV export URL) or an
// already-CSV link (publish-to-web, or an export URL someone already built) and passes it
// straight through. Google's /export endpoint has no CORS header for third-party origins, which
// is exactly why this has to happen server-side in the Worker rather than the browser.
function normalizeSheetUrl(raw:string){
  if(/[?&](output|format)=csv/i.test(raw))return raw;
  const m=raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  // A Google Sheets *edit* link needs converting to its CSV export form. Anything else (a direct
  // CSV link from elsewhere) is passed through unchanged and simply fetched as-is.
  return m?`https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`:raw;
}
// Minimal CSV parser: handles quoted fields (with escaped "" and embedded commas/newlines),
// strips a UTF-8 BOM, skips the header row. Good enough for the small, teacher-authored sheets
// this endpoint expects — not a general-purpose CSV library.
function parseCsv(text:string):string[][]{
  const rows:string[][]=[];let field='',row:string[]=[],inQuotes=false;
  const s=text.replace(/^﻿/,'').replace(/\r\n/g,'\n');
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
  return rows.filter(r=>r.some(c=>c.trim().length>0)).slice(1); // drop header row
}
interface BulkRowResult {name:string;grade:string;ok:boolean;password?:string;error?:string}
// Same {이름,학년,학교코드,비밀번호} column order as scripts/admin-bootstrap.mjs's own
// student-accounts.csv output — a teacher can literally take that file, edit it in Sheets
// (change some passwords, leave others blank to auto-generate), share the link, and paste it
// here instead of re-running the offline script per student.
async function bulkResetPasswords(accessToken:string,sheetUrl:string):Promise<BulkRowResult[]>{
  const csvRes=await fetch(normalizeSheetUrl(sheetUrl));
  if(!csvRes.ok)throw new Error('시트를 불러오지 못했습니다. 링크 공유 설정(보기 권한)을 확인해 주세요.');
  const rows=parseCsv(await csvRes.text());
  if(!rows.length)throw new Error('시트에서 학생 행을 찾지 못했습니다.');
  // Cloudflare's free tier caps subrequests per invocation (~50); each row costs two fetches
  // (lookup + set password) plus a few fixed calls (OAuth token, teacher check, the sheet
  // itself), so this stays comfortably under that with room to spare. Split larger rosters into
  // more than one paste.
  if(rows.length>20)throw new Error('한 번에 최대 20명까지 처리할 수 있습니다. 명단을 나눠서 올려 주세요.');
  const results:BulkRowResult[]=[];
  for(const cols of rows){
    const [name,grade,schoolCode,passwordCol]=cols.map(c=>c.trim());
    if(!name||!grade||!schoolCode){results.push({name:name||'(이름 없음)',grade:grade||'',ok:false,error:'이름·학년·학교코드를 확인해 주세요.'});continue}
    try{
      const email=studentLoginEmail(schoolCode,grade,name);
      const targetUid=await lookupUid(accessToken,email);
      if(!targetUid){results.push({name,grade,ok:false,error:'계정을 찾을 수 없습니다.'});continue}
      const password=passwordCol||randomPassword();
      await setPassword(accessToken,targetUid,password);
      results.push({name,grade,ok:true,password});
    }catch(err){
      results.push({name,grade,ok:false,error:err instanceof Error?err.message:'처리 실패'});
    }
  }
  return results;
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

      const body=await request.json() as {schoolId?:string;schoolCode?:string;grade?:string;name?:string;password?:string;sheetUrl?:string};
      const {schoolId}=body;
      if(!schoolId)return json({error:'학교 정보가 없습니다.'},400,origin);

      const accessToken=await googleAccessToken(env,'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore');
      if(!await isActiveTeacher(env,accessToken,schoolId,uid))return json({error:'교사 권한이 필요합니다.'},403,origin);

      if(body.sheetUrl){
        const results=await bulkResetPasswords(accessToken,body.sheetUrl);
        return json({results,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length},200,origin);
      }

      const {schoolCode,grade,name}=body;
      if(!schoolCode||!grade||!name)return json({error:'학교 코드·학년·이름을 모두 입력해 주세요.'},400,origin);
      const password=(body.password??'').trim()||randomPassword();
      if(password.length<6)return json({error:'비밀번호는 6자 이상이어야 합니다.'},400,origin);

      const email=studentLoginEmail(schoolCode,grade,name);
      const targetUid=await lookupUid(accessToken,email);
      if(!targetUid)return json({error:'해당 학생 계정을 찾을 수 없습니다. 학년·이름을 확인해 주세요.'},404,origin);

      await setPassword(accessToken,targetUid,password);
      return json({email,password},200,origin);
    }catch(err){
      return json({error:err instanceof Error?err.message:'처리 중 오류가 발생했습니다.'},500,origin);
    }
  },
};
