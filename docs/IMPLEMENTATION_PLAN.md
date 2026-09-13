# 작은 사회 웹앱 — 구현 계획과 데이터베이스 설계

설계 기준일: 2026-09-12. 최상위 요구사항: `sources/madong_citizen_small_society_plan.txt` 전체 40개 항목. 해당 원문과 동기화 자료는 읽기 전용이다. 이 문서는 원문의 대체물이 아니라 구현 결정을 기록한다. 충돌 시 사용자의 명시적 지시와 원문을 우선한다.

## 1. 현재 상태와 이번 구현 범위

- 기존 프로젝트에는 요구사항 텍스트와 AGENTS.md만 있었고, 운영 중인 코드·Firebase 연결·DB는 없었다.
- 초기 화면 체험 초안은 `madong-app/dist`에 생성되었으나 운영 구조 확정 전에 중단했다. 로그인·권한 보호·영구 저장이 없는 초안이며 운영 코드로 사용하지 않는다. 별도의 `prototype` 영역으로 분리한다.
- Sites 등록은 이루어졌지만 버전 저장·배포·학생 정보 업로드는 하지 않았다. 등록된 사이트는 재사용하며 새 사이트를 중복 생성하지 않는다.
- 사용자는 Firebase 계정만 있고 이 앱에 연결한 프로젝트는 아직 없다. 실제 Firebase 리소스를 생성하거나 요금제를 변경하지 않는다.
- 제공된 학생 시트의 A1:F100 범위를 읽기 전용으로 확인했다. 열은 `학년`, `이름`, 학생 39명(1~6학년 각각 4, 2, 5, 10, 4, 14명). 해당 범위 내 필수값 누락과 학년+이름 중복은 0건. 실제 이름은 소스·테스트·데모·배포물에 포함하지 않는다.
- 반, 학적 고유번호, 로그인 계정은 명단에 없다. 반을 임의로 1반으로 확정하지 않으며 가져오기 전 교사가 지정한다. 이름 또는 이름의 해시를 영구 ID로 사용하지 않는다.
- 제공된 디자인 폴더는 backgrounds, characters, decorations, departments, finance_civic, jobs, status, ui로 구성된다. 파일 내용과 크기를 확인한 자산만 사용한다. 실명 명단은 자산 폴더와 분리한다.

이번 코드 단계는 **멀티스쿨·인증·권한·명단 가져오기 검증의 기반**이다. 전체 기능을 한번에 출시하지 않는다. 이후 단계는 각각 규칙 테스트와 기능 검증을 통과한 뒤 활성화한다. 미구현 기능은 기본 거부 규칙으로 닫아 둔다.

## 2. 요구사항을 제품 구조로 연결

| 원문 | 요구 | 구현 단위 |
|---|---|---|
| 1–4, 36–37, 40 | 지속 가능한 작은 사회, 핵심국, 복수 직업 | 학교 설정, 부서, 직업, 기간별 직업 배정 |
| 5 | 직업 생애주기, 종료 자료 보존 | 상태 전이와 archive 상태; 별도 역사관 없음 |
| 6–8, 34–35 | 시민증, 태블릿, 학생·교사 구분 | 인증, 학교 멤버십, 시민 프로필, 역할별 화면 |
| 9–11 | 직업과 업무 분리, 세 가지 인증 | 업무 템플릿, 업무 인스턴스, 제출본, 검토 기록 |
| 12–19, 22 | 학교 화폐, 월급, 저축, 단리, 원장 | 금융상품 버전, 계약, 원장, 계좌 투영, 정산 |
| 20–21 | 대출과 학생 은행원 검증 | 금융 요청, 검증 담당 배정, 검토, 교사 실행 |
| 23–24 | 세금, 공동기금, 과태료 | 학교 정책 버전, 납부 청구, 교사 승인 |
| 25 | 학생 사업과 판매 | 사업·사업 구성원·상품·주문·사업계좌 |
| 26–29 | 직업·사업 제안, 투표, 최종 승인 | 유형별 제안서, 의견, 개인 투표, 결정과 생성 |
| 30–32 | 교사 관리, 자동화, 여러 학교 | 학교별 권한, 요청 처리기, 정책·템플릿 설정 |
| 33 | 카드 없는 Firebase 운영 | Auth + Firestore Spark, Functions/Storage/TTL 미사용 |
| 38–39 | 먼저 설계, 단계별 검증 | 아래 8단계와 요구사항 추적표 |

## 3. 유지보수 구조

운영 앱은 React + TypeScript + Vite의 정적 SPA와 Firebase Web SDK로 구성한다. 서버 렌더링이 필요하지 않아 무료 정적 호스팅과 맞는다. Firebase Admin SDK·비밀 키를 브라우저에 넣지 않는다.

