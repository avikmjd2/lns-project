/**
 * Vercel names the Blob token BLOB_READ_WRITE_TOKEN by default, but the store can be created with a
 * custom prefix (e.g. STORAGE_READ_WRITE_TOKEN). Accept either.
 */
export function getBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN") && process.env[k]);
  return key ? process.env[key] : undefined;
}
