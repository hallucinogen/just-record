import React from 'react';
import play from './play.svg';
import stop from './stop.svg';

interface ControlProps {
  started: boolean;
  onStop: () => void;
  onStart: () => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  playPauseButton: {
    border: '1px solid #111',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2,
  },
};


const Control: React.FC<ControlProps> = ({ started, onStop, onStart }) => (
  <button
    style={styles.playPauseButton}
    onClick={() => (started ? onStop() : onStart())}
  >
    {started ? (
      <>
        <img src={stop} alt="stop" style={{ height: 32, marginRight: 8 }}></img>{' '}
        Stop & Save
      </>
    ) : (
      <>
        <img src={play} alt="play" style={{ height: 32, marginRight: 8 }}></img>{' '}
        Start
      </>
    )}
  </button>
);

export default Control;
