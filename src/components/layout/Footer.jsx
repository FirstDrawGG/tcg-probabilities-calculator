import React from 'react';

const Footer = ({ typography }) => {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-main)',
      paddingTop: '20px',
      marginTop: '40px',
      textAlign: 'center'
    }}>
      <p style={{
        ...typography.small,
        color: 'var(--text-secondary)',
        margin: 0,
        marginBottom: '8px'
      }}>
        Built with ❤️ for the Yu-Gi-Oh community
      </p>
      <p style={{
        ...typography.small,
        color: 'var(--text-secondary)',
        margin: 0,
        fontSize: '12px'
      }}>
        © 2025 FirstDrawGG. All rights reserved.
      </p>
    </footer>
  );
};

export default Footer;
