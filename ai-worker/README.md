# 판순이 무료 생성형 AI 서버 설치 방법

> **현재 상태:** 프런트엔드 코드와 Cloudflare Workers AI 소스 준비 완료. **Cloudflare 계정 배포는 별도로 필요**합니다. 배포 전에는 기존 사이트 검색형 챗봇만 작동합니다.

## 쉬운 설치 (Windows)

1. [GitHub 저장소](https://github.com/sk01040667698-bit/younghwa-flashing-3d)에서 **Code → Download ZIP**으로 압축파일을 받고 압축을 풉니다.
2. Windows에 **Node.js LTS**가 없으면 https://nodejs.org/ 에서 설치합니다.
3. 압축 해제한 폴더에서 **ai-worker/배포하기.bat**를 더블클릭합니다.
4. 브라우저가 열리면 본인의 **Cloudflare Free 계정**으로 로그인하여 권한을 승인합니다. 회사가 승인한 계정만 사용하세요.
5. 설치 창에 출력된 `https://...workers.dev` 주소를 확인합니다. 이 주소는 **공개 URL**입니다. 비밀번호/API 토큰을 복사하거나 공유하지 마세요.
6. 사이트의 생성형 AI 연결을 완료하려면 저장소 루트의 `pansooni-ai-config.js`에 나온 빈 문자열을 **해당 공개 URL**로 바꾸고 커밋합니다. (예: `window.PANSOONI_AI_ENDPOINT = "https://actual-worker-name.account.workers.dev";` — 예시 URL 그대로 사용 금지)
7. 기존 [3D 작업실](https://sk01040667698-bit.github.io/younghwa-flashing-3d/)에서 판순이를 짧게 클릭하여 테스트합니다.

명령어 방식: `cd ai-worker && npx wrangler login && npx wrangler deploy`

## 무료 한도와 보안

- Workers AI Free는 **하루 10,000 Neurons**의 무료 한도가 있습니다(2026-11-15 기준). 무료 요금제를 유지하면 초과 요청은 실패하며 자동으로 무제한 청구되는 것은 아닙니다. 근거: https://developers.cloudflare.com/workers-ai/platform/pricing/
- 이 서비스는 직원별 로그인 권한을 확인하는 서버가 **아닙니다**. **공개된 3D 작업실의 일반 제품정보만** 근거로 답변해야 하며, 핵심 기밀·품질자료·가격·직원 정보·민감한 질문을 입력하면 안 됩니다.
- 사용자 질문이 **Cloudflare Workers AI로 전송**됩니다. 회사 내부에만 남는 로컬 AI가 아닙니다.
- Origin 검사와 요청 빈도 제한은 사용량 방어용이며, 직원 인증을 대신하지 못합니다.
- Worker 코드에는 AI API 토큰이 없습니다. Workers AI 바인딩을 통해 호출하며, Cloudflare 계정/비밀번호를 GitHub에 업로드하지 않습니다.
- AI를 사용할 수 없으면 검색형 챗봇으로 자동 대체합니다.
- 무료 한도는 직원 10명이 얼마든지 질문할 수 있다는 보장은 아닙니다. Cloudflare 대시보드에서 사용량을 모니터링하세요.
- **생성형 AI 완전 연결은 5~6단계가 끝나야 합니다.** 이 문서와 파일만 만들었다고 서버가 배포된 것은 아닙니다.

## 구성

- `src/index.js` — 공개 제품 지식만 전달하는 생성형 AI Worker
- `wrangler.jsonc` — AI 바인딩, 요청 제한, 허용 사이트
- `../pansooni-ai-config.js` — 서비스 주소 설정(비밀 정보 저장 금지)

**AI 모델:** `@cf/google/gemma-4-26b-a4b-it` (무료 이용 가능 범위 내). https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
