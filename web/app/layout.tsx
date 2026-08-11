import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  title: {
    default: "ExamPath — Indian Government Exams, Dates & Official Sources",
    template: "%s | ExamPath",
  },
  description: "Discover Indian government exams, deadlines, vacancies, eligibility and results. ExamPath links important information to official sources and clearly marks what has been verified.",
  applicationName: "ExamPath",
  keywords: ["government exams", "Sarkari exams", "SSC", "UPSC", "IBPS", "RRB", "exam dates", "government job exams"],
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  openGraph: {
    title: "ExamPath — Indian Government Exams, Dates & Official Sources",
    description: "Find exam dates, vacancies and eligibility, then verify against the official notification.",
    type: "website",
    siteName: "ExamPath",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main id="app">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
