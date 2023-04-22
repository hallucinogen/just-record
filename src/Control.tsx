import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-use-gesture';
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
    touchAction: 'none',
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
    padding: '8px 16px',
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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const prevPosition = useRef({ x: 0, y: 0 });


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

  const bind = useDrag(
    ({ down, movement: [x, y], tap }) => {
      if (tap) {
        setDragging(false);
      } else if (down) {
        setDragging(true);
        setPosition({ x: prevPosition.current.x + x, y: prevPosition.current.y + y });
      } else if (!down) {
        setTimeout(() => setDragging(false), 50);
        prevPosition.current = { x: position.x, y: position.y };
      }
    },
    { eventOptions: { passive: false } },
  );

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (dragging) {
      event.stopPropagation();
      return;
    }

    started ? onStop() : onStart();
  };

  return (
    <div
      {...bind()}
      style={{
        ...styles.controlContainer,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <button
        style={{
          ...styles.playPauseButton,
          backgroundColor: started ? '#FF4136' : '#2ECC71',
        }}
        onClick={handleButtonClick}
      >
        {started ? (
          <>
            <img src={stop} alt="stop" style={{ height: 30 }} />
            <span style={styles.recordingTime}>{formatTime(recordingTime)}</span>
          </>
        ) : (
          <>
            <img src={play} alt="play" style={{ height: 30 }} />
            <span style={{ ...styles.recordingTime, marginLeft: '8px' }}>Start Recording</span>
          </>
        )}
      </button>
    </div>
  );
};

export default Control;
