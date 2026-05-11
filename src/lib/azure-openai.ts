type AzureApiStyle = "responses" | "chat";

type AzureOpenAiConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiStyle: AzureApiStyle;
  apiVersion: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_CHAT_API_VERSION = "2024-10-21";
const DEFAULT_DEPLOYMENT = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 14_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1_200;

export function getAzureOpenAiConfig(): AzureOpenAiConfig | null {
  const endpoint = clean(process.env.AZURE_OPENAI_ENDPOINT ?? process.env.OPENAI_BASE_URL);
  const apiKey = clean(process.env.AZURE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY);
  if (!endpoint || !apiKey) return null;

  return {
    endpoint,
    apiKey,
    deployment:
      clean(process.env.AZURE_OPENAI_DEPLOYMENT) ??
      clean(process.env.AZURE_OPENAI_DEPLOYMENT_NAME) ??
      clean(process.env.AZURE_OPENAI_MODEL) ??
      clean(process.env.AZURE_OPENAI_GPT55_DEPLOYMENT) ??
      DEFAULT_DEPLOYMENT,
    apiStyle: clean(process.env.AZURE_OPENAI_API_STYLE) === "chat" ? "chat" : "responses",
    apiVersion: clean(process.env.AZURE_OPENAI_API_VERSION) ?? DEFAULT_CHAT_API_VERSION,
    timeoutMs: positiveInt(process.env.AZURE_OPENAI_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
    maxOutputTokens: positiveInt(process.env.AZURE_OPENAI_MAX_OUTPUT_TOKENS) ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };
}

export function isAzureOpenAiConfigured() {
  return getAzureOpenAiConfig() !== null;
}

export async function callAzureOpenAi(messages: ChatMessage[], signal?: AbortSignal) {
  const config = getAzureOpenAiConfig();
  if (!config) throw new Error("Azure OpenAI is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(urlForConfig(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify(bodyForConfig(config, messages)),
      signal: controller.signal,
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Azure OpenAI ${response.status}: ${truncate(rawText, 420)}`);
    }

    const payload = JSON.parse(rawText) as Record<string, unknown>;
    const text = config.apiStyle === "chat" ? textFromChatCompletion(payload) : textFromResponse(payload);
    if (!text) throw new Error("Azure OpenAI response did not include text output.");
    return text;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function bodyForConfig(config: AzureOpenAiConfig, messages: ChatMessage[]) {
  if (config.apiStyle === "chat") {
    return {
      model: usesV1Endpoint(config.endpoint) ? config.deployment : undefined,
      messages,
      max_completion_tokens: config.maxOutputTokens,
    };
  }

  return {
    model: config.deployment,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    max_output_tokens: config.maxOutputTokens,
  };
}

function urlForConfig(config: AzureOpenAiConfig) {
  const endpoint = config.endpoint.replace(/\/+$/, "");

  if (config.apiStyle === "chat") {
    if (usesV1Endpoint(endpoint)) return `${endpoint}/chat/completions`;
    if (endpoint.endsWith("/openai")) return `${endpoint}/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
    return `${endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
  }

  if (usesV1Endpoint(endpoint)) return `${endpoint}/responses`;
  if (endpoint.endsWith("/openai")) return `${endpoint}/v1/responses`;
  return `${endpoint}/openai/v1/responses`;
}

function usesV1Endpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "").endsWith("/openai/v1");
}

function textFromResponse(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const maybeText = part as { text?: unknown; type?: unknown };
      if (typeof maybeText.text === "string") return maybeText.text;
    }
  }

  return "";
}

function textFromChatCompletion(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  return typeof first?.message?.content === "string" ? first.message.content : "";
}

function clean(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
