"use client";

import styles from "./LoginForm.module.css";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function PasswordResetForm() {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");

  async function handlePasswordReset(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>Check your email</h1>
        <p>
          If an account exists for {email}, we've sent a password reset link.
        </p>
        <Link href="/auth/login">Back to log in</Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handlePasswordReset}>
      <h1 className={styles.title}>Request New Password</h1>

      <label className={styles.label}>
        Email
        <input
          className={styles.input}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send Reset Link"}
      </button>
    </form>
  );
}
