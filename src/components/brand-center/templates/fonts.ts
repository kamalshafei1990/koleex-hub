/* The brand's Arabic face for the templates (book ch. 50: Noto Sans Arabic),
   self-hosted by next/font — no Google request from the reader's browser,
   which matters in China. Latin is the Hub's Inter; Chinese uses the book's
   own stack (PingFang SC / Noto Sans SC), as the book does. The unicode-range
   split means a card downloads Arabic only when it shows Arabic. */

import { Noto_Sans_Arabic } from "next/font/google";

export const cardArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["300", "400", "600"], display: "swap", variable: "--font-bc-ar" });
