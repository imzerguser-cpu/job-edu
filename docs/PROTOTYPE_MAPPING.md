# 프로토타입 → 정식 구조 대응표

기준 파일: `sources/madong_citizen_role_based_full_prototype.html` (327줄 구조 코드 + 인라인 지도 이미지 1장, localStorage 기반 단일 파일 시안). 이 문서는 그 파일의 모든 화면·상태·상호작용을 실제 컴포넌트와 Firestore 엔티티로 옮기는 대응표다. 원문 요구사항은 `docs/requirements.txt`, 현재 구현 결정은 `docs/IMPLEMENTATION_PLAN.md`를 따른다. 충돌 시 요구사항 원문이 우선한다.

## 1. 무엇을 유지하고 무엇을 버리는가

**유지한다 (정식 앱의 화면 정체성):**
- 학생 홈은 대시보드가 아니라 **지도**다. 건물을 눌러 이동한다.
- 지도 위 HUD(시민증 카드) — 이름/학년반/현재 직업/오늘 업무 진행률을 상시 노출.
- 같은 건물이라도 **직업(권한)에 따라 다른 화면**을 보여주는 원칙 — `visitorNotice(owner, ...)` 패턴.
- 파스텔·둥근 카드·큰 터치 영역의 톤 (`--green/--blue/--orange/--purple` 팔레트, `.card/.menuGrid/.menuBtn`).
- 부서(국) 단위로 건물을 묶는 지도 구성 (경제/미디어/생활/문화 4국 + 학교=마이페이지).

**버리거나 정식 버전에서 제거한다:**
- `#roleSelect` 시안 테스트 드롭다운과 `setRole()` — 학생이 자기 직업을 임의로 바꾸는 기능은 정식 앱에 없다 (원문 §11). 실제 역할은 `JobAssignment` 조회 결과로 결정된다. 교사용 "역할 미리보기"로만 축소 유지할 수 있다.
- `localStorage` 상태(`madongState`) 전체 — Firestore로 이전한다. 공유 태블릿에서 localStorage에 학생 데이터를 남기지 않는다는 원문 §7 원칙(그리고 `docs/IMPLEMENTATION_PLAN.md` §4의 "메모리 기반 로그인 지속성" 결정)과 정면으로 배치되므로 반드시 제거.
- `formModal`/`toast`로 끝나는 가짜 제출(`저장 완료` 문자열만 찍고 끝) — 전부 실제 서비스 계층 호출로 교체.
- 은행 화면의 "대출 즉시 승인"(`approveLoan`), 상점의 "즉시 결제"(`buy`) 같은 **학생 클라이언트가 잔액을 직접 증감시키는 로직** — 금융 무결성 원칙(원문 §19-23, IMPLEMENTATION_PLAN §6)에 정면으로 위배. 반드시 요청→검토→교사 정산 흐름으로 교체.
- 하나의 거대한 단일 HTML 파일 구조 — React 컴포넌트 트리로 분리 (원문 §55).

## 2. 지도 화면 대응

| 프로토타입 요소 | 정식 컴포넌트 | 비고 |
|---|---|---|
| `#map` 섹션 전체, `.mapImg`/`.mapShade` | `CitizenMap` (src/features/map) | 배경은 이미 확보된 실제 자산 사용: `public/assets/backgrounds/school_front_background.png` 등. 인라인 base64가 아니라 정적 파일로 로드. |
| `.hotspot.hs-*` 10개 버튼 + `go(id)` | `BuildingHotspot` 컴포넌트 배열 + React Router 경로 이동 | 좌표(`left/top/width/height` %)는 그대로 재사용 가능한 값이므로 CSS 변수/설정 객체로 이전. |
| `.hud` 시민증 카드 | `CitizenHud` (src/features/school) | 표시 데이터는 `Student` + 현재 활성 `JobAssignment` 목록. 원문 §6의 "불필요한 개인정보 비공개" 원칙에 따라 이름 외 개인정보 추가 노출 금지. |
| `.topbar` (brand/jobChip/balanceChip) | `TopBar` | `balanceChip`(잔액)은 4단계(금융) 구현 전까지 "준비 중" 상태로 비활성 표시. 실제 값은 `accounts/{accountId}.balanceMinor` 투영. |
| `roleTest`/`roleSelect` | (제거) 교사 전용 "역할 미리보기" 토글로 축소 이전 | §1 참조. |

