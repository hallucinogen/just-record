import React from 'react';
import { SelfieSize } from './types/SelfieSize';

interface Props {
  selectedSize: string;
  onSizeSelect: (size: SelfieSize) => void;
  style?: React.CSSProperties;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    backgroundColor: '#F2F2F5',
    borderRadius: '24px',
    color: '#1c1c1e',
    fontWeight: 800,
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    flexGrow: 1,
    textAlign: 'center',
    fontSize: '20px',
    padding: '6px'
  },
  selectedButton: {
    backgroundColor: '#1c1c1e',
    color: '#ffffff',
  },
  label: {
    fontSize: '16px',
    marginBottom: '8px',
  },
};

const SizeSelector: React.FC<Props> = ({ selectedSize, onSizeSelect, style }) => {
  const sizes = [
    { name: SelfieSize.None, emoji: '✖️', fontSize: '20px' },
    { name: SelfieSize.SmallCircle, emoji: '◯', fontSize: '12px' },
    { name: SelfieSize.Rectangle, emoji: '◯', fontSize: '24px' },
  ];

  return (
    <div style={{ ...styles.container, ...style }}>
      <p style={styles.label}>Selfie Size</p>
      {sizes.map((size) => (
        <button
          key={size.name}
          style={{
            ...styles.button,
            ...(selectedSize === size.name ? styles.selectedButton : {}),
            ...{ fontSize: size.fontSize }
          }}
          onClick={() => onSizeSelect(size.name)}
          disabled={selectedSize === size.name}
        >
          {size.emoji}
        </button>
      ))}
    </div>
  );
};

export default SizeSelector;
