import React from 'react';
import Icon from '../Icon';

const Header = ({ typography }) => {
  return (
    <div className="flex items-center justify-between mb-8 px-0">
      <div className="flex items-center">
        <img
          src="https://raw.githubusercontent.com/FirstDrawGG/tcg-probabilities-calculator/main/Logo.png"
          alt="FirstDrawGG Logo"
          style={{
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            marginRight: '8px'
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            const fallback = e.target.nextElementSibling;
            if (fallback) fallback.style.display = 'block';
          }}
        />
        <h1 style={{
          fontSize: '24px',
          lineHeight: '24px',
          color: 'var(--text-main)',
          fontFamily: 'Geist Regular, sans-serif',
          fontWeight: 'normal',
          margin: 0
        }}>
          FirstDrawGG
        </h1>
      </div>

      {/* Help button */}
      <a
        href="https://aboard-fog-a81.notion.site/FirstDrawGG-Help-Center-23130fcd61f381afb4e4e81f2f5db13b?source=copy_link"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--text-main)',
          fontFamily: 'Geist Regular, sans-serif',
          fontSize: '14px',
          lineHeight: '20px',
          borderRadius: '999px',
          border: 'none',
          height: '32px',
          paddingLeft: '16px',
          paddingRight: '16px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'opacity 0.2s ease'
        }}
        className="hover:opacity-80 transition-opacity"
      >
        <Icon name="question-mark" ariaLabel="Help" size={24} />
      </a>
    </div>
  );
};

export default Header;
