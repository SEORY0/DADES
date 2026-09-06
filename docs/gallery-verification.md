# 발행 갤러리 최종 검증

2026-09-07. 사용자 최종 지시인 '생성 이미지 없이 실제 내용의 이미지 사용'을 적용한 빌드 기준. 작업 브랜치 `improve/ai-security-magazine`, 기준 main `dc4e013fb635f2ac4efe60ab10d41d7142091ff7`.

## 구현 결과

- 총 6개 호, 20개 기사. 기존 1호 본문은 유지하고 공식 자료 15편을 엮은 예시 5개 호를 추가했다.
- 실제 원문 이미지 6개가 홈 카드에 표시된다. 제목·링크·검색 UI는 HTML이며 이미지로 합성하지 않았다. 생성한 커버는 저장소에서 제거했다.
- 3열/2열/1열 그리드. 도표는 원본 프레임과 라벨을 보존한다. 출처 크레딧과 원문 링크는 각 상세 페이지에 표시한다.
- 주제/검색 결합, 빈 결과/초기화, URL 상태 보존, 상세 목록 복귀, 브라우저 뒤로/앞으로, 키보드 Enter, 스크랩북 저장, 모바일 메뉴, JS 없는 목록을 검증했다.
- 자동 발행은 실제 기사 HTML의 OG/Twitter 이미지 메타데이터를 추출한다. 이미지가 없거나 로딩에 실패하면 제목만 남긴다. 무관한 사진이나 생성 이미지로 대체하지 않는다.

## 실행 증거

- `npm run build`: 성공, 53개 정적 페이지와 14개 Pagefind 문서.
- `npm test`: 편집 파이프라인 11개 + 원문 이미지 10개 = 21개 통과.
- `DADES_TEST_ORIGIN=http://localhost:4173 npm run test:site`: 6개 통과.
- TypeScript `tsc --noEmit`, 변경 CSS 파싱, `git diff --check`: 통과.
- `artifacts/qa/gallery-browser.cjs`: 375/768/1280px에서 전체 53개 경로, 164개 캡처, 667개 검사, 런타임 오류 0개.
- 실제 OpenAI 공개 문서로 원문 이미지 추출 실행: 실제 HTTPS OG URL과 출처 반환. AI 모델/API key 또는 발행은 호출하지 않았다.
- Lighthouse 접근성: 홈/6호 × 모바일/데스크톱, 4개 프로필 모두 100. 자동 접근성 점수는 전체 사용성의 보증을 뜻하지 않는다.

브라우저 산출물: `/tmp/dades-source-gallery-qa/final/report.json`, 같은 폴더의 캡처·`overviews.json`.
접근성: `/tmp/dades-source-gallery-qa/accessibility/a11y-final.json`.

## nav 보존

`SiteHeader.astro` SHA256 `8ac91a6704d090837497ac4159eaedcdf1581f42ac1587e747e27685d78aa044`.
`glass-interactions.css` SHA256 `66e9189b7d8c23e50d57f81b1a8d456a351838c9cb4fe467464e96b07ff0d9db`.

1280px 실측: x308.296875, y30, 폭663.40625, 높이46.203125, 반경30px, blur9px. 기존 geometry와 동일하며 최신 호 표시만 №06으로 갱신된다. 긴 모바일 전체 캡처 중간의 독은 기존 화면 하단 고정 동작이다.

LSP 서버는 설치되지 않았고 기존 설치 거절 상태를 유지했다. 대체 검증은 빌드·TypeScript·Node 테스트·실제 Chrome으로 수행했다. 실제 정기 발행과 이메일 발송에는 문서에 적힌 외부 서비스 설정이 필요하다.

## 독립 최종 검토

- `source_gallery_integrity`: PASS. 구현·원문 출처·이미지 추출·URL 상태 보존·nav 해시를 확인하고, 21개 편집 테스트·6개 사이트 테스트·TypeScript·구문 검사를 별도로 통과했다.
- `source_gallery_visual`: PASS. 참고 이미지와 최종 데스크톱·태블릿·모바일 홈, 6개 상세 지면, 원문 출처 기록을 확인했다. 한글 조판과 도표 전체 프레임이 보존됐다.
- 검토 대상은 위 기준 main에 적용된 최종 소스 이미지 작업 트리다. 이 문서는 PR 승인 기록이 아니다.
