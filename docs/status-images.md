# 상태판 모델 아이콘

2026-09-09 확인. 브랜드 아이콘은 아래 출처의 원본 바이트 그대로 `public/model-icons/`에 보관한다. 브랜드 식별용 이미지이며 해당 개발사의 보증·제휴를 의미하지 않는다. 상표 권리는 각 소유자에게 있다. `Model.svg`는 로고 미등록 모델에만 사용하는 중립적인 대체 아이콘이다.

| 파일 | 대응 모델 | 확인 페이지 | 이미지 원본 |
| --- | --- | --- | --- |
| Anthropic.svg | `anthropic/*` | [Claude Fable 5.1](https://openrouter.ai/anthropic/claude-fable-5.1) | [원본](https://openrouter.ai/images/icons/Anthropic.svg) |
| Cohere.png | `cohere/*` | [North Mini Code](https://openrouter.ai/cohere/north-mini-code:free) | [원본](https://openrouter.ai/images/icons/Cohere.png) |
| Tencent.png | `tencent/*` | [Hy4 preview](https://openrouter.ai/tencent/hy4-preview) | [원본](https://openrouter.ai/images/icons/Tencent.png) |
| OpenAI.svg | `openai/*` | [GPT-6 Astra](https://openrouter.ai/openai/gpt-6-astra) | [원본](https://openrouter.ai/images/icons/OpenAI.svg) |
| GoogleGemini.svg | `google/gemini-*` | [Gemini 3.1 Pro](https://openrouter.ai/google/gemini-3.1-pro-preview) | [원본](https://openrouter.ai/images/icons/GoogleGemini.svg) |
| DeepSeek.png | `deepseek/*` | [DeepSeek V4 Flash](https://openrouter.ai/deepseek/deepseek-v4-flash) | [원본](https://openrouter.ai/images/icons/DeepSeek.png) |
| ZAI.svg | `z-ai/*` | [Z.ai 공식 사이트](https://z.ai/)의 icon/apple-touch-icon 선언 | [원본](https://z-cdn.chatglm.cn/z-ai/static/logo.svg) |
| MetaAI.svg | `meta/muse-spark*` | [Muse Spark와 Meta AI 새 디자인 발표](https://about.fb.com/news/2026/04/introducing-muse-spark-meta-superintelligence-labs/amp/) | [LobeHub MetaAI 색상 SVG](https://github.com/lobehub/lobe-icons/blob/a94750e3f5f8fc33757b839d85030e742284e43a/packages/static-svg/icons/metaai-color.svg) · MIT, `MetaAI-LICENSE` 동봉 |

`src/lib/model-artwork.ts`가 서버 렌더링과 브라우저 갱신에 동일한 매핑을 사용한다. Gemini 심볼은 Gemini 계열에만, Meta AI의 분홍·보라색 심볼은 Muse Spark 계열에만 표시한다. 모르는 개발사는 `Model.svg`로 대체하고, 선두가 없는 지표에는 이미지를 표시하지 않는다. 자동 갱신으로 선두가 바뀌면 이미지도 함께 갱신한다.

아이콘은 장식용 `alt=""` 이미지이며 바로 앞 유리판에 모델명과 지표를 실제 텍스트로 제공한다. 아이콘 위에 위치한 독립된 DOM 유리판의 `backdrop-filter`가 이미지를 흐린다. 페이지 스크린샷이나 생성 이미지를 배경으로 쓰지 않는다.

OpenAI의 검정 단색 원본은 Ink 배경에서 사라지지 않도록 이미지 요소 뒤에 밝은 중립색 판을 둔다. 원본 색상이나 파일은 수정하지 않는다.
