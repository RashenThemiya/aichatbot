import { Bot, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { PrimaryButton } from "./ui";

export function LoginPage({ loginForm, setLoginForm, loading, error, handleLogin }) {
  return (
    <main className="flex min-h-screen bg-slate-950 text-slate-950">
      <section className="hidden min-h-screen w-[46%] flex-col justify-between bg-slate-950 px-10 py-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
            <Bot size={23} />
          </div>
          <div>
            <div className="text-lg font-bold">RAG System</div>
            <div className="text-sm text-slate-300">Knowledge support console</div>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 shadow-sm">
            <ShieldCheck size={15} />
            Secure admin access
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-normal text-white">
            Manage documents, channels, and customer answers in one place.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Sign in to monitor company knowledge bases, upload PDFs, manage integrations, and test chat responses.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-2xl font-bold">PDF</div>
            <div className="mt-1 text-slate-300">Knowledge ingest</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-2xl font-bold">RAG</div>
            <div className="mt-1 text-slate-300">Grounded answers</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-2xl font-bold">API</div>
            <div className="mt-1 text-slate-300">Widget ready</div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Bot size={21} />
            </div>
            <div>
              <div className="font-bold text-slate-950">RAG System</div>
              <div className="text-sm text-slate-500">Admin console</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/40">
            <div className="mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white">
                <LockKeyhole size={22} />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-950">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Use your admin account to continue securely.</p>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </span>
                <span className="relative block">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </span>
                <span className="relative block">
                  <LockKeyhole
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                  />
                </span>
              </label>

              <PrimaryButton type="submit" className="h-11 w-full" disabled={loading.auth}>
                {loading.auth ? "Signing in..." : "Sign in"}
              </PrimaryButton>
            </form>

            <div className="mt-5 grid gap-2 rounded-md bg-slate-50 px-3 py-3 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <span>API endpoint</span>
                <span className="truncate font-medium text-slate-700">{api.baseUrl}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Session</span>
                <span className="font-medium text-slate-700">Token protected</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
