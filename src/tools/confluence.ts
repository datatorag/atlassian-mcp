import type { AtlassianClient } from "../atlassian-client.js";
import { jsonResponse, textResponse } from "./response.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const confluenceTools = [
  {
    name: "confluence_list_pages",
    description:
      "List pages in a Confluence space. Returns an array of pages with id, title, version, and link.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_key: {
          type: "string",
          description: "The key of the Confluence space (e.g. 'ENG').",
        },
        limit: {
          type: "number",
          description: "Maximum number of pages to return (default 25).",
        },
      },
      required: ["space_key"],
    },
    annotations: { destructiveHint: false, readOnlyHint: true },
  },
  {
    name: "confluence_get_page",
    description:
      "Get a single Confluence page by ID, including its XHTML body content and version info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to retrieve.",
        },
      },
      required: ["page_id"],
    },
    annotations: { destructiveHint: false, readOnlyHint: true },
  },
  {
    name: "confluence_create_page",
    description:
      "Create a new page in Confluence. Content must be in XHTML storage format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Title of the new page.",
        },
        content: {
          type: "string",
          description:
            "Page body in Confluence XHTML storage format (e.g. '<p>Hello</p>').",
        },
        space_key: {
          type: "string",
          description: "The key of the space to create the page in.",
        },
        parent_id: {
          type: "string",
          description:
            "Optional parent page ID to nest this page under.",
        },
      },
      required: ["title", "content", "space_key"],
    },
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  {
    name: "confluence_edit_page",
    description:
      "Update an existing Confluence page. Content must be in XHTML storage format. If version is not provided the current version is fetched and auto-incremented.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to update.",
        },
        title: {
          type: "string",
          description: "New title for the page.",
        },
        content: {
          type: "string",
          description: "New body in XHTML storage format.",
        },
        version: {
          type: "number",
          description:
            "Version number for the update. If omitted the current version is auto-incremented.",
        },
      },
      required: ["page_id", "title", "content"],
    },
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  {
    name: "confluence_delete_page",
    description: "Delete a Confluence page by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to delete.",
        },
      },
      required: ["page_id"],
    },
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  {
    name: "confluence_search",
    description:
      "Search Confluence content using CQL (Confluence Query Language). Returns matching pages/content with id, title, version, and link.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cql: {
          type: "string",
          description:
            "CQL query string (e.g. 'type=page AND space=ENG AND title~\"onboarding\"').",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 25).",
        },
      },
      required: ["cql"],
    },
    annotations: { destructiveHint: false, readOnlyHint: true },
  },
  {
    name: "confluence_get_comments",
    description:
      "Get all comments on a Confluence page, including their body content and version info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page whose comments to retrieve.",
        },
      },
      required: ["page_id"],
    },
    annotations: { destructiveHint: false, readOnlyHint: true },
  },
  {
    name: "confluence_add_comment",
    description:
      "Add a comment to a Confluence page. Optionally reply to an existing comment by providing parent_comment_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to comment on.",
        },
        body: {
          type: "string",
          description:
            "Comment text (plain text; will be wrapped in <p> tags automatically).",
        },
        parent_comment_id: {
          type: "string",
          description:
            "Optional ID of an existing comment to reply to.",
        },
      },
      required: ["page_id", "body"],
    },
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  {
    name: "confluence_get_attachment",
    description:
      "Get metadata for a specific attachment on a Confluence page by filename.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page the attachment belongs to.",
        },
        filename: {
          type: "string",
          description: "Exact filename of the attachment.",
        },
      },
      required: ["page_id", "filename"],
    },
    annotations: { destructiveHint: false, readOnlyHint: true },
  },
] as const;

// ---------------------------------------------------------------------------
// Response helpers — shape the Confluence API response into something concise
// ---------------------------------------------------------------------------

interface ConfluencePage {
  id: string;
  title: string;
  version?: { number: number };
  body?: { storage?: { value: string } };
  _links?: { webui?: string; self?: string };
}

interface ConfluenceSearchResult {
  results: ConfluencePage[];
  _links?: { base?: string };
}

interface ConfluenceChildResult {
  results: Array<{
    id: string;
    title: string;
    version?: { number: number };
    body?: { storage?: { value: string } };
    _links?: { webui?: string };
  }>;
  _links?: { base?: string };
}

interface ConfluenceAttachmentResult {
  results: Array<{
    id: string;
    title: string;
    version?: { number: number };
    metadata?: { mediaType?: string };
    extensions?: { mediaType?: string; fileSize?: number };
    _links?: { download?: string; webui?: string };
  }>;
  _links?: { base?: string };
}

