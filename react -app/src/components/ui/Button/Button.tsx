import './Button.css';

type ButtonVariant = 'navy' | 'gold' | 'outline-navy' | 'ghost' | 'danger' | 'danger-filled';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit' | 'reset';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: ButtonType;
  children: React.ReactNode;
  className?: string;
}

export default function Button({
  variant = 'navy',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  type = 'button',
  children,
  className = '',
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    (disabled || loading) ? 'btn--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <svg className="btn__spinner" viewBox="0 0 24 24">
          <circle
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4" fill="none"
            style={{ opacity: 0.25 }}
          />
          <path
            fill="currentColor"
            style={{ opacity: 0.75 }}
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}