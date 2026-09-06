# Gallery sample issue sources

This file records the source checks used for the five sample issues added for the minimal home gallery. The issue `date` fields are DADES reading-note publication dates, not the original source publication dates.

## Issue 002: 에이전트에게 맡길 일

- OpenAI Agents SDK — official docs reviewed at https://developers.openai.com/api/docs/guides/agents. Key check: SDK fit is recurring orchestration, sessions, tracing, guardrails, and approval flows.
- Google Agent Development Kit — official Google Cloud docs reviewed at https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk. Key check: ADK is an open-source framework for building, debugging, and deploying agents and multi-agent systems.
- Anthropic Model Context Protocol — official announcement reviewed at https://www.anthropic.com/news/model-context-protocol. Key check: MCP connects AI tools and data sources through a client/server protocol.

## Issue 003: 신뢰 경계가 먼저다

- OWASP Top 10 for LLM Applications — official project page reviewed at https://owasp.org/www-project-top-10-for-large-language-model-applications/. Key check: prompt injection is listed as LLM01 and is framed as a risk to access, data, and decisions.
- OpenAI prompt-injection resistant agent design — official OpenAI article reviewed at https://openai.com/index/designing-agents-to-resist-prompt-injection/. Key check: design should constrain the impact of manipulation, not depend only on perfect malicious-input detection.
- Microsoft MSRC indirect prompt injection defense — official Microsoft Security Response Center post reviewed at https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks. Key check: indirect prompt injection is handled through layered defense.

## Issue 004: 작은 모델의 기준

- Meta Llama 3.2 — official Meta AI release reviewed at https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/. Key check: 1B and 3B text models target edge and mobile devices.
- Google Gemma 4 — official Google AI docs reviewed at https://ai.google.dev/gemma/docs/core. Key check: model size and precision create trade-offs in capability, processing, memory, and power.
- Microsoft Phi-3 — official Microsoft Azure post reviewed at https://azure.microsoft.com/en-us/blog/introducing-phi-3-redefining-whats-possible-with-slms/. Key check: Phi-3-mini is a 3.8B small language model with 4K and 128K context variants.

## Issue 005: 답변 품질 재는 법

- OpenAI Evals — official OpenAI docs reviewed at https://developers.openai.com/api/docs/guides/evals. Key check: the Evals platform has a deprecation schedule, so evaluation data and rubrics should remain portable.
- Stanford HELM — official Stanford CRFM page reviewed at https://crfm.stanford.edu/helm/. Key check: HELM is a living benchmark for transparency across scenarios and metrics.
- MLCommons AILuminate Safety — official MLCommons page reviewed at https://mlcommons.org/ailuminate/safety/. Key check: the benchmark evaluates general chatbot safety across hazard categories using public and private prompts.

## Issue 006: 데이터 연결을 안전하게

- OpenAI data controls — official OpenAI platform docs reviewed at https://developers.openai.com/api/docs/guides/your-data. Key check: API data is not used to train or improve models unless the customer opts in.
- OpenAI Secure MCP Tunnel — official OpenAI docs reviewed at https://developers.openai.com/api/docs/guides/secure-mcp-tunnels. Key check: private MCP servers can connect through an outbound HTTPS tunnel without inbound public exposure.
- MCP Security Best Practices — official MCP docs reviewed at https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices. Key check: implementations must handle consent, token audience, token passthrough, SSRF, and related boundaries carefully.
