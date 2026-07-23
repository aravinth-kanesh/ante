export default function Logo({ size = 32 }: { size?: number }) {
  const glyph = Math.round(size / 2);
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <rect x="7" y="2" width="2" height="12" rx="1" />
        <rect x="3" y="5" width="2" height="6" rx="1" />
        <rect x="11" y="5" width="2" height="6" rx="1" />
      </svg>
    </span>
  );
}
