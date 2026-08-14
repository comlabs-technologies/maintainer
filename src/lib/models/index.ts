import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { CodingModel, MigrationContext } from "@/lib/models/types";
import type { GeneratedPatch } from "@/lib/domain";
import { RuleBasedCodingModel } from "@/lib/models/rule-based";

type ChatMessage = { role: "system" | "user"; content: string };

async function completeChat(messages: ChatMessage[]): Promise<string> {
  const env = getEnv();
  const provider = env.LLM_PROVIDER ?? "openai";
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL ?? "claude-sonnet-4-5",
        max_tokens: 8000,
        system: messages.find((message) => message.role === "system")?.content,
        messages: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({ role: "user", content: message.content })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }
    const json = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    return json.content?.[0]?.text ?? "";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL ?? "gpt-4.1",
      temperature: 0,
      messages,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): GeneratedPatch {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const parsed = JSON.parse(raw) as GeneratedPatch;
  if (!Array.isArray(parsed.files)) {
    throw new Error("Model response did not include files");
  }
  return {
    files: parsed.files,
    notes: parsed.notes ?? "",
  };
}

export class LlmCodingModel implements CodingModel {
  async generatePatch(context: MigrationContext): Promise<GeneratedPatch> {
    const fallback = new RuleBasedCodingModel();
    try {
      const prompt = [
        `Provider: ${context.provider.displayName} (${context.packageName})`,
        `Upgrade: ${context.fromVersion} → ${context.toVersion}`,
        context.change
          ? `Change: ${context.change.description}\nInstructions: ${context.change.migrationInstructions}\nSymbols: ${context.change.affectedSymbols.join(", ")}`
          : "No catalogued API change. Upgrade the package and update call sites if the new types require it.",
        "Return JSON only: { files: [{ path, action: \"update\"|\"create\"|\"delete\", content? }], notes: string }",
        "Only include files you change. Do not invent files. Do not wrap in markdown except a json fence.",
        "Affected files:",
        ...context.files.map(
          (file) => `--- ${file.path}\n${file.content}`,
        ),
        "package.json:",
        context.packageJson,
      ].join("\n\n");

      const text = await completeChat([
        {
          role: "system",
          content:
            "You generate candidate source patches for TypeScript SDK migrations. Verification, not this patch, determines success. Preserve existing behavior except for the required SDK migration.",
        },
        { role: "user", content: prompt },
      ]);
      return extractJson(text);
    } catch (error) {
      logger.warn("llm_patch_failed_using_rules", {
        error: error instanceof Error ? error.message : "unknown",
        provider: context.provider.id,
      });
      return fallback.generatePatch(context);
    }
  }
}

export function getCodingModel(): CodingModel {
  return getEnv().LLM_API_KEY ? new LlmCodingModel() : new RuleBasedCodingModel();
}
