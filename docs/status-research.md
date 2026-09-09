# AI 모델 상태판: 출처와 표현 방식

조사일 2026-09-07. 목적은 뉴스를 읽기 전 현재 모델 선택지를 짧게 이해하는 것이다. 아래 개선점은 각 서비스의 장점과 데이터 범위를 바탕으로 한 DADES의 설계 판단이다.

| 참고 | 강점 | DADES에서 보완한 부분 |
| --- | --- | --- |
| [Chartdex](https://seory0.github.io/chartdex/) | ranked list, in-cell bar, Pareto plot 등 질문에 맞는 시각화 선택 | 표 안에서 수치와 상대 크기를 함께 표시. 모바일에서는 긴 필터·표가 데이터를 밀어내지 않도록 4개 지표와 선택 열만 표시 |
| [Artificial Analysis](https://artificialanalysis.ai/data-api/docs) | 품질·가격·속도를 나누어 비교하는 모델 지표 | 공개 OpenRouter 카탈로그의 전달 지수만 원래 척도로 사용. 다른 벤치마크와 합산하지 않으며 벤치마크 실행일과 수집일을 구분 |
| [Arena](https://arena.ai/blog/arena-rank) | 인간 선호도, 불확실성 구간과 표본 수를 고려한 순위 | 선호도·성능·인기를 동의어로 쓰지 않음. 관측되지 않은 신뢰구간이나 순위 상승을 만들어 붙이지 않음 |
| [OpenRouter](https://openrouter.ai/rankings) | 실제 라우팅 사용량과 모델별 가격 | 주간 토큰 합계라는 단위와 플랫폼 표본을 표시. 전체 시장 점유율·사용자 수·매출로 해석하지 않음. 무료/배치 등 경로를 명시 |
| [LiveBench](https://github.com/LiveBench/new-livebench) | 같은 릴리스 안에서 객관적 세부 과제와 비용을 비교 | 임의의 통합 순위를 만들지 않고 하나의 지표를 선택하게 함. 비용 계산의 입력/출력 토큰 양을 독자가 직접 바꿀 수 있게 함 |

## 2026-09-08 추가 조사: 벤치마크·속도 출처

| 출처 | 확인 결과 | 결정 |
| --- | --- | --- |
| [Terminal-Bench 4.0 공식 리더보드](https://www.tbench.ai/leaderboard/terminal-bench/4.0) | 2026-09-03 갱신, 18행, 95% CI 포함, GPT-6 Astra·Fable 5.1·Opus 5·GLM-5.3 등 포함. 페이지 임베디드 JSON | 수집. 모델 값은 조합 중 최고 하나, 조합 전체는 패널에 표시 |
| [SWE-bench Verified 공식](https://www.swebench.com/) | 마지막 갱신 2026-02 | 싣지 않음 |
| [Epoch AI Benchmarking Hub](https://epoch.ai/benchmarks) (CC BY, 매일 ZIP) | SWE-bench Verified 자체 실행은 2026-06이 마지막. 다른 벤치마크는 9월 모델 반영 | SWE-bench 대체 출처로 부적합. 향후 다른 지표 후보 |
| [OpenRouter 문서화 endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model) | 인증 없이는 `throughput_last_30m`·`latency_last_30m`가 null | 사용 중단 |
| OpenRouter 공개 모델 페이지 | 제공사별 p50 속도·지연·요청 수·창 길이가 키 없이 임베디드됨 | 속도 출처로 채택. 요청 수 최다 표준 경로를 대표값으로 |
| Artificial Analysis, llm-stats, BenchLM, LLMPerf, TheFastest.ai | 약관 제한, 원본 비공개, 2026-01 아카이브, 사이트 폐쇄 | 사용 안 함 |

## 실제 구현

1. 네 가지 지표의 선두 모델과 단위를 먼저 표시한다.
2. 성능 대 비용 산점도는 입력100만+출력100만 토큰의 기본 단가를 동일하게 적용한다. x는 log(1+cost), y는 원래 AA 지수이다. 높은 성능과 낮은 비용 방향을 분리한다.
3. 주간 사용량은 출처가 공개한 상위 모델만 막대로 비교한다. 과거 합계가 없어 시계열·증감률을 추정하지 않는다.
4. 표는 검색/개발사/지표별 정렬이 가능하며 URL에 상태를 보존한다. 최대3개 모델을 같은 토큰 양으로 비교한다.
5. 속도는 OpenRouter 공개 모델 페이지의 제공사별 p50 중 요청 수가 가장 많은 표준 경로 하나를 쓰고, 제공사명·요청 수·창 길이를 함께 저장한다. 관측이 없는 모델은 0이 아니라 비워 둔다.
6. 사용자 최신 요청에 맞춰 nav의 실제 회색 fill·블러·곡률·미세한 inset shadow를 복사하고 설명은 접어둔다. nav 자체는 수정하지 않았다.

## 조사 증거

Chartdex 공개소스 기준 SHA `7bb75fbbbf0359200aa34109dc722b3bdfb8784b`: [템플릿](https://github.com/SEORY0/chartdex/blob/7bb75fbbbf0359200aa34109dc722b3bdfb8784b/src/template.html). 실제375/768/1280 화면, 정렬·검색·상세·테마를 확인했다. 예제 숫자는 합성 데이터이므로 옮기지 않았다. 캡처/계산스타일은 `/tmp/dades-status-reference/`에 있다.

공개 API와 페이지를 실제로 조회했다. [모델 카탈로그](https://openrouter.ai/api/v1/models), [endpoint p50 스키마](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model), [Data API의 범위](https://openrouter.ai/docs/cookbook/administration/data-api)를 확인했다. 마지막 문서의 키가 필요한 Data API를 공개 HTML 수집과 혼동하지 않는다.

속도 확보를 위한 직접 AA API 연결은 추가하지 않았다. 현재 연결은 키·이용 범위 확인이 별도로 필요한 경로이므로 공개 endpoint의 실제 결측 상태를 유지한다. 정기 배포 활성화와 수집 실패 복구는 [데이터 운영](status-data.md)을 참조한다.
