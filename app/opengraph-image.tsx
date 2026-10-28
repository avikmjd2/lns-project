import { ImageResponse } from "next/og";

// Link preview image shown by WhatsApp, Telegram, Slack, iMessage etc. Paper-and-ink to match the site.
export const alt = "Voices & Speaking Styles: a 5-minute anonymous listening study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const ink = "#1b1a17", paper = "#f2ede2", signal = "#b5321a", muted = "#6a6457";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: paper, color: ink, padding: "64px 80px", fontFamily: "serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 22, height: 22, background: signal }} />
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", fontFamily: "monospace" }}>Voices</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: -2, fontWeight: 600, display: "flex" }}>Help us understand how voices are heard.</div>
          <div style={{ marginTop: 36, fontSize: 36, color: muted, display: "flex" }}>Listen to 4 short clips and tell us what you think. About 5 minutes. Anonymous.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `3px solid ${ink}`, paddingTop: 24, fontSize: 26, fontFamily: "monospace", letterSpacing: 3, textTransform: "uppercase" }}>
          <div style={{ display: "flex" }}>A short listening study</div>
          <div style={{ display: "flex", color: signal }}>Tap the link to begin</div>
        </div>
      </div>
    ),
    size,
  );
}
