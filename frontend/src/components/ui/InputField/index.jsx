import { useId } from 'react';
import './index.css';

/**
 * InputField — accessible form control wrapper.
 *
 * @param {string}  id
 * @param {string}  label
 * @param {string}  [type='text']
 * @param {string}  [error]         Error message string. null/undefined = no error.
 * @param {string}  [hint]          Helper text below the input.
 * @param {boolean} [required]
 * @param {string}  [autoComplete]
 * @param {'input'|'textarea'|'select'} [as='input']
 * @param {import('react').ReactNode} [children]  Used when as='select'
 */
export function InputField({
  id,
  label,
  type = 'text',
  error,
  hint,
  required = false,
  autoComplete,
  as: Component = 'input',
  children,
  className = '',
  ...rest
}) {
  const uid = useId();
  const fieldId = id ?? uid;
  const errorId = `${fieldId}-error`;
  const hintId  = `${fieldId}-hint`;

  const describedBy = [
    error ? errorId : null,
    hint  ? hintId  : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`input-field ${error ? 'input-field--error' : ''} ${className}`}>
      <label className="input-field__label" htmlFor={fieldId}>
        {label}
        {required && <span className="input-field__required" aria-hidden="true"> *</span>}
      </label>

      <Component
        id={fieldId}
        type={Component === 'input' ? type : undefined}
        className="input-field__control"
        aria-describedby={describedBy}
        aria-invalid={!!error}
        aria-required={required}
        autoComplete={autoComplete}
        {...rest}
      >
        {children}
      </Component>

      {error && (
        <span id={errorId} className="input-field__error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="input-field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}
