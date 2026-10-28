import { ImageResponse } from "next/og";

// Browser-tab icon: the red square from the wordmark on paper.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2ede2" }}>
        <div style={{ width: 18, height: 18, background: "#b5321a" }} />
      </div>
    ),
    size,
  );
}
