import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { LockKeyhole } from "lucide-react";
import { auth } from "../../firebase";

function getSignInErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "The email or password is incorrect.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Could not reach Firebase Authentication. Check your connection and try again.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email and password sign-in is not enabled for this Firebase project.";
  }
  return "Sign-in failed. Check your credentials and try again.";
}

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (signInError: unknown) {
      console.error("Admin sign-in failed:", signInError);
      setError(getSignInErrorMessage(signInError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ background: "#f8f7f3" }}>
      <section className="w-full max-w-md rounded-2xl p-6 sm:p-8" style={{ background: "#fff", border: "1px solid #e9e5dd", boxShadow: "0 12px 36px rgba(45, 26, 14, 0.08)" }}>
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/app_logo.png"
            alt="StallSeeker logo"
            className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
            style={{ boxShadow: "0 5px 12px rgba(217, 83, 22, 0.22)" }}
          />
          <div>
            <p className="font-semibold" style={{ color: "#2d241d" }}>StallSeeker</p>
            <p className="text-xs" style={{ color: "#a17b58" }}>Administrator sign-in</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>Welcome back</h1>
          <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
            Sign in with your Firebase admin account to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium" style={{ color: "#433a31" }}>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              style={{ color: "#433a31", background: "#fff", border: "1px solid #e9e5dd" }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium" style={{ color: "#433a31" }}>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              style={{ color: "#433a31", background: "#fff", border: "1px solid #e9e5dd" }}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl px-3 py-2.5 text-sm" style={{ color: "#8f3b32", background: "#fff0ed", border: "1px solid #f2d1cb" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#d95316", border: "none" }}
          >
            <LockKeyhole size={16} />
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
