# 아이콘 중심 디자인 수정 — 2026-09-16

최신 `Downloads/jobedu`의 미커밋 기능 변경까지 포함한 소스를 기준으로 작업했다. 데이터 저장, 인증, 금융 계산, Firestore 규칙은 변경하지 않았다.

- 은행·저축·대출: 새 투명 PNG 아이콘 3종 (`public/assets/icons/*-v2.png`).
- 상점·방송·예술·도서·우편·환경·행사·문화·시민증: 새 3×3 투명 아이콘 시트 (`destinations-v2.png`). CSS sprite로 개별 표시하며 원본은 보존한다.
- 지도 아래 10개 공간 바로가기, 공간 제목 아이콘, 시민 정보 아이콘을 연결했다.
- 은행·상점의 기능 제목에 아이콘을 연결했다. 신규 3종 이외의 금융 세부 아이콘은 기존 제공 파일을 재사용한다.
- 초록·크림 계열 버튼 및 카드, 키보드 초점, 모바일 2열 메뉴를 적용했다.
- 기존 가상 직업 체험에서 지도와 공간 아이콘도 확인할 수 있다. 은행 거래를 흉내 내거나 실데이터에 쓰지 않는다.
- 큰 환영 일러스트는 사용자 정정에 따라 앱에서 제외했다.

## 검증

TypeScript 검사 및 Vite 프로덕션 빌드 통과. 브라우저에서 로그인 화면, 데스크톱/390px 모바일 지도, 아이콘 로딩, 은행 진입을 확인했다. 실사용자 금융 거래나 로그인 후 모든 업무 기능의 재검증은 수행하지 않았다. 운영 배포는 수행하지 않았다.

## 생성 프롬프트 기록

공통: `Use case: stylized-concept. Korean elementary school society app. Cheerful children's game inventory art, thick clean outlines, soft dimensional highlights, rounded forms, centered composition, transparent background. Highly legible at 48px. No words, letters, labels, scenery, UI or watermark.`

- 은행: `Single isolated BANK BUILDING icon. Compact front facing blue-roofed cream bank with three chunky columns, central rounded door, tiny gold coin medallion on pediment and two small green shrubs. Dark blue outlines, generous transparent padding.`
- 저축: `Single isolated SAVINGS icon. Cute round pink piggy bank with one golden coin entering the slot, tiny clover motif on the coin. Dark rose outlines, large simple silhouette.`
- 대출: `Single isolated LOAN APPLICATION icon. Cream paper contract on a blue clipboard, two small golden coins and a short blue pencil. Only abstract lines on the paper, navy outlines.`
- 공간 시트: `Production UI ICON SPRITE SHEET, square, precisely aligned 3 columns by 3 rows of equal cells, transparent background, NO grid lines. Exact order: shopfront; headphones with microphone; artist palette and brush; colorful standing books; parcel and envelope; recycling arrows and leaf; calendar with star and pennant; dice and pawn; mint citizen ID card. Each centered within its cell, occupies 65 percent, even transparent padding. Nothing may cross cell boundaries.`
