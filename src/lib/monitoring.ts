/**
 * Observabilité — DÉSACTIVÉE PAR DÉFAUT.
 *
 * `initMonitoring()` est un no-op tant que `VITE_MONITORING_DSN` n'est pas défini.
 * Aucun compte n'est créé, aucun secret n'est committé. L'activation est une action
 * MANUELLE (voir docs/operations + PROJECT_STATUS) : définir la variable côté Netlify.
 *
 * Vie privée : on ne journalise JAMAIS de JWT, email, donnée de formulaire, information
 * personnelle ni réponse Supabase. On ne transmet qu'un message d'erreur + contexte technique
 * (type d'erreur, route, nom de chunk, métrique Web Vital, commit déployé).
 */

const DSN = import.meta.env.VITE_MONITORING_DSN as string | undefined;
// Injecté au build (optionnel) : `VITE_COMMIT_SHA`. Sinon 'unknown'.
const RELEASE = (import.meta.env.VITE_COMMIT_SHA as string | undefined) || 'unknown';

// Redaction défensive : retire tokens/emails d'une chaîne avant tout envoi.
function redact(input: string): string {
  return input
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(sb_(?:secret|publishable)_[A-Za-z0-9_-]+)/g, '[key]');
}

type Payload = { kind: string; message: string; route: string; release: string; extra?: Record<string, string | number> };

function send(p: Payload) {
  // Sans DSN : no-op total (aucun réseau). Avec DSN : POST minimal, best-effort.
  if (!DSN) return;
  try {
    const body = JSON.stringify({ ...p, message: redact(p.message).slice(0, 500) });
    navigator.sendBeacon?.(DSN, body) || fetch(DSN, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch { /* jamais bloquer l'app pour du monitoring */ }
}

let started = false;
export function initMonitoring() {
  if (started || !DSN) return;          // inerte tant que non configuré
  started = true;
  const route = () => location.pathname;

  // Erreurs JS non capturées
  window.addEventListener('error', (e) => {
    const msg = e.message || String(e.error?.message || 'error');
    // Erreurs de chargement de chunk lazy (code splitting) — utile pour les déploiements
    const isChunk = /Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(msg);
    send({ kind: isChunk ? 'chunk-load' : 'js-error', message: msg, route: route(), release: RELEASE });
  });

  // Promesses rejetées (inclut nombre d'erreurs Supabase remontées via throw)
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e.reason && (e.reason.message || String(e.reason))) || 'unhandledrejection';
    send({ kind: 'promise-rejection', message: String(reason), route: route(), release: RELEASE });
  });

  // Web Vitals via PerformanceObserver natif (pas de dépendance externe)
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        send({ kind: 'web-vital', message: entry.name, route: route(), release: RELEASE, extra: { value: Math.round((entry as any).value ?? (entry as any).startTime ?? 0) } });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* navigateur sans LCP API */ }
}

/**
 * À signaler explicitement depuis un catch de soumission de formulaire, SANS passer les
 * champs saisis : `reportFormRejection('quote_requests', code)`.
 */
export function reportFormRejection(form: string, code?: string) {
  send({ kind: 'form-rejection', message: `${form}:${code || 'error'}`, route: location.pathname, release: RELEASE });
}
