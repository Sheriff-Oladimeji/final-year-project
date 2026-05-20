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

interface RawSegment {
  text: unknown;
  offset?: unknown;
  start?: unknown;
  duration?: unknown;
}

interface RapidApiResponse {
  success?: boolean;
  transcript?: RawSegment[];
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) return videoId;
    const data = await res.json() as { title?: string };
    return data.title?.trim() || videoId;
  } catch {
    return videoId;
  }
}

async function fetchRawTranscript(videoId: string, apiKey: string): Promise<RawSegment[]> {
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

  const data = await res.json() as RapidApiResponse | RawSegment[];
  return Array.isArray(data) ? data : (data as RapidApiResponse).transcript ?? [];
}

export async function fetchTranscript(url: string): Promise<{ videoId: string; title: string; text: string }> {
  const videoId = extractVideoId(url);
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY is not configured.");

  // Fetch title and transcript in parallel
  const [title, segments] = await Promise.all([
    fetchVideoTitle(videoId),
    fetchRawTranscript(videoId, apiKey),
  ]);

  if (segments.length === 0) {
    throw new Error(
      `No transcript available for video ${videoId}. Captions may be disabled on this video.`,
    );
  }

  const parts = segments.map((seg) => {
    const rawOffset = seg.start ?? seg.offset ?? 0;
    const seconds = typeof rawOffset === "string" ? parseFloat(rawOffset) : Number(rawOffset);
    const timestamp = secondsToMmss(isNaN(seconds) ? 0 : seconds);
    const text = String(seg.text ?? "").trim().replace(/\n/g, " ");
    return `${timestamp} ${text}`;
  });

  return { videoId, title, text: parts.join(" ") };
}
