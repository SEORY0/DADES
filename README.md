# DADES 매거진

**Do Agents Dream of Electric Sheep?** — 사람이 고르고, 클로드가 엮는 AI 주간지.

에디터가 한 주 동안 모은 AI 뉴스·레포·논문·포스트를 클로드 루틴이 한 호(Issue)의
지면으로 편집하는 정적 매거진 사이트입니다.

- **Issue (시간의 축)** — 발행 목록이 첫 화면에 담백하게 쌓입니다.
- **Index (주제의 축)** — 같은 항목을 태그 색인으로 다시 찾을 수 있습니다.
- **Clippings (스크랩북)** — 지면의 ✂ 클립 버튼으로 오려둔 조각을 `내 스크랩북`에서
  다시 봅니다. localStorage에만 저장되며 서버 전송이 없습니다.

## 운영 — 발행 루틴

```
inbox.md에 링크를 쌓는다  →  /curate  →  새 issue JSON 생성·검증·커밋  →  push하면 자동 배포
```

1. 한 주 동안 [inbox.md](inbox.md)에 링크를 던져둡니다 (메모를 붙이면 에디터 노트에 반영).
2. Claude Code에서 `/curate`를 실행하면 [발행 루틴](.claude/skills/curate/SKILL.md)이
   링크를 읽고 요약해 `src/content/issues/issue-NNN.json`을 만들고 빌드 검증까지 마칩니다.
3. main에 push하면 GitHub Actions가 GitHub Pages로 배포합니다.

정기 발행을 원하면 Claude Code의 스케줄 기능(`/schedule`)으로 "매주 금요일 /curate 실행"
루틴을 등록할 수 있습니다.

## 개발

```bash
npm install
npm run dev      # http://localhost:4321/DADES/
npm run build    # dist/ 에 정적 빌드 (이슈 JSON 스키마 검증 포함)
```

## 배포 (GitHub Pages)

1. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다 (최초 1회).
2. main에 push하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이
   빌드·배포합니다 → `https://seory0.github.io/DADES/`

## 구조

```
src/content/issues/   이슈 JSON — 한 호에 파일 하나 (zod 스키마 검증)
src/pages/            발행 목록 · 이슈 지면 · Index 색인 · 스크랩북 · 소개
src/lib/mag.ts        섹션·태그·클립 페이로드 헬퍼
inbox.md              다음 호 수집함
.claude/skills/curate 발행 루틴 (/curate)
```

현재 실려 있는 №00–02는 시스템 데모용 큐레이션입니다. 링크는 모두 실재하는
프로젝트·글을 가리킵니다.
