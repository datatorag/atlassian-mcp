/**
 * Atlassian REST API client.
 *
 * Authentication is via OAuth 2.0 access token passed in the X-User-Token
 * header by the DataToRAG gateway.  The token is a standard Atlassian
 * OAuth 2.0 (3LO) access token.
 *
 * After obtaining the token we must resolve the Atlassian "cloud ID" for the
 * user's site so that all subsequent API calls target the correct tenant:
 *   GET https://api.atlassian.com/oauth/token/accessible-resources
 *
 * Jira REST v3:       https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
 * Confluence v2:      https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2/...
 * Confluence v1:      https://api.atlassian.com/ex/confluence/{cloudId}/wiki/rest/api/...
 *   (v1 is deprecated; only retained here for CQL search, which has no v2 equivalent)
 */

export interface AtlassianClientOptions {
  accessToken?: string;
}

export class AtlassianClient {
  private accessToken?: string;
  private cloudId?: string;
  private spaceIdCache = new Map<string, string>();

  constructor(options?: AtlassianClientOptions) {
    this.accessToken = options?.accessToken;
  }

  withToken(accessToken: string): AtlassianClient {
    const c = new AtlassianClient({ accessToken });
    c.cloudId = this.cloudId;
    c.spaceIdCache = this.spaceIdCache;
    return c;
  }

  private async ensureCloudId(): Promise<string> {
    if (this.cloudId) return this.cloudId;
    if (!this.accessToken) {
      throw new Error(
        "Atlassian is not connected. Please connect from the dashboard."
      );
    }

    const res = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error(
        `Failed to resolve Atlassian cloud ID: ${res.status} ${res.statusText}`
      );
    }

    const sites = (await res.json()) as Array<{ id: string; url: string; name: string }>;
    if (sites.length === 0) {
      throw new Error(
        "No Atlassian sites found for this account. Ensure your OAuth app has the correct scopes."
      );
    }

    // Use the first accessible site
    this.cloudId = sites[0].id;
    return this.cloudId;
  }

  private headers(): Record<string, string> {
    if (!this.accessToken) {
      throw new Error(
        "Atlassian is not connected. Please connect from the dashboard."
      );
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // ── Jira helpers ──────────────────────────────────────────────

  async jiraGet(path: string): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira GET ${path} failed (${res.status}): ${body}`);
    }
    return res.json();
  }

  async jiraPost(path: string, body: unknown): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira POST ${path} failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async jiraPut(path: string, body: unknown): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira PUT ${path} failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async jiraDelete(path: string): Promise<void> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira DELETE ${path} failed (${res.status}): ${text}`);
    }
  }

  // ── Confluence v2 helpers (wiki/api/v2) ───────────────────────

  async confluenceV2Get(path: string): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2${path}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Confluence v2 GET ${path} failed (${res.status}): ${body}`
      );
    }
    return res.json();
  }

  async confluenceV2Post(path: string, body: unknown): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Confluence v2 POST ${path} failed (${res.status}): ${text}`
      );
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async confluenceV2Put(path: string, body: unknown): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Confluence v2 PUT ${path} failed (${res.status}): ${text}`
      );
    }
    return res.json();
  }

  async confluenceV2Delete(path: string): Promise<void> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Confluence v2 DELETE ${path} failed (${res.status}): ${text}`
      );
    }
  }

  // Resolve a human-readable space key (e.g. "ENG") to the numeric space ID
  // that v2 endpoints require. Cached because the mapping is stable per cloud.
  async getSpaceIdByKey(spaceKey: string): Promise<string> {
    const cached = this.spaceIdCache.get(spaceKey);
    if (cached) return cached;

    const data = (await this.confluenceV2Get(
      `/spaces?keys=${encodeURIComponent(spaceKey)}`,
    )) as { results?: Array<{ id: string; key: string }> };

    const found = data.results?.find((s) => s.key === spaceKey) ?? data.results?.[0];
    if (!found) {
      throw new Error(`Confluence space with key '${spaceKey}' not found.`);
    }

    this.spaceIdCache.set(spaceKey, found.id);
    return found.id;
  }

  // ── Confluence v1 helpers (wiki/rest/api) ─────────────────────
  // Retained only for CQL search, which has no v2 equivalent.

  async confluenceV1Get(path: string): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api${path}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Confluence v1 GET ${path} failed (${res.status}): ${body}`
      );
    }
    return res.json();
  }
}
