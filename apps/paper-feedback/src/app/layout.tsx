import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Paper Feedback | Hospital Workspace", description: "Staff review and import of paper patient feedback.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body><a href="#main" className="skip">Skip to content</a><header className="header"><div className="brand"><span aria-hidden className="monogram">H</span><div><strong>Paper Feedback</strong><span>Hospital staff workspace</span></div></div><span className="badge">Staff access</span></header>{children}</body></html>;}
