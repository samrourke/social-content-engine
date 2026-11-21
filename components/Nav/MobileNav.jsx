"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { site } from "@/config/site";
import styles from "./MobileNav.module.css";

export default function MobileNav({ client, clients = [] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

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

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("sign out error: ", error);
    }
    setIsOpen(false);
    router.push("/auth/login");
    router.refresh();
  }

  function switchClient(newSlug) {
    // "/circawaves/calendar" → ["", "circawaves", "calendar"] → "calendar"
    const rest = pathname.split("/").slice(2).join("/");
    setIsOpen(false);
    router.push(`/${newSlug}/${rest}`);
  }

  return (
    <div className={styles.mobileNav}>
      <div className={styles.navBar}>
        {clients.length > 1 && (
          <select
            value=""
            onChange={(e) => switchClient(e.target.value)}
            aria-label="Switch client"
            className={styles.switchClient}
          >
            <option value="" disabled>
              Switch client
            </option>
            {clients
              .filter((c) => c.slug !== client.slug)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
        <Link
          href={`/${client.slug}/youtube-review`}
          className={styles.brand}
          onClick={closeMenu}
        >
          <p className={styles.clientName}>{client.name}</p>
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
                const href = `/${client.slug}/${link.path}`;
                const isActive = pathname === link.href;

                return (
                  <li
                    key={href}
                    className={`${styles.navItem} ${
                      isActive ? styles.active : ""
                    }`}
                  >
                    <Link
                      href={href}
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
          <button className={styles.signOutButton} onClick={signOut}>
            Sign Out
          </button>
          <div className={styles.menuFooter}>
            <span>{site.name}</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
