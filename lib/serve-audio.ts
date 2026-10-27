/** Serves a buffer with HTTP Range support. Safari/iOS will not play media without 206 responses. */
const CHUNK = 1024 * 1024; // cap each ranged response at 1 MB (Vercel limits response size)

export function serveAudio(buf: Buffer, rangeHeader: string | null): Response {
  const size = buf.length;
  const base = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (!rangeHeader) {
    return new Response(new Uint8Array(buf), { status: 200, headers: { ...base, "Content-Length": String(size) } });
  }
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }
  let start: number;
  let end: number;
  if (m[1] === "") {
    // suffix range: last N bytes
    const n = Number(m[2]);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Number(m[2]);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1, start + CHUNK - 1);
  const slice = buf.subarray(start, end + 1);
  return new Response(new Uint8Array(slice), {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(slice.length) },
  });
}
