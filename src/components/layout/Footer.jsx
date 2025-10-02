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
        margin: 0
      }}>
        Built with ❤️ for the TCG community
      </p>
    </footer>
  );
};

export default Footer;
