import {
  Codex,
  type CodexOptions,
  type Thread,
  type ThreadOptions,
} from "@openai/codex-sdk";

let codexClient: Codex | undefined;

export function startCodexThread(
  overrides: Partial<ThreadOptions> = {},
  options?: { config?: CodexOptions["config"] },
): Thread {
  const client = options?.config
    ? new Codex({ config: options.config })
    : getCodexClient();

  return client.startThread({
    ...buildThreadOptions(),
    ...overrides,
  });
}

function getCodexClient(): Codex {
  if (!codexClient) {
    codexClient = new Codex();
  }
  return codexClient;
}

function buildThreadOptions(): ThreadOptions {
  return {
    model: "gpt-5.4-mini",
    approvalPolicy: "never",
    sandboxMode: "read-only",
    skipGitRepoCheck: true,
    webSearchMode: "disabled",
    workingDirectory: process.cwd(),
  };
}