function summarisePage(page: ConfluencePage, baseUrl?: string) {
  return {
    id: page.id,
    title: page.title,
    version: page.version?.number ?? null,
    link: baseUrl && page._links?.webui
      ? `${baseUrl}${page._links.webui}`
      : page._links?.webui ?? null,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleConfluence(
  client: AtlassianClient,
  toolName: string,
  args: Record<string, unknown>,
) {
  switch (toolName) {
    // ── List pages ────────────────────────────────────────────────
    case "confluence_list_pages": {
      const spaceKey = args.space_key as string;
      const limit = (args.limit as number | undefined) ?? 25;

      const data = (await client.confluenceGet(
        `/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&limit=${limit}&expand=version`,
      )) as ConfluenceSearchResult;

      const baseUrl = data._links?.base;
      const pages = (data.results ?? []).map((p) => summarisePage(p, baseUrl));
      return jsonResponse(pages);
    }

    // ── Get page ──────────────────────────────────────────────────
    case "confluence_get_page": {
      const pageId = args.page_id as string;

      const page = (await client.confluenceGet(
        `/content/${encodeURIComponent(pageId)}?expand=body.storage,version`,
      )) as ConfluencePage;

      return jsonResponse({
        id: page.id,
        title: page.title,
        version: page.version?.number ?? null,
        body: page.body?.storage?.value ?? null,
      });
    }

    // ── Create page ───────────────────────────────────────────────
    case "confluence_create_page": {
      const title = args.title as string;
      const content = args.content as string;
      const spaceKey = args.space_key as string;
      const parentId = args.parent_id as string | undefined;

      const payload: Record<string, unknown> = {
        type: "page",
        title,
        space: { key: spaceKey },
        body: {
          storage: {
            value: content,
            representation: "storage",
          },
        },
      };

      if (parentId) {
        payload.ancestors = [{ id: parentId }];
      }

      const created = (await client.confluencePost(
        "/content",
        payload,
      )) as ConfluencePage;

      return jsonResponse({
        id: created.id,
        title: created.title,
        version: created.version?.number ?? null,
        link: created._links?.webui ?? null,
      });
    }

    // ── Edit page ─────────────────────────────────────────────────
    case "confluence_edit_page": {
      const pageId = args.page_id as string;
      const title = args.title as string;
      const content = args.content as string;
      let version = args.version as number | undefined;

      if (version === undefined) {
        const current = (await client.confluenceGet(
          `/content/${encodeURIComponent(pageId)}?expand=version`,
        )) as ConfluencePage;
        version = (current.version?.number ?? 0) + 1;
      }

      const payload = {
        id: pageId,
        type: "page",
        title,
        body: {
          storage: {
            value: content,
            representation: "storage",
          },
        },
        version: { number: version },
      };

      const updated = (await client.confluencePut(
        `/content/${encodeURIComponent(pageId)}`,
        payload,
      )) as ConfluencePage;

      return jsonResponse({
        id: updated.id,
        title: updated.title,
        version: updated.version?.number ?? null,
      });
    }

    // ── Delete page ───────────────────────────────────────────────
    case "confluence_delete_page": {
      const pageId = args.page_id as string;
      await client.confluenceDelete(
        `/content/${encodeURIComponent(pageId)}`,
      );
      return textResponse(`Page ${pageId} deleted.`);
    }

    // ── Search ────────────────────────────────────────────────────
    case "confluence_search": {
      const cql = args.cql as string;
      const limit = (args.limit as number | undefined) ?? 25;

      const data = (await client.confluenceGet(
        `/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&expand=version`,
      )) as ConfluenceSearchResult;

      const baseUrl = data._links?.base;
      const results = (data.results ?? []).map((p) =>
        summarisePage(p, baseUrl),
      );
      return jsonResponse(results);
    }

    // ── Get comments ──────────────────────────────────────────────
    case "confluence_get_comments": {
      const pageId = args.page_id as string;

      const data = (await client.confluenceGet(
        `/content/${encodeURIComponent(pageId)}/child/comment?expand=body.storage,version`,
      )) as ConfluenceChildResult;

      const comments = (data.results ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        version: c.version?.number ?? null,
        body: c.body?.storage?.value ?? null,
      }));
      return jsonResponse(comments);
    }

    // ── Add comment ───────────────────────────────────────────────
    case "confluence_add_comment": {
      const pageId = args.page_id as string;
      const body = args.body as string;
      const parentCommentId = args.parent_comment_id as string | undefined;

      const payload: Record<string, unknown> = {
        type: "comment",
        container: { type: "page", id: pageId },
        body: {
          storage: {
            value: `<p>${body}</p>`,
            representation: "storage",
          },
        },
      };

      if (parentCommentId) {
        payload.ancestors = [{ id: parentCommentId }];
      }

      const created = (await client.confluencePost(
        "/content",
        payload,
      )) as ConfluencePage;

      return jsonResponse({
        id: created.id,
        title: created.title,
        version: created.version?.number ?? null,
      });
    }

    // ── Get attachment ────────────────────────────────────────────
    case "confluence_get_attachment": {
      const pageId = args.page_id as string;
      const filename = args.filename as string;

      const data = (await client.confluenceGet(
        `/content/${encodeURIComponent(pageId)}/child/attachment?filename=${encodeURIComponent(filename)}&expand=version`,
      )) as ConfluenceAttachmentResult;

      const baseUrl = data._links?.base;
      const attachments = (data.results ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version?.number ?? null,
        mediaType: a.extensions?.mediaType ?? a.metadata?.mediaType ?? null,
        fileSize: a.extensions?.fileSize ?? null,
        downloadLink: baseUrl && a._links?.download
          ? `${baseUrl}${a._links.download}`
          : a._links?.download ?? null,
      }));

      if (attachments.length === 0) {
        return textResponse(
          `No attachment named "${filename}" found on page ${pageId}.`,
        );
      }

      return jsonResponse(attachments.length === 1 ? attachments[0] : attachments);
    }

    default:
      throw new Error(`Unknown Confluence tool: ${toolName}`);
  }
}
