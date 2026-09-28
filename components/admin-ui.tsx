"use client";

/**
 * Shared admin UI primitives.
 *
 * Every page inside /admin is built from these, so any screen opened inside the
 * console reads as the same product rather than a different template. The
 * visual language is taken directly from the approved Command Center: layered
 * white surfaces on a zinc canvas, hairline borders, one brand accent, and
 * semantic SVG glyphs instead of emoji.
 *
 * Rules baked in here so pages cannot regress:
 *  - every interactive control has a visible focus ring
 *  - every input is labelled, never placeholder-only
 *  - errors announce via role="alert", confirmations via role="status"
 *  - loading uses motion-safe skeletons so reduced motion is respected
 *  - tables always get scope="col" and a horizontal scroll container
 */

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";

import {
  IconAlert,
  IconArrow,
  IconCheck,
  IconSearch,
  IconX,
} from "@/components/admin-icons";
import { BRAND_BURGUNDY, BRAND_NAVY } from "@/lib/admin-dashboard";

/* ------------------------------------------------------------------ tokens */

const FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 focus-visible:ring-offset-1";

/** Standard raised surface, matching the Command Center panels. */
export const panelClass =
  "rounded-2xl border border-zinc-200 bg-white shadow-sm";

/* ------------------------------------------------------------------ button */

type ActionTone = "primary" | "secondary" | "ghost" | "danger";

const ACTION_TONES: Record<ActionTone, string> = {
  primary: "text-white shadow-sm hover:brightness-110",
  secondary:
    "border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger:
    "border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50",
};

export function AdminActionButton({
  children,
  tone = "secondary",
  icon,
  className = "",
  ...rest
}: {
  children: ReactNode;
  tone?: ActionTone;
  icon?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_TONES[tone]} ${FOCUS} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function AdminLinkButton({
  href,
  children,
  tone = "secondary",
  icon,
  className = "",
  ...rest
}: {
  href: string;
  children: ReactNode;
  tone?: ActionTone;
  icon?: ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${ACTION_TONES[tone]} ${FOCUS} ${className}`}
    >
      {icon}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ header */

/**
 * Section heading used inside the shell's content area. The shell already owns
 * the page <h1>, so this starts at <h2> to keep the heading order valid.
 */
export function AdminSection({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {eyebrow}
          </p>
        )}
        <h2 className="text-base tracking-wide text-zinc-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------- stat */

export type AdminStatTone = "neutral" | "good" | "warn" | "critical" | "brand";

const STAT_TONE_BG: Record<AdminStatTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  critical: "bg-rose-50 text-rose-700",
  brand: "bg-[#7a1233]/10 text-[#7a1233]",
};

/**
 * A single headline figure. `hint` must describe the figure honestly - it is
 * never a trend, because no prior window is stored to compare against.
 */
export function AdminStat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: AdminStatTone;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>
          <p className="mt-1.5 font-bold leading-none tabular-nums text-zinc-950">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${STAT_TONE_BG[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${FOCUS}`}
      >
        {body}
      </Link>
    );
  }
  return <div className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm`}>{body}</div>;
}

/** The Command Center's own KPI treatment: one large block plus a support band. */
export function AdminStatBand({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}

/* ------------------------------------------------------------------ filter */

export function AdminFilterBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export type FilterChip = { id: string; label: string; count?: number };

export function AdminFilterChips({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly FilterChip[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-0.5"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${FOCUS} ${
              active
                ? "bg-[#0f172a] text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span
                className={`rounded px-1 text-[10px] tabular-nums ${
                  active ? "bg-white/20" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ search */

export function AdminSearch({
  value,
  onChange,
  label,
  placeholder = "Search…",
  className = "",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className={`relative min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <IconSearch
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
      />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#7a1233] focus:bg-white ${FOCUS}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 ${FOCUS}`}
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#7a1233]";

/**
 * A labelled control. Every admin form input goes through this so no field is
 * ever identified by its placeholder alone.
 */
export function AdminField({
  label,
  hint,
  error,
  children,
  className = "",
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-zinc-500"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-rose-700">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdminInput({
  invalid,
  className = "",
  ...rest
}: { invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${FIELD_CLASS} ${invalid ? "border-rose-400" : ""} ${FOCUS} ${className}`}
    />
  );
}

export function AdminSelect({
  invalid,
  className = "",
  children,
  ...rest
}: { invalid?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${FIELD_CLASS} ${invalid ? "border-rose-400" : ""} ${FOCUS} ${className}`}
    >
      {children}
    </select>
  );
}

export function AdminTextarea({
  invalid,
  className = "",
  ...rest
}: { invalid?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#7a1233] ${
        invalid ? "border-rose-400" : ""
      } ${FOCUS} ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ status */

export type StatusTone = "neutral" | "info" | "progress" | "good" | "warn" | "critical";

const STATUS_TONE: Record<StatusTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  progress: "bg-amber-50 text-amber-700 ring-amber-600/20",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warn: "bg-orange-50 text-orange-800 ring-orange-600/20",
  critical: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function AdminStatusBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
        STATUS_TONE[tone]
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ states */

export function AdminSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-xl bg-zinc-200/70 ${className}`}
    />
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
      {icon && (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm">
          {icon}
        </span>
      )}
      <p className="text-sm font-bold text-zinc-700">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>
      )}
      {action}
    </div>
  );
}

export function AdminError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <span className="inline-flex rounded-lg bg-rose-100 p-1.5" aria-hidden="true">
        <IconAlert className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <AdminActionButton tone="danger" onClick={onRetry}>
          Retry
        </AdminActionButton>
      )}
    </div>
  );
}

export function AdminNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-emerald-50 p-4 text-sm text-emerald-700"
    >
      <span className="inline-flex rounded-lg bg-emerald-50 p-1.5" aria-hidden="true">
        <IconCheck className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- misc */

export function AdminInlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-xs font-bold text-[#7a1233] underline-offset-2 hover:underline ${FOCUS}`}
    >
      {children}
      <IconArrow className="h-3 w-3" />
    </Link>
  );
}

export function AdminFeatureCard({
  href,
  title,
  description,
  icon,
  accent = BRAND_BURGUNDY,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_14px_34px_-14px_rgba(15,23,42,0.4)] ${FOCUS}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100"
        style={{ backgroundColor: accent }}
      />
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${accent}12`, color: accent }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight text-zinc-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
          {description}
        </span>
      </span>
      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-300 transition-all duration-200 group-hover:bg-zinc-100 group-hover:text-[#7a1233]">
        <IconArrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ dialog */

/**
 * Accessible modal used for confirmations and detail views.
 *
 * Replaces the `window.confirm` calls the old admin pages used: it traps
 * Escape, moves focus inside on open, restores focus on close, and is labelled.
 */
export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], button, input, select, textarea, a[href]",
      );
      target?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(timer);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm tracking-wide text-zinc-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs leading-relaxed text-zinc-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 ${FOCUS}`}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
}) {
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>
            Cancel
          </AdminActionButton>
          <AdminActionButton
            tone={tone}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
            style={tone === "primary" ? { backgroundColor: BRAND_NAVY } : undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </AdminActionButton>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-zinc-700">{description}</div>
    </AdminDialog>
  );
}
