import { Activity, Bot, Building2, LogOut, RefreshCcw } from "lucide-react";
import { api } from "../lib/api";
import { classNames } from "../utils/classNames";
import { SecondaryButton, StatusBadge } from "./ui";

export function AdminShell({
  children,
  currentUser,
  health,
  loading,
  activeNavItems,
  activeSection,
  setActiveSection,
  isSuperAdmin,
  selectedCompany,
  backToSuperAdmin,
  loadHealth,
  handleLogout,
}) {
  const initials = (currentUser?.name || currentUser?.email || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const pageTitle =
    activeNavItems.find((item) => item.id === activeSection)?.label ||
    (selectedCompany ? "Company Dashboard" : "Dashboard");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="min-h-screen lg:grid lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-950 px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0">
          <div className="flex h-full flex-col gap-5">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
                <Bot size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold">RAG System</div>
                <div className="truncate text-xs text-slate-400">Admin workspace</div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-sm font-bold text-slate-950">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{currentUser.name}</div>
                  <div className="truncate text-xs text-slate-400">{currentUser.role}</div>
                </div>
              </div>
              {selectedCompany && (
                <div className="mt-3 rounded-md bg-white/5 px-3 py-2 text-xs text-slate-300">
                  Managing <span className="font-semibold text-white">{selectedCompany.name}</span>
                </div>
              )}
            </div>

            <nav className="space-y-1">
              {isSuperAdmin && selectedCompany && (
                <button
                  type="button"
                  onClick={backToSuperAdmin}
                  className="mb-2 flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <Building2 size={17} />
                  Superadmin Home
                </button>
              )}

              {activeNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={classNames(
                      "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold transition",
                      active
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon size={17} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Activity size={14} />
                System Status
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={health?.mongodb || "unknown"} />
                <StatusBadge status={health?.ragService || "unknown"} />
              </div>
              <button
                type="button"
                onClick={loadHealth}
                disabled={loading.health}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshCcw className={loading.health ? "animate-spin" : ""} size={15} />
                Refresh Status
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {selectedCompany ? selectedCompany.name : "Admin Console"}
                </div>
                <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">{pageTitle}</h1>
                <p className="mt-1 truncate text-sm text-slate-500">{api.baseUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={loadHealth} disabled={loading.health}>
                  <RefreshCcw className={loading.health ? "animate-spin" : ""} size={16} />
                  Check
                </SecondaryButton>
                <SecondaryButton onClick={handleLogout}>
                  <LogOut size={16} />
                  Logout
                </SecondaryButton>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
