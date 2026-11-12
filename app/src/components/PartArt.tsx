// The seven parts as characters (Direction A "Toy Works"). Lifted from docs/design/directions.html (a-* symbols),
// refined: every part has idle / happy / worried / surprised expressions; the Splitter flap moves per coin;
// the Gate arm lifts; the Vault shows its fill; the Portal swirls while a payout is in flight.
// All colours come from tokens.css so a direction switch is a token swap.
import type { PartType } from '../lib/machine';

export type Mood = 'idle' | 'happy' | 'worried' | 'surprised';
export type ArtState = { mood?: Mood; flap?: -1 | 1; split?: number; fill?: number; armUp?: boolean; glint?: boolean; spinning?: boolean; glow?: boolean };

const INK = 'var(--color-ink)';

function Face({ x1, x2, y, mood = 'idle', mouthY, rx = 5.5, ry = 7, mouth = 'smile', cheeks }: { x1: number; x2: number; y: number; mood?: Mood; mouthY: number; rx?: number; ry?: number; mouth?: 'smile' | 'flat' | 'grin'; cheeks?: boolean }) {
  const mx = (x1 + x2) / 2;
  return (
    <g className={`face mood-${mood}`}>
      {mood === 'happy' ? (
        <g fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round">
          <path d={`M${x1 - 6} ${y + 2} Q${x1} ${y - 7} ${x1 + 6} ${y + 2}`} />
          <path d={`M${x2 - 6} ${y + 2} Q${x2} ${y - 7} ${x2 + 6} ${y + 2}`} />
        </g>
      ) : mood === 'surprised' ? (
        <g>
          <circle cx={x1} cy={y} r={rx + 1.8} fill="#fff" stroke={INK} strokeWidth={3} />
          <circle cx={x2} cy={y} r={rx + 1.8} fill="#fff" stroke={INK} strokeWidth={3} />
          <circle cx={x1} cy={y} r={2.8} fill={INK} /><circle cx={x2} cy={y} r={2.8} fill={INK} />
        </g>
      ) : (
        <g>
          <ellipse cx={x1} cy={y} rx={mood === 'worried' ? rx - 1 : rx} ry={mood === 'worried' ? ry - 1.5 : ry} fill={INK} />
          <ellipse cx={x2} cy={y} rx={mood === 'worried' ? rx - 1 : rx} ry={mood === 'worried' ? ry - 1.5 : ry} fill={INK} />
          <circle cx={x1 + 2} cy={y - 2.6} r={1.9} fill="#fff" /><circle cx={x2 + 2} cy={y - 2.6} r={1.9} fill="#fff" />
        </g>
      )}
      {mood === 'worried' && (
        <g>
          <path d={`M${x1 - 9} ${y - 11} L${x1 + 4} ${y - 15} M${x2 + 9} ${y - 11} L${x2 - 4} ${y - 15}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
          <path className="sweat" d="M98 16 q5 8 0 11 q-5 -3 0 -11z" fill="var(--color-sweat)" />
        </g>
      )}
      {cheeks && mood !== 'worried' && (
        <g fill="var(--color-cheek)" opacity={0.45}><ellipse cx={x1 - 14} cy={mouthY - 2} rx={7} ry={4} /><ellipse cx={x2 + 14} cy={mouthY - 2} rx={7} ry={4} /></g>
      )}
      {mood === 'surprised' ? (
        <ellipse cx={mx} cy={mouthY + 1} rx={5} ry={6} fill={INK} />
      ) : mood === 'worried' ? (
        <path d={`M${mx - 9} ${mouthY + 3} q4.5 -5 9 0 q4.5 5 9 0`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      ) : mood === 'happy' || mouth === 'grin' ? (
        <path d={`M${mx - 12} ${mouthY - 3} H${mx + 12} Q${mx + 12} ${mouthY + 12} ${mx} ${mouthY + 12} Q${mx - 12} ${mouthY + 12} ${mx - 12} ${mouthY - 3} Z`} fill={INK} />
      ) : mouth === 'flat' ? (
        <path d={`M${mx - 8} ${mouthY} H${mx + 8}`} stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      ) : (
        <path d={`M${mx - 8} ${mouthY - 2} Q${mx} ${mouthY + 6} ${mx + 8} ${mouthY - 2}`} fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      )}
    </g>
  );
}

function Block({ fam, y = 6, h = 100 }: { fam: string; y?: number; h?: number }) {
  return (
    <g>
      <rect x={10} y={y + 6} width={100} height={h} rx={26} fill={`var(--color-${fam}-shade)`} />
      <rect x={10} y={y} width={100} height={h} rx={26} fill={`var(--color-${fam})`} />
      <rect x={22} y={y + 6} width={76} height={5} rx={2.5} fill="#fff" opacity={0.3} />
    </g>
  );
}

export function PartArt({ type, s = {}, size = 112 }: { type: PartType; s?: ArtState; size?: number }) {
  const mood = s.mood ?? 'idle';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`part-art part-${type}`} aria-hidden>
      {type === 'CoinSlot' && (
        <g>
          <Block fam="input" />
          <rect x={32} y={20} width={56} height={24} rx={12} fill="var(--color-input-light)" />
          <rect x={41} y={28} width={38} height={8} rx={4} fill={INK} />
          <rect className={`slot-glow ${s.glow ? 'on' : ''}`} x={36} y={22} width={48} height={20} rx={10} fill="var(--color-coin)" opacity={0} />
          <Face x1={46} x2={74} y={64} mood={mood} mouthY={81} cheeks />
        </g>
      )}
      {type === 'Splitter' && (
        <g>
          <Block fam="logic" />
          <Face x1={45} x2={75} y={30} mood={mood === 'happy' ? 'happy' : mood} mouthY={44} rx={5} ry={6.5} mouth="flat" />
          <circle cx={60} cy={78} r={24} fill="#fff" stroke={INK} strokeWidth={4} />
          <PieShare share={s.split ?? 0.5} />
          <g className="flap" style={{ transform: `rotate(${(s.flap ?? -1) * 38}deg)`, transformOrigin: '60px 78px' }}>
            <path d="M60 78 L60 57" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          </g>
          <circle cx={60} cy={78} r={5} fill={INK} />
        </g>
      )}
      {type === 'Vault' && (
        <g>
          <rect x={22} y={98} width={20} height={16} rx={6} fill="var(--color-storage-deep)" />
          <rect x={78} y={98} width={20} height={16} rx={6} fill="var(--color-storage-deep)" />
          <rect x={10} y={10} width={100} height={96} rx={24} fill="var(--color-storage-shade)" />
          <rect x={10} y={4} width={100} height={96} rx={24} fill="var(--color-storage)" />
          <rect x={22} y={10} width={76} height={5} rx={2.5} fill="#fff" opacity={0.25} />
          <circle cx={60} cy={66} r={28} fill="var(--color-storage-light)" stroke="var(--color-storage-shade)" strokeWidth={4} />
          <g fill="var(--color-storage-shade)"><circle cx={60} cy={43} r={2.5} /><circle cx={83} cy={66} r={2.5} /><circle cx={60} cy={89} r={2.5} /><circle cx={37} cy={66} r={2.5} /></g>
          <clipPath id="vault-window"><rect x={45} y={53} width={30} height={27} rx={9} /></clipPath>
          <rect x={45} y={53} width={30} height={27} rx={9} fill="var(--color-vault-window)" />
          <g clipPath="url(#vault-window)">
            <rect className="vault-fill" x={45} y={80 - 27 * Math.min(1, s.fill ?? 0)} width={30} height={27} fill="var(--color-coin)" />
            {(s.fill ?? 0) > 0.05 && <rect x={45} y={80 - 27 * Math.min(1, s.fill ?? 0)} width={30} height={3} fill="var(--color-coin-light)" />}
          </g>
          {(s.fill ?? 0) <= 0.05 && <rect x={48} y={76} width={24} height={2.5} rx={1.2} fill="var(--color-failed)" />}
          <path d="M64 56 l7 0 -10 14 -5 0z" fill="#fff" opacity={0.15} />
          <Face x1={44} x2={76} y={29} mood={mood} mouthY={40} rx={4.5} ry={5.5} mouth="flat" />
        </g>
      )}
      {type === 'Gate' && (
        <g>
          <Block fam="logic" />
          <g className="gate-arm" style={{ transform: s.armUp ? 'rotate(-28deg)' : 'rotate(0deg)', transformOrigin: '30px 29px' }}>
            <rect x={22} y={22} width={94} height={14} rx={7} fill="#fff" stroke={INK} strokeWidth={3.5} />
            <g fill="var(--color-failed)"><rect x={44} y={24} width={11} height={10} /><rect x={68} y={24} width={11} height={10} /><rect x={92} y={24} width={11} height={10} /></g>
          </g>
          <circle cx={30} cy={29} r={9} fill={INK} /><circle cx={30} cy={29} r={3} fill="var(--color-logic)" />
          <Face x1={46} x2={74} y={64} mood={mood === 'idle' ? 'idle' : mood} mouthY={84} mouth="flat" />
          {mood === 'idle' && <path d="M38 53 L52 55 M82 53 L68 55" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />}
        </g>
      )}
      {type === 'Worker' && (
        <g>
          <Block fam="crew" />
          <path d="M30 26 Q30 2 60 2 Q90 2 90 26 Z" fill="var(--color-input)" />
          <rect x={56} y={3} width={8} height={22} rx={4} fill="var(--color-coin-rim)" />
          <rect x={20} y={22} width={80} height={9} rx={4.5} fill="var(--color-coin-rim)" />
          <Face x1={46} x2={74} y={52} mood={mood} mouthY={68} rx={5} ry={6.5} />
          <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round">
            <rect x={44} y={83} width={34} height={8} rx={3} fill="var(--color-coin)" />
            <path d="M48 91 v7 h6 v-7 M58 91 v5 h5 v-5" fill="var(--color-coin)" />
            <circle cx={86} cy={87} r={12} fill="var(--color-coin)" />
            <circle cx={86} cy={87} r={4} fill={INK} stroke="none" />
          </g>
          <path className={`glint ${s.glint ? 'on' : ''}`} d="M104 66 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" />
        </g>
      )}
      {type === 'Payout' && (
        <g>
          <Block fam="output" />
          <path d="M86 50 H104 a8 8 0 0 1 8 8 V84 a8 8 0 0 1 -8 8 H86 Z" fill="var(--color-output-shade)" />
          <rect x={90} y={56} width={16} height={30} rx={6} fill={INK} />
          <g className={`chute-coin ${s.glow ? 'pop' : ''}`}>
            <circle cx={103} cy={70} r={11} fill="var(--color-coin-rim)" /><circle cx={103} cy={70} r={8.5} fill="var(--color-coin)" />
            <rect x={101} y={64} width={3} height={12} rx={1.5} fill="var(--color-coin-light)" />
          </g>
          <Face x1={38} x2={64} y={50} mood={mood === 'idle' ? 'happy' : mood} mouthY={68} mouth="grin" />
        </g>
      )}
      {type === 'Portal' && (
        <g>
          <Block fam="portal" />
          <circle cx={60} cy={56} r={36} fill="var(--color-portal-shade)" />
          <circle cx={60} cy={56} r={29} fill="var(--color-portal-light)" />
          <circle cx={60} cy={56} r={22} fill={INK} />
          <g className={`swirl ${s.spinning ? 'on' : ''}`} style={{ transformOrigin: '60px 56px' }}>
            <path d="M60 41 a15 15 0 0 1 15 15 M45 56 a15 15 0 0 1 6 -12 M75 62 a15 15 0 0 1 -22 10" fill="none" stroke="var(--color-portal-shade)" strokeWidth={3} strokeLinecap="round" />
          </g>
          {mood === 'happy' ? (
            <g fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><path d="M49 58 q4 -6 8 0" /><path d="M63 58 q4 -6 8 0" /></g>
          ) : mood === 'worried' ? (
            <g fill="#fff"><ellipse cx={53} cy={57} rx={2.6} ry={3.4} /><ellipse cx={67} cy={57} rx={2.6} ry={3.4} /></g>
          ) : mood === 'surprised' ? (
            <g fill="#fff"><circle cx={53} cy={55} r={4.6} /><circle cx={67} cy={55} r={4.6} /></g>
          ) : (
            <g fill="#fff"><ellipse cx={53} cy={56} rx={3.2} ry={4.4} /><ellipse cx={67} cy={56} rx={3.2} ry={4.4} /></g>
          )}
          <g fill={INK} opacity={0.55}><circle cx={38} cy={99} r={3} /><circle cx={60} cy={99} r={3} /><circle cx={82} cy={99} r={3} /></g>
        </g>
      )}
    </svg>
  );
}

function PieShare({ share }: { share: number }) {
  // share = fraction going to port 0 (gold); the rest is lilac-grey.
  const r = 21;
  const a = Math.max(0.0001, Math.min(0.9999, share)) * Math.PI * 2;
  const x = 60 + r * Math.sin(a);
  const y = 78 - r * Math.cos(a);
  const large = share > 0.5 ? 1 : 0;
  return (
    <g>
      <circle cx={60} cy={78} r={r} fill="var(--color-storage)" opacity={0.35} />
      <path d={`M60 78 L60 ${78 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill="var(--color-coin)" />
    </g>
  );
}

export function CoinArt({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx={12} cy={12} r={11.5} fill="var(--color-coin-rim)" /><circle cx={12} cy={12} r={9} fill="var(--color-coin)" />
      <rect x={10.4} y={5.5} width={3.2} height={13} rx={1.6} fill="var(--color-coin-light)" />
    </svg>
  );
}

export function CustomerArt({ mood = 'idle', size = 90 }: { mood?: Mood; size?: number }) {
  return (
    <svg viewBox="0 0 90 110" width={size} height={size * 110 / 90} aria-hidden className="customer-art">
      <ellipse cx={45} cy={104} rx={30} ry={5} fill={INK} opacity={0.1} />
      <g fill={INK}><ellipse cx={34} cy={100} rx={8} ry={5} /><ellipse cx={56} cy={100} rx={8} ry={5} /></g>
      <rect x={16} y={32} width={58} height={68} rx={29} fill="var(--color-customer-shade)" />
      <rect x={16} y={26} width={58} height={68} rx={29} fill="var(--color-customer)" />
      <path d="M70 62 L84 54" stroke="var(--color-customer-shade)" strokeWidth={9} strokeLinecap="round" />
      {mood === 'happy' ? (
        <g fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round"><path d="M37 55 q5 -7 10 0" /><path d="M55 55 q5 -7 10 0" /></g>
      ) : (
        <g><g fill={INK}><ellipse cx={42} cy={54} rx={4.5} ry={6} /><ellipse cx={60} cy={54} rx={4.5} ry={6} /></g>
          <g fill="#fff"><circle cx={44} cy={52} r={1.6} /><circle cx={62} cy={52} r={1.6} /></g></g>
      )}
      <path d={mood === 'happy' ? 'M43 66 Q51 76 59 66' : 'M45 67 Q51 72 57 67'} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <g fill="var(--color-cheek-customer)" opacity={0.5}><ellipse cx={32} cy={64} rx={5} ry={3} /><ellipse cx={68} cy={63} rx={4} ry={3} /></g>
      {/* a shopping-tag hat: this is a scripted (seeded) customer, not an AI */}
      <g transform="translate(45 14) rotate(-12)">
        <rect x={-12} y={-8} width={24} height={14} rx={4} fill="#fff" stroke={INK} strokeWidth={2.5} />
        <circle cx={-6} cy={-1} r={2} fill={INK} />
      </g>
    </svg>
  );
}
