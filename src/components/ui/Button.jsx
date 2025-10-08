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
        boxSizing: 'border-box',
        width: '140px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0px 0.64px 2.16px -0.25px rgba(255, 255, 255, 0.05), 0px 1.93px 6.57px -0.5px rgba(255, 255, 255, 0.06), 0px 5.1px 17.36px -0.75px rgba(255, 255, 255, 0.08), 0px 8px 25px -1px rgba(255, 255, 255, 0.03)',
        overflow: 'hidden',
        gap: '4px',
        position: 'relative',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Geist, sans-serif',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.2s',
        border: 'none',
        ...getVariantStyles(),
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