```text
madong-app/
  docs/                         운영 설정, 테스트 결과, 자산 출처
  prototype/                    중단한 화면 실험; 배포 대상 아님
  src/
    app/                        로그인 상태, 학교 선택, 역할별 진입
    domain/                     순수 타입·금액 계산·전이·명단 검증
    data/                       SchoolContext가 필수인 Firestore 저장소
    features/
      auth/                     이메일/비밀번호 로그인, 로그아웃
      school/                   시민증, 학교 정보, 교사 명단 화면
      roster/                   가져오기 미리보기·오류·확정
      jobs/ tasks/ finance/     해당 구현 단계에서 추가
      civic/ business/         해당 구현 단계에서 추가
    ui/                         공통 접근성 컴포넌트·테마
  firebase/
    firestore.rules             서버 측 권한의 최종 경계
    firestore.indexes.json      실제 쿼리에 필요한 색인만 추가
  tests/                        순수 도메인 + 에뮬레이터 권한 테스트
  public/assets/                확인한 비개인 디자인 자료만
```

UI → 기능 서비스 → 학교 범위 저장소 → Firestore 순서로 접근한다. 컴포넌트에서 임의의 학교 컬렉션 문자열을 조합하지 않는다. 금액 계산과 상태 전이는 Firebase를 모르는 순수 함수로 분리한다. 화면을 숨기는 것과 데이터 권한은 별개이며 둘 다 적용한다.

학교 기본값은 설정/템플릿 데이터다. 마동초라는 문자열은 샘플 설정·자료 설명에만 허용한다. 학교별 문서 경로는 항상 `schools/{schoolId}/...`이다. Firebase 프로젝트는 여러 학교가 공유할 수 있지만 무료 사용량도 공유된다. 학교 수가 늘면 동일 앱을 학교별 Firebase 프로젝트에 배포할 수 있게 설정 주입을 지원한다. 처음부터 DB를 학교별로 여러 개 만드는 것은 한 프로젝트에 한 개만 무료인 조건과 맞지 않는다.

## 4. 계정·등록·권한

### 인증과 시민 데이터 분리

Firebase Auth UID는 로그인 주체다. `studentId`는 학적/시민 주체다. 두 값을 분리하면 전학·계정 재발급·학생 이름 변경에도 직업·원장을 유지할 수 있다. 학생 등록만으로 로그인 계정이 자동 생성됐다고 표시하지 않는다.

첫 학교와 owner 멤버십은 프로젝트 소유자가 Firebase 콘솔 또는 별도 로컬 관리 도구로 최초 등록한다. 가입 폼에서 사용자가 teacher/owner를 선택해 저장하지 못한다. 일반 앱의 멤버십 쓰기는 전부 거부한다. 이후 초대/계정 발급은 별도의 검증된 관리 도구 단계에서 추가한다. Firebase Admin은 규칙을 우회하므로 학교 단위 검증·작업 미리보기·감사 로그를 별도로 구현한다.

학생 로그인은 학교가 관리하는 계정으로 시작한다. SMS 인증·공용 비밀번호·이름만 입력하는 로그인은 쓰지 않는다. 저학년용 QR/짧은 로그인 방식은 탈취·재발급·공유 태블릿 요건을 별도 설계한 뒤 추가한다. 학생의 개인 이메일이 반드시 필요하다고 가정하지 않는다.

### 역할

| 주체 | 조회 | 생성·변경 | 금지 |
|---|---|---|---|
| 미로그인 | 로그인/안내 | 로그인만 | 학교·명단·금융 조회 |
| 등록 대기 계정 | 자기 계정의 연결 상태 | 없음 | 임의 학교 가입/역할 변경 |
| 학생 | 자기 시민증·업무·계좌, 학교 공개 직업·제안 | 자기 신청·제출·금융 요청·의견·한 표 | 잔액/원장/승인/타인 프로필/학교 설정 |
| 학생 은행원 | 교사가 배정한 검증 작업의 최소 거래 정보 | 해당 작업의 검토 결과 | 전체 금융정보 조회, 원장·잔액·이율 수정 |
| 교사 | 해당 학교 관리 데이터 | 학생 프로필·직업·업무·검토·정산·설정 | 타 학교 접근, 원장 수정·삭제, 역할 승격 |
| 학교 owner | 교사 권한 및 학교 운영 책임 | 관리 도구를 통한 멤버십 관리 | 다른 학교 접근 |
| 프로젝트 관리자 | 신뢰 경계 밖의 관리 권한 | 초기 설정·복구·관리 작업 | 앱 보안 규칙으로 관리자 자체를 통제할 수는 없음 |

멤버십의 `status=active`를 모든 규칙에서 검사한다. 졸업/전출은 데이터 삭제 대신 멤버십 비활성화 및 학적 상태 변경부터 처리한다. 학생 직업은 접근 역할이 아니다. '은행원' 직업을 얻어도 teacher 권한이 생기지 않는다.

