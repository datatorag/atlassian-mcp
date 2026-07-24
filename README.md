# Atlassian MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for Jira and Confluence Cloud — search, issues, pages, comments, and attachments, 22 tools total.

This server powers the Atlassian connector of [DataToRAG](https://datatorag.com), a hosted MCP gateway with per-user OAuth and Google Workspace tools alongside these — add `https://datatorag.com/mcp` to your MCP client and connect your Atlassian account from the [dashboard](https://datatorag.com/dashboard). Or run it yourself, standalone.

## Tools

| Service | Tools | Operations |
|---------|-------|------------|
| **Jira** | 13 | search (JQL), get issue, create, update, transition, get transitions, list fields, search users, get/add/edit/delete comments, get attachment |
| **Confluence** | 9 | search (CQL), list pages, get page, create, edit, delete, get/add comments, get attachment |

### Key tool details

**jira_search** — Full [JQL](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/) support with field selection and pagination.

**jira_create_issue / jira_update_issue** — Structured parameters for the common fields (project, type, summary, description, assignee, labels, priority), plus `additional_fields` for anything else the create/edit screens accept, including custom fields.

**jira_transition_issue** — Moves an issue through its workflow. Use `jira_get_transitions` first to see which transitions are available from the issue's current status.

**confluence_get_page / confluence_edit_page** — Read and write page bodies in Confluence storage format, with a `format` parameter on reads.

**confluence_search** — [CQL](https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/) search across pages, blog posts, and comments.

## How authentication works

Each MCP session authenticates with a standard Atlassian OAuth 2.0 (3LO) access token passed in the `X-User-Token` HTTP header when the session is initialized. The server resolves the token's Atlassian cloud ID automatically (via `oauth/token/accessible-resources`) and targets that tenant for all Jira and Confluence calls.

There are no app credentials in this server — obtaining and refreshing user tokens is the caller's job. Under the DataToRAG gateway, that's handled by the gateway's per-user OAuth flow; standalone, you need to supply a valid access token yourself.

Scopes required (see `datatorag.json`): `read:jira-work`, `write:jira-work`, `read:jira-user`, `read:confluence-content.all`, `write:confluence-content`, `read:confluence-space.summary`, `offline_access`.

## Running standalone

```bash
pnpm install
pnpm run build
PORT=40001 pnpm run start
```

The server exposes `/mcp` (Streamable HTTP) and `/health` on the configured port. Initialize an MCP session with an `X-User-Token` header carrying the user's Atlassian access token:

```json
{
  "mcpServers": {
    "atlassian": {
      "type": "streamable-http",
      "url": "http://localhost:40001/mcp",
      "headers": {
        "X-User-Token": "<atlassian-oauth-access-token>"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port (the DataToRAG gateway's plugin manager sets this) |

## Architecture

```
src/
├── index.ts              # HTTP entry point (StreamableHTTP, /health + /mcp)
├── create-server.ts      # MCP server factory (accepts optional per-session client)
├── atlassian-client.ts   # Atlassian REST client, cloud-ID resolution, token per call
└── tools/
    ├── jira.ts           # Jira tool schemas + handler dispatch
    ├── confluence.ts     # Confluence tool schemas + handler dispatch
    └── response.ts       # Shared response helpers (JSON formatting, truncation)
```

`datatorag.json` is the plugin manifest the DataToRAG gateway reads: name, description, and the OAuth block (scopes plus the *names* of the client-credential env vars — never secret values).

### Key implementation details

- **Jira REST v3** for all Jira calls; **Confluence v2 API** for pages and comments, with the deprecated v1 API retained only for CQL search, which has no v2 equivalent
- **Cloud-ID resolution** happens once per client and is reused across calls
- **Space key resolution**: Confluence v2 endpoints require numeric space IDs; human-readable keys (like `ENG`) are resolved and cached per server process
- **Verbose tool schemas**: every tool documents its parameters in the description and carries `readOnlyHint`/`destructiveHint` annotations

## Development

```bash
pnpm run dev    # Watch mode — recompiles on change
```

No test framework — verification is `tsc` strict mode plus a live smoke test against a real Atlassian site, recorded in the commit body.

## License

MIT
