import { createServerFn } from "@tanstack/react-start";
import { attachFirebaseAuth } from "@/integrations/firebase/auth-attacher";
import { db } from "@/integrations/firebase/client.server";
import { z } from "zod";
import { collection, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc } from "firebase/firestore";

export const listChatMessages = createServerFn({ method: "POST" })
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contract_id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { user } = context;
    if (!user) throw new Error("Not authenticated");

    const q = query(
      collection(db, `contracts/${data.contract_id}/chat_messages`),
      orderBy("created_at", "asc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      role: doc.data().role,
      content: doc.data().content,
      created_at: doc.data().created_at,
    }));
  });

export const askContract = createServerFn({ method: "POST" })
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contract_id: z.string(),
        question: z.string().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { user } = context;
    if (!user) throw new Error("Not authenticated");

    // Ownership check + gather context.
    const contractRef = doc(db, "contracts", data.contract_id);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) throw new Error("Contract not found");
    const contract = contractSnap.data();
    if (contract.user_id !== user.id) throw new Error("Forbidden");

    // Get related data
    const [extractionSnap, synthesisSnap, risksSnap, historySnap] = await Promise.all([
      getDoc(doc(db, `contracts/${data.contract_id}/extractions`, "latest")),
      getDoc(doc(db, `contracts/${data.contract_id}/synthesis`, "latest")),
      getDocs(collection(db, `contracts/${data.contract_id}/risks`)),
      getDocs(query(
        collection(db, `contracts/${data.contract_id}/chat_messages`),
        orderBy("created_at", "asc"),
        limit(20)
      )),
    ]);

    const extraction = extractionSnap.exists() ? extractionSnap.data() : null;
    const synthesis = synthesisSnap.exists() ? synthesisSnap.data() : null;
    const risks = risksSnap.docs.map(doc => doc.data());
    const history = historySnap.docs.map(doc => ({
      role: doc.data().role,
      content: doc.data().content,
    }));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    // Persist the user message immediately so it shows up if the model call fails.
    await addDoc(collection(db, `contracts/${data.contract_id}/chat_messages`), {
      contract_id: data.contract_id,
      user_id: user.id,
      role: "user",
      content: data.question,
      created_at: new Date().toISOString(),
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

    const priorMessages = history.map((m) => ({
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

    await addDoc(collection(db, `contracts/${data.contract_id}/chat_messages`), {
      contract_id: data.contract_id,
      user_id: user.id,
      role: "assistant",
      content: answer,
      created_at: new Date().toISOString(),
    });

    return { answer };
  });
