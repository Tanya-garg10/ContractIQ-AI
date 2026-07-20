import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("contract_id", data.contract_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const askContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contract_id: z.string().uuid(),
        question: z.string().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check + gather context.
    const [{ data: contract }, { data: extraction }, { data: synthesis }, { data: risks }, { data: history }] =
      await Promise.all([
        supabase
          .from("contracts")
          .select("id, user_id, filename")
          .eq("id", data.contract_id)
          .maybeSingle(),
        supabase.from("extractions").select("*").eq("contract_id", data.contract_id).maybeSingle(),
        supabase.from("synthesis").select("*").eq("contract_id", data.contract_id).maybeSingle(),
        supabase.from("risks").select("severity, category, clause_text, explanation, recommendation").eq("contract_id", data.contract_id),
        supabase
          .from("chat_messages")
          .select("role, content")
          .eq("contract_id", data.contract_id)
          .order("created_at", { ascending: true })
          .limit(20),
      ]);

    if (!contract) throw new Error("Contract not found");
    if (contract.user_id !== userId) throw new Error("Forbidden");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    // Persist the user message immediately so it shows up if the model call fails.
    await supabase.from("chat_messages").insert({
      contract_id: data.contract_id,
      user_id: userId,
      role: "user",
      content: data.question,
    });

    const context_json = JSON.stringify(
      {
        filename: contract.filename,
        extraction,
        synthesis,
        risks,
      },
      null,
      2,
    ).slice(0, 60_000);

    const systemPrompt = `You are a legal contract assistant answering questions about a specific contract that has already been analyzed.

You have the following structured knowledge about the contract as JSON (extracted clauses, risks, and executive synthesis):

<contract_analysis>
${context_json}
</contract_analysis>

Rules:
- Answer strictly based on the analysis above. If the answer is not present, say so plainly and suggest what section of the contract to check.
- Be concise (2–5 sentences unless the user asks for detail). Use markdown for structure.
- Quote short clauses in italics when helpful.
- Never invent dates, amounts, or party names that are not in the analysis.`;

    const priorMessages = (history ?? []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...priorMessages,
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const msg =
        res.status === 429
          ? "AI rate limit reached. Please try again in a minute."
          : res.status === 402
            ? "AI credits exhausted for this workspace."
            : `AI gateway error ${res.status}: ${body.slice(0, 200)}`;
      throw new Error(msg);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer =
      payload.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate an answer. Please try rephrasing.";

    await supabase.from("chat_messages").insert({
      contract_id: data.contract_id,
      user_id: userId,
      role: "assistant",
      content: answer,
    });

    return { answer };
  });
