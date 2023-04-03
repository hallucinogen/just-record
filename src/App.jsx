import React, { useState, useEffect } from "react";
import "./App.css";
import play from "./play.svg";
import stop from "./stop.svg";
import MultiStreamsMixer from "multistreamsmixer";

var videoPreview = document.querySelector("video");
var mixerOptions = {};
var mixer;
var mediaRecorder;
var recordedBlobs;

function App() {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);

  useEffect(() => {
    let handlePermission = async () => {
      mixerOptions.value = "camera-screen";
      let camera = await startCameraAndScreen();
      if (camera === null) {
        setPermission(false);
      } else {
        setPermission(true);
      }
    };
    handlePermission();
  }, []);

  function addStreamStopListener(stream, callback) {
    stream.addEventListener(
      "ended",
      function () {
        callback();
        callback = function () {};
      },
      false
    );
    stream.addEventListener(
      "inactive",
      function () {
        callback();
        callback = function () {};
      },
      false
    );
    stream.getTracks().forEach(function (track) {
      track.addEventListener(
        "ended",
        function () {
          callback();
          callback = function () {};
        },
        false
      );
      track.addEventListener(
        "inactive",
        function () {
          callback();
          callback = function () {};
        },
        false
      );
    });
  }

  function afterScreenCaptured(screenStream) {
    
    cameraStream().then(async function (cameraStream) {
        screenStream.fullcanvas = true;

        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        const cameraWidth = parseInt((20/100) * screenWidth);
        const cameraHeight = parseInt((20/100) * screenHeight);

        cameraStream.width = cameraWidth;
        cameraStream.height = cameraHeight;
        cameraStream.top = screenHeight - cameraHeight;
        cameraStream.left = screenWidth - cameraWidth;

        screenStream.width = screenWidth;
        screenStream.height = screenHeight;

        // fullCanvasRenderHandler(screenStream, "");
        // normalVideoRenderHandler(cameraStream, "");

        mixer = new MultiStreamsMixer([screenStream, cameraStream]);

        mixer.frameInterval = 1;
        mixer.startDrawingFrames();
        videoPreview = document.querySelector("video");
        videoPreview.srcObject = mixer.getMixedStream();
        
        // stop listener
        addStreamStopListener(screenStream, async function () {
          mixer.releaseStreams();
          videoPreview.pause();
          videoPreview.src = null;
          if (videoPreview === document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
          cameraStream.getTracks().forEach(function (track) {
            track.stop();
          });
          screenStream.getTracks().forEach(function (track) {
            track.stop();
          });
        });
      });
  }

  async function startCameraAndScreen() {
    let captureStream = null;
    
    try {
      captureStream = await screenStream().then((screenStream) => {
        afterScreenCaptured(screenStream);
      });
    } catch (err) {
      console.error("Error: " + err);
    }

    return captureStream;
  }

  async function screenStream() {
    if (navigator.getDisplayMedia) {
      return navigator.getDisplayMedia({ video: true });
    } else if (navigator.mediaDevices.getDisplayMedia) {
      return navigator.mediaDevices
          .getDisplayMedia({ video: true });
    }

    alert("getDisplayMedia API is not supported by this browser.");
    return null;
  }

  async function cameraStream() {
    let captureStream = null;
    
    try {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
  
      const cameraWidth = parseInt((20/100) * screenWidth);
      const cameraHeight = parseInt((20/100) * screenHeight);

      captureStream = navigator.mediaDevices.getUserMedia({
        video:  {
          width: cameraWidth,
          height: cameraHeight,
          frameRate: 15
        },
        audio: true,
      });
    } catch (err) {
      console.error("Error: " + err);
    }
    return captureStream;
  }

  function startRecording() {
    recordedBlobs = [];
    let options = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = { mimeType: "video/webm;codecs=vp8,opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = { mimeType: "video/webm" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.error(`${options.mimeType} is not supported`);
          options = { mimeType: "" };
        }
      }
    }

    try {
      mediaRecorder = new MediaRecorder(mixer.getMixedStream(), options);
    } catch (e) {
      console.error("Exception while creating MediaRecorder:", e);
      return;
    }

    console.log(
      "Created MediaRecorder",
      mediaRecorder,
      "with options",
      options
    );
    mediaRecorder.onstop = async (event) => {
      console.log("Recorder stopped: ", event);
      console.log("Recorded Blobs: ", recordedBlobs);
      download();
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();
    console.log("MediaRecorder started", mediaRecorder);
    setStart(true);
  }

  function stopRecording() {
    mediaRecorder.stop();
  }


  function handleDataAvailable(event) {
    console.log("handleDataAvailable", event);
    if (event.data && event.data.size > 0) {
      recordedBlobs.push(event.data);
    }
  }

  async function download() {
    const blob = new Blob(recordedBlobs, { type: "video/webm" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "Recording-" + new Date().toISOString() + ".webm";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    setStart(false);
    videoPreview.pause();
    videoPreview.src = null;
  }

  return (
    <div className="App">
      <h2>Just Record</h2>
      <p className="info">
        Not supported in small devices. Please open in desktop browser
      </p>

      <div className="layout">
        {permissionAllowed ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <video
              id="video"
              style={{ height: "70%", backgroundColor: "#444" }}
              autoPlay
              muted
              playsInline
            >
              Your browser does not support the video tag.
            </video>
            
            <div
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                marginTop: 24,
              }}
            >
              {!started && (
                <button
                  style={{
                    border: "1px solid #111",
                    borderRadius: 4,
                    cursor: "pointer",
                    margin: "auto",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                    width: 100,
                    backgroundColor: "#fff",
                  }}
                  onClick={() => startRecording()}
                >
                  <img
                    src={play}
                    alt="play"
                    style={{ height: 36, marginRight: 8 }}
                  ></img>{" "}
                  Start
                </button>
              )}
              {started && (
                <button
                  style={{
                    border: "1px solid #111",
                    borderRadius: 4,
                    cursor: "pointer",
                    margin: "auto",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                    width: 180,
                    backgroundColor: "#fff",
                  }}
                  onClick={() => stopRecording()}
                >
                  <img
                    src={stop}
                    alt="stop"
                    style={{ height: 36, marginRight: 8 }}
                  ></img>{" "}
                  Stop & Save
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <video
              src=""
              style={{ backgroundColor: "#444", height: 200 }}
            ></video>
            <p>
              <span style={{ fontWeight: 600 }}>Note: </span>You need to allow
              camera, audio, and screen sharing permission to start recording.
            </p>
            <p>
              <span>Refresh the page and try again.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
