# AI 상태판 검증

2026-09-07, Chrome 실제 렌더링과 로컬 정적 빌드 기준. 공개 운영 배포 검증과 구분한다.

## 구현과 데이터

- 성능·출력 단가·속도·주간 사용량을 별도로 정렬한다. 검색/개발사/지표는 URL에 보존한다.
- 최대 3개 비교, 입력·출력 토큰 수를 바꾼 비용 계산, 더 보기, 키보드 조작, 실패 시 이전 스냅샷 보존을 확인했다.
- 스냅샷은 모델 430개, AA 지수 56개, 공개 주간 합계 20개다. 속도 관측값과 근거 없는 과거 시계열은 없다. 결측을 0으로 변환하지 않는다.
- 60초 자동 확인은 편집/차트 포커스를 빼앗지 않는다. 직접 새로 확인하면 새 값·모델명·아이콘·출처를 함께 적용한다.

## 테마·이미지

- Paper 제거를 먼저 완료했다. White·Ink 두 선택, 저장된 Paper→White 이전(어두운 OS 포함), 저장 불가 시에도 현재 지면 적용, 새로고침 후 유지가 통과했다.
- 375/768/1280px, 두 테마에서 모든 유리판의 fill·반경·blur·border·shadow가 해당 nav 또는 모바일 독과 정확히 같다.
- 7개 실제 아이콘이 로드되며, 갱신된 모델 ID에 맞춰 바뀐다. 미지원 모델·관측값 없음·Gemma에는 잘못된 이미지가 남지 않는다. Ink에서 검정 OpenAI 아이콘은 밝은 판 위에 표시한다.
- 공개 원본과 로컬 아이콘 바이트가 일치한다. 이미지와 유리판은 별도 DOM이며 9px backdrop blur가 실제 배경 이미지에 작용한다.
- 사용량이 사라진 새 스냅샷의 안내, 데이터 복구 후 차트 재표시, Ink 인쇄의 흰 배경/짙은 글자를 확인했다.

## 검증 명령과 산출물

- `npm run build`: Astro 53개 경로와 Pagefind 빌드 성공.
- `npm test`: 44개 통과. `DADES_TEST_ORIGIN=http://localhost:4173 npm run test:site`: 17개 통과.
- `tsc --noEmit`, 변경된 TypeScript 모듈의 strict 검사, `git diff --check` 통과. LSP는 기존 미설치/설치 거절 상태여서 사용하지 않았다.
- 재현 스크립트: `artifacts/qa/status-browser.cjs`. `DADES_PLAYWRIGHT_PATH`에 설치된 Playwright 경로를 지정하고 `DADES_QA_OUTPUT`으로 저장 위치를 지정한다.
- 최종 브라우저 보고서: `/tmp/dades-status-qa/themes-final/report.json`. 511개 검사, 74개 최신 캡처, 실패·브라우저 오류 0개. 대표 화면: 같은 폴더의 `status-1280.png`, `status-ink-375.png`, `leader-art-OpenAI.png`.
- 독립된 기능/디자인 시스템 검토와 시각/CJK 검토 모두 최종 보고서 및 수정된 캡처 재확인 후 PASS. 직접 Chrome에서도 두 테마 선택, 단가 바로가기, 모델 검색, 비교, 토큰 수 변경, 새로 확인을 실행했다.
- Lighthouse 보고서: `/tmp/dades-status-qa/themes-a11y/report.json`. White 모바일/데스크톱과 Ink 모바일은 100, Ink 데스크톱은 97이다. 유일한 경고는 기존 nav 선택 라벨의 blur 합성 대비 계산이다. 실제 캡처의 선택 판 RGB(67,70,74)와 글자 대비는 약 8.6:1 이상이며 nav 소스는 수정하지 않았다. 이 한 장의 확인을 모든 nav 상태의 적합성 보증으로 확장하지 않는다.

## nav 보존

- `src/components/SiteHeader.astro`: SHA256 `8ac91a6704d090837497ac4159eaedcdf1581f42ac1587e747e27685d78aa044`
- `src/styles/glass-interactions.css`: SHA256 `66e9189b7d8c23e50d57f81b1a8d456a351838c9cb4fe467464e96b07ff0d9db`

## 운영 범위

원격 main의 기존 매거진 변경 병합을 fast-forward로 반영했다. 이번 코드의 작업 브랜치 push는 운영 배포나 예약 갱신 활성화가 아니다. `model-board.yml`이 main에 반영되고 Actions/Pages가 실행되어야 30분 수집이 배포된다. 데이터 출처·실패 복구는 `docs/status-data.md`, 이미지 출처는 `docs/status-images.md`에 기록했다.