공유 태블릿은 메모리 기반 로그인 지속성과 Firestore 메모리 캐시를 사용한다. 학교 변경·로그아웃 시 조회 결과와 사진 URL을 폐기한다. 학생 명단이나 금융정보를 localStorage·서비스 워커 캐시에 저장하지 않는다.

## 5. Firestore 데이터베이스 전체 설계

별도 표기가 없는 모든 문서는 `schoolId`, `schemaVersion`, 생성/수정 시각을 가진다. 수정 시각은 서버 타임스탬프다. 참조는 다른 학교 경로를 받지 않고 같은 학교의 문서 ID만 받는다. 미구현 컬렉션은 문서 설계만 존재하며 보안 규칙은 거부한다.

| 경로 | 핵심 필드 | 성격·읽기 범위 |
|---|---|---|
| `userSchools/{uid}/links/{schoolId}` | schoolId, schoolName | 본인만 읽는 학교 선택용 인덱스; 권한 판단에는 미사용 |
| `schools/{schoolId}` | schoolName, communityName, currencyName, currencySymbol, timezone, status, schemaVersion | 활성 멤버의 학교 기본 정보 |
| `.../members/{uid}` | role, studentId(nullable), status, schoolId | 본인/교사 조회; 앱에서 역할 변경 불가 |
| `.../students/{studentId}` | name, grade, className(nullable), citizenCode, schoolYear, status, schoolId | 본인 또는 교사만; UID/개인 이메일/잔액 넣지 않음 |
| `.../enrollments/{id}` | studentId, schoolYear, grade, className, startAt, endAt | 학년도 이력; 현 프로필은 최신 투영 |
| `.../departments/{id}` | name, core, status, order | 핵심국 4개는 템플릿에서 생성 |
| `.../jobs/{jobId}` | departmentId, name, description, core, status, recommendedGrades, capacity, payPolicyId | 직업 정의. 필수/시민 직업 구분 |
| `.../jobAssignments/{id}` | jobId, studentId, startAt, endAt, status | 학생:직업 N:M. 복수 직업/여러 담당자 가능 |
| `.../jobApplications/{id}` | jobId, studentId, reason, status, reviewedBy | 신청과 배정 분리 |
| `.../taskTemplates/{id}` | jobId, title, instructions, recurrence, verificationKind, rewardPolicyId | 반복 업무의 설계도 |
| `.../tasks/{taskId}` | templateId, jobId, assigneeStudentId, occurrenceKey, dueAt, verificationKind, status, rewardSnapshot | 한 학생에게 배정된 실제 업무; 당시 조건 보존 |
| `.../submissions/{id}` | taskId, studentId, attempt, kind, text, status, submittedAt, reviewedAt, reviewerUid | 제출/재제출을 별도 버전으로 기록 |
| `.../evidence/{submissionId}` | studentId, submissionId, mimeType, payloadBase64, expiresAt, createdAt | 임시 사진; 본인/담당 교사만, 인덱스 제외 |
| `.../systemEvents/{id}` | taskId, sourceType, sourceId, verifiedBy, createdAt | 실제 거래/도서대여 등에 묶인 자동 인증 근거 |
| `.../financialPolicies/{versionId}` | taxRateBps, rounding, currencyScale, effectiveFrom | 정책 버전; 이미 체결된 계약 조건 불변 |
| `.../financialProducts/{productId}` | kind, rateBpsMonthly, min/maxMinor, min/maxMonths, earlyExitPolicy, payoutSchedule, status | 월이율·단리·기간·한도·만기 조건 |
| `.../accounts/{accountId}` | ownerType, ownerId, currencyCode, balanceMinor, version, lastJournalId, status | 잔액은 원장의 투영; 본인/교사 읽기 |
| `.../financialRequests/{requestId}` | requesterStudentId, operation, input, status, submittedAt, reviewerUid | 학생이 쓸 수 있는 유일한 금융 입력. 금액은 요청값 |
| `.../journals/{journalId}` | type, sourceType, sourceId, debitAccountId, creditAccountId, amountMinor, postedBy, postedAt, policyVersionId, reversalOf | 불변 복식 원장. 계정 간 동일 금액 이동 |
| `.../accounts/{accountId}/entries/{journalId}` | deltaMinor, journalId, type, postedAt, balanceAfterMinor | 학생에게 상대의 금융정보를 노출하지 않는 자기 명세 투영 |
| `.../operationKeys/{key}` | journalIds, sourceId, completedAt | 중복 실행 방지. 같은 요청/정산 기간은 한 번 |
| `.../savings/{contractId}` | studentId, accountId, principalMinor, productSnapshot, startAt, maturityAt, paidPeriods, status | 가입 당시 이율/반올림/만기 조건 고정 |
| `.../loans/{contractId}` | studentId, principalMinor, rateBpsMonthly, months, interestMinor, outstandingPrincipalMinor, outstandingInterestMinor, repaymentPlan, status | 목적·상환 계획·검토·실행 분리 |
| `.../financeReviews/{id}` | assignedStudentId, requestId, redactedFacts, checklist, status | 은행원 검증에 필요한 최소 정보만 |
| `.../assessments/{id}` | studentId/businessId, kind(tax/fine), reason, approvedBy, amountMinor, paidJournalId | 학생에게 부과 권한 없음 |
| `.../businesses/{id}` | name, ownerStudentId, memberStudentIds, proposalId, accountId, status | 승인된 사업만 생성 |
| `.../products/{id}` | businessId, name, priceMinor, stock, status | 사업 직원 권한은 별도 배정 문서로 검사 |
| `.../orders/{id}` | buyerStudentId, businessId, linesSnapshot, totalMinor, status, journalId | 가격·재고 서버 규칙/정산 시 재검증 |
| `.../proposals/{id}` | type, authorStudentId, title, payload, status, votingPolicySnapshot, opensAt, closesAt, decision | 직업/사업/규칙 등의 유형별 필수 필드 |
| `.../proposals/{id}/votes/{uid}` | choice, createdAt | 인증 사용자당 한 문서, 투표 기간·학교·멤버십 검사 |
| `.../proposals/{id}/comments/{id}` | authorStudentId, text, createdAt | 학교 안에서만 읽기, 작성자 위조 차단 |
| `.../proposalDecisions/{id}` | proposalId, voteSnapshot, reason, approvedBy, createdEntityId | 투표 종료 후 교사 최종 결정; 생성과 원자적 처리 |
| `.../notifications/{id}` | recipientStudentId, kind, relatedId, readAt | 본인 대상 조회만 |
| `.../auditLogs/{id}` | actorUid, action, targetType, targetId, timestamp, reason | 교사 작업 기록, 학생 실명·사진 본문은 기록하지 않음 |
| `.../importBatches/{id}` | sourceKind, rowCount, acceptedCount, rejectedCount, status, actorUid | 중복 가져오기 예방·결과 요약; 원본 전체 보관 금지 |

