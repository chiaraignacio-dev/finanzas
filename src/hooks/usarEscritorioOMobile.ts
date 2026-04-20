import { useState, useEffect } from 'react';

// ── Hook que detecta si la pantalla es de escritorio ──
export function usarEscritorioOMobile(breakpoint = 768): boolean {
  const [esEscritorio, setEsEscritorio] = useState(
    () => window.innerWidth >= breakpoint,
  );

  useEffect(() => {
    const mq      = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setEsEscritorio(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return esEscritorio;
}
