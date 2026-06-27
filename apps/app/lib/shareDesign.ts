// Hands a composed share-card image off to the OS. On mobile this opens the
// native share sheet (Web Share API L2, files) so the customer picks Instagram /
// WhatsApp / Stories themselves — we never post on their behalf. Where file
// sharing isn't supported (most desktops), we fall back to a download.

export type ShareResult = "shared" | "downloaded" | "cancelled";

export async function shareOrDownload(
  blob: Blob,
  opts: { filename: string; text?: string; url?: string }
): Promise<ShareResult> {
  const file = new File([blob], opts.filename, { type: blob.type || "image/png" });

  // Web Share API with files — mobile Safari/Chrome. canShare gates support.
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: opts.text, url: opts.url });
      return "shared";
    } catch (err) {
      // User dismissed the sheet — not an error worth surfacing.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other share failure: fall through to download.
    }
  }

  // Fallback: trigger a download.
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return "downloaded";
}
