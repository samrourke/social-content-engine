"use client";

import styles from "./LoginForm.module.css";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  async function handleUpdatePassword(e) {
    e.preventDefault(); // stop the browser reloading the page

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleUpdatePassword}>
      <h1 className={styles.title}>Set Password</h1>

      <label className={styles.label}>
        Password
        <input
          className={styles.input}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label className={styles.label}>
        Confirm Password
        <input
          className={styles.input}
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Set Password"}
      </button>
    </form>
  );
}
