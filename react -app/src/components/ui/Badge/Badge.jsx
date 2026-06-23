import './Badge.css';

/**
 * Badge — Waitless UI Kit
 *
 * @prop {string} variant
 *   Specialty: 'cardiology' | 'dermatology' | 'pediatrics' | 'orthopedics' | 'neutral'
 *   Status:    'available' | 'waiting' | 'in-session' | 'confirmed' | 'no-show' | 'completed' | 'verified' | 'today' | 'wait-days'
 * @prop {boolean} showDot  - show animated live dot (auto-shown for 'waiting', 'available', 'today')
 * @prop {string}  label    - text content (overrides children)
 * @prop {node}    children
 *
 * @example
 * <Badge variant="cardiology">Cardiology</Badge>
 * <Badge variant="waiting">Waiting</Badge>
 * <Badge variant="confirmed">✓ Confirmed</Badge>
 * <Badge variant="today">Today</Badge>
 */

const DOT_VARIANTS = new Set(['waiting', 'available', 'today']);

export default function Badge({
  variant = 'neutral',
  showDot,
  label,
  children,
  className = '',
}) {
  const hasDot = showDot ?? DOT_VARIANTS.has(variant);

  return (
    <span className={`badge badge--${variant} ${className}`}>
      {hasDot && <span className="badge__dot" />}
      {label ?? children}
    </span>
  );
}