건물-국 대응(그대로 유지):

| hotspot id | 프로토타입 라벨 | 국(Department) | 실제 배경 자산 후보 |
|---|---|---|---|
| hs-bank | 경제 관리국 · 은행 | economy | bank_background.png |
| hs-store | 경제 관리국 · 상점 | economy | store_background.png / cafe_background.png |
| hs-broadcast | 미디어 디지털국 · 방송부 | media | media_room_background.png |
| hs-art | 미디어 디지털국 · 예술부 | media | classroom_background.png(임시) |
| hs-library | 생활국 · 도서부 | life | library_background.png |
| hs-post | 생활국 · 우체부 | life | school_front_background.png(임시) |
| hs-env | 생활국 · 환경부 | life | school_garden_background.png |
| hs-event | 행사 문화국 · 행사 | culture | gym_background.png / auditorium_background.png |
| hs-culture | 행사 문화국 · 문화 | culture | classroom_background.png(임시) |
| hs-school | 마이페이지 | — | civic_square_background.png |

'임시' 표시는 전용 배경 자산이 아직 없어 기존 자산으로 대체함을 뜻한다. 확정 전 교사/디자인 담당 확인 필요.

## 3. 역할별 분기 로직 대응

프로토타입의 `ROLES` 객체(28개 항목, `journalist/banker/store_manager/...`)는 **직업 정의(JobRole) + 화면 분기 규칙**이 하나로 뭉쳐 있다. 정식 구조에서는 이를 분리한다.

```
ROLES[key].name/icon/dept   → Job.name / Job.icon / Department (이미 firebase/firestore.rules의 jobShape().icon enum과 대부분 일치)
ROLES[key].perms            → capability 목록 (§47) — UI 조건 분기 + 서버 규칙 조건 양쪽에 사용
ROLES[key].tasks            → TaskTemplate → 학생별 Task 인스턴스 (3단계 구현 전까지는 화면에 노출하지 않음)
ROLES[key].home             → BuildingId (지도 라우팅 대상) — Job 문서에 buildingId 필드로 승격 고려
state.role (선택된 하나의 역할) → 실제로는 "해당 건물에서 활성 JobAssignment가 있는가"의 배열 판정으로 대체.
                                 학생이 여러 직업을 동시에 가질 수 있으므로(원문 §2) 단일 role 변수로는 표현 불가.
```

`src/domain/jobs.ts`의 `jobIcons` 배열은 이미 프로토타입 `ROLES` 키와 거의 1:1로 대응한다(`banker, tax_accounting, store_manager, cafe_worker, journalist, photographer, writer, webtoon_artist, painter, library_manager, environment_manager, plant_manager, safety_manager, rules_manager, milk_delivery, parcel_delivery, event_planner, music, singer, dancer, board_game` 등). 다만 프로토타입에는 있으나 현재 아이콘 enum에 없는 것: `radio_dj`(→ 기존 `dj`), `noticeboard_manager`(게시판관리, 존재), `real_estate`/`digital_manager`(원문에는 있으나 프로토타입 미사용). 새 아이콘 추가 시 `firebase/firestore.rules`의 `jobShape().icon` enum도 함께 갱신해야 한다(서버 검증 누락 방지).

## 4. 건물별 화면 대응 (일반 시민 뷰 vs 담당자 뷰)

각 건물은 `renderX()` 함수 안에서 `owner ? 담당자뷰 : 방문자뷰`로 분기한다. 정식 구조는 **동일 라우트, capability 기반 조건부 렌더**로 옮긴다.

