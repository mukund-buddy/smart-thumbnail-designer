/**
 * YouTube thumbnail fetching — no API key, no daily quota.
 *
 * YouTube stores every video's public thumbnails on its i.ytimg.com image
 * servers. We only need the 11-character video ID, then pick the best
 * quality that actually exists:
 *
 *   maxresdefault  1280x720+  (best, but missing on some older videos)
 *   hq720          1280x720   (common fallback)
 *   sddefault       640x480   (4:3 letterboxed — older videos)
 *   hqdefault       480x360   (always exists, lowest quality)
 */

const QUALITY_ORDER = ['maxresdefault', 'hq720', 'sddefault', 'hqdefault'] as const;

export interface FetchedThumbnail {
  videoId: string;
  dataUrl: string;
  quality: string;
}

/** Extracts an 11-char video ID from common YouTube URL shapes — or accepts a bare ID. */
export const parseVideoId = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;
  // Already just an ID?
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,                      // youtube.com/watch?v=ID&...
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,                 // youtu.be/ID
    /\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/  // /embed/ID, /shorts/ID, /live/ID
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('could not read image data'));
    reader.readAsDataURL(blob);
  });

const loadAsDataUrl = async (url: string): Promise<string> => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
};

/**
 * CORS-safe fallback. If a browser refuses to fetch i.ytimg.com directly,
 * we retry through the public images.weserv.nl image proxy (it only ever
 * sees the public thumbnail URL, not the user's content or keys).
 */
const proxied = (url: string): string =>
  `https://images.weserv.nl/?url=${encodeURIComponent(url.replace('https://', 'ssl:'))}`;

/**
 * Fetches the best available thumbnail for a video link.
 * Throws a readable error for bad links and unavailable videos.
 */
export const fetchThumbnailForVideo = async (videoUrl: string): Promise<FetchedThumbnail> => {
  const videoId = parseVideoId(videoUrl);
  if (!videoId) {
    throw new Error(
      'Could not read a video ID from that link. Paste a normal YouTube link (youtube.com/watch?v=…, youtu.be/…, /shorts/…) or the 11-character video ID.'
    );
  }

  let lastError: unknown = null;
  for (const quality of QUALITY_ORDER) {
    const direct = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
    for (const candidate of [direct, proxied(direct)]) {
      try {
        const dataUrl = await loadAsDataUrl(candidate);
        return { videoId, dataUrl, quality };
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw new Error(
    `Could not fetch a thumbnail for ${videoId} (${
      lastError instanceof Error ? lastError.message : 'network error'
    }). The video may be private, deleted, or region-locked.`
  );
};
