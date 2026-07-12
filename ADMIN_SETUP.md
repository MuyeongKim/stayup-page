# 활동 관리 화면 최초 설정

관리 화면은 `https://www.stayup-ai.com/admin/`에서 열립니다. GitHub 쓰기 권한이 있는 계정으로 로그인한 뒤 Stay-Up과 FireHawks 활동을 추가·수정·숨김 처리할 수 있습니다.

사진은 브라우저 안에서 방향을 보정하고 최대 1600px, 품질 82%의 WebP로 다시 만든 뒤 업로드합니다. 원본 JPEG·PNG·WebP 파일과 EXIF/GPS 위치정보는 GitHub로 전송하지 않습니다. 변환된 사진과 활동 JSON은 항상 하나의 Git 커밋으로 함께 저장됩니다.

## 1. GitHub OAuth App 만들기

GitHub에서 **Settings → Developer settings → OAuth Apps → New OAuth App**으로 이동해 다음 값을 입력합니다.

- Application name: `Stay-Up 활동 관리`
- Homepage URL: `https://www.stayup-ai.com/admin/`
- Authorization callback URL: `https://www.stayup-ai.com/api/callback`

등록 후 표시되는 **Client ID**를 복사하고 **Client secret**을 새로 생성합니다. Client secret은 저장소 파일, 관리 화면 또는 `NEXT_PUBLIC_`처럼 브라우저에 노출되는 환경 변수에 넣지 않습니다.

## 2. Vercel 환경 변수 등록

Vercel의 `stayup-page` 프로젝트에서 **Settings → Environment Variables**로 이동해 아래 값을 등록합니다.

| 이름 | 값 |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App의 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App의 Client secret |
| `GITHUB_OAUTH_CALLBACK_URL` | `https://www.stayup-ai.com/api/callback` |
| `OAUTH_STATE_SECRET` | `openssl rand -hex 32`로 생성한 임의 값 |
| `OAUTH_ALLOWED_ORIGINS` | `https://stayup-ai.com,https://www.stayup-ai.com,https://stayup-page.vercel.app` |
| `GITHUB_OAUTH_SCOPE` | `public_repo` |
| `GITHUB_OAUTH_REPOSITORY` | `MuyeongKim/stayup-page` |

운영 환경에는 반드시 등록하고 새 배포를 실행합니다. 동적으로 생성된 Vercel Preview 주소에서 관리 화면 로그인을 시험하려면 그 주소의 exact origin(경로 없는 `https://...vercel.app`)을 `OAUTH_ALLOWED_ORIGINS`에 쉼표로 추가하고 Preview 환경에도 같은 비밀값을 설정합니다. 보안을 위해 `*.vercel.app` 와일드카드는 사용하지 않습니다.

## 3. Vercel 보안 헤더

`/admin` 응답에는 다음 Content Security Policy가 필요합니다. 관리 화면은 자체 호스팅한 JavaScript와 CSS만 실행하며 GitHub API 이외의 외부 서버로 연결하지 않습니다.

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https://raw.githubusercontent.com; connect-src 'self' https://api.github.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; worker-src 'none'; upgrade-insecure-requests
```

함께 권장하는 헤더는 다음과 같습니다.

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin`
- `Cache-Control: no-store`
- `X-Robots-Tag: noindex, nofollow`

## 4. 접속 확인

1. `https://www.stayup-ai.com/admin/`을 엽니다.
2. `MuyeongKim/stayup-page` 저장소 쓰기 권한이 있는 GitHub 계정으로 로그인합니다.
3. Stay-Up 또는 FireHawks를 선택합니다.
4. 활동 내용과 대표 사진을 입력하고 저장합니다.
5. 성공 안내가 나오면 Vercel 배포가 끝날 때까지 기다린 뒤 소개 페이지를 확인합니다.

관리 화면의 GitHub 토큰은 `sessionStorage`에만 보관되어 탭을 닫으면 브라우저에서 삭제됩니다. 공용 기기에서는 반드시 로그아웃하고, 기기 노출이 의심되면 GitHub **Settings → Applications → Authorized OAuth Apps**에서도 이 OAuth App 권한을 철회합니다. 저장 직전에 `master` 브랜치가 다른 사용자에 의해 변경되었는지 다시 확인하고, 변경이 있으면 덮어쓰지 않고 새로고침을 요청합니다. 활동을 숨겨도 JSON 기록과 사진은 삭제되지 않으며 언제든 다시 공개할 수 있습니다. 현재 저장소는 공개 상태이므로 숨김은 사이트 표시만 제어할 뿐 보안상 비공개를 의미하지 않습니다. 민감한 초안이나 사진은 등록하지 않습니다.

현재 사진 미리보기는 공개 저장소의 `raw.githubusercontent.com` 주소를 사용합니다. 저장소를 비공개로 전환하려면 `GITHUB_OAUTH_SCOPE`과 관리 화면의 OAuth 요청 scope를 `repo`로 바꾸는 것뿐 아니라, 사진 미리보기도 인증된 GitHub Blob 응답을 브라우저 객체 URL로 표시하도록 함께 변경해야 합니다.
