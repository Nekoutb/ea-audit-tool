import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
            EA Audit
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Access your firm&rsquo;s audit engagements.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
