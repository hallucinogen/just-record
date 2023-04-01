import React, { useState, useEffect } from "react";
import "./App.css";
import play from "./play.svg";
import stop from "./stop.svg";
import pause from "./pause.svg";
import MultiStreamsMixer from "multistreamsmixer";

var videoPreview = document.querySelector("video");
var mixerOptions = {};
var mixer;
var mediaRecorder;
var recordedBlobs;

function fullCanvasRenderHandler(stream, textToDisplay) {
  // on-video-render:
  // called as soon as this video stream is drawn (painted or recorded) on canvas2d surface
  stream.onRender = function (context, x, y, width, height, idx) {
    context.font = "50px Georgia";
    var measuredTextWidth = parseInt(
      context.measureText(textToDisplay).width
    );
    x = x + (parseInt(width - measuredTextWidth) - 40);
    y = y + 80;
    context.strokeStyle = "rgb(255, 0, 0)";
    context.fillStyle = "rgba(255, 255, 0, .5)";
    roundRect(context, x - 20, y - 55, measuredTextWidth + 40, 75, 20, true);
    var gradient = context.createLinearGradient(0, 0, width * 2, 0);
    gradient.addColorStop("0", "magenta");
    gradient.addColorStop("0.5", "blue");
    gradient.addColorStop("1.0", "red");
    context.fillStyle = gradient;
    context.fillText(textToDisplay, x, y);
  };
}

function normalVideoRenderHandler(stream, textToDisplay, callback) {
  // on-video-render:
  // called as soon as this video stream is drawn (painted or recorded) on canvas2d surface
  stream.onRender = function (context, x, y, width, height, idx, ignoreCB) {
    if (!ignoreCB && callback) {
      callback(context, x, y, width, height, idx, textToDisplay);
      return;
    }

    context.font = "40px Georgia";
    var measuredTextWidth = parseInt(
      context.measureText(textToDisplay).width
    );
    x = x + parseInt(width - measuredTextWidth) / 2;
    y = context.canvas.height - height + 50;
    context.strokeStyle = "rgb(255, 0, 0)";
    context.fillStyle = "rgba(255, 255, 0, .5)";
    roundRect(context, x - 20, y - 35, measuredTextWidth + 40, 45, 20, true);
    var gradient = context.createLinearGradient(0, 0, width * 2, 0);
    gradient.addColorStop("0", "magenta");
    gradient.addColorStop("0.5", "blue");
    gradient.addColorStop("1.0", "red");
    context.fillStyle = gradient;
    context.fillText(textToDisplay, x, y);
  };
}

/**
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 5] The corner radius; It can also be an object
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
// via: http://stackoverflow.com/a/3368118/552182
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == "undefined") {
    stroke = true;
  }
  if (typeof radius === "undefined") {
    radius = 5;
  }
  if (typeof radius === "number") {
    radius = {
      tl: radius,
      tr: radius,
      br: radius,
      bl: radius,
    };
  } else {
    var defaultRadius = {
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    };
    for (var side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side];
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius.br,
    y + height
  );
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
}

function App() {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);

  useEffect(() => {
    let handlePermission = async () => {
      mixerOptions.value = "camera-screen";
      let camera = await startCameraAndScreen();
      console.log(permissionAllowed);
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

  function handleDataAvailable(event) {
    console.log("handleDataAvailable", event);
    if (event.data && event.data.size > 0) {
      recordedBlobs.push(event.data);
    }
  }

  function stopRecording() {
    mediaRecorder.stop();
  }

  async function download() {
    const blob = new Blob(recordedBlobs, { type: "video/webm" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = new Date().getTime() + ".webm";
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
