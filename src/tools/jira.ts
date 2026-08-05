import type { AtlassianClient } from "../atlassian-client.js";
import { jsonResponse, textResponse } from "./response.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap plain text in Atlassian Document Format (ADF). */
function textToAdf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const jiraTools = [
  // 1. Search users
  {
    name: "jira_search_users",
    description:
      "Search for Jira users by name, username, or email address. Returns matching user accounts with display names and account IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query — matches against name, username, or email",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default 10)",
        },
      },
      required: ["query"],
    },
    annotations: { title: "Search Jira users", readOnlyHint: true, destructiveHint: false },
  },

  // 2. JQL search
  {
    name: "jira_search",
    description:
      "Search Jira issues using JQL (Jira Query Language). Returns matching issues with key fields. Supports pagination via next_page_token.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jql: {
          type: "string",
          description: "JQL query string (e.g. 'project = PROJ AND status = Open')",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results per page (default 50)",
        },
        next_page_token: {
          type: "string",
          description: "Pagination token from a previous search response",
        },
      },
      required: ["jql"],
    },
    annotations: { title: "Search Jira issues", readOnlyHint: true, destructiveHint: false },
  },

  // 3. Get issue
  {
    name: "jira_get_issue",
    description:
      "Get detailed information about a specific Jira issue by its key (e.g. PROJ-123). Returns summary, status, priority, assignee, reporter, description, labels, dates, comments count, and attachments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
      },
      required: ["issue_key"],
    },
    annotations: { title: "Get Jira issue", readOnlyHint: true, destructiveHint: false },
  },

  // 4. List fields
  {
    name: "jira_list_fields",
    description:
      "List all available Jira fields (both system and custom). Useful for discovering field IDs needed for creating or updating issues.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    annotations: { title: "List Jira fields", readOnlyHint: true, destructiveHint: false },
  },

  // 5. Create issue
  {
    name: "jira_create_issue",
    description:
      "Create a new Jira issue in the specified project. You can set arbitrary fields at creation via additional_fields (e.g. assignee, priority, labels, components) — required for projects that reject unassigned issues. Returns the created issue key and URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_key: {
          type: "string",
          description: "Project key (e.g. PROJ)",
        },
        summary: {
          type: "string",
          description: "Issue summary / title",
        },
        description: {
          type: "string",
          description: "Issue description (plain text, will be converted to ADF)",
        },
        issue_type: {
          type: "string",
          description: "Issue type name (default 'Task'). Common values: Task, Bug, Story, Epic",
        },
        additional_fields: {
          type: "object",
          description:
            "Additional fields to set at creation, as a JSON object of field ID to value (e.g. {\"assignee\": {\"accountId\": \"abc123\"}, \"priority\": {\"name\": \"High\"}, \"labels\": [\"foo\"]}). Caller is responsible for value shape — pass-through to the Jira API.",
        },
      },
      required: ["project_key", "summary"],
    },
    annotations: { title: "Create Jira issue", readOnlyHint: false, destructiveHint: false },
  },

  // 6. Update issue
  {
    name: "jira_update_issue",
    description:
      "Update an existing Jira issue. You can change the summary, description, and/or set arbitrary fields via additional_fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
        summary: {
          type: "string",
          description: "New summary / title",
        },
        description: {
          type: "string",
          description: "New description (plain text, will be converted to ADF)",
        },
        additional_fields: {
          type: "object",
          description:
            "Additional fields to set, as a JSON object of field ID to value (e.g. {\"priority\": {\"name\": \"High\"}})",
        },
      },
      required: ["issue_key"],
    },
    annotations: { title: "Update Jira issue", readOnlyHint: false, destructiveHint: true },
  },

  // 7. Add comment
  {
    name: "jira_add_comment",
    description: "Add a comment to a Jira issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
        comment: {
          type: "string",
          description: "Comment text (plain text, will be converted to ADF)",
        },
      },
      required: ["issue_key", "comment"],
    },
    annotations: { title: "Add Jira comment", readOnlyHint: false, destructiveHint: false },
  },

  // 8. Edit comment
  {
    name: "jira_edit_comment",
    description: "Edit an existing comment on a Jira issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
        comment_id: {
          type: "string",
          description: "The ID of the comment to edit",
        },
        comment: {
          type: "string",
          description: "New comment text (plain text, will be converted to ADF)",
        },
      },
      required: ["issue_key", "comment_id", "comment"],
    },
    annotations: { title: "Edit Jira comment", readOnlyHint: false, destructiveHint: true },
  },

  // 9. Delete comment
  {
    name: "jira_delete_comment",
    description: "Delete a comment from a Jira issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
        comment_id: {
          type: "string",
          description: "The ID of the comment to delete",
        },
      },
      required: ["issue_key", "comment_id"],
    },
    annotations: { title: "Delete Jira comment", readOnlyHint: false, destructiveHint: true },
  },

  // 10. Get comments
  {
    name: "jira_get_comments",
    description: "Get all comments on a Jira issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
      },
      required: ["issue_key"],
    },
    annotations: { title: "Get Jira comments", readOnlyHint: true, destructiveHint: false },
  },

  // 11. Get transitions
  {
    name: "jira_get_transitions",
    description:
      "Get the available workflow transitions for a Jira issue. Use the returned transition IDs with jira_transition_issue to move an issue through its workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
      },
      required: ["issue_key"],
    },
    annotations: { title: "List Jira transitions", readOnlyHint: true, destructiveHint: false },
  },

  // 12. Transition issue
  {
    name: "jira_transition_issue",
    description:
      "Transition a Jira issue to a new workflow status. Use jira_get_transitions first to find valid transition IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key (e.g. PROJ-123)",
        },
        transition_id: {
          type: "string",
          description: "The transition ID (from jira_get_transitions)",
        },
      },
      required: ["issue_key", "transition_id"],
    },
    annotations: { title: "Change Jira issue status", readOnlyHint: false, destructiveHint: false },
  },

  // 13. Get attachment metadata
  {
    name: "jira_get_attachment",
    description:
      "Get metadata for a Jira attachment by its ID. Returns filename, size, MIME type, and content URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        attachment_id: {
          type: "string",
          description: "The attachment ID",
        },
      },
      required: ["attachment_id"],
    },
    annotations: { title: "Get Jira attachment", readOnlyHint: true, destructiveHint: false },
  },

  // 14. Delete issue
  {
    name: "jira_delete_issue",
    description:
      "Permanently delete a Jira issue. THIS CANNOT BE UNDONE through the API — deleted issues do not go to a trash or archive, and the issue key is not reused, so every link to it breaks. Prefer transitioning the issue to Done or Won't Do, which keeps the history. Deleting an issue that has subtasks fails unless delete_subtasks is true, in which case the subtasks are destroyed with it. Deleting a parent does not delete linked issues, only subtasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issue_key: {
          type: "string",
          description: "The issue key to delete (e.g. PROJ-123)",
        },
        delete_subtasks: {
          type: "boolean",
          default: false,
          description:
            "Also delete the issue's subtasks. Required to be true when the issue has any — without it Jira rejects the whole call rather than deleting partially. Default false.",
        },
      },
      required: ["issue_key"],
    },
    annotations: { title: "Delete Jira issue permanently", readOnlyHint: false, destructiveHint: true },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleJira(
  client: AtlassianClient,
  toolName: string,
  args: Record<string, unknown>,
) {
  switch (toolName) {
    // ── 1. Search users ─────────────────────────────────────────
    case "jira_search_users": {
      const query = args.query as string;
      const maxResults = (args.max_results as number | undefined) ?? 10;
      const data = await client.jiraGet(
        `/user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      );
      return jsonResponse(data);
    }

    // ── 2. JQL search ───────────────────────────────────────────
    case "jira_search": {
      const jql = args.jql as string;
      const maxResults = (args.max_results as number | undefined) ?? 50;
      const body: Record<string, unknown> = { jql, maxResults };
      if (args.next_page_token) {
        body.nextPageToken = args.next_page_token as string;
      }
      const data = await client.jiraPost("/search/jql", body);
      return jsonResponse(data);
    }

    // ── 3. Get issue ────────────────────────────────────────────
    case "jira_get_issue": {
      const issueKey = args.issue_key as string;
      const raw = (await client.jiraGet(`/issue/${encodeURIComponent(issueKey)}`)) as Record<
        string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      >;

      const fields = raw.fields ?? {};
      const result = {
        key: raw.key,
        summary: fields.summary ?? null,
        status: fields.status?.name ?? null,
        priority: fields.priority?.name ?? null,
        assignee: fields.assignee
          ? {
              displayName: fields.assignee.displayName,
              accountId: fields.assignee.accountId,
              emailAddress: fields.assignee.emailAddress ?? null,
            }
          : null,
        reporter: fields.reporter
          ? {
              displayName: fields.reporter.displayName,
              accountId: fields.reporter.accountId,
              emailAddress: fields.reporter.emailAddress ?? null,
            }
          : null,
        description: fields.description ?? null,
        labels: fields.labels ?? [],
        created: fields.created ?? null,
        updated: fields.updated ?? null,
        commentCount: fields.comment?.total ?? 0,
        attachments: Array.isArray(fields.attachment)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fields.attachment.map((a: any) => ({
              id: a.id,
              filename: a.filename,
              size: a.size,
              mimeType: a.mimeType,
              content: a.content,
            }))
          : [],
      };
      return jsonResponse(result);
    }

    // ── 4. List fields ──────────────────────────────────────────
    case "jira_list_fields": {
      const data = await client.jiraGet("/field");
      return jsonResponse(data);
    }

    // ── 5. Create issue ─────────────────────────────────────────
    case "jira_create_issue": {
      const projectKey = args.project_key as string;
      const summary = args.summary as string;
      const description = args.description as string | undefined;
      const issueType = (args.issue_type as string | undefined) ?? "Task";

      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
      };

      if (description) {
        fields.description = textToAdf(description);
      }

      if (args.additional_fields !== undefined) {
        const extra = args.additional_fields as Record<string, unknown>;
        Object.assign(fields, extra);
      }

      const data = await client.jiraPost("/issue", { fields });
      return jsonResponse(data);
    }

    // ── 6. Update issue ─────────────────────────────────────────
    case "jira_update_issue": {
      const issueKey = args.issue_key as string;
      const fields: Record<string, unknown> = {};

      if (args.summary !== undefined) {
        fields.summary = args.summary as string;
      }
      if (args.description !== undefined) {
        fields.description = textToAdf(args.description as string);
      }
      if (args.additional_fields !== undefined) {
        const extra = args.additional_fields as Record<string, unknown>;
        Object.assign(fields, extra);
      }

      await client.jiraPut(`/issue/${encodeURIComponent(issueKey)}`, { fields });
      return textResponse(`Issue ${issueKey} updated successfully.`);
    }

    // ── 7. Add comment ──────────────────────────────────────────
    case "jira_add_comment": {
      const issueKey = args.issue_key as string;
      const comment = args.comment as string;
      const data = await client.jiraPost(
        `/issue/${encodeURIComponent(issueKey)}/comment`,
        { body: textToAdf(comment) },
      );
      return jsonResponse(data);
    }

    // ── 8. Edit comment ─────────────────────────────────────────
    case "jira_edit_comment": {
      const issueKey = args.issue_key as string;
      const commentId = args.comment_id as string;
      const comment = args.comment as string;
      const data = await client.jiraPut(
        `/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`,
        { body: textToAdf(comment) },
      );
      return jsonResponse(data);
    }

    // ── 9. Delete comment ───────────────────────────────────────
    case "jira_delete_comment": {
      const issueKey = args.issue_key as string;
      const commentId = args.comment_id as string;
      await client.jiraDelete(
        `/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`,
      );
      return textResponse(`Comment ${commentId} deleted from ${issueKey}.`);
    }

    // ── 10. Get comments ────────────────────────────────────────
    case "jira_get_comments": {
      const issueKey = args.issue_key as string;
      const data = await client.jiraGet(
        `/issue/${encodeURIComponent(issueKey)}/comment`,
      );
      return jsonResponse(data);
    }

    // ── 11. Get transitions ─────────────────────────────────────
    case "jira_get_transitions": {
      const issueKey = args.issue_key as string;
      const data = await client.jiraGet(
        `/issue/${encodeURIComponent(issueKey)}/transitions`,
      );
      return jsonResponse(data);
    }

    // ── 12. Transition issue ────────────────────────────────────
    case "jira_transition_issue": {
      const issueKey = args.issue_key as string;
      const transitionId = args.transition_id as string;
      await client.jiraPost(
        `/issue/${encodeURIComponent(issueKey)}/transitions`,
        { transition: { id: transitionId } },
      );
      return textResponse(
        `Issue ${issueKey} transitioned successfully (transition ${transitionId}).`,
      );
    }

    // ── 13. Get attachment metadata ─────────────────────────────
    case "jira_get_attachment": {
      const attachmentId = args.attachment_id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (await client.jiraGet(
        `/attachment/${encodeURIComponent(attachmentId)}`,
      )) as Record<string, any>;

      const result = {
        id: raw.id,
        filename: raw.filename,
        size: raw.size,
        mimeType: raw.mimeType,
        content: raw.content,
      };
      return jsonResponse(result);
    }

    // ── 14. Delete issue ────────────────────────────────────────
    case "jira_delete_issue": {
      const issueKey = args.issue_key as string;
      // Only this tool validates the key shape, and only because it is the one
      // call that cannot be taken back. Everywhere else a malformed key costs
      // a 404; here it is worth failing locally with a message that names the
      // problem, rather than sending a delete built from input we did not
      // recognise. encodeURIComponent already makes the path safe — this is
      // about not issuing an irreversible request on a guess.
      if (!/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(issueKey ?? "")) {
        throw new Error(
          `Not a Jira issue key: ${JSON.stringify(issueKey)}. Expected the form PROJ-123.`
        );
      }
      // Jira defaults deleteSubtasks to false and then REJECTS the whole call
      // if the issue has any, rather than deleting the parent alone. Sending
      // the flag explicitly makes the caller's intent the thing that decides,
      // instead of a default they never saw.
      const deleteSubtasks = args.delete_subtasks === true;
      await client.jiraDelete(
        `/issue/${encodeURIComponent(issueKey)}?deleteSubtasks=${deleteSubtasks}`,
      );
      // The API returns 204 with no body, so there is nothing to read back and
      // no way to confirm afterwards: the issue is gone, and a get would 404
      // whether we deleted it or it never existed. Say what was done, plainly.
      return textResponse(
        `Issue ${issueKey} permanently deleted` +
          (deleteSubtasks ? ", along with its subtasks." : ".")
      );
    }

    default:
      throw new Error(`Unknown Jira tool: ${toolName}`);
  }
}
