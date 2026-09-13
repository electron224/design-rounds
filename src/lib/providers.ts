export interface ProviderModel {
  id: string;
  label: string;
}

export interface LlmProvider {
  id: string;
  label: string;
  /** Fixed server-side endpoint — clients pick an id, never a URL (no SSRF). */
  baseUrl: string;
  keyUrl: string;
  keyHint: string;
  models: ProviderModel[];
  defaultModel: string;
}

/**
 * Providers a candidate can bring a key for. All speak OpenAI-compatible
 * chat-completions with Bearer auth, so one client serves all of them.
 * (Anthropic-native and other shapes are out — use OpenRouter for Claude.)
 */
export const LLM_PROVIDERS: LlmProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini (cheap, recommended)" },
      { id: "gpt-4o", label: "gpt-4o (stronger, pricier)" }
    ],
    defaultModel: "gpt-4o-mini"
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza… (free tier works)",
    models: [
      { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite (fastest, recommended)" },
      { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
      { id: "gemini-3.5-flash", label: "gemini-3.5-flash (stronger)" }
    ],
    defaultModel: "gemini-3.5-flash-lite"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-…",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini via OpenRouter" },
      { id: "google/gemini-3.5-flash-lite", label: "Gemini Flash-Lite via OpenRouter" }
    ],
    defaultModel: "openai/gpt-4o-mini"
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk-… (generous free tier)",
    models: [
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (fast)" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (stronger)" }
    ],
    defaultModel: "llama-3.1-8b-instant"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "sk-…",
    models: [{ id: "deepseek-chat", label: "deepseek-chat" }],
    defaultModel: "deepseek-chat"
  }
];

export function providerById(id: string): LlmProvider | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

/** Model ids are opaque strings to trusted hosts — but still charset-capped. */
export const MODEL_ID_RE = /^[A-Za-z0-9._\-/:]{1,100}$/;

export function isValidModel(model: string): boolean {
  return MODEL_ID_RE.test(model.trim());
}
