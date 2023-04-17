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
    { name: 'No Selfie Camera', emoji: '✖️', fontSize: '20px' },
    { name: 'Small Selfie Camera', emoji: '◯', fontSize: '12px' },
    { name: 'Huge Selfie Camera', emoji: '◯', fontSize: '24px' },
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
