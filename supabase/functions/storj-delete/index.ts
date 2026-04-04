/**
 * Delete an object from Storj (S3-compatible). Same secrets as storj-upload.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.654.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
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
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { path } = await req.json() as { path?: string };
    if (!path || typeof path !== "string") {
      return new Response(JSON.stringify({ error: "path required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const safePrefix = `uploads/${user.id}/`;
    if (!path.startsWith(safePrefix) || path.includes("..")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const bucket = Deno.env.get("STORJ_BUCKET") || "nust-nexus-uploads";
    const endpoint = Deno.env.get("STORJ_ENDPOINT") || "https://gateway.storjshare.io";
    const accessKey = Deno.env.get("STORJ_ACCESS_KEY") || "jw2gzcvfqzjcldpdfgjl3tp2yvyq";
    const secretKey = Deno.env.get("STORJ_SECRET_KEY") || "j3sgl4z7j4xzu2tlrekhcaimxbpbrrhtidlnzszppl4lhrrqlhume";

    if (!accessKey || !secretKey) {
      return new Response(JSON.stringify({ error: "Storage not configured on server" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const s3 = new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      }),
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storj-delete:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Delete failed" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