### 필드와 식별자 정책

- studentId/jobId/taskId/contractId는 무작위 ID다. 이름 변경과 학년 진급은 동일 studentId를 유지한다.
- 시민증 코드는 식별 표시에만 사용하고 비밀번호처럼 사용하지 않는다.
- 학년+이름은 첫 가져오기 후보 중복 검사에만 사용한다. 재가져오기 시 기존 studentId 매핑을 검토해야 하며 자동 병합하지 않는다.
- 돈은 정수 `Minor` 단위, 월이율은 정수 basis points(5%=500bps)로 저장한다. JS 부동소수점 누적 오차를 피한다.
- 학교 화폐 소수 자릿수는 개설 시 고정한다. 표시 이름·기호 변경과 금액 단위 변경을 구분한다. 운영 중 단위 변경은 데이터 마이그레이션이다.
- 개발용 샘플은 `demo-*` 프로젝트와 가상 학교·학생만 사용한다.

## 6. 금융 무결성 설계

### 최우선 원칙

학생 클라이언트는 계좌 잔액, 원장, 이자 지급 기록, 대출 실행 상태를 직접 쓰지 못한다. Firestore Security Rules에서 차단한다. 브라우저 버튼을 숨기는 것만으로 보호하지 않는다.

Spark에서 유료 Functions를 사용하지 않으므로 처음에는 **학생 요청 → 은행원 검토 → 교사 세션에서 검증·정산**을 사용한다. 프로그램이 계산과 기록을 자동 수행하고 교사는 처리를 시작/승인한다. 즉시 자동 확정이 필요한 저축·구매·송금은 각 연산을 보안 규칙으로 완전히 검증할 수 있을 때 별도 단계로 연다. 범용적인 '학생 금융 쓰기 허용' 규칙은 만들지 않는다. 아무도 접속하지 않았을 때의 정각 자동 정산은 제공한다고 약속하지 않는다.

### 거래 처리

