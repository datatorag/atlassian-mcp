import { describe, expect, it } from "vitest";
import { allTools } from "./index.js";

describe("tool annotations", () => {
  it("every registered tool has a human-readable title", () => {
    for (const tool of allTools) {
      expect(tool.annotations?.title, `${tool.name} is missing a title`).toBeTruthy();
    }
  });

  // These overwrite content that already exists, so they must carry
  // destructiveHint.
  it.each(["jira_update_issue", "jira_edit_comment", "confluence_edit_page"])(
    "%s overwrites existing content and is destructive",
    (name) => {
      const tool = allTools.find((t) => t.name === name);
      expect(tool?.annotations?.destructiveHint).toBe(true);
    }
  );
});
