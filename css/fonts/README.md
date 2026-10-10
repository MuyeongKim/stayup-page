# Pretendard 웹폰트

- 원본: [orioncactus/pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard/dist/web/variable)
- 구성: 공식 가변 다이나믹 서브셋 CSS와 WOFF2 파일. 글꼴 바이너리는 수정하지 않았으며 CSS의 URL만 같은 디렉터리의 상대 경로로 바꿨습니다.
- 라이선스: [SIL Open Font License 1.1](OFL-Pretendard.txt), 원본 저작권·라이선스 동봉.
- `unicode-range`에 따라 페이지에 필요한 글자가 들어 있는 파일만 요청합니다. `font-display: swap`으로 다운로드 중에도 시스템 글꼴을 표시합니다.
- `css/` 전체가 배포에 복사되므로 별도의 CDN·설치 단계는 없습니다. `scripts/check-dist.mjs`가 공개 화면의 CSS 연결, 참조 파일, WOFF2 헤더, 라이선스 동봉을 확인합니다.

업데이트할 때는 공식 버전의 CSS와 모든 참조 파일을 함께 교체하고 라이선스를 보존한 뒤, 빌드와 글꼴 로딩 실패 상태를 검증합니다. 페이지의 글꼴 CSS 버전 쿼리도 함께 갱신합니다.