1. 학생은 소유자·종류·입력·요청 시각만 포함한 요청을 제출한다. `status=submitted`를 강제한다.
2. 은행원은 배정된 검증 자료로 체크리스트를 작성한다. 이것만으로 금융 실행은 되지 않는다.
3. 교사 정산 서비스는 요청·상품·계좌·원장 중복 키를 서버에서 읽고 금액과 정책을 다시 계산한다.
4. Firestore transaction에서 불변 journal, 두 계좌의 잔액/버전, 두 계좌 명세, operationKey, 요청 완료 상태를 함께 기록한다. 하나라도 실패하면 모두 실패한다.
5. Rules의 getAfter로 계좌 변화와 journal의 연결, 같은 학교/화폐, 양의 정수 금액, 잔액 한도, 버전 증가, 요청의 완료 상태를 검증한다. 금융 구현 단계에서 이 규칙과 공격 테스트를 함께 완성한다. 지금 단계에서는 금융 쓰기를 전부 거부한다.
6. 재시도는 같은 operationKey를 쓰고 이미 완료된 결과를 반환한다. UI 재클릭 방지만으로 중복 지급을 막지 않는다.

키 예: 업무 보상 `salary:{taskId}:{approvedSubmissionId}`, 이자 `interest:{contractId}:{period}`, 구매 `purchase:{orderId}`. 최초 업무 지급 이후 재제출로 두 번째 보상을 받을 수 없어야 하므로 task의 paidJournalId도 검사한다.

계좌 하나의 버전은 직렬화한다. 동시에 두 번 쓰면 Firestore가 재시도하여 최신 잔액으로 재검증한다. 오프라인 금융 요청을 성공으로 표시하지 않는다.

### 원장과 정정

모든 금액 이동은 출금 계정과 입금 계정이 있는 한 개 journal로 표현한다. 월급·이자도 학교 지급 계정에서 학생 계정으로 이동하고, 저축은 학생 현금 계정에서 저축 계정으로 이동한다. 시스템 발행/회수 계정과 학교 운영계정의 역할을 분리한다. 전체 journal은 교사만 읽으며 학생에게는 자신의 account entries만 공개한다.

원문 거래 종류 SALARY, DEPOSIT, WITHDRAW, TRANSFER, INTEREST, LOAN, LOAN_REPAYMENT, TAX, FINE, PURCHASE, SALE, REFUND, ADJUSTMENT를 지원한다. 매매의 PURCHASE/SALE은 한 경제 사건의 양쪽 명세이며 총액을 두 번 집계하지 않는다.

기존 journal은 교사도 수정·삭제할 수 없다. 오류는 원본을 참조하는 반대 방향 정정 거래와 필요한 대체 거래를 추가한다. 정정 사유와 승인자 필수. 시스템 관리자(Admin SDK/콘솔)는 규칙을 우회할 수 있으므로 '어떤 관리자도 절대 바꿀 수 없다'는 보장은 하지 않는다.

### 이자·월급·세금

- 단리 이자 = 원금 × 월이율 × 개월수. 100 × 5% × 3 = 15, 100 × 6% × 3 = 18.
- 단기 저축 500bps/1~3개월, 장기 저축 1000bps/4개월 이상. 단기 대출 600bps, 장기 대출 1200bps. 기간 상한은 학교가 설정한다.
- 학교 시간대는 기본 Asia/Seoul. 달력 월 단위로 만기를 계산하고 월말은 해당 월의 마지막 날로 보정한다. 30일×개월수를 쓰지 않는다.
- 반올림은 최소 화폐 단위에서 한 번만. 정책과 계약에 저장한다. 중도해지·부분상환·휴일·졸업 정산은 상품 정책을 확정한 뒤 구현한다.
- 정산 화면에서 지급 예정 목록을 먼저 보여 주고 중복 키로 처리한다. 앱 종료 중 만기는 다음 교사 접속 때 미처리분을 계산하되 원래 만기일과 실제 처리일 모두 남긴다.
- 원문은 교사 지정 월급도 요구한다. 업무 보상과 정기 월급을 별도 payPolicy로 지원하며 같은 근거의 이중 지급을 금지한다.
- 세금과 벌금은 교사 승인 청구에만 근거한다. 학생의 규칙 위반 보고는 부과 기록과 분리한다.

## 7. 직업·업무·인증

직업 정의, 학생 배정, 반복 업무 템플릿, 날짜별 업무, 인증 제출을 각각 분리한다. 반복 업무 ID는 template+student+발생일에서 결정하거나 중복 키를 둬 한 날짜의 중복 생성을 막는다. 직업 종료는 새 배정·새 업무만 막으며 기존 제출/원장은 보존한다.

업무 상태: assigned → submitted → approved/revision_requested → rewarded. 반려 후 새 submission을 만들고 이전 검토 이력을 보존한다. 보상과 승인 사이 실패에 대비해 approved+paidJournalId의 원자적 확정을 검토하며, 단순 완료 버튼으로 rewarded가 될 수 없다.

인증 종류:

| 종류 | 근거 | 승인/검증 |
|---|---|---|
| system | 확정된 거래, 대여, 판매 등의 event ID | 연관 이벤트와 담당 학생 일치 검증; 학생이 이벤트를 위조 생성 못함 |
| photo | 크기를 제한한 임시 사진 + 활동 설명 | 선생님 확인 후 원본 삭제, 승인 메타데이터만 보존 |
| artifact | 기사/글/기획서 등 텍스트 또는 허용된 파일 | 제출본 버전·검토 의견, 타입·크기·학교 접근 제한 |

