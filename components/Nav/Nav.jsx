"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { site } from "@/config/site";
import styles from "./Nav.module.css";

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <Link href="/" className={styles.brand}>
        <img
          src="/cw-logo.png"
          alt="Circa Waves"
          style={{ height: "70px", width: "auto", margin: 0 }}
        />
      </Link>
      <h1 className={styles.siteName}>{site.name}</h1>

      <ul className={styles.navList}>
        {site.nav.map((link) => {
          const isActive = pathname === link.href;

          return (
            <li
              key={link.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
              >
                {link.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
