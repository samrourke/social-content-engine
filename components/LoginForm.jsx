"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./LoginForm.module.css";
import Link from "next/link";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault(); // stop the browser reloading the page
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    // checks the email and password; on success the browser client saves the session cookies
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
    router.refresh(); // re-render on the server with the new cookies
  }

  return (
    <form className={styles.form} onSubmit={handleLogin}>
      <h1 className={styles.title}>Log in</h1>

      <label className={styles.label}>
        Email
        <input
          className={styles.input}
          type="email"
          required
          value={email}
          autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className={styles.label}>
        Password
        <input
          className={styles.input}
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Log in"}
      </button>
      <Link href="/auth/forgot-password">Forgot your password?</Link>
    </form>
  );
}
