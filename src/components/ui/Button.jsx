import React from 'react';
import { TYPOGRAPHY } from '../../constants/config';

const Button = ({
  children,
  onClick,
  variant = 'primary', // 'primary' | 'secondary' | 'danger'
  size = 'medium', // 'small' | 'medium' | 'large'
  disabled = false,
  style = {},
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--bg-action)',
          color: 'var(--text-action)',
          border: 'none'
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-main)',
          border: '1px solid var(--border-main)'
        };
      case 'danger':
        return {
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none'
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { height: '32px', padding: '0 16px', fontSize: TYPOGRAPHY.small.fontSize };
      case 'large':
        return { height: '48px', padding: '0 24px', fontSize: TYPOGRAPHY.body.fontSize };
      default:
        return { height: '40px', padding: '0 20px', fontSize: TYPOGRAPHY.body.fontSize };
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: '999px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Geist Regular, sans-serif',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.2s',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
