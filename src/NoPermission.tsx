import React from 'react';

const NoPermission: React.FC = () => (
    <div
        style={{
            display: "block",
            justifyContent: "space-between",
            marginTop: 12,
            marginBottom: 12,
        }}>
        <div className="info">
            Not supported in small devices. Please open in desktop browser
        </div>
        <div>
            <span style={{ fontWeight: 600 }}>Note: </span>You need to allow
            camera, audio, and screen sharing permission to start recording.
        </div>
        <div>
            <span>Refresh the page and try again.</span>
        </div>
    </div>
);

export default NoPermission;