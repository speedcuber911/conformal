import { ImageResponse } from "next/og";
import { ConformalMark } from "@/components/brand/ConformalMark";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <ConformalMark size={180} />,
    size,
  );
}
