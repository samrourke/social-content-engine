import Link from "next/link";
import styles from "./layout.module.css";
import "./globals.css";

export const metadata = {
  title: "Circa Waves Content Engine",
  description: "Content discovery and review dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className={styles.nav}>
          <Link href="/">Content Review</Link>
          <Link href="/tiktok">TikTok Dashboard</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
