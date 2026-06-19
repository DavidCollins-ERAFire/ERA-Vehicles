import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "ERA Fleet Management",
  description: "Fleet service, scheduling, invoicing, and predictive maintenance.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#800020",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
