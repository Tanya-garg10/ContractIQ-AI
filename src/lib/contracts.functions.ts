import { createServerFn } from "@tanstack/react-start";
import { attachFirebaseAuth } from "@/integrations/firebase/auth-attacher";
import { db, storage } from "@/integrations/firebase/client.server";
import { z } from "zod";
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, getDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

/**
 * Register a newly uploaded contract (after the client uploads the file to
 * storage) and kick off a multi-agent analysis run.
 */
export const registerContract = createServerFn({ method: "POST" })
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) => z.object({
    filename: z.string().min(1).max(255),
    storage_path: z.string().min(1),
    mime: z.string().min(1),
    size: z.number().int().positive().max(20 * 1024 * 1024),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { user } = context;
    if (!user) throw new Error("Not authenticated");

    const contractRef = await addDoc(collection(db, "contracts"), {
      user_id: user.id,
      filename: data.filename,
      storage_path: data.storage_path,
      mime: data.mime,
      size: data.size,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      risk_counts: { high: 0, medium: 0, low: 0 },
    });

    return { contract_id: contractRef.id };
  });


export const listContracts = createServerFn({ method: "GET" })
  .middleware([attachFirebaseAuth])
  .handler(async ({ context }) => {
    const { user } = context;
    if (!user) throw new Error("Not authenticated");

    const q = query(
      collection(db, "contracts"),
      where("user_id", "==", user.id),
      orderBy("created_at", "desc")
    );
    
    const snapshot = await getDocs(q);
    const contracts = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // Get related subcollections
      const risksSnapshot = await getDocs(collection(db, `contracts/${doc.id}/risks`));
      const risks = risksSnapshot.docs.map(d => d.data());
      
      const synthesisSnapshot = await getDocs(collection(db, `contracts/${doc.id}/synthesis`));
      const synthesis = synthesisSnapshot.docs[0]?.data();
      
      const extractionsSnapshot = await getDocs(collection(db, `contracts/${doc.id}/extractions`));
      const extractions = extractionsSnapshot.docs[0]?.data();

      const counts = { high: 0, medium: 0, low: 0 };
      for (const r of risks) {
        const s = (r.severity ?? "").toLowerCase();
        if (s === "high") counts.high++;
        else if (s === "medium") counts.medium++;
        else if (s === "low") counts.low++;
      }

      const partiesRaw = extractions?.parties;
      const parties: string[] = Array.isArray(partiesRaw)
        ? partiesRaw.map((p: any) => (typeof p === "string" ? p : p?.name)).filter(Boolean)
        : [];

      return {
        id: doc.id,
        filename: data.filename,
        status: data.status,
        size: data.size,
        created_at: data.created_at,
        summary: synthesis?.summary ?? null,
        risk_counts: counts,
        parties,
        confidence: extractions?.confidence ?? null,
      };
    }));

    return contracts;
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([attachFirebaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { user } = context;
    if (!user) throw new Error("Not authenticated");

    // Grab storage path first so we can clean up the file.
    const contractRef = doc(db, "contracts", data.id);
    const contractSnap = await getDoc(contractRef);
    
    if (contractSnap.exists()) {
      const contractData = contractSnap.data();
      if (contractData.storage_path) {
        const storageRef = ref(storage, contractData.storage_path);
        await deleteObject(storageRef);
      }
    }
    
    await deleteDoc(contractRef);
    return { ok: true };
  });
