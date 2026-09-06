# DADES 변경 검증 — 2026-09-07

> 1차 개선 당시의 기록입니다. 이후 홈은 원문 이미지 갤러리로 변경됐습니다. 최종 상태와 검증은 [갤러리 검증](gallery-verification.md)을 참조하세요.

기준 커밋: `dc4e013fb635f2ac4efe60ab10d41d7142091ff7` (origin/main).
작업 브랜치: `improve/ai-security-magazine`. 이 기록은 해당 기준 위의 로컬 작업 트리 변경을 검증한다. 커밋·push·원격 workflow 실행은 수행하지 않았다.

## 결과

| 항목 | 결과 |
| --- | --- |
| Astro/콘텐츠 스키마/클라이언트 빌드 | 성공, 29개 HTML 경로 생성 |
| Pagefind 검색 인덱스 | 성공, 9개 읽기 페이지 색인 |
| TypeScript `tsc --noEmit` | 성공 (기존 캐시의 TypeScript 실행 파일 사용) |
| JS 구문 검사 | 편집 모듈 5개 및 브라우저 QA 실행 파일 모두 통과 |
| 편집 회귀 테스트 | 11/11 통과 |
| 기존 사이트 계약 테스트 | 6/6 통과 |
| 실제 Chrome | 29개 경로 × 375/768/1280px, 상태 포함 93개 캡처, 370개 검사 통과 |
| 브라우저 콘솔/런타임 오류 | 0 |
| 한글 조판/시각 검토 | 독립 검토 2개 PASS |
| 내비 데스크톱 이미지 비교 | 680×66 영역, 44,880픽셀 중 차이 0 |
| 내비 소스 불변 | SiteHeader.astro, glass-interactions.css 변경 없음 |
| 실제 피드 수집 | 허용된 10개 피드 진단, 5개 origin에서 18개 후보 |
| API 키 없음 | exit 1, 후보·실패 원인 기록, 새 호 생성 없음 |
| 최종 접근성 검사 | 홈/구독/제휴 × 모바일/데스크톱 6개 모두 100, 실패 audit 없음 |

기존 `issue-001.json`과 발행 기사·URL·스크랩 저장 형태는 보존했다. 새 호가 생겨도 홈페이지 계약 테스트가 최신호 데이터에 따라 검증하도록 고정 기사 개수를 제거했다.

## 직접 실행한 동작

주제 필터 → 기사 수 확인 → AI 보안 빈 상태 → 전체 복원과 키보드 포커스, RSS 주소 복사와 실제 클립보드 확인, 제휴 이메일 링크, 기사 저장 후 스크랩북 표시, MCP 검색 결과, 모바일 메뉴 열기/Escape/포커스 복귀, 먹색 테마 유지, 인쇄·JavaScript 없는 상태의 기사 노출을 확인했다.

모바일 하단 독은 기존처럼 화면 위에 떠 있으며 스크롤 중인 콘텐츠와 겹칠 수 있다. 동일한 동작이 변경 전 캡처에도 존재한다. 사용자가 요구한 내비 디자인 불변 조건으로 보존했으며, 영구적인 텍스트 잘림이나 접근 불가능한 컨트롤은 발견되지 않았다.

## 재현 명령

```bash
npm run build
npm test
DADES_TEST_ORIGIN=http://localhost:4173 npm run test:site
npm run editorial:dry-run
DADES_PLAYWRIGHT_PATH=/path/to/playwright node artifacts/qa/magazine-browser.cjs
```

브라우저 실행은 기존의 실제 Chrome과 Playwright를 사용했다. 새로운 프로젝트 의존성은 추가하지 않았다. QA는 `dist`가 제공되는 4173 포트에 연결한다.

LSP/Biome 서버는 설치되어 있지 않고 기존 설치 거절 설정이 있어 설치하지 않았다. 대신 TypeScript, Astro 컴파일, CSS 파서, Node 구문 검사, 실행 테스트를 사용했다. 별도의 LSP 통과를 주장하지 않는다.

## 측정 자료

로컬 원본 자료:

- `/tmp/dades-magazine-qa/final/report.json` 및 같은 폴더의 93개 PNG
- `/tmp/dades-magazine-qa/overview-{375,768,1280}.png`
- `/tmp/dades-magazine-qa/nav-diff.json`
- `/tmp/dades-magazine-qa/performance/summary.json`
- `/tmp/dades-magazine-qa/performance/a11y-final.json`
- `/tmp/dades-magazine-qa/final-build.log`
- `.editorial/final-verification/` (실제 수집)
- `.editorial/final-no-key/` (키 부재로 발행 차단, 수정된 한국 시간 수집 기간)

런타임 산출물은 Git에 추가하지 않았다. 위 임시 경로는 환경 정리 시 사라질 수 있으므로 QA 실행 파일과 명령을 보존한다.

## 성능과 실제 운영의 한계

실제 Playwright Chrome에서 프로그램 방식 Lighthouse를 3회씩 실행했다. 홈 성능 중앙값은 모바일 94, 데스크톱 99이며 접근성은 100이었다. 주된 비용은 외부 Pretendard CSS/폰트의 네트워크 의존성이다. 성능을 모든 항목 100으로 통과했다고 주장하지 않는다. 이후 접근성 이름을 고치고 6개 프로필의 접근성 검사를 다시 통과했다. 이름 변경 후 성능 3회 측정은 반복하지 않았다.

모델의 실제 유료 API 호출, 새 기사 실발행, 원격 push·Pages 배포, 이메일 전송·결제는 실행하지 않았다. API secret과 자동 발행 variable은 실제 저장소에서 별도로 설정해야 한다. `PUBLIC_NEWSLETTER_URL`이 비어 있으므로 현재는 RSS 구독이며, 문의는 제공받은 `dades.mag@gmail.com`으로 연결한다.

모델 출력의 링크/ID/출처/수량 검증은 사실성 전체의 증명이 아니다. 편집 입력은 피드 발췌문 최대 700자이며 원문 본문 전체를 읽지 않는다. 관련 제한과 복구 방법은 `editorial-operations.md`에 명시했다.

기존 패턴 자산의 상업적 사용 권한은 이번 작업에서 새로 확인하지 않았다. 자산 출처·기존 범위는 `DESIGN.md`의 provenance 항목을 따른다.

## 독립 검토 기록

| 검토 | 기준 | 판정 | 근거 |
| --- | --- | --- | --- |
| 자동 편집 정확성 | 기준 SHA + 현재 편집 파이프라인 작업 트리 | 수정 후 승인 | 아티팩트 보관, 비-AI 보안 제외 회귀, 배포만 복구하는 경로 |
| 시각 A: 구성/기능 | 기준 SHA + 최종 캡처 작업 트리 | PASS | 370개 검사, 진짜 DOM/토큰/실제 구독·제휴 링크, 내비 차이 0 |
| 시각 B: 한글/반응형 | 같은 최종 캡처 | PASS | 3개 폭 전체 경로 개요와 변경 지면 확인, 글자 잘림 없음 |
| 접근성 재검증 | 최종 빌드 | PASS | 6개 프로필 100, 이름 불일치 해결 |

이 기록은 특정 커밋의 PR 승인 기록이 아니며, 후속 변경이나 커밋 후 자동으로 재사용할 수 없다.
