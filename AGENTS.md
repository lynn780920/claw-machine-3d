<!-- codebase-memory-mcp:start -->
For structural codebase exploration, use the installed `codebase-memory` skill.
<!-- codebase-memory-mcp:end -->

## Token-Efficient Work
- Correctness, necessary tests, error handling, safety, and existing functionality take priority over token savings.
- For symbols, locations, callers, and dependencies, prefer precise, bounded Codebase Memory MCP queries. Reuse current indexes; do not routinely reindex or enumerate the whole graph. If unavailable, incomplete, or stale, use targeted search/read fallback. Confirm actual source before editing.
- Locate relevant code first; read only necessary snippets. Reuse unchanged context. Avoid unrelated assets, large JSON, build output, and dependencies.
- Keep tool calls and output scoped. Avoid repeated architecture explanations, full code/diffs, and lengthy logs unless requested. Low-risk work needs no detailed plan; analyze significant risks and ambiguity.
- Run checks appropriate to the change; broaden or repeat only when failures, new edits, or unresolved risks require it. Never guess unverified behavior or omit necessary checks to save tokens.
- Prefer a final report under 150 Chinese characters for small tasks: changes, files, validation, and unresolved issues. Expand only when needed.
- Keep persistent rules here. Use Git for history; update detailed handoffs only for major architecture changes, important decisions, or cross-agent transfer. Avoid repetitive Markdown maintenance.
