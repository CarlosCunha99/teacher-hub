import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teacher Hub",
  description: "A platform for teachers to share and discover classroom resources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* TODO(auth): mount <NotificationBadge> once issue #2 lands */}
        {children}
      </body>
    </html>
  );
}
