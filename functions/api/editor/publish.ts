import { currentSession, isSameOriginMutation, json, readJson, type PagesContext } from "../../_shared/server";

const OWNER = "Chillbroz005";
const REPOSITORY = "portfolio";
const BRANCH = "main";
const ALLOWED_PATHS = new Set(["src/data/profile.ts", "public/resume.pdf", "public/profile-photo.png"]);
const MAX_FILE_BASE64_LENGTH = 7_000_000;

type PublishBody = {
  files?: Array<{ path?: unknown; contentBase64?: unknown }>;
};

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await currentSession(request, env)) return json({ error: "Sign in again to publish changes." }, 401);
  if (!env.GITHUB_CONTENTS_TOKEN) return json({ error: "GitHub publishing is not configured in Cloudflare." }, 503);

  const body = await readJson<PublishBody>(request, 8_000_000);
  if (!Array.isArray(body?.files) || body.files.length < 2 || body.files.length > 3) return json({ error: "The publish request is invalid." }, 400);
  const paths = new Set<string>();
  for (const file of body.files) {
    if (typeof file.path !== "string" || !ALLOWED_PATHS.has(file.path) || paths.has(file.path)) return json({ error: "The publish request contains an unsupported file path." }, 400);
    if (typeof file.contentBase64 !== "string" || file.contentBase64.length === 0 || file.contentBase64.length > MAX_FILE_BASE64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.contentBase64)) {
      return json({ error: "The publish request contains an invalid or oversized file." }, 400);
    }
    paths.add(file.path);
  }
  if (!paths.has("src/data/profile.ts") || !paths.has("public/resume.pdf")) return json({ error: "The profile and resume must be published together." }, 400);

  const apiBase = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_CONTENTS_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
  const apiRequest = async (endpoint: string, method = "GET", payload?: Record<string, unknown>) => {
    const response = await fetch(`${apiBase}/${endpoint}`, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const result = await response.json().catch(() => ({})) as Record<string, any>;
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) throw new Error("GitHub changed while publishing. Reload the page and try again.");
      if (response.status === 401 || response.status === 403) throw new Error("The Cloudflare GitHub token is invalid or lacks repository Contents write permission.");
      throw new Error("GitHub could not save the portfolio update.");
    }
    return result;
  };

  try {
    const branchRef = await apiRequest(`git/ref/heads/${BRANCH}`);
    const parentCommit = await apiRequest(`git/commits/${branchRef.object.sha}`);
    const blobs = await Promise.all(body.files.map(async file => {
      const blob = await apiRequest("git/blobs", "POST", { content: file.contentBase64, encoding: "base64" });
      return { path: file.path as string, mode: "100644", type: "blob", sha: blob.sha };
    }));
    const tree = await apiRequest("git/trees", "POST", { base_tree: parentCommit.tree.sha, tree: blobs });
    const commit = await apiRequest("git/commits", "POST", {
      message: "Publish portfolio profile and synchronized resume",
      tree: tree.sha,
      parents: [branchRef.object.sha]
    });
    await apiRequest(`git/refs/heads/${BRANCH}`, "PATCH", { sha: commit.sha, force: false });
    return json({ published: true, commit: commit.sha });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub could not save the portfolio update.";
    return json({ error: message }, 502);
  }
}
