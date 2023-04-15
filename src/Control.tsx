import React, { useState, useEffect } from 'react';
import play from './play.svg';
import stop from './stop.svg';

interface ControlProps {
  started: boolean;
  onStop: () => void;
  onStart: () => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  controlContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'fixed',
    bottom: '32px',
    left: '32px',
  },
  playPauseButton: {
    border: '1px solid #ccc',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '24px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    backgroundColor: '#F2F2F5',
  },
  recordingTime: {
    color: '#111',
    fontSize: '16px',
    marginLeft: '8px',
  },
};

const Control: React.FC<ControlProps> = ({ started, onStop, onStart }) => {
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (started) {
      interval = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [started]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.controlContainer}>
      <button
        style={styles.playPauseButton}
        onClick={() => (started ? onStop() : onStart())}
      >
        {started ? (
          <img src={stop} alt="stop" style={{ height: 30 }}></img>
        ) : (
          <img src={play} alt="play" style={{ height: 30 }}></img>
        )}
        <span style={styles.recordingTime}>{formatTime(recordingTime)}</span>
      </button>
      
    </div>
  );
};

export default Control;
