import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  metadataBase: new URL("https://exampath.example"),
  title: "ExamPath — Every government exam. Every date. One place.",
  description:
    "Track every Indian government exam (SSC, UPSC, IBPS, RRB, state PSCs) — notifications, deadlines, vacancies, eligibility and results, compiled from official sources.",
  applicationName: "ExamPath",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "ExamPath — Every government exam. Every date. One place.",
    description:
      "Notifications, deadlines, vacancies, eligibility and results for Indian government exams — always current.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
