import { useSyncExternalStore } from 'react';

const subs = new Set<() => void>();
window.addEventListener('popstate', () => subs.forEach(f => f()));

export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState(null, '', to);
  window.scrollTo(0, 0);
  subs.forEach(f => f());
}

export function usePath(): string {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => window.location.pathname);
}

/** Anchor that routes in-app (keeps session, ledger and running Portal payouts alive). */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
