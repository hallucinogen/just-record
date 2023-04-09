import React, { useState, useEffect } from "react";
import "./App.css";
import MultiStreamsMixer from "multistreamsmixer";
import Control from "./Control";
import NoPermission from "./NoPermission"

var videoPreview = document.querySelector("video");
var mixer;
var mediaRecorder;
var recordedBlobs;

function addStreamStopListener(stream, callback) {
  stream.addEventListener(
    "ended",
    function () {
      callback();
      callback = function () { };
    },
    false
  );
  stream.addEventListener(
    "inactive",
    function () {
      callback();
      callback = function () { };
    },
    false
  );
  stream.getTracks().forEach(function (track) {
    track.addEventListener(
      "ended",
      function () {
        callback();
        callback = function () { };
      },
      false
    );
    track.addEventListener(
      "inactive",
      function () {
        callback();
        callback = function () { };
      },
      false
    );
  });
}

const App: React.FC = () => {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);

  useEffect(() => {
    let handlePermission = async () => {
      let camera = await startCameraAndScreen();
      if (camera === null) {
        setPermission(false);
      } else {
        setPermission(true);
      }
    };
    handlePermission();
  }, []);

  function afterScreenCaptured(screenStream) {
    cameraStream().then(async function (cameraStream) {
      screenStream.fullcanvas = true;

      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const cameraWidth = (20 / 100) * screenWidth;
      const cameraHeight = (20 / 100) * screenHeight;

      cameraStream.width = cameraWidth;
      cameraStream.height = cameraHeight;
      cameraStream.top = screenHeight - cameraHeight;
      cameraStream.left = screenWidth - cameraWidth;

      screenStream.width = screenWidth;
      screenStream.height = screenHeight;

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
    if (navigator.mediaDevices.getDisplayMedia) {
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

      const cameraWidth = (20 / 100) * screenWidth;
      const cameraHeight = (20 / 100) * screenHeight;

      captureStream = navigator.mediaDevices.getUserMedia({
        video: {
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
      <div className="layout">
        <div
          style={{
            display: "relative",
            alignItems: "center",
            width: "100%"
          }}
        >
          <video
            id="video"
            style={{ height: permissionAllowed ? "100vh" : "80vh", backgroundColor: "#444" }}
            autoPlay
            muted
            playsInline
          >
            Your browser does not support the video tag.
          </video>

          {!permissionAllowed ? <NoPermission /> : <Control started={started} onStart={startRecording} onStop={stopRecording} />}
        </div>
      </div>
    </div>
  );
}

export default App;
