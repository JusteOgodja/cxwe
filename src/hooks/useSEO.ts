import { useEffect } from 'react';

const SITE = 'Morocco Food Export';

export function useSEO({ title, description }: { title?: string; description?: string }) {
  useEffect(() => {
    const prev = document.title;
    if (title) {
      document.title = title.includes(SITE) ? title : `${title} — ${SITE}`;
    }

    let descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = descEl?.content ?? '';
    if (description && descEl) {
      descEl.content = description;
    }

    return () => {
      document.title = prev;
      if (descEl && prevDesc) descEl.content = prevDesc;
    };
  }, [title, description]);
}
