# 아키텍처 개요

이 문서는 구조를 한눈에 보기 위한 요약이다. 구현 결정의 근거와 세부 규칙은 `docs/IMPLEMENTATION_PLAN.md`(데이터 모델·금융 무결성·단계별 계획의 원본)를, 화면 자산 대응은 `docs/PROTOTYPE_MAPPING.md`를, 결정 이력은 `docs/DECISIONS.md`를 함께 본다. 최상위 요구사항은 `docs/requirements.txt`이며 충돌 시 그 원문이 우선한다.

## 1. 기술 스택

- React 19 + TypeScript + Vite (정적 SPA, 서버 렌더링 없음 → 무료 정적 호스팅과 호환)
- Firebase: Authentication(이메일/비밀번호) + Firestore(Spark 무료 플랜) — Functions/Storage/TTL 미사용
- 테스트: Vitest(순수 도메인 로직) + `@firebase/rules-unit-testing`(에뮬레이터 기반 보안 규칙 테스트)
- Firebase Admin SDK/비밀 키는 브라우저 번들에 절대 포함하지 않는다.

## 2. 레이어 구조

```
UI 컴포넌트 → 기능(feature) 서비스 → 학교 범위 저장소(data/*Repository) → Firestore
                                            ↑
                             domain/* (순수 함수: 금액 계산, 상태 전이, 명단 검증 — Firebase 비의존)
```

- `src/domain/`: `model.ts`(School/Membership/Student/Job/Journal 등 핵심 타입, `schoolPath` 경로 생성기), `jobs.ts`(직업 도메인 로직), `money.ts`(단리 계산 — BigInt 기반, half-up 반올림), `roster.ts`(명단 CSV/TSV 파싱·검증).
- `src/data/`: `firebase.ts`(SDK 초기화, 메모리 전용 persistence), `schoolRepository.ts`, `careerRepository.ts` — 항상 `SchoolContext`(schoolId+uid+membership)를 받아 `schoolPath()`로 경로를 만든다. **컴포넌트에서 컬렉션 문자열을 직접 조합하지 않는다.**
- `src/features/`: 화면 단위 기능 모듈. 현재 `jobs/`(CareerWorkspace, Demo), `roster/`(RosterImport). 이후 `tasks/ finance/ civic/ business/ school/`이 각 구현 단계에서 추가된다.
- `src/app/App.tsx`: 인증 상태 → 학교 선택 → 역할(학생/교사) 분기의 최상위 라우팅.
- `src/ui/`: 공통 스타일(`theme.css`, `careers.css`).

## 3. 화면 아키텍처 — 중요한 보정 사항

**현재 구현(App.tsx, theme.css)은 지도형 시민 UI가 아니라 일반 관리자 패널(파란색 `.panel`/`.button` 톤)이다.** 이는 프로젝트 지침("은행 앱·ERP처럼 보이면 안 된다", "지도형 사회 공간이 학생 홈의 핵심")과 어긋난다. `docs/PROTOTYPE_MAPPING.md`에 정리한 대로, 학생 화면은 다음 구조로 재구성되어야 한다.

```
App
 ├─ AuthGate (기존 로그인/학교선택 로직 재사용)
 ├─ StudentLayout
 │   ├─ TopBar (국기/잔액 chip — 잔액은 4단계 전까지 비활성)
 │   ├─ CitizenMap (홈) — BuildingHotspot[] → 건물별 라우트
 │   ├─ CitizenHud (시민증 오버레이)
 │   └─ Building 라우트: Bank / Store / Broadcast / Art / Library / Post / Environment / Event / Culture / MyPage
 │       └─ 각 라우트 내부에서 "일반 시민 뷰" vs "담당 직업 뷰"를 capability로 분기 (§4)
 └─ TeacherLayout (기존 SchoolWorkspace 계열 — 대시보드 톤 유지 가능, 학생 화면과 완전 분리)
```

- 학생 레이아웃과 교사 레이아웃은 원문 §40 지침대로 완전히 분리한다. 교사 화면은 관리 효율을 위해 지금의 패널형 UI를 유지해도 된다.
- 지도/건물 화면은 새 CSS 네임스페이스(예: `src/ui/citizen.css`)로 분리하고, 기존 `theme.css`의 관리자 팔레트를 학생 화면에 재사용하지 않는다.
- 건물 내부에서 "같은 장소, 다른 메뉴"는 React 조건부 렌더로 구현하되, **UI에서 숨기는 것과 서버 쓰기 권한은 별개**라는 원칙(원문 §48)에 따라 Firestore Rules도 항상 함께 갖춘다.

## 4. 권한/역할(Capability) 구조

