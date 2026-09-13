#!/usr/bin/env node
// Trusted, offline admin tool — the exact "별도의 검증된 관리 도구" the app's own security
// model assumes for first-time provisioning (D-5): normal app membership writes are denied by
// Firestore Rules on purpose, so bootstrapping a school/teacher/student accounts happens here,
// with the Admin SDK, using a service account key that never ships to the browser.
//
// Usage:
//   node scripts/admin-bootstrap.mjs create-school --key <service-account.json> --school <schoolId> --name "학교 이름" [--community "사회 이름"] [--currency "마동"] [--symbol "M"]
//   node scripts/admin-bootstrap.mjs create-teacher --key <service-account.json> --school <schoolId> --email <email> --password <password> [--role owner|teacher]
//   node scripts/admin-bootstrap.mjs create-student-accounts --key <service-account.json> --school <schoolId> --code <학교코드> [--out student-accounts.csv]
//
// create-student-accounts reads the already-imported roster (schools/{school}/students) and
// creates one Firebase Auth account per active student with no real email required — the login
// "email" is synthesized from 학교코드-학년-이름 (see src/domain/studentAuth.ts; the two must
// stay in sync) and a random 6-digit password. This assumes grade+이름 is unique school-wide
// (one class per grade); the command refuses to run if it finds a same-grade name collision.
// Re-running skips students who already have an account, so it's safe to run again after adding
// new students to the roster.
import {readFileSync,writeFileSync} from 'node:fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

function usage(){
  console.log(`사용법:
  node scripts/admin-bootstrap.mjs create-school --key <service-account.json> --school <schoolId> --name "학교 이름" [--community "사회 이름"] [--currency "마동"] [--symbol "M"]
  node scripts/admin-bootstrap.mjs create-teacher --key <service-account.json> --school <schoolId> --email <email> --password <password> [--role owner|teacher]
  node scripts/admin-bootstrap.mjs create-student-accounts --key <service-account.json> --school <schoolId> --code <학교코드> [--out student-accounts.csv]`);
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
  const rows=['이름,학년,학교코드,비밀번호'];
  let created=0,skipped=0;
  for(const studentDoc of snap.docs){
    const s=studentDoc.data();
    const email=studentLoginEmail(schoolCode,String(s.grade),s.name);
    try{
      await auth.getUserByEmail(email);
      skipped++;
    }catch{
      const password=randomPassword();
      const user=await auth.createUser({email,password});
      await db.doc(`schools/${schoolId}/members/${user.uid}`).set({schoolId,role:'student',studentId:studentDoc.id,status:'active'});
      await db.doc(`userSchools/${user.uid}/links/${schoolId}`).set({schoolId,schoolName});
      rows.push(`${s.name},${s.grade},${schoolCode},${password}`);
      created++;
    }
  }
  writeFileSync(outPath,'﻿'+rows.join('\n'),'utf8');
  console.log(`학생 계정 생성 ${created}건, 이미 있어서 건너뜀 ${skipped}건.`);
  console.log(`비밀번호 목록(학생에게 나눠주세요, git에 커밋하지 마세요): ${outPath}`);
}

const commands={'create-school':createSchool,'create-teacher':createTeacher,'create-student-accounts':createStudentAccounts};
const command=process.argv[2];
if(!commands[command]){usage();process.exit(1)}
await commands[command]();
