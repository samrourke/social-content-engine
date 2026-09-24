"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { site } from "@/config/site";
import styles from "./MobileNav.module.css";

export default function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  /*
   * Prevent the page scrolling underneath the menu.
   */
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.__lenis?.stop();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.__lenis?.start();
    };
  }, [isOpen]);

  /*
   * Close with Escape.
   */
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className={styles.mobileNav}>
      <div className={styles.navBar}>
        <Link href="/" className={styles.brand} onClick={closeMenu}>
          <img
            src="/cw-logo.png"
            alt="Circa Waves"
            style={{ height: "60px", width: "auto", margin: 0 }}
          />
        </Link>

        <button
          className={`${styles.menuButton} ${
            isOpen ? styles.menuButtonOpen : ""
          }`}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
        >
          <span className={styles.menuTitle}>{isOpen ? "Close" : "Menu"}</span>

          <span className={styles.menuIcon} aria-hidden="true">
            {isOpen ? "×" : "+"}
          </span>
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`${styles.menu} ${isOpen ? styles.menuOpen : ""}`}
        inert={!isOpen}
      >
        <div className={styles.menuInner}>
          <nav className={styles.nav} aria-label="Mobile navigation">
            <ul className={styles.navList}>
              {site.nav.map((link) => {
                const isActive = pathname === link.href;

                return (
                  <li
                    key={link.href}
                    className={`${styles.navItem} ${
                      isActive ? styles.active : ""
                    }`}
                  >
                    <Link
                      href={link.href}
                      onClick={closeMenu}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={`${styles.linkText} boldTitle`}>
                        {link.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.menuFooter}>
            <span>{site.name}</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
