import React from 'react';
import { TYPOGRAPHY } from '../../constants/config';

const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  style = {},
  ...props
}) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '8px',
          color: 'var(--text-main)',
          fontFamily: 'Geist, sans-serif',
          fontSize: TYPOGRAPHY.body.fontSize
        }}>
          {label}
        </label>
      )}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: '40px',
          padding: '0 16px',
          borderRadius: '999px',
          border: `1px solid ${error ? '#dc2626' : 'var(--border-main)'}`,
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-main)',
          fontFamily: 'Geist, sans-serif',
          fontSize: TYPOGRAPHY.body.fontSize,
          outline: 'none',
          ...style
        }}
        {...props}
      />

      {(error || helperText) && (
        <p style={{
          marginTop: '4px',
          fontSize: TYPOGRAPHY.small.fontSize,
          color: error ? '#dc2626' : 'var(--text-secondary)'
        }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
