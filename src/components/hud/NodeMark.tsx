/** Small "node network" brand mark: one bright node linked to three satellites. */
export function NodeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55">
        <path d="M12 12 5 6.5M12 12l7.5-3.5M12 12l2 8" />
      </g>
      <circle cx="5" cy="6.5" r="1.6" fill="currentColor" opacity="0.8" />
      <circle cx="19.5" cy="8.5" r="1.3" fill="currentColor" opacity="0.7" />
      <circle cx="14" cy="20" r="1.4" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="12" r="3.2" fill="var(--color-brand)" />
      <circle
        cx="12"
        cy="12"
        r="5.2"
        stroke="var(--color-brand)"
        strokeWidth="0.75"
        opacity="0.45"
      />
    </svg>
  );
}
