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

interface TranscriptSegment {
  text: string;
  start?: number;
  offset?: number;
  duration?: number;
}

export async function fetchTranscript(url: string): Promise<{ videoId: string; text: string }> {
  const videoId = extractVideoId(url);
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY is not configured.");

  const res = await fetch(
    `https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${videoId}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "youtube-transcript3.p.rapidapi.com",
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Transcript API returned ${res.status} for video ${videoId}.`);
  }

  const data = await res.json() as TranscriptSegment[] | { transcript: TranscriptSegment[] };

  // API returns either a plain array or { transcript: [...] }
  const segments: TranscriptSegment[] = Array.isArray(data) ? data : data.transcript ?? [];

  if (segments.length === 0) {
    throw new Error(`No transcript available for video ${videoId}. It may be disabled or unavailable.`);
  }

  const parts = segments.map((seg) => {
    const seconds = seg.start ?? seg.offset ?? 0;
    const timestamp = secondsToMmss(seconds);
    const text = seg.text.trim().replace(/\n/g, " ");
    return `${timestamp} ${text}`;
  });

  return { videoId, text: parts.join(" ") };
}
