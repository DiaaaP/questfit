import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type Athlete = { id: number; fullName: string; email: string; goal: string };

export const formatNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format;
const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const eventFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty",
});
export const dateLabel = (time: number) => dateFormat.format(time);
export const eventDateLabel = (time: number) => eventFormat.format(time);

export function Go({ to, primary = false, children }: { to: string; primary?: boolean; children: ReactNode }) {
  return <a className={primary ? "portal-button is-primary" : "portal-button"} href={`#${to}`}>{children}</a>;
}

export function Back({ to, children }: { to: string; children: ReactNode }) {
  return <a className="portal-back" href={`#${to}`}><ArrowLeft size={16} aria-hidden="true" />{children}</a>;
}

export function Action({ primary = false, className = "", ...props }: ComponentProps<"button"> & { primary?: boolean }) {
  return <button type="button" {...props} className={`portal-button${primary ? " is-primary" : ""} ${className}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="portal-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <section className="portal-panel portal-empty"><h2>{title}</h2><p>{text}</p>{children}</section>;
}

export function Meter({ value, label }: { value: number; label: string }) {
  return <progress className="portal-meter" aria-label={label} max={100} value={Math.min(100, Math.max(0, value))} />;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <article className="portal-stat"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export function FormError({ error }: { error: string }) {
  return error ? <p role="alert" className="portal-error">{error}</p> : null;
}

export function NeedAccount({ description }: { description: string }) {
  const next = encodeURIComponent(windowHash());
  return <Empty title="Войдите в QuestFit" text={description}>
    <div className="portal-actions"><Go to={`login?next=${next}`} primary>Войти</Go><Go to={`register?next=${next}`}>Создать аккаунт</Go></div>
  </Empty>;
}

export function windowHash() {
  return typeof window === "undefined" ? "overview" : window.location.hash.slice(1) || "overview";
}

export function navigate(to: string) {
  window.location.hash = to;
}

export async function api<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  });
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error || "Сервис временно недоступен. Попробуйте ещё раз.");
  return result;
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
