# DADES 매거진

**AI의 흐름과 보안의 기준.** AI 기술과 AI 보안의 변화를 출처와 함께 읽는 독립 매거진.

Astro 정적 사이트이며, 주간호·주제별 색인·출처 기반 위키·상태판·브라우저 내 스크랩북을 제공합니다. 홈페이지는 사진과 제목만으로 발행 호를 둘러보는 갤러리입니다. 주제와 검색어로 찾고, 짧은 읽기 지면에서 원문을 확인하거나 스크랩할 수 있습니다. 구독과 제휴는 별도 지면과 푸터에서 연결합니다.

## 개발과 확인

```bash
npm ci
npm run dev                    # http://localhost:4321/DADES/
npm run build                  # 콘텐츠 스키마 검증 + 정적 빌드 + Pagefind
npm run preview -- --port 4173 # http://localhost:4173/DADES/
npm test                       # 네트워크 없이 편집 파이프라인 검증
DADES_TEST_ORIGIN=http://localhost:4173 npm run test:site
npm run test:editorial:smoke    # 실제 공개 피드 수집 확인 (네트워크 필요)
```

## 발행 갤러리

002–006호는 공식 자료 15편을 엮은 테마 예시 호입니다. 상세 지면의 소개에 예시임을 표시하며, `date`는 원자료 발표일이 아니라 이 매거진 호의 발행일입니다.

- 카드마다 선택적 `cover` 메타데이터(`image`, `alt`, `topic`, `sourceUrl`, `credit`, `fit`)를 지정할 수 있습니다. 자산은 `src/assets/source-covers/`에 보관합니다.
- `src/lib/covers.ts`가 커버를 연결하며, 자동 발행 루틴은 원문 최대 3개의 OG/Twitter 대표 이미지를 찾아 출처와 함께 기록합니다. 원문에 이미지가 없으면 제목만 표시하며, 임의의 그림이나 관련 없는 사진으로 대체하지 않습니다.
- Astro Image가 WebP/srcset을 생성합니다. 전체 발행은 JS 없이도 읽을 수 있고, JS가 있으면 주제와 검색어가 URL에 보존됩니다.
- [예시 자료 출처](docs/gallery-sources.md), [이미지 원문 출처](docs/gallery-images.md), [갤러리 검증](docs/gallery-verification.md).

## 자동 편집

`공식 피드 → 최근 AI 후보 → 중복·주제·출처 검사 → 한국어 초안 → 검증 → 주간호 JSON → 사이트·RSS`

사람의 링크 수집이나 `inbox.md` 입력을 기다리지 않습니다. 외부 피드의 지시문은 데이터로 취급하며, 편집 모델에는 도구 실행 권한을 주지 않습니다. 기존 자료 제보 페이지는 선택적 참고 기록으로 유지합니다.

```bash
npm run editorial:dry-run  # 키 없이 수집만 실행; 기존 기사 변경 없음
npm run editorial:draft    # ANTHROPIC_API_KEY 필요; 검증 초안을 .editorial/에 저장
npm run editorial:publish  # 검증된 새 호만 로컬 src/content/issues/에 작성
```

기본 제한은 최근 10일, 최대 후보 18개, 기사 3~8개, 출처 2곳 이상, 모델 호출 1회입니다. 출처의 RSS 발췌문을 사용하며 생성 문장 전체의 사실성을 자동으로 보증하는 시스템은 아닙니다. 검증 실패 시 발행하지 않고 진단 자료를 남깁니다.

GitHub workflow는 매주 금요일 **08:20 KST**에 실행됩니다. `ANTHROPIC_API_KEY` secret과 `EDITORIAL_AUTOPUBLISH=true` repository variable을 설정해야 자동 발행이 켜집니다. 설정 전 예약 작업은 수집만 합니다. GitHub Actions 스케줄은 지연될 수 있습니다.

[편집 운영·활성화·실패 복구](docs/editorial-operations.md)에서 모델 설정, 실행 산출물과 배포 복구 방법을 확인하세요. 이 문서와 코드의 존재가 해당 저장소의 예약 발행 활성화를 의미하지 않습니다.

## 구독과 수익화

- RSS: `/DADES/rss.xml`. 이메일 주소를 수집하지 않고 바로 사용할 수 있습니다.
- 이메일 구독: `.env.example`의 `PUBLIC_NEWSLETTER_URL`에 실제 호스팅 구독 페이지를 설정하면 연결됩니다. 이메일 발송 서비스는 별도입니다.
- 광고·제휴: `/DADES/partner/`, 기본 문의 주소 `dades.mag@gmail.com`.
- 문의 주소 변경: `PUBLIC_CONTACT_EMAIL`. 잘못된 이메일이나 HTTPS가 아닌 뉴스레터 주소는 빌드에서 거부합니다.

GitHub Pages에서 구독 링크를 사용하려면 `PUBLIC_NEWSLETTER_URL` repository variable도 설정하세요. 기존 배포 workflow가 빌드에 전달합니다. 개인 정보·수신 동의·해지·이메일 발송은 연결한 구독 서비스에서 관리합니다. 현재 결제·유료 접근 제어는 구현하지 않았습니다.

[수익·편집 리서치와 90일 검증 계획](docs/magazine-strategy.md)은 디자인컴퍼스의 공식 공개 자료, DADES의 차별화, 스폰서십과 실무 브리프 검증 순서를 구분해 설명합니다.

## 주요 파일

- `src/content/issues/`: 기존 및 새 발행 데이터. 기존 기사와 URL은 보존합니다.
- `scripts/editorial/`, `config/editorial.sources.json`: 수집·편집·검증·발행 파이프라인.
- `.github/workflows/editorial.yml`: 정기 실행, 검증, 커밋, 배포 호출, 진단 보관.
- `src/lib/publication.ts`: 실제 구독 링크·연락처 설정.
- `src/pages/subscribe.astro`, `src/pages/partner.astro`: 구독·제휴 지면.
- `DESIGN.md`: 지면 토큰, 반응형, 접근성, 자산 출처와 내비 불변 조건.
- `artifacts/qa/gallery-browser.cjs`: 실제 Chrome으로 전체 경로·3개 화면 폭·갤러리/읽기/스크랩 상호작용 검증. 외부 Playwright 경로는 `DADES_PLAYWRIGHT_PATH`, 산출물 위치는 `DADES_QA_OUTPUT`으로 설정합니다.

## 배포

`main`에 push하면 기존 GitHub Pages workflow가 빌드·배포합니다. 자동 편집 bot의 push는 다른 workflow를 자동으로 실행하지 않으므로, 편집 workflow가 `deploy.yml`을 명시적으로 호출합니다. 작업 브랜치 push와 운영 배포는 구분합니다. `main` 반영 시 운영 배포 workflow가 실행됩니다.
