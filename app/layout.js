import Link from "next/link";
import styles from "./layout.module.css";
import "./globals.css";
import Nav from "../components/Nav/Nav";
import MobileNav from "../components/Nav/MobileNav";
import { sans, display } from "./fonts";

export const metadata = {
  title: "Circa Waves Content Engine",
  description: "Content discovery and review dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        {/* <nav className={styles.nav}>
          <Link href="/">Content Review</Link>
          <Link href="/tiktok">TikTok Dashboard</Link>
        </nav> */}
        <Nav />
        <MobileNav />
        {children}
      </body>
    </html>
  );
}
