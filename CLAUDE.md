# CLAUDE.md

## Project

Atlassian MCP plugin for the DataToRAG gateway. Exposes Jira and Confluence
tools via MCP over HTTP.

## Commands

- `pnpm run build` — compile TypeScript (src/ → server/)
- `pnpm run dev` — watch mode
- `pnpm run start` — run the compiled HTTP server

## Architecture

- `src/index.ts` — HTTP entry point (the gateway's plugin-manager sets the
  port via `PORT` env)
- `src/create-server.ts` — builds the MCP server
- `src/atlassian-client.ts` — Atlassian REST client; per-user access token
  injected per call by the gateway
- `src/tools/jira.ts`, `src/tools/confluence.ts` — one file per service:
  tool schemas + a `handle<Service>()` dispatch switch
- `src/tools/response.ts` — shared response helpers
- `datatorag.json` — plugin manifest the gateway reads (name, description,
  oauth block with env var *names*, never secret values)

## Key conventions

- ESM, TypeScript strict mode, output dir `server/`
- Use `pnpm`, not `npm`
- No test framework — verification is `tsc` plus a live smoke test; record
  what was smoke-tested in the commit/PR body
- Tool schemas carry verbose parameter-documenting descriptions and
  `annotations: { destructiveHint, readOnlyHint }` on every tool

## Cross-repo guidance

DataToRAG development runs from the datatorag-mcp session; the canonical
skills and workflow guidance (including the design-time "Quality pass"
checklist) live in that repo's `.claude/skills/` —
<https://github.com/datatorag/mcp-gateway>, start with `codebase-map`.
Keep only repo-specific facts in this file; don't duplicate cross-repo
guidance here, it drifts.
