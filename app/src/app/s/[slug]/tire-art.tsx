// Длина окружности надписи (r = 142) и сколько букв на ней помещается без сжатия
const ARC = 2 * Math.PI * 142;
// Unbounded широкий: заглавная буква около 1 em, вместе с разрядкой примерно 21 точка при размере 19
const FIT = 40;

/** «Боковина»: шина с надписью по кругу и литой диск. Чистый SVG, без картинок. */
export function TireArt({ text }: { text: string }) {
  // Надпись повторяется целиком, пока помещается, и растягивается ровно на круг: конец не наезжает на начало
  const unit = `${text.trim()} • `;
  const times = Math.max(1, Math.floor(FIT / unit.length));
  const ring = unit.repeat(times);
  // Длинное название не сжимаем буквами друг на друга, а уменьшаем шрифт
  const size = ring.length > FIT ? Math.max(11, Math.floor((19 * FIT) / ring.length)) : 19;
  return (
    <div className="tire" aria-hidden="true">
      <svg viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <path id="tire-arc" d="M200,200 m-142,0 a142,142 0 1,1 284,0 a142,142 0 1,1 -284,0" />
          <radialGradient id="tire-rubber" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#1c1e20" />
            <stop offset="88%" stopColor="#202325" />
            <stop offset="100%" stopColor="#151718" />
          </radialGradient>
          <linearGradient id="tire-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d9dcdd" />
            <stop offset=".5" stopColor="#9aa0a3" />
            <stop offset="1" stopColor="#5f6568" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="198" fill="url(#tire-rubber)" />
        <circle cx="200" cy="200" r="188" fill="none" stroke="#2c3033" strokeWidth="16" strokeDasharray="9 7" />
        <circle cx="200" cy="200" r="176" fill="none" stroke="#141617" strokeWidth="2" />
        <text fontFamily="var(--font-unbounded), sans-serif" fontWeight="800" fontSize={size} letterSpacing="2" fill="#141618" dy="1.5">
          <textPath href="#tire-arc" textLength={Math.floor(ARC - 6)} lengthAdjust="spacing">{ring}</textPath>
        </text>
        <text fontFamily="var(--font-unbounded), sans-serif" fontWeight="800" fontSize={size} letterSpacing="2" fill="#3a3e41">
          <textPath href="#tire-arc" textLength={Math.floor(ARC - 6)} lengthAdjust="spacing">{ring}</textPath>
        </text>
        <circle cx="200" cy="200" r="118" fill="#141617" />
        <circle cx="200" cy="200" r="110" fill="url(#tire-metal)" />
        <circle cx="200" cy="200" r="103" fill="none" stroke="#6d7376" strokeWidth="1.5" />
        <g fill="#1d2022" stroke="#1d2022" strokeWidth="10" strokeLinejoin="round">
          <path d="M219.5,108.1 A94,94 0 0,1 281.4,153.0 L232.7,170.6 A44,44 0 0,0 217.9,159.8 Z" />
          <path d="M293.5,190.2 A94,94 0 0,1 269.9,262.9 L238.1,222.0 A44,44 0 0,0 243.8,204.6 Z" />
          <path d="M238.2,285.9 A94,94 0 0,1 161.8,285.9 L190.9,243.0 A44,44 0 0,0 209.1,243.0 Z" />
          <path d="M130.1,262.9 A94,94 0 0,1 106.5,190.2 L156.2,204.6 A44,44 0 0,0 161.9,222.0 Z" />
          <path d="M118.6,153.0 A94,94 0 0,1 180.5,108.1 L182.1,159.8 A44,44 0 0,0 167.3,170.6 Z" />
        </g>
        <circle cx="200" cy="200" r="26" fill="#7c8285" />
        <g fill="#3b4043">
          <circle cx="200" cy="186" r="4" /><circle cx="213.3" cy="195.7" r="4" /><circle cx="208.2" cy="211.3" r="4" /><circle cx="191.8" cy="211.3" r="4" /><circle cx="186.7" cy="195.7" r="4" />
        </g>
        <circle cx="200" cy="200" r="7" fill="#c9cdcf" />
      </svg>
    </div>
  );
}
