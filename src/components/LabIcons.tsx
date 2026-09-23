import type { ModuleId } from '../data/scenes';

export function ModuleIcon({ id }: { id: ModuleId }) {
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}>
    {id === 'model' && <><path d="m12 2 8 4.6v9L12 20l-8-4.4v-9L12 2Z"/><path d="m4 6.6 8 4.5 8-4.5M12 11.1V20"/></>}
    {id === 'motion' && <><path d="M3 8h13m-3-3 3 3-3 3M21 16H8m3-3-3 3 3 3"/><circle cx="4" cy="16" r="1"/></>}
    {id === 'multiplication' && <><path d="M5 16V8c0-2 2-3 4-3 4 0 3 5 7 5h3"/><path d="M19 7v6m-3-3h6M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>}
    {id === 'intersection' && <><path d="M4 4 20 20M20 4 4 20"/><circle cx="12" cy="12" r="2"/></>}
    {id === 'partial' && <><path d="M3 7h18M3 12h18M3 17h18"/><path d="m9 4-3 3 3 3m6 4 3 3-3 3"/></>}
  </svg>;
}

export function SceneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="1.4"/><circle cx="20" cy="5" r="1.4"/><circle cx="4" cy="19" r="1.4"/><circle cx="20" cy="19" r="1.4"/><path d="M6 6.5 9.5 10m5-0.5L18 6.5M6 17.5 9.5 14m5 0L18 17.5"/>
  </svg>;
}
