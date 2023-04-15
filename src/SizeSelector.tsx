import React from 'react';

interface Props {
  selectedSize: string;
  onSizeSelect: (size: string) => void;
  style?: React.CSSProperties;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    backgroundColor: '#f5f5f7',
    borderRadius: '6px',
    color: '#1c1c1e',
    fontWeight: 800,
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    flexGrow: 1,
    textAlign: 'center',
    fontSize: '32px',
    padding: '6px'
  },
  selectedButton: {
    backgroundColor: '#1c1c1e',
    color: '#ffffff',
  },
};

const SizeSelector: React.FC<Props> = ({ selectedSize, onSizeSelect, style }) => {
  const sizes = [
    { name: 'No Selfie Camera', emoji: '✖️' },
    { name: 'Small Selfie Camera', emoji: '◯' },
    { name: 'Huge Selfie Camera', emoji: '⬤' },
  ];

  return (
    <div style={{ ...styles.container, ...style }}>
      {sizes.map((size) => (
        <button
          key={size.name}
          style={{
            ...styles.button,
            ...(selectedSize === size.name ? styles.selectedButton : {}),
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
