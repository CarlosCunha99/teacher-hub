import type { Metadata } from "next";
import DownloadQuotaIndicator from "@/components/DownloadQuotaIndicator";

export const metadata: Metadata = {
  title: "Teacher Hub",
  description: "A platform for teachers to share and discover classroom resources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DownloadQuotaIndicator />
        {children}
      </body>
    </html>
  );
}
