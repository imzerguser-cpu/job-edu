#!/usr/bin/env node
// Trusted, offline admin tool — the exact "별도의 검증된 관리 도구" the app's own security
// model assumes for first-time provisioning (D-5): normal app membership writes are denied by
// Firestore Rules on purpose, so bootstrapping a school/teacher/student accounts happens here,
// with the Admin SDK, using a service account key that never ships to the browser.
//
// Usage:
//   node scripts/admin-bootstrap.mjs create-school --key <service-account.json> --school <schoolId> --name "학교 이름" [--community "사회 이름"] [--currency "마동"] [--symbol "M"]
//   node scripts/admin-bootstrap.mjs create-teacher --key <service-account.json> --school <schoolId> --email <email> --password <password> [--role owner|teacher]
//   node scripts/admin-bootstrap.mjs create-student-accounts --key <service-account.json> --school <schoolId> --code <학교코드> [--password <모든 신규 계정 공통 비밀번호>] [--out student-accounts.csv]
//   node scripts/admin-bootstrap.mjs reset-student-password --key <service-account.json> --school <schoolId> --code <학교코드> --grade <학년> --name <이름> [--password <새 비밀번호>]
//
// create-student-accounts reads the already-imported roster (schools/{school}/students) and
// creates one Firebase Auth account per active student with no real email required — the login
// "email" is synthesized from 학교코드-학년-이름 (see src/domain/studentAuth.ts; the two must
// stay in sync) and a random 6-digit password (or one shared --password for the whole batch,
// handy for testing). This assumes grade+이름 is unique school-wide (one class per grade); the
// command refuses to run if it finds a same-grade name collision. Re-running skips students who
// already have an account, so it's safe to run again after adding new students to the roster.
//
// Firebase never lets anyone — including admins — read back an existing password (only its
// salted hash is stored), so "관리자가 비밀번호를 본다" only works going forward: every password
// this script sets (on creation or reset) is recorded in a local, git-ignored "password book"
// (.student-passwords.json) and re-exported to the CSV every time, so the CSV always reflects the
// last known password for each student. reset-student-password lets the admin assign a brand-new
// password to one existing student at any time (Admin SDK — never exposed to the browser client).
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

function usage(){
  console.log(`사용법:
  node scripts/admin-bootstrap.mjs create-school --key <service-account.json> --school <schoolId> --name "학교 이름" [--community "사회 이름"] [--currency "마동"] [--symbol "M"]
  node scripts/admin-bootstrap.mjs create-teacher --key <service-account.json> --school <schoolId> --email <email> --password <password> [--role owner|teacher]
  node scripts/admin-bootstrap.mjs create-student-accounts --key <service-account.json> --school <schoolId> --code <학교코드> [--password <모든 신규 계정 공통 비밀번호>] [--out student-accounts.csv]
  node scripts/admin-bootstrap.mjs reset-student-password --key <service-account.json> --school <schoolId> --code <학교코드> --grade <학년> --name <이름> [--password <새 비밀번호>]`);
}
function arg(name,def){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:def}
function required(name){const v=arg(name);if(!v){console.error(`--${name}는 필수입니다.`);usage();process.exit(1)}return v}
function normalizePart(v){return String(v).trim().replace(/\s+/g,'')}
// Keep this in lockstep with src/domain/studentAuth.ts's studentLoginEmail.
// Assumes grade+name is unique school-wide (one class per grade) — see D-44.
function studentLoginEmail(schoolCode,grade,name){
  const parts=[schoolCode,grade,name].map(normalizePart);
  return `${parts.join('-')}@students.jobedu.local`;
}
function randomPassword(){return String(Math.floor(100000+Math.random()*900000))}

const passwordBookPath=arg('book','.student-passwords.json');
function loadPasswordBook(){if(!existsSync(passwordBookPath))return{};try{return JSON.parse(readFileSync(passwordBookPath,'utf8'))}catch{return{}}}
function savePasswordBook(book){writeFileSync(passwordBookPath,JSON.stringify(book,null,2),'utf8')}
function writeStudentCsv(outPath,book,schoolId){
  const rows=['이름,학년,학교코드,비밀번호'];
  const entries=Object.values(book).filter(e=>e.schoolId===schoolId).sort((a,b)=>a.grade-b.grade||a.name.localeCompare(b.name,'ko'));
  for(const e of entries)rows.push(`${e.name},${e.grade},${e.schoolCode},${e.password}`);
  writeFileSync(outPath,'﻿'+rows.join('\n'),'utf8');
}

const keyPath=required('key');
const serviceAccount=JSON.parse(readFileSync(keyPath,'utf8'));
initializeApp({credential:cert(serviceAccount)});
const auth=getAuth(),db=getFirestore();

async function createSchool(){
  const schoolId=required('school'),name=required('name');
  const community=arg('community',name),currencyName=arg('currency','마동'),symbol=arg('symbol',currencyName.slice(0,1)||'M');
  await db.doc(`schools/${schoolId}`).set({
    schoolId,schoolName:name,communityName:community,currencyName,currencySymbol:symbol,
    timezone:'Asia/Seoul',status:'active',schemaVersion:1,
  });
  console.log(`학교 생성 완료: schools/${schoolId} (${name})`);
}

