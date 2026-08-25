# Landing Page Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 메인 포털이 실제 현장성과 최신 활동을 먼저 보여주고, 사용 가능한 서비스와 준비 중 프로젝트를 명확히 구분하도록 개선한다.

**Architecture:** 정적 HTML의 핵심 탐색 경로는 JavaScript 없이도 유지한다. 최신 활동만 기존 `ActivityDataStore`와 두 팀의 JSON을 사용해 클라이언트에서 렌더링하며, 실패 시 전체 기록 링크가 포함된 대체 상태를 표시한다.

**Tech Stack:** HTML5, CSS, 바닐라 JavaScript, 기존 Node.js 정적 검증 스크립트

---

### Task 1: 정보 구조 회귀 검증

**Files:**
- Modify: `scripts/check-site.mjs`

1. `index.html`에 현장 사진, 최신 활동 영역, 사용 가능 서비스 영역, 개발 로드맵, 확장 푸터가 있어야 한다는 검증을 추가한다.
2. 비대화형 `Portal Directory`가 남아 있으면 실패하도록 검증한다.
3. `npm run check`를 실행해 새 검증이 기존 페이지에서 의도대로 실패하는지 확인한다.

### Task 2: 페이지 구조와 카피 개선

**Files:**
- Modify: `index.html`

1. 우측 디렉터리를 부안 내변산 현장 사진과 캡션으로 교체한다.
2. 두 팀이 같은 포털에 있는 이유가 드러나도록 히어로 제목과 설명, CTA를 다듬는다.
3. 팀 소개 뒤에 최신 활동 컨테이너와 전체 기록 링크를 추가한다.
4. 프로젝트를 검증된 사용 가능 서비스 한 개와 RFID 연결 점검을 포함한 세 항목의 개발 로드맵으로 분리한다.
5. 푸터에 팀·활동·서비스 링크를 추가하고 `activity-data.js`를 `main.js`보다 먼저 로드한다.

### Task 3: 최신 활동 렌더링

**Files:**
- Modify: `js/main.js`

1. 두 활동 JSON을 `Promise.allSettled`로 병렬 로드한다.
2. 유효하게 로드된 항목을 팀 정보와 결합해 날짜순으로 정렬하고 최신 세 건을 렌더링한다.
3. 일부 또는 전체 요청 실패 시 사용자에게 명확한 상태를 보여주되 전체 활동 기록 링크는 유지한다.
4. JavaScript 구문 검사를 실행한다.

### Task 4: 시각 스타일과 반응형 개선

**Files:**
- Modify: `css/style.css`

1. 현장 사진 중심 히어로, 활동 카드, 서비스/로드맵, 확장 푸터 스타일을 추가한다.
2. Stay-Up과 FireHawks 카드의 이미지 초점과 오버레이를 각각 조정한다.
3. 980px, 760px, 520px 구간에서 헤더 높이, 여백, 카드 열, 현장 사진 높이를 조정한다.
4. 키보드 포커스와 모션 감소 규칙을 보존한다.

### Task 5: 통합 검증과 시각 QA

**Files:**
- Verify: `index.html`, `css/style.css`, `js/main.js`, `scripts/check-site.mjs`

1. `npm run check`를 실행해 콘텐츠, 링크, JavaScript, HTML 검증을 통과시킨다.
2. `npm run build`를 실행해 배포 산출물 검증까지 통과시킨다.
3. 로컬 서버에서 데스크톱과 좁은 화면의 히어로, 팀, 최근 활동, 서비스, 푸터를 확인한다.
4. 브라우저 콘솔 오류와 가로 오버플로를 확인하고 발견된 문제를 수정한다.
