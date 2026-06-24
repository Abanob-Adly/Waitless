import './Badge.css';

type BadgeVariant =
  | 'cardiology' | 'dermatology' | 'pediatrics' | 'orthopedics' | 'neutral'
  | 'available' | 'waiting' | 'in-session' | 'confirmed'
  | 'no-show' | 'completed' | 'verified' | 'today' | 'wait-days';

interface BadgeProps {
  variant?: BadgeVariant;
  showDot?: boolean;
  label?: string;
  children?: React.ReactNode;
  className?: string;
}

const DOT_VARIANTS = new Set<BadgeVariant>(['waiting', 'available', 'today']);

export default function Badge({
  variant = 'neutral',
  showDot,
  label,
  children,
  className = '',
}: BadgeProps) {
  const hasDot = showDot ?? DOT_VARIANTS.has(variant);

  return (
    <span className={`badge badge--${variant} ${className}`}>
      {hasDot && <span className="badge__dot" />}
      {label ?? children}
    </span>
  );
}