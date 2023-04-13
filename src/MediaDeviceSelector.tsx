import React from 'react';

interface Props {
  onDeviceSelect: (audioDeviceId: string, videoDeviceId: string) => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontWeight: 600,
    color: '#1c1c1e',
    marginBottom: '4px',
  },
  select: {
    backgroundColor: '#f5f5f7',
    borderRadius: '6px',
    padding: '6px',
    color: '#1c1c1e',
    fontWeight: 400,
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
  },
};

const MediaDeviceSelector: React.FC<Props> = ({ onDeviceSelect }) => {
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);

  React.useEffect(() => {
    async function fetchDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((device) => device.kind === 'audioinput'));
      setVideoDevices(devices.filter((device) => device.kind === 'videoinput'));
    }

    fetchDevices();
  }, []);

  const handleAudioDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const audioDeviceId = event.target.value;
    const videoDeviceId = videoDevices.length > 0 ? videoDevices[0].deviceId : '';
    onDeviceSelect(audioDeviceId, videoDeviceId);
  };

  const handleVideoDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const videoDeviceId = event.target.value;
    const audioDeviceId = audioDevices.length > 0 ? audioDevices[0].deviceId : '';
    onDeviceSelect(audioDeviceId, videoDeviceId);
  };

  return (
    <div style={styles.container}>
      <label htmlFor="audio-device-selector" style={styles.label}>
        Audio:
      </label>
      <select
        id="audio-device-selector"
        onChange={handleAudioDeviceChange}
        style={styles.select}
      >
        {audioDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <label htmlFor="video-device-selector" style={styles.label}>
        Video:
      </label>
      <select
        id="video-device-selector"
        onChange={handleVideoDeviceChange}
        style={styles.select}
      >
        {videoDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );  
};

export default MediaDeviceSelector;
