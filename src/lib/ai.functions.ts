import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  action: z.enum(["reply", "summarize", "translate", "assistant", "rewrite"]),
  transcript: z.string().max(12000).default(""),
  prompt: z.string().max(4000).default(""),
  language: z.string().max(40).default("English"),
});

const systemFor = (action: string, language: string) => {
  switch (action) {
    case "reply":
      return "You suggest exactly 3 short, natural chat replies for the last message in the conversation. Return them as a plain list, one per line, no numbering, no quotes, max 8 words each.";
    case "summarize":
      return "You summarise a chat conversation into 3-5 crisp bullet points covering decisions, questions and action items. Use markdown bullets.";
    case "translate":
      return `You translate the user's text into ${language}. Return only the translation, nothing else.`;
    case "rewrite":
      return "You rewrite the user's draft message so it is clearer, warmer and well punctuated. Return only the rewritten message.";
    default:
      return "You are Bhek AI, the built-in assistant inside the BhekConnect messenger. Be concise, friendly and practical. Use markdown sparingly.";
  }
};

export const askAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const userContent =
      data.action === "assistant" || data.action === "translate" || data.action === "rewrite"
        ? data.prompt
        : `Conversation:\n${data.transcript}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: systemFor(data.action, data.language) },
          { role: "user", content: userContent || "Say hello and offer help." },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Too many AI requests right now — try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to keep using Bhek AI.");
    if (!res.ok) throw new Error("Bhek AI could not respond right now.");

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  });
