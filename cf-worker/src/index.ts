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

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=env.ALLOWED_ORIGIN;
    if(request.method==='OPTIONS')return new Response(null,{headers:corsHeaders(origin)});
    if(request.method!=='POST')return json({error:'허용되지 않은 요청입니다.'},405,origin);
    try{
      const idToken=(request.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'');
      if(!idToken)return json({error:'로그인이 필요합니다.'},401,origin);
      const uid=await verifyCallerUid(idToken,env.FIREBASE_PROJECT_ID);

      const body=await request.json() as {schoolId?:string;schoolCode?:string;grade?:string;name?:string;password?:string};
      const {schoolId,schoolCode,grade,name}=body;
      if(!schoolId||!schoolCode||!grade||!name)return json({error:'학교·학년·이름을 모두 입력해 주세요.'},400,origin);
      const password=(body.password??'').trim()||randomPassword();
      if(password.length<6)return json({error:'비밀번호는 6자 이상이어야 합니다.'},400,origin);

      const accessToken=await googleAccessToken(env,'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore');
      if(!await isActiveTeacher(env,accessToken,schoolId,uid))return json({error:'교사 권한이 필요합니다.'},403,origin);

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
