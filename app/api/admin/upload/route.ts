import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/auth";

// Issues client-upload tokens so audio goes straight from the browser to Vercel Blob
// (bypasses the serverless body-size limit). Pathnames are randomised by the client.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as HandleUploadBody;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("upload: BLOB_READ_WRITE_TOKEN is not set");
    return NextResponse.json({ error: "Blob storage is not connected: BLOB_READ_WRITE_TOKEN is missing. In Vercel open Storage, create or connect a Blob store to this project, then redeploy." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/webm"],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      // No onUploadCompleted: the webhook has no admin cookie, and the client registers the clip itself.
    });
    return NextResponse.json(json);
  } catch (e) {
    console.error("upload token error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
