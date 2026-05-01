import { YoutubeTranscript } from "youtube-transcript";

const WATCH_RE = /[?&]v=([A-Za-z0-9_-]{11})/;
const SHORT_RE = /youtu\.be\/([A-Za-z0-9_-]{11})/;

export function extractVideoId(url: string): string {
  const watchMatch = WATCH_RE.exec(url);
  if (watchMatch) return watchMatch[1];

  const shortMatch = SHORT_RE.exec(url);
  if (shortMatch) return shortMatch[1];

  throw new Error(
    "Could not extract a YouTube video ID from that URL. " +
      "Supported formats: youtube.com/watch?v=... or youtu.be/...",
  );
}

function secondsToMmss(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
}

export async function fetchTranscript(url: string): Promise<{ videoId: string; text: string }> {
  const videoId = extractVideoId(url);

  let entries: { text: string; offset: number; duration: number }[];
  try {
    entries = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch transcript for video ${videoId}: ${msg}`);
  }

  const parts = entries.map((e) => {
    const timestamp = secondsToMmss(e.offset / 1000);
    const text = e.text.trim().replace(/\n/g, " ");
    return `${timestamp} ${text}`;
  });

  return { videoId, text: parts.join(" ") };
}