| 프로토타입 함수 | 담당 직업(들) | 방문자 화면 | 담당자 화면 | 실제 엔티티 | 구현 단계 |
|---|---|---|---|---|---|
| `renderStore` | store_manager, cafe_manager | 상품 보기/구매/내 주문 | 재고/가격/주문처리/매출 | Business, Product, Order | 8단계(사업) |
| `renderBank` (은행원) | banker | 내 계좌/저축/대출신청/거래내역 | 대출심사, 거래·이자·월급 검증 | Account, financialRequests, financeReviews | 4~5단계(금융) |
| `renderBank` (세무·회계) | tax_accounting | 위와 동일 | 세금 장부, 공동기금, 경제통계, 정정거래 | financialPolicies, assessments, journals(ADJUSTMENT) | 5단계(경제) |
| `renderBank` (사업관리) | business_manager | 위와 동일 | 사업 현황, 사업제안서 검토, 사업계좌 | Business, proposals(BUSINESS) | 8단계 |
| `renderBroadcast` | journalist/writer/radio_dj | 기사/방송일정/학생 글 열람 | 인터뷰·기사작성·결과물 제출, 대본, 편성/선곡/사연 | Task(verificationKind=artifact), submissions | 7단계(증빙) |
| `renderArt` | photographer/webtoon_artist/painter | 작품 감상 | 촬영미션, 작품 제출, 승인현황 | Task(photo/artifact), submissions | 7단계 |
| `renderLibrary` | librarian | 도서 검색/내 대여현황 | 대출/반납 처리, 연체확인 | Task(system, 도서 이벤트 연동) | 3단계 이후, systemEvents 연동은 8단계 |
| `renderPost` | mail/parcel/milk | 내 우편함 | 배달 목록, 배달완료 인증 | Task(photo/system) | 3단계 |
| `renderEnvironment` | environment/plant/safety/rules/board | 생활 안내 | 점검 시작, 사진 인증, 이전 기록 | Task(photo), evidence | 3, 7단계 |
| `renderEvent` | event_planner/event_proposal/music/singer/dancer | 행사 일정 열람 + 시민 제안 | 행사기획/제안서/연습기록 | proposals(EVENT), Task(artifact) | 6, 3단계 |
| `renderCulture` | boardgame | 대여 신청 | 대여/반납/재고·파손상태 | Task(system, 대여 이벤트) | 8단계 |
| `renderMyPage` | 전 직업 공통 | 시민증/현재 권한/오늘 업무/직업 전용 메뉴 | 좌동 | Student + 활성 JobAssignment 배열 + Task 목록 | 1~3단계 (부분 구현됨, §5 참조) |

## 5. 상호작용별 실제 백엔드 대응 (가짜 → 진짜)

| 프로토타입 동작 | 표면 효과 | 실제로 필요한 흐름 |
|---|---|---|
| `buy(k, price)` | `state.balance -= price` 즉시 반영, toast | 학생이 `financialRequests`(operation=PURCHASE) 생성 → 서버 규칙이 재고/가격 재검증 → 교사/시스템이 journal 기록 → 학생 계좌 entries에 반영 (원문 §33, IMPLEMENTATION_PLAN §6) |
| `approveLoan(i)` | 목록 항목 상태만 로컬 변경 | `loans/{contractId}` 신청 → 은행원 `financeReviews` 체크리스트 → 교사 세션에서 실행 → journal(LOAN) 기록 (§20-22) |
| `completeOrder(i)` | 상태 문자열만 변경 | `Order.status` 전이 + 사업 계좌 SALE journal |
| `completeTask(i)` | `tasksDone` 플래그만 저장 | Task 상태 전이 assigned→submitted→approved→rewarded, TaskExecution/Verification 경유 (원문 §13-14) — "완료 버튼만 눌러 보상"은 명시적으로 금지된 패턴이므로 절대 그대로 옮기지 않는다 |
| `formModal(...)`의 모든 "저장하기" | toast만 띄우고 끝 | 각 건물의 실제 제출 폼은 `submissions`/`proposals`/`financialRequests` 중 하나로 귀결되어야 함 |

## 6. 남은 작업

- 지도 좌표·건물 배경 확정은 실제 학교 사진/디자인 자산과 함께 교사 확인 필요 (임시 배정 다수, §2 표 참조).
- `state.tasks`처럼 역할에 하드코딩된 업무 문구는 전부 `taskTemplates`로 옮겨야 하며, 학교마다 다른 업무를 설정할 수 있어야 한다(원문 §2, §41 — 학년별 권장 역할은 강제 규칙이 아닌 기본값).
- 프로토타입은 한 학생이 한 role만 갖는다고 가정하지만 실제로는 복수 직업(N:M)이 가능하므로, `renderMyPage`의 "직업 전용 메뉴" 3버튼 레이아웃은 **직업 개수만큼 반복되는 리스트**로 재설계해야 한다.
