/**
 * NUST NEXUS — Storj Delete Edge Function
 * Uses native fetch + AWS Signature V4 (no npm packages) for maximum reliability.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── AWS Signature V4 helpers ────────────────────────────────────────────────

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function sha256(data: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function signRequest(params: {
  method: string;
  host: string;
  path: string;
  body: Uint8Array;
  contentType: string;
  accessKey: string;
  secretKey: string;
  region: string;
  service: string;
}): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256(params.body);

  const headers: Record<string, string> = {
    host: params.host,
    "content-type": params.contentType,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  // Canonical headers (sorted)
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    params.method,
    params.path,
    "", // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest))),
  ].join("\n");

  // Signing key
  const kDate = await hmac(new TextEncoder().encode("AWS4" + params.secretKey), dateStamp);
  const kRegion = await hmac(kDate, params.region);
  const kService = await hmac(kRegion, params.service);
  const kSigning = await hmac(kService, "aws4_request");

  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${params.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    Authorization: authorization,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { path } = await req.json() as { path?: string };
    if (!path || typeof path !== "string") {
      return new Response(JSON.stringify({ error: "path required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const safePrefix = `uploads/${user.id}/`;
    if (!path.startsWith(safePrefix) || path.includes("..")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const bucket = Deno.env.get("STORJ_BUCKET") || "nust-nexus-uploads";
    const endpoint = Deno.env.get("STORJ_ENDPOINT") || "https://gateway.storjshare.io";
    const accessKey = Deno.env.get("STORJ_ACCESS_KEY");
    const secretKey = Deno.env.get("STORJ_SECRET_KEY");

    if (!accessKey || !secretKey) {
      return new Response(JSON.stringify({ error: "Storage not configured on server" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Extraction host from url
    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const s3Path = `/${bucket}/${path}`;
    const emptyBody = new Uint8Array(0);

    const signedHeaders = await signRequest({
      method: "DELETE",
      host,
      path: s3Path,
      body: emptyBody,
      contentType: "application/octet-stream", // or leave empty for delete
      accessKey,
      secretKey,
      region: "us-east-1",
      service: "s3",
    });

    const deleteUrl = `${endpoint}/${bucket}/${path}`;
    const deleteRes = await fetch(deleteUrl, {
      method: "DELETE",
      headers: signedHeaders,
    });

    if (!deleteRes.ok && deleteRes.status !== 204) {
      const errText = await deleteRes.text().catch(() => "");
      console.error("storj-delete failed:", deleteRes.status, errText);
      return new Response(JSON.stringify({ error: `Delete failed: ${deleteRes.status}` }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storj-delete:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Delete failed" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