async function createTeacher(){
  const schoolId=required('school'),email=required('email'),password=required('password');
  const role=arg('role','owner');
  if(!['owner','teacher'].includes(role)){console.error('--role은 owner 또는 teacher여야 합니다.');process.exit(1)}
  const school=await db.doc(`schools/${schoolId}`).get();
  if(!school.exists){console.error(`schools/${schoolId}가 없습니다. create-school을 먼저 실행해 주세요.`);process.exit(1)}
  let user;
  try{user=await auth.getUserByEmail(email)}catch{user=await auth.createUser({email,password})}
  await db.doc(`schools/${schoolId}/members/${user.uid}`).set({schoolId,role,studentId:null,status:'active'});
  await db.doc(`userSchools/${user.uid}/links/${schoolId}`).set({schoolId,schoolName:school.data().schoolName});
  console.log(`선생님 계정 준비 완료: ${email} / 비밀번호: ${password} (uid=${user.uid}, role=${role})`);
}

async function createStudentAccounts(){
  const schoolId=required('school'),schoolCode=required('code'),outPath=arg('out','student-accounts.csv');
  const sharedPassword=arg('password');
  const school=await db.doc(`schools/${schoolId}`).get();
  if(!school.exists){console.error(`schools/${schoolId}가 없습니다.`);process.exit(1)}
  const schoolName=school.data().schoolName;
  const snap=await db.collection(`schools/${schoolId}/students`).where('status','==','active').get();
  // Login uses grade+이름 only (no 반) — warn instead of silently colliding if that's not unique.
  const byGradeName=new Map();
  for(const d of snap.docs){const key=`${d.data().grade}-${d.data().name}`;byGradeName.set(key,(byGradeName.get(key)??0)+1)}
  const collisions=[...byGradeName].filter(([,count])=>count>1).map(([key])=>key);
  if(collisions.length){
    console.error(`같은 학년·이름 조합이 여러 명입니다 — 이 학생들은 같은 로그인으로 겹칩니다: ${collisions.join(', ')}`);
    console.error('반을 구분해서 로그인해야 하면 studentLoginEmail을 학년+반+이름으로 되돌려야 합니다. 계속 진행하지 않습니다.');
    process.exit(1);
  }
  const book=loadPasswordBook();
  let created=0,skipped=0;
  for(const studentDoc of snap.docs){
    const s=studentDoc.data();
    const email=studentLoginEmail(schoolCode,String(s.grade),s.name);
    try{
      await auth.getUserByEmail(email);
      skipped++;
      if(!book[email])book[email]={name:s.name,grade:s.grade,schoolCode,schoolId,password:'(알 수 없음 — reset-student-password로 재설정하세요)'};
    }catch{
      const password=sharedPassword||randomPassword();
      const user=await auth.createUser({email,password});
      await db.doc(`schools/${schoolId}/members/${user.uid}`).set({schoolId,role:'student',studentId:studentDoc.id,status:'active'});
      await db.doc(`userSchools/${user.uid}/links/${schoolId}`).set({schoolId,schoolName});
      book[email]={name:s.name,grade:s.grade,schoolCode,schoolId,password};
      created++;
    }
  }
  savePasswordBook(book);
  writeStudentCsv(outPath,book,schoolId);
  console.log(`학생 계정 생성 ${created}건, 이미 있어서 건너뜀 ${skipped}건.`);
  console.log(`비밀번호 목록(학생에게 나눠주세요, git에 커밋하지 마세요): ${outPath}`);
  if(sharedPassword&&created)console.log(`새로 만든 ${created}개 계정은 모두 같은 비밀번호(${sharedPassword})입니다 — 테스트용입니다. 실제 사용 전 reset-student-password로 각자 바꿔주세요.`);
}

async function resetStudentPassword(){
  const schoolId=required('school'),schoolCode=required('code'),grade=required('grade'),name=required('name');
  const outPath=arg('out','student-accounts.csv');
  const password=arg('password')||randomPassword();
  const email=studentLoginEmail(schoolCode,grade,name);
  let user;
  try{user=await auth.getUserByEmail(email)}
  catch{console.error(`계정을 찾을 수 없습니다: ${email}\n학교코드·학년·이름이 맞는지 확인해 주세요.`);process.exit(1)}
  await auth.updateUser(user.uid,{password});
  const book=loadPasswordBook();
  book[email]={name,grade:Number(grade),schoolCode,schoolId,password};
  savePasswordBook(book);
  writeStudentCsv(outPath,book,schoolId);
  console.log(`비밀번호 재설정 완료: ${name} (${grade}학년) → 새 비밀번호: ${password}`);
}

const commands={'create-school':createSchool,'create-teacher':createTeacher,'create-student-accounts':createStudentAccounts,'reset-student-password':resetStudentPassword};
const command=process.argv[2];
if(!commands[command]){usage();process.exit(1)}
await commands[command]();
