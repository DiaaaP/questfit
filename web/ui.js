import { glyphs } from "./icons.js";

class Markup {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function renderValue(value) {
  if (value instanceof Markup) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return value == null || value === false ? "" : escape(value);
}

export function html(parts, ...values) {
  return new Markup(parts.reduce((result, part, index) => result + part + renderValue(values[index]), ""));
}

export function write(node, content) {
  node.innerHTML = renderValue(content);
}

export function icon(name, size = 19) {
  const paths = new Markup(glyphs[name] ?? "");
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const go = (to, title, primary = false) => html`<a class="portal-button ${primary ? "is-primary" : ""}" href="#${to}">${title}</a>`;
export const back = (to, title) => html`<a class="portal-back" href="#${to}">${icon("ArrowLeft", 17)} ${title}</a>`;
export const button = (action, title, { value = "", primary = false, danger = false } = {}) =>
  html`<button type="button" class="portal-button ${primary ? "is-primary" : ""} ${danger ? "is-danger" : ""}" data-action="${action}" data-value="${value}">${title}</button>`;
export const submit = (title, disabled = false) => html`<button type="submit" class="portal-button is-primary" ${disabled && "disabled"}>${title}</button>`;
export const field = (name, input, hint) => html`<label class="portal-field"><span>${name}</span>${input}${hint && html`<small>${hint}</small>`}</label>`;
export const error = html`<p class="portal-error" role="alert" data-error hidden></p>`;
export const stat = (label, title, detail) => html`<article class="portal-stat"><span>${label}</span><strong>${title}</strong>${detail && html`<small>${detail}</small>`}</article>`;
export const empty = (title, text, actions) => html`<section class="portal-panel portal-empty"><h2>${title}</h2><p>${text}</p>${actions && html`<div class="portal-actions">${actions}</div>`}</section>`;
export const mark = (type, name) => html`<span class="portal-icon activity-${type}">${icon(name, 20)}</span>`;
export const brand = () => html`<span class="portal-brand"><span>${icon("Swords", 22)}</span><strong>Quest<i>Fit</i></strong></span>`;
export const num = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format;
export const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format;
export const eventDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty",
}).format;
export const localDate = date => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0"),
].join("-");

export function meter(value, label) {
  const safe = Math.max(0, Math.min(100, value));
  return html`<progress class="portal-meter" aria-label="${label}" max="100" value="${safe}"></progress>`;
}

export function needAccount(description, next) {
  const query = "?next=" + encodeURIComponent(next);
  return empty("Войдите в QuestFit", description, [go("login" + query, "Войти", true), go("register" + query, "Создать аккаунт")]);
}

export function rows(items) {
  return html`<div class="portal-rows">${items}</div>`;
}

export function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function storeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function dateTimeInput(time) {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function weekMinutes(workouts, now) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return workouts.reduce((sum, item) =>
    item.performedAt >= monday.getTime() && item.performedAt <= now ? sum + item.durationMinutes : sum, 0);
}
