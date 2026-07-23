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

## Quality pass — design-time, not post-hoc

Don't run agent-fan-out review passes (/simplify-style) on every change by
default. Before implementing, answer these four questions inline (one grep
each) and let the answers shape the code:

1. **Reuse** — does a helper already exist? Check `src/tools/response.ts`
   and the sibling tool file before writing a new one. Near-match found?
   Promote it to `response.ts` instead of copying.
2. **Source of truth** — derive displayed/duplicated values from where they
   already live; never hand-copy things that will drift.
3. **Altitude** — if sibling tools have the same problem (e.g. a bloated
   response shape), fix the shared layer or apply the same fix to the
   siblings; don't special-case one tool.
4. **Efficiency** — bound work on large inputs (multi-KB API payloads)
   before running heavy transforms over them.

Reserve agent fan-out review for explicit requests or large multi-file
changes.
