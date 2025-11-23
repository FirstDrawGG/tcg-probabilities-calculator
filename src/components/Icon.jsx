import React from 'react';
import {
  Info,
  PlusCircle,
  Plus,
  MinusCircle,
  Minus,
  StarFour,
  QuestionMark,
  TrayArrowUp,
  Hand,
  Bomb,
  AsteriskSimple,
  Calculator,
  StackPlus,
  RowsPlusBottom,
  ArrowCounterClockwise,
  Sigma,
  X,
  XCircle,
  XSquare,
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  Funnel,
  Image,
  Video
} from '@phosphor-icons/react';

const Icon = ({ name, variant = 'main', ariaLabel, className = '', style = {}, ...props }) => {
  const iconMap = {
    'info': Info,
    'plus-circle': PlusCircle,
    'plus': Plus,
    'minus-circle': MinusCircle,
    'minus': Minus,
    'star-four': StarFour,
    'question-mark': QuestionMark,
    'tray-arrow-up': TrayArrowUp,
    'hand': Hand,
    'bomb': Bomb,
    'asterisk-simple': AsteriskSimple,
    'calculator': Calculator,
    'stack-plus': StackPlus,
    'rows-plus-bottom': RowsPlusBottom,
    'arrow-counter-clockwise': ArrowCounterClockwise,
    'sigma': Sigma,
    'x': X,
    'x-circle': XCircle,
    'x-square': XSquare,
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight,
    'magnifying-glass': MagnifyingGlass,
    'funnel': Funnel,
    'image': Image,
    'video': Video
  };

  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }

  const colorVariable = variant === 'secondary' ? 'var(--icon-secondary)' : 'var(--icon-main)';
  
  const defaultStyle = {
    color: colorVariable,
    cursor: 'pointer',
    ...style
  };

  return (
    <IconComponent 
      weight="light"
      className={className}
      style={defaultStyle}
      aria-label={ariaLabel}
      {...props}
    />
  );
};

export default Icon;