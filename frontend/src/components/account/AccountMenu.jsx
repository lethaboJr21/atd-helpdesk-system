import {
  Camera,
  ChevronDown,
  Gauge,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Settings2,
  Sun,
  WalletCards,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import useAppearance from "../../hooks/useAppearance";
import { ACCENT_THEMES, APPEARANCE_STYLES } from "../../services/appearance";
import AvatarEditor from "./AvatarEditor";
import ProfileAvatar from "./ProfileAvatar";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function AccountMenu({
  compact = false,
  dashboardView = null,
  onDashboardViewChange = null,
}) {
  const navigate = useNavigate();
  const {
    user,
    logout,
    employeeView,
    effectiveExperience,
    enterEmployeeView,
    exitEmployeeView,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const { appearance, setMode, setStyle, setAccent, toggleMode } = useAppearance();
  const [busy, setBusy] = useState(false);

  const menuRef = useRef(null);
  const operationsAccount = user?.role !== "user";

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (
        event.type === "mousedown" &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);



  const switchExperience = () => {
    setOpen(false);
    if (employeeView) {
      exitEmployeeView();
      navigate("/");
    } else {
      enterEmployeeView();
      navigate("/employee");
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="portal-universal-account-anchor group/account z-[120] overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] px-2.5 py-2 shadow-sm transition hover:bg-[var(--portal-surface-muted)]"
      >
        <ProfileAvatar user={user} className="h-8 w-8" />
        {!compact ? (
          <span className="hidden max-w-36 truncate text-sm font-semibold text-[var(--portal-text)] 2xl:block">
            {user?.name || "My account"}
          </span>
        ) : null}
        <ChevronDown className="h-4 w-4 text-[var(--portal-text-muted)]" />
      </button>

      {!open ? (
          <div role="tooltip" className="pointer-events-none absolute right-0 top-full z-[119] mt-2 hidden w-72 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] p-4 shadow-2xl group-hover/account:block group-focus-within/account:block">
            <div className="flex items-center gap-3"><ProfileAvatar user={user} className="h-12 w-12 shrink-0" /><div className="min-w-0"><p className="truncate font-bold text-[var(--portal-text)]">{user?.name || "Portal account"}</p><p className="truncate text-sm font-semibold text-[var(--portal-primary)]">{user?.job_title || user?.jobTitle || "Portal user"}</p><p className="truncate text-xs text-[var(--portal-text-muted)]">{user?.department || user?.email || ""}</p></div></div>
          </div>
        ) : null}

        {open ? (
        <div role="menu" className="absolute right-0 top-full z-[120] mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] shadow-2xl">
          <div className="flex items-start gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
            <ProfileAvatar user={user} className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-[var(--portal-text)]">{user?.name || "Portal account"}</p>
              <p className="truncate text-sm text-[var(--portal-text-muted)]">{user?.email || ""}</p>
              {user?.job_title || user?.jobTitle ? (
                <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">{user?.job_title || user?.jobTitle}</p>
              ) : null}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[var(--portal-text-muted)] hover:bg-[var(--portal-surface-strong)]" aria-label="Close account menu">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[72vh] space-y-3 overflow-y-auto p-3">
            <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate("/employee"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]">
              <User className="h-4 w-4" /> My profile and employee home
            </button>

            {(String(user?.department || "").toLowerCase().includes("finance") || user?.role === "superadmin") ? (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate("/finance-workspace"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]">
                <WalletCards className="h-4 w-4" /> Open Finance Workspace
              </button>
            ) : null}
            {operationsAccount ? (
              <button type="button" role="menuitem" onClick={switchExperience} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]">
                <LayoutDashboard className="h-4 w-4" />
                {employeeView ? "Return to Operations View" : "Switch to Employee View"}
              </button>
            ) : null}            {operationsAccount && dashboardView && onDashboardViewChange ? (
              <section className="border-t border-[var(--portal-border)] pt-3">
                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">Operations dashboard view</p>
                <button type="button" role="menuitemradio" aria-checked={dashboardView === "simple"} onClick={() => onDashboardViewChange("simple")} className={classNames("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold", dashboardView === "simple" ? "portal-selected" : "text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]")}>
                  <LayoutDashboard className="h-4 w-4" /> Simple
                </button>
                <button type="button" role="menuitemradio" aria-checked={dashboardView === "explorative"} onClick={() => onDashboardViewChange("explorative")} className={classNames("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold", dashboardView === "explorative" ? "portal-selected" : "text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]")}>
                  <Gauge className="h-4 w-4" /> Explorative
                </button>
              </section>
            ) : null}

            <section className="border-t border-[var(--portal-border)] pt-3">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setAvatarEditorOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]">
                <Camera className="h-4 w-4" /> Change profile picture
              </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/employee?configure=dashboard");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]"
          >
            <LayoutDashboard className="h-4 w-4" />
            Customize dashboard
          </button>
</section>
<section className="border-t border-[var(--portal-border)] pt-3">
              <div className="flex items-center justify-between px-3 pb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">Appearance</p>
                <button type="button" onClick={toggleMode} className="portal-control rounded-full border px-2.5 py-1 text-xs font-bold">{appearance.mode === "dark" ? "Light home" : "Dark home"}</button>
              </div>
              {[["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "Use device setting", Monitor]].map(([value, label, Icon]) => (
                <button key={value} type="button" role="menuitemradio" aria-checked={appearance.mode === value} onClick={() => setMode(value)} className={classNames("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold", appearance.mode === value ? "portal-selected" : "text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]")}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 px-3">
                {APPEARANCE_STYLES.map((value) => <button key={value} type="button" onClick={() => setStyle(value)} className={classNames("portal-control rounded-lg border px-2 py-2 text-xs font-bold capitalize", appearance.style === value && "portal-selected")}>{value}</button>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 px-3" aria-label="Accent colours">
                {ACCENT_THEMES.map((item) => <button key={item.id} type="button" onClick={() => setAccent(item.id)} title={item.label} aria-label={item.label} aria-pressed={appearance.accent === item.id} className={classNames("h-7 w-7 rounded-full border-2 border-[var(--portal-surface)] shadow ring-1 ring-[var(--portal-border)]", appearance.accent === item.id && "ring-2 ring-[var(--portal-primary)]")} style={{ background: appearance.style === "solid" ? item.primary : `linear-gradient(135deg, ${item.primary}, ${item.secondary})` }} />)}
              </div>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate("/employee?configure=preferences"); }} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--portal-text-soft)] hover:bg-[var(--portal-surface-muted)]">
                <Settings2 className="h-4 w-4" /> Configure preferences
              </button>
            </section>

<button type="button" role="menuitem" onClick={signOut} disabled={busy} className="flex w-full items-center gap-2 rounded-lg border-t border-[var(--portal-border)] px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
              <LogOut className="h-4 w-4" /> {busy ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
      <AvatarEditor open={avatarEditorOpen} user={user} onClose={() => setAvatarEditorOpen(false)} />
    </div>
  );
}
