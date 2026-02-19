/**
 * Tests for inference response validation in chatViaOpenAiCompatible
 * and chatViaAnthropic — specifically the 200-with-error-body patterns
 * that would previously crash the agent loop with a TypeError.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Hoisted mock state ────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("node:fetch", () => ({ default: mockFetch }));

// Replace the global fetch used by inference.ts
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ──────────────────────────────────────────────────

import { createInferenceClient } from "../../agent-client/inference.js";

function makeClient(backend: "openai" | "anthropic" = "openai") {
  return createInferenceClient({
    defaultModel: backend === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o",
    maxTokens: 1024,
    anthropicApiKey: backend === "anthropic" ? "sk-ant-test" : undefined,
    openaiApiKey: backend === "openai" ? "sk-test" : undefined,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

const GOOD_OPENAI_RESPONSE = {
  id: "chatcmpl-test",
  model: "gpt-4o",
  choices: [
    {
      finish_reason: "stop",
      message: { role: "assistant", content: "Hello!" },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const GOOD_ANTHROPIC_RESPONSE = {
  id: "msg-test",
  type: "message",
  model: "claude-sonnet-4-6",
  content: [{ type: "text", text: "Hello!" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 5 },
};

const MESSAGES = [{ role: "user" as const, content: "Hi" }];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── OpenAI path ──────────────────────────────────────────────

describe("chatViaOpenAiCompatible – happy path", () => {
  it("parses a well-formed response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(GOOD_OPENAI_RESPONSE));
    const client = makeClient("openai");
    const resp = await client.chat(MESSAGES);
    expect(resp.message.content).toBe("Hello!");
    expect(resp.message.role).toBe("assistant");
    expect(resp.usage.promptTokens).toBe(10);
  });
});

describe("chatViaOpenAiCompatible – malformed 200 responses", () => {
  it("throws on non-JSON body (e.g. nginx error page)", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("<html>Bad Gateway</html>"));
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/non-JSON/i);
  });

  it("throws on top-level error object (some proxy providers)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Rate limit exceeded", type: "rate_limit_error" } }),
    );
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("throws when choices array is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "x", choices: [], usage: {} }),
    );
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/No completion choice/i);
  });

  it("throws when choices is missing entirely", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "x", object: "chat.completion" }),
    );
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/No completion choice/i);
  });

  it("throws when choice has no message field (finish_reason: error pattern)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "x",
        choices: [{ finish_reason: "error", error: "upstream failure" }],
        usage: {},
      }),
    );
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/no valid message field/i);
  });

  it("throws when message exists but role is missing", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "x",
        choices: [{ finish_reason: "stop", message: { content: "hi" } }],
        usage: {},
      }),
    );
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/no valid message field/i);
  });

  it("throws on non-200 with error body", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Unauthorized", 401));
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/401/);
  });
});

// ─── Anthropic path ───────────────────────────────────────────

describe("chatViaAnthropic – happy path", () => {
  it("parses a well-formed response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(GOOD_ANTHROPIC_RESPONSE));
    const client = makeClient("anthropic");
    const resp = await client.chat(MESSAGES);
    expect(resp.message.content).toBe("Hello!");
    expect(resp.finishReason).toBe("end_turn"); // Anthropic passes end_turn through unchanged
  });
});

describe("chatViaAnthropic – malformed 200 responses", () => {
  it("throws on non-JSON body", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Service Unavailable"));
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/non-JSON/i);
  });

  it("throws on type=error response from Anthropic-compatible proxy", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
    );
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/Overloaded/);
  });

  it("throws when content array is empty and no tool calls", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "msg-x",
        type: "message",
        model: "claude-sonnet-4-6",
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 0 },
      }),
    );
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/No completion content/i);
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Too Many Requests", 429));
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES)).rejects.toThrow(/429/);
  });
});

// ─── Timeout handling ─────────────────────────────────────────

describe("timeout – OpenAI path", () => {
  it("wraps TimeoutError with a clear message including model name", async () => {
    const timeoutErr = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    mockFetch.mockRejectedValueOnce(timeoutErr);
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES, { timeoutMs: 5000 })).rejects.toThrow(
      /timed out after 5000ms.*gpt-4o/i,
    );
  });

  it("wraps AbortError with a clear message (older Node versions)", async () => {
    const abortErr = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });
    mockFetch.mockRejectedValueOnce(abortErr);
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES, { timeoutMs: 1000 })).rejects.toThrow(
      /timed out after 1000ms/i,
    );
  });

  it("re-throws non-timeout errors unchanged", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const client = makeClient("openai");
    await expect(client.chat(MESSAGES)).rejects.toThrow("ECONNREFUSED");
  });

  it("uses requestTimeoutMs default when no per-call timeoutMs given", async () => {
    const timeoutErr = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    mockFetch.mockRejectedValueOnce(timeoutErr);
    const client = createInferenceClient({
      defaultModel: "gpt-4o",
      maxTokens: 1024,
      openaiApiKey: "sk-test",
      requestTimeoutMs: 30_000,
    });
    await expect(client.chat(MESSAGES)).rejects.toThrow(/timed out after 30000ms/i);
  });
});

describe("timeout – Anthropic path", () => {
  it("wraps TimeoutError with a clear message including model name", async () => {
    const timeoutErr = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    mockFetch.mockRejectedValueOnce(timeoutErr);
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES, { timeoutMs: 8000 })).rejects.toThrow(
      /timed out after 8000ms.*claude-sonnet-4-6/i,
    );
  });

  it("re-throws non-timeout errors unchanged", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    const client = makeClient("anthropic");
    await expect(client.chat(MESSAGES)).rejects.toThrow("ETIMEDOUT");
  });
});
