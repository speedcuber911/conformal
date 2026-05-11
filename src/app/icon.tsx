import { ImageResponse } from "next/og";
import { ConformalMark } from "@/components/brand/ConformalMark";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <ConformalMark size={32} />,
    size,
  );
}