인증 담당을 업무별로 지정할 수 있게 하고, 저학년은 짧은 문장·큰 버튼을 제공한다. 사진 촬영 권한은 필요한 순간에만 요청한다. 얼굴 촬영을 강제하지 않는다.

### 사진과 무료 요금 충돌 해결

현재 Cloud Storage for Firebase는 Blaze가 필요하므로 Spark 기본 구성에서 제외한다. 작은 사진을 브라우저에서 재인코딩해 긴 변 640px 이하·압축 후 최대 약 60KB로 줄이고, Firestore 임시 문서에 Base64로 저장하는 제한적 대안을 검토한다. Base64는 약 33% 커지므로 인코딩 문자열 한도도 강제한다. EXIF를 재인코딩으로 제거하고 SVG 등 실행 가능한 파일 형식은 거부한다.

이 방식은 일반 파일 저장소가 아니며 소규모 인증에만 사용한다. 본문 인덱스를 제외하고 1회 제출 1장, 만료 24시간, 사용자당 미검토 제출 한도를 검증한다. 정확한 한도는 사진 구현 단계에서 규칙·용량 테스트로 확정한다.

승인 트랜잭션에 evidence 삭제를 포함한다. 제출자가 취소하면 자기 evidence를 삭제할 수 있다. 만료 문서는 규칙에서 조회를 차단하고 교사 운영실 접속 시 소량씩 정리한다. Firestore TTL·예약 Functions는 쓰지 않는다. **접속이 없으면 물리 삭제가 지연된다.** 즉시/정시 자동 삭제가 필수이면 카드 없는 현재 구성만으로 보장할 수 없으므로 현장 확인 후 미업로드 방식이나 학교 관리 서버를 별도 결정한다. 브라우저 캐시, 화면 캡처, 이미 내려받은 사진까지 원격 삭제할 수는 없다.

## 8. 시민 제안·투표·사업

직업추천서는 직업명, 목적/필요성, 구체 업무, 수혜자, 예상 급여, 도구, 추천 이유를 필수/선택 필드로 구분한다. 사업제안서는 서비스, 고객, 가격, 자본, 인력, 수익/비용, 장점, 예상 문제와 해결책을 분리한다. 하나의 자유입력 칸으로 모든 필드를 대체하지 않는다.

상태: draft → submitted → voting → closed → teacher_review → approved/rejected → implemented.

교사는 투표 개시 전에 마감일·참여자 범위·최소 참여율·찬성 기준을 확정한다. 진행 중 기준을 바꾸면 새 투표로 진행한다. 학생은 자기 UID 한 표만 생성하며 학교·기간·대상자를 검사한다. 학생이 집계 숫자를 쓰지 않는다. 소규모 학교는 마감 후 교사가 실제 votes를 읽어 집계하고 스냅샷을 남긴다. 개별 투표는 학생에게 비공개, 집계만 공개한다.

교사 승인과 새 직업/사업/규칙 생성은 결정 문서+생성 문서를 한 transaction으로 처리한다. 생성 ID는 proposalId에 묶어 재시도 중복을 막는다. 투표 통과가 안전·개인정보·금융 권한 검토를 대신하지 않는다. 반려 이유를 남기고 수정 제안은 새 버전으로 처리한다.

## 9. 학생·교사 화면

학생: 학교 선택/로그인 → 내 시민증과 오늘의 업무 → 직업 신청 → 인증 제출 → 내 보상/거래 → 저축/대출 요청·상환 → 시장·내 사업 → 제안·투표·알림. 각 화면은 본인 정보만 조회한다. 타 학생의 이름·잔액 목록은 제공하지 않는다.

교사: 로그인 → 학교 선택 → 학교 운영 현황 → 명단 가져오기/학생 관리 → 국·직업·복수 배정 → 업무 템플릿/배정 → 인증 검토 → 금융 요청 검토/정산/오류 정정 → 제안 최종 결정 → 사업·세금·과태료 → 통계·정책·임시 사진 정리.

화면 진입 시 membership을 확인한다. 교사 화면에 역할 전환 버튼을 두어 학생이 교사를 체험하는 기능은 운영 빌드에 포함하지 않는다. 데모는 별도 진입·별도 가상 데이터로만 가능하며 실제 Firebase 저장소를 호출하지 않는다.

명단 가져오기: CSV/TSV 또는 시트 복사 → 열 매핑 → 학년·이름·반 검사 → 중복/기존 학생 후보 확인 → 무작위 studentId 배정 미리보기 → 교사 확정 → 소규모 원자적 배치 → importBatch 요약. 가져오기는 학생 프로필만 생성하며 Auth 계정 발급과 연결은 별도다. 가져온 문자열은 실행하지 않고 React 텍스트로 렌더링한다.

