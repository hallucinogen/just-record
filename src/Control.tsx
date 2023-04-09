import React from 'react';
import play from './play.svg';
import stop from './stop.svg';

interface ControlProps {
  started: boolean;
  onStop: () => void;
  onStart: () => void;
}

const Control: React.FC<ControlProps> = ({ started, onStop, onStart }) => (
  <button
    className="play-pause-button"
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