| 계층 | 근거 | 비고 |
|---|---|---|
| Firebase Auth UID | 로그인 주체 | `studentId`(학적)와 분리 — 전학/계정 재발급에도 기록 유지 |
| Membership.role | `student` / `teacher` / `owner` | 학교별 `schools/{schoolId}/members/{uid}` 문서, 앱에서 변경 불가 |
| JobAssignment | 학생의 현재 직업(들), N:M | 화면 접근 role이 아니라 "무엇을 할 수 있는가"의 근거. 은행원 직업을 얻어도 teacher 권한이 생기지 않는다 |
| Capability | JobAssignment로부터 파생되는 세부 동작 단위(§47) | UI 조건 분기 + Firestore Rules 조건 양쪽에 동일하게 반영. 이름 문자열을 과도하게 하드코딩하지 않도록 `jobs.ts`의 icon/department 조합에서 유도 가능한 범위로 최소화 |

권한은 UI(버튼 숨김) + 애플리케이션 로직 + Firestore Security Rules 3중으로 적용한다(원문 §48). 현재 `firebase/firestore.rules`는 이미 이 원칙을 따르고 있다(교사도 원장을 수정할 수 없음, `{document=**} allow write: if false` 기본 거부 등).

## 5. 데이터 모델 요약

전체 컬렉션 설계와 필드는 `docs/IMPLEMENTATION_PLAN.md` §5(전체 표)를 정본으로 한다. 요지:

- 모든 학교 데이터는 `schools/{schoolId}/...` 아래에 있다. 다른 학교 문서 참조 금지, schoolId 기준 완전 격리.
- 계속 늘어나는 기록(거래, 업무 실행, 활동 이력)은 절대 배열 필드로 저장하지 않고 별도 컬렉션/서브컬렉션으로 둔다(원문 §52 — 현재 구현도 `jobApplications`, `jobAssignments`를 배열이 아닌 컬렉션으로 분리하여 이 원칙을 지키고 있음).
- 금액은 정수 `*Minor` 단위, 이율은 정수 basis points로 저장(부동소수점 누적 오차 회피) — `src/domain/money.ts`에 이미 구현.
- 미구현 컬렉션은 설계만 존재하고 Rules는 기본 거부로 닫아 둔다.

## 6. 금융 아키텍처 요약

- 원문 §19-30, IMPLEMENTATION_PLAN §6이 정본. 핵심: **학생 클라이언트는 잔액/원장을 직접 쓸 수 없다.** 학생 요청(`financialRequests`) → 은행원 학생 검토(`financeReviews`, 실행 권한 없음) → 교사 세션에서 서버 재계산·트랜잭션 확정(`journals`, 계좌 투영, `operationKeys`로 멱등성 보장).
- 모든 금전 이동은 불변 복식 `journal` 한 건(차변/대변 계좌 쌍)으로 기록. 정정은 원거래를 삭제하지 않고 반대 방향 정정 거래를 추가.
- Cloud Functions/스케줄러 없이(Spark 무료 제약) "교사가 버튼을 눌러 정산을 시작 → 미리보기 → 확정" 흐름으로 자동화 부족분을 사람이 메운다.

## 7. Firebase 무료 운영(Spark) 제약과 대응

- Firestore 무료 한도(읽기 50k/일, 쓰기 20k/일 등)는 프로젝트 단위로 여러 학교가 공유. 학교가 늘면 학교별 Firebase 프로젝트로 같은 코드베이스를 배포하는 방식을 고려(설정 주입 기반, `src/data/firebase.ts`의 `import.meta.env` 패턴 재사용 가능).
- Cloud Storage(Blaze 필요)를 쓰지 않는 대신, 사진은 클라이언트에서 축소·압축 후 Firestore에 임시 Base64 문서로 저장, 짧은 만료·승인 시 삭제(§16, IMPLEMENTATION_PLAN §7). 즉시/정시 자동 삭제는 보장하지 않음을 UI에 명시.
- 실시간 리스너 대신 수동 새로고침/작업 완료 후 재조회 위주. 목록은 25~100건 페이지 단위(현재 코드도 `limit(100)` 적용 중).

## 8. 비용/유지보수 전략

- 학교 이름·화폐 이름 등은 `School` 문서의 설정값으로만 존재(`schoolName/communityName/currencyName/currencySymbol`) — "마동" 문자열은 샘플 기본값에만 허용, 로직에 하드코딩하지 않는다.
- 핵심국 4개(경제·관리국/미디어·디지털국/생활·환경국/문화·기획국)는 템플릿에서 생성되는 기본값이며 학교별로 세부 직업 수를 유연하게 조정할 수 있다(원문 §2-3).
- 직업은 hard delete 없이 상태 전이(preparing→recruiting→active→paused→closed)로만 관리 — 현재 `firestore.rules`의 `jobs` 업데이트 규칙이 이미 이를 강제.
