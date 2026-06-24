import './Input.css';

type InputState = 'default' | 'error' | 'success' | 'disabled';

interface SelectOption {
  value: string;
  label: string;
}

interface InputProps {
  label?: string;
  required?: boolean;
  state?: InputState;
  message?: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  options?: string[] | SelectOption[];
  id?: string;
  className?: string;
}

const ErrorIcon = () => (
  <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
  </svg>
);

const SuccessIcon = () => (
  <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
  </svg>
);

export default function Input({
  label,
  required = false,
  state = 'default',
  message,
  type = 'text',
  placeholder,
  value,
  onChange,
  options,
  id,
  className = '',
}: InputProps) {
  const fieldClass = [
    'input-field',
    state === 'error'    ? 'input-field--error'    : '',
    state === 'success'  ? 'input-field--success'  : '',
    state === 'disabled' ? 'input-field--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="input-wrapper">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
          {required && <span className="input-label__required">*</span>}
        </label>
      )}

      {options ? (
        <div className="input-select-wrapper">
          <select
            id={inputId}
            className={fieldClass}
            value={value}
            onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
            disabled={state === 'disabled'}
          >
            {options.map((opt) =>
              typeof opt === 'string'
                ? <option key={opt} value={opt}>{opt}</option>
                : <option key={opt.value} value={opt.value}>{opt.label}</option>
            )}
          </select>
          <span className="input-select-arrow"><ChevronDown /></span>
        </div>
      ) : (
        <input
          id={inputId}
          type={type}
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          disabled={state === 'disabled'}
        />
      )}

      {message && (
        <p className={`input-message input-message--${state}`}>
          {state === 'error'   && <ErrorIcon />}
          {state === 'success' && <SuccessIcon />}
          {message}
        </p>
      )}
    </div>
  );
}