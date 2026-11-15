# 판순이 생성형 AI: 기존 Cloudflare Pages 사이트 연결

## 적용된 구성

- 기존 사이트: **https://donghyun-3d.pages.dev/**
- 프로젝트: **donghyun-3d** (GitHub: `sk01040667698-bit/younghwa-flashing-3d`)
- 자동 배포: GitHub `main` 브랜치로부터 기존 Cloudflare Pages 프로젝트를 업데이트
- 사이트 내 AI 경로: `/api/chat` (Cloudflare Pages Functions: `functions/api/chat.js`)
- AI 호출: Cloudflare Workers AI의 `AI` 바인딩 → `@cf/google/gemma-4-26b-a4b-it`
- AI 대화가 불가능하면 기존 사이트 검색형 답변으로 자동 전환
- **다른 사이트와 회사 기밀문서는 AI 검색 대상에 포함하지 않음**

## 꼭 필요한 설정: Cloudflare 대시보드에서 AI 바인딩

소유자 계정에서 한 번만 설정하면 됩니다.

1. Cloudflare Dashboard → **Workers & Pages** → **donghyun-3d**
2. **Settings → Bindings → Add** (UI에 따라 Production 환경을 먼저 선택)
3. **Workers AI** 선택
4. **Variable name: `AI`** (대문자 그대로)
5. **Save** 후 **Deployments → 최신 Production 배포를 다시 배포(Retry deployment)**. 또는 GitHub에서 변경사항이 포함된 새 커밋 배포를 기다립니다.
6. **https://donghyun-3d.pages.dev/api/chat** 접속 시 `{"ok":true,"mode":"generative",...}`가 나오면 바인딩이 준비된 것입니다.
7. 사이트에서 판순이를 클릭해 제품 질문을 보내면 사이트의 `/api/chat`으로 전송되고, 생성형 AI가 답합니다.

**바인딩이 아직 없으면** 상태 확인에 HTTP 503과 `"mode":"faq"`가 나와야 정상이며, 기존 검색형 답변이 표시됩니다.

## 중요

- 무료 Cloudflare 사용 한도 내에서 사용. **유료 요금제로 변경하지 마세요.** 모델 비용은 Cloudflare Workers AI 정책에 따릅니다.
- 직원 약 10명의 실제 일일 질문량이 무료 한도에 들어갈지는 사용량 확인이 필요합니다.
- 사이트가 공개되어 있으므로 질문이 외부 Cloudflare AI에 전송됩니다. **기밀·개인정보 입력 금지**. 외부에서 접근 가능한 Pages Functions Origin 체크는 직원 인증이 아닙니다.
- 등록 지식은 **이 3D 작업실 제품·규격·조작법만** 포함합니다. 실제 사이트 콘텐츠를 실시간으로 전부 읽는 검색 엔진은 아닙니다.
- 별도의 `ai-worker/` 파일과 `wrangler.jsonc`는 과거 독립 Worker 방식의 참고 구현입니다. **현재는 독립 Worker를 배포할 필요가 없습니다.** 기존 Cloudflare Pages 프로젝트의 Workers AI 바인딩을 연결하세요.
- 필요할 때만 공개 가능 자료를 검수·승인하고 서버의 지식 목록에 추가할 수 있습니다.

공식 설정 안내: https://developers.cloudflare.com/pages/functions/bindings/#workers-ai
