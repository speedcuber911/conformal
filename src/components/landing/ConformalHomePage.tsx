import { Lexend, Roboto_Serif } from "next/font/google";
import { ConformalHomePageClient } from "./ConformalHomePageClient";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--conformal-font-lexend",
  display: "swap",
});

const robotoSerif = Roboto_Serif({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--conformal-font-roboto-serif",
  display: "swap",
});

export function ConformalHomePage() {
  return (
    <ConformalHomePageClient
      fontClassName={`${lexend.variable} ${robotoSerif.variable}`}
    />
  );
}