## 10. Spark 무료 운영 예산과 제약

2026-09-12 공식 문서 확인:

- Firestore 무료: 저장 1GiB, 읽기 50,000/일, 쓰기 20,000/일, 삭제 20,000/일, 외부 전송 10GiB/월. 한 프로젝트의 한 DB에 적용하며 여러 학교가 합산 사용한다.
- Cloud Storage는 Blaze 필요. 무료 사용량이 있어도 카드 없는 Spark와 같지 않다.
- TTL 삭제, 관리형 백업/PITR 등은 무료 사용에 포함되지 않는다.
- 규칙의 get/exists 검증도 읽기 비용에 영향을 준다. getAfter는 원자적 검증에 유용하지만 전체/개별 접근 호출 제한이 있다.

운영 방안: 학생 초기 화면은 필요한 문서만 조회, 목록 25~50개 페이지, 실시간 구독 기본 미사용, 수동 새로고침·작업 완료 후 재조회, 집계는 교사 화면에서 제한적으로, 사진은 상세 검토 때만 읽기, 대형 배열/학년도 전체 원장 다운로드 금지. 데이터량과 규칙 읽기를 에뮬레이터 및 실제 사용량으로 점검한다. 프로젝트 전체가 한도에 도달하면 기능 제한/중단을 안내하며 자동으로 유료 전환하지 않는다.

예시 추정(보장값 아님): 39명 × 하루 3회 × 회당 35읽기 = 4,095읽기/일. 규칙 참조·교사 사용·재시도·사진 검토·금융 등은 별도다. 학교 확장 전 실제 Firebase Usage에서 여유를 확인한다. 60KB 사진 39장/일·1일 보관의 인코딩 본문은 약 3.1MB이며 문서/색인 오버헤드와 여러 읽기는 추가다.

참고:
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions

## 11. 단계별 구현과 통과 기준

| 단계 | 구현 | 필수 검증 |
|---|---|---|
| 1 기반 | 타입, 학교 범위 저장소, Firebase 설정, 로그인, 역할 분기, 시민 프로필, 교사 명단 가져오기 | 학교 A→B 접근 거부, 학생→교사 승격 거부, 타 학생 조회 거부, 미로그인 차단, 가져오기 누락/중복 검증 |
| 2 직업 | 4국 템플릿, 직업 상태, 신청, 복수 배정, 권장 학년 | 1학생 복수 직업, core 삭제 거부, 종료 후 신규 업무 차단 |
| 3 업무 | 템플릿/인스턴스, 반복, 제출/재제출, 검토 | 발생일 중복 방지, 타인 제출 거부, 단순 완료 보상 불가 |
| 4 금융 | 고정소수점, 원장, 계좌 투영, 요청/정산, 저축/대출/상환/이자/월급 | 100×5%×3=15, 이중 지급/동시 인출/재시도/원장 변조/오프라인 실패/정정 대사 |
| 5 경제 | 사업, 상품, 주문, 세금, 과태료, 공동기금 | 가격 변조, 재고 초과 판매, 학생 임의 부과 거부 |
| 6 시민사회 | 구조화 제안서, 투표, 교사 결정, 직업/사업 생성 | 중복 투표, 마감 후 투표, 기준 변경, 승인 재시도 중복 생성 차단 |
| 7 증빙 | 압축 사진·결과물, 만료 접근 차단, 승인 시 삭제, 정리 | 잘못된 MIME/과대 파일/타인 접근/만료/삭제 지연 안내 |
| 8 운영 | 통계, 명단 갱신, 졸업/전학, 감사, 접근성·태블릿 | 2학교 실데이터 격리, 계정 비활성화, 비용 점검, 전체 사용자 흐름 |

공통 완료 조건: 해당 단계에 도메인 테스트, Firestore 에뮬레이터 공격/정상 시나리오, 타입 검사, 프로덕션 빌드, 수동 화면 검증이 통과해야 한다. Firebase 미연결 상태를 '운영 완료'라고 표시하지 않는다. 실제 명단 반영은 연결된 학교 ID와 대상 검증 후 시행한다.

## 12. 명시적 개선·차이 기록

