import React, { useEffect, useRef } from 'react';

const BinomialCoefficient = ({ n, k }) => (
  <span className="binomial" aria-label={`${n} choose ${k}`}>
    <span className="top" aria-hidden="true">{n}</span>
    <span className="bottom" aria-hidden="true">{k}</span>
  </span>
);

const CardHeader = ({ cardName, logicOperator = '' }) => (
  <div style={{
    marginTop: logicOperator ? '16px' : '0',
    marginBottom: '8px',
    paddingBottom: '4px',
    borderBottom: '1px solid var(--border-main)'
  }}>
    {logicOperator && (
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: '12px',
        marginBottom: '4px',
        textAlign: 'center',
        fontFamily: 'Geist, sans-serif'
      }}>
        {logicOperator}
      </div>
    )}
    <div style={{
      color: 'var(--text-secondary)',
      fontWeight: 'normal',
      fontSize: 'var(--font-h3-size)',
      fontFamily: 'Geist, sans-serif'
    }}>
      {cardName}
    </div>
  </div>
);

const FormulaLine = ({ 
  probability, 
  n, 
  k, 
  remaining, 
  drawn, 
  totalCards, 
  handSize, 
  percentage,
  isRange = false,
  cardName = '',
  logicOperator = '',
  isMultiCard = false,
  isCardContent = false,
  isCardHeader = false,
  isCardDivider = false
}) => {
  // Render card headers and dividers
  if (isCardHeader || isCardDivider) {
    return <CardHeader cardName={cardName} logicOperator={isCardDivider ? logicOperator : ''} />;
  }

  return (
    <div className="formula-line" style={{ marginLeft: isCardContent ? '16px' : '0' }}>
      <span className="prob-label">
        {`P(X=${k}) = `}
      </span>
      {typeof k === 'string' || drawn === 'varies' ? (
        // Handle range cases or multi-card scenarios
        <span className="equals">= {percentage}</span>
      ) : (
        <>
          <BinomialCoefficient n={n} k={k} />
          <span className="operator">×</span>
          <BinomialCoefficient n={remaining} k={drawn} />
          <span className="operator">÷</span>
          <BinomialCoefficient n={totalCards} k={handSize} />
          <span className="equals">= {percentage}</span>
        </>
      )}
    </div>
  );
};

const FormulaDisplay = ({ 
  formulaData, 
  isExpanded = false, 
  onToggle 
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // Check if formula is wider than container for scroll indicator
      const container = containerRef.current;
      const isScrollable = container.scrollWidth > container.clientWidth;
      container.setAttribute('data-scrollable', isScrollable ? 'true' : 'false');
    }
  }, [formulaData, isExpanded]);

  if (!formulaData || !isExpanded) {
    return null;
  }

  const { type, scenarios, totalPercentage, metadata } = formulaData;
  
  return (
    <div 
      ref={containerRef}
      className={`formula-container ${isExpanded ? 'expanded' : ''}`}
    >
      <div className="formula-header">
        <h4 style={{
          margin: '0 0 12px 0',
          fontSize: 'var(--font-h3-size)',
          lineHeight: 'var(--font-h3-line-height)',
          fontFamily: 'Geist, sans-serif',
          fontWeight: '600',
          color: 'var(--text-main)'
        }}>
          Exact math behind combo
        </h4>
      </div>
      {scenarios.map((scenario, index) => (
        <FormulaLine
          key={index}
          probability={scenario.probability}
          n={scenario.n}
          k={scenario.k}
          remaining={scenario.remaining}
          drawn={scenario.drawn}
          totalCards={metadata.totalCards}
          handSize={metadata.handSize}
          percentage={scenario.percentage}
          isRange={type === 'range'}
          cardName={scenario.cardName}
          logicOperator={scenario.logicOperator}
          isMultiCard={type === 'multi-card'}
          isCardContent={scenario.isCardContent}
          isCardHeader={scenario.isCardHeader}
          isCardDivider={scenario.isCardDivider}
        />
      ))}
      
      {(type === 'range' && scenarios.length > 1) && (
        <div className="formula-total">
          <div className="formula-line">
            <span className="prob-label">Total = </span>
            <span className="equals">{totalPercentage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaDisplay;