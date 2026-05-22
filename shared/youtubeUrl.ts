/** True if URL is http(s) with a supported YouTube host. */
export function isAllowedYoutubeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  return (
    h === "youtube.com" ||
    h === "www.youtube.com" ||
    h === "m.youtube.com" ||
    h === "youtu.be" ||
    h === "www.youtube-nocookie.com"
  );
}