1. 사진 저장: 원문의 자체 인증을 유지하되 유료 Storage 대신 작은 임시 Firestore 증빙을 고려한다. 무료·단기 보관 우선이며 무접속 정시 삭제 한계를 표시한다.
2. 금융 자동화: 계산·원자적 기록은 자동, 실행은 초기에는 교사 세션에 의존한다. 학생 직접 잔액 수정 금지를 우선하며 안전성이 검증된 연산만 단계적으로 즉시 처리한다.
3. Firebase 회원과 시민 프로필 분리: 계정 재발급에도 금융 원장을 유지하고 학생 명단에서 개인 이메일을 요구하지 않기 위함이다.
4. 원장과 학생 명세 분리: 전체 복식 원장의 상대 계좌를 학생에게 노출하지 않으면서 자기 금융 이력을 제공한다.
5. 사진 만료와 삭제 분리: 접근 차단은 규칙으로 즉시, 물리 삭제는 교사 접속 때 수행한다. 둘을 자동 삭제라는 한 표현으로 묶어 약속하지 않는다.
6. 실명 자료와 디자인 자산 분리: 명단을 public 자산·Git·체험 데이터로 복제하지 않는다.

## 13. UI 아키텍처 보정 (신규)

2026-09-13 재검토: 최초 작성 당시 §1에서 프로토타입(`sources/madong_citizen_role_based_full_prototype.html`)을 "운영 구조 확정 전 중단된 화면 실험, 배포 대상 아님"으로 분류했다. **이 판단은 정정한다.** 최신 지침은 해당 프로토타입의 지도형 홈·건물 hotspot·역할별 화면 분기를 정식 앱의 화면 정체성으로 유지·발전시킬 것을 명시한다. 폐기 대상이 아니다.

현재 `src/app/App.tsx`, `src/ui/theme.css`로 구현된 1~2단계 화면은 기능적으로는 견고하지만(로그인/학교선택/명단가져오기/직업신청·배정이 규칙 테스트까지 통과) 시각적으로는 지도형 프로토타입과 무관한 일반 관리자 패널 톤이다. 이 도메인/데이터 레이어(`domain/`, `data/`)는 그대로 재사용하고, **학생 대면 화면만** 지도(`CitizenMap`) + 건물별 라우트 + 역할 조건부 렌더 구조로 다시 감싼다. 교사 화면(`SchoolWorkspace`)은 지금의 패널형 톤을 유지한다.

세부 대응표는 `docs/PROTOTYPE_MAPPING.md`, 컴포넌트 트리는 `docs/ARCHITECTURE.md` §3, 결정 배경은 `docs/DECISIONS.md` D-1/D-2를 참조한다.

## 15. 금융(계좌·월급) 1차 구현 범위 (신규)

2026-09-13: §6의 금융 무결성 설계를 실제로 구현했다. 범위는 **월급 정산 한 가지 거래 종류**로 좁혔다: `accounts`(학생 계좌 + 학교 발행 계좌 `system-issuer`), `journals`(SALARY 전용, 불변, ID 자체가 멱등키), 계좌별 `entries` 서브컬렉션(학생 자기 명세). 교사가 정산 월을 고르면 미리보기(직업별 월급 × 해당 직업의 활성 배정 학생) → 확정 순서로 진행하며, Cloud Functions 없이 교사 세션에서 트랜잭션으로 처리한다(§28-29 원칙 그대로).

저축·대출·세금·과태료·`financialRequests`/`financeReviews`(학생 요청·은행원 검증) 워크플로는 아직 없다. 다형적 journal 스키마(sourceType/sourceId/policyVersionId, 여러 거래 종류를 한 형태로)와 별도의 `operationKeys` 컬렉션도 아직 도입하지 않았다 — 지금은 SALARY/PURCHASE 두 가지뿐이라 필요가 없고, 다음 거래 종류가 추가될 때 실제 필요에 맞춰 일반화한다. 자세한 근거는 `docs/DECISIONS.md` D-17~D-21.

## 16. 사업·상점(구매) 1차 구현 범위 (신규)

2026-09-13: `businesses`/`products` + 두 번째 journal 종류 PURCHASE를 추가했다. 월급과 달리 **구매는 학생이 즉시 실행**한다(교사 정산 없음) — 가격·재고·잔액을 그 자리에서 Rules가 재검증하기 때문에 안전하다(D-23). 사업은 교사가 직접 만들며 시민 제안 승인 절차는 아직 연결되지 않았다(D-22, 6단계 대기). 수량은 1개 고정, 별도 `orders` 컬렉션 없이 journal + 계좌별 entries가 곧 구매 기록이다(D-24).

이 단계에서 실제 Rules 버그 두 가지를 에뮬레이터 테스트로 발견해 고쳤다 — 둘 다 다음 금융 기능(저축·대출)에서 재발할 수 있는 패턴이므로 `docs/DECISIONS.md` D-26을 반드시 참고: (1) 같은 트랜잭션에서 만드는 문서는 `exists()`가 아니라 `getAfter()`로 확인해야 한다, (2) 여러 계좌를 넘나드는 트랜잭션의 당사자는 상대 계좌를 최소한 읽을 수 있어야 정확한 증가분을 계산해 쓸 수 있다.
