import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Issues a short-lived, single-purpose token so the browser can upload a PDF
// straight to Vercel Blob. This bypasses the 4.5 MB Vercel function body limit:
// the file never passes through our server. We only hand out a scoped token,
// so the Gemini API key is never exposed to the client.
//
// Indexing into Gemini is NOT done here (the onUploadCompleted webhook needs a
// public URL and won't fire on localhost). Instead the client calls
// indexPdfFromBlobAction with the returned blob URL once the upload resolves.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session || session.user.disabledAt) {
          throw new Error("Unauthorised");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB cap
          addRandomSuffix: true,
        };
      },
      // No-op: indexing happens via indexPdfFromBlobAction, not this webhook.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[/api/blob-upload] failed:", error);
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[/api/blob-upload] BLOB_READ_WRITE_TOKEN is not set in this environment.");
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
