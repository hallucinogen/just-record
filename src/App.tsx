import React, { useState, useEffect } from "react";
import "./App.css";
import MultiStreamsMixer from "multistreamsmixer";
import Control from "./Control";
import NoPermission from "./NoPermission"
import MediaDeviceSelector from "./MediaDeviceSelector";
import { useDrag } from "react-use-gesture";
import { IDBPDatabase, openDB } from "idb";
import { SelfieSize } from './types/SelfieSize';
import JSZip from "jszip";


// TODO: All of these garbages need to move out of from this place and make the
// code less stateful
let db: IDBPDatabase<unknown>;
const dbName = "videoChunksDB";
const storeName = "videoChunks";

let mixer: MultiStreamsMixer;
let mediaRecorders: Array<MediaRecorder> = [];
let chunkIndexes = [0, 0, 0];
let cameraStreamState: MediaStream;
let screenStreamState: MediaStream;
let selectedAudioDevice: string = null;
let selectedVideoDevice: string = null;

let selfieSize: SelfieSize = SelfieSize.SmallCircle;

class IndexedDBStream {
  db: IDBPDatabase;
  storeName: string;
  chunkCount: number;
  currentChunk: number;

  constructor(db: IDBPDatabase, storeName: string, chunkCount: number) {
    this.db = db;
    this.storeName = storeName;
    this.chunkCount = chunkCount;
    this.currentChunk = 0;
  }

  async getNextChunk() {
    if (this.currentChunk < this.chunkCount) {
      const chunk = await this.db.get(this.storeName, this.currentChunk);
      this.currentChunk++;
      return chunk;
    } else {
      return null;
    }
  }
}

async function initDb() {
  db = await openDB(dbName, 2, {
    upgrade(db) {
      // Create object stores for each stream
      db.createObjectStore(`${storeName}_0`);
      db.createObjectStore(`${storeName}_1`);
      db.createObjectStore(`${storeName}_2`);
    },
  });
}

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

function maskCameraStreamToCircle(stream) {
  stream.preRender = function (context, x, y, width, height, idx, ignoreCB) {
    context.save();
    //context.translate(stream.left + stream.width, 0);
    //context.scale(-1, 1);

    context.beginPath();
    context.arc(stream.left + stream.height * 0.75, stream.top + stream.height / 2, stream.height / 2, 0, 2 * Math.PI);
    context.closePath();
    context.clip();
  }

  stream.postRender = function (context, x, y, width, height, idx, ignoreCB) {
    context.restore();
  }
}

function maskCameraStreamToPortrait(stream) {
  const borderRadius = 50; // Adjust the border radius as needed

  function drawRoundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  stream.preRender = function (context, x, y, width, height, idx, ignoreCB) {
    context.save();

    const portraitWidth = stream.height * 0.75; // Adjust the width-to-height ratio as needed
    const portraitX = stream.left + (stream.width - portraitWidth) / 2;

    drawRoundedRect(context, portraitX, stream.top, portraitWidth, stream.height, borderRadius);
    context.clip();
  }

  stream.postRender = function (context, x, y, width, height, idx, ignoreCB) {
    context.restore();
  }
}


const App: React.FC = () => {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);
  const cameraSelfieRef = React.useRef(null);
  const [xx, setX] = useState(0);
  const [yy, setY] = useState(0);
  // this is absolutely bad pattern. Should've used context instead
  const [licenseKeyValid, setLicenseKeyValid] = useState(false);

  const handleDeviceSelect = async (audioDeviceId: string, videoDeviceId: string, selectedSize: SelfieSize) => {
    selectedAudioDevice = audioDeviceId;
    selectedVideoDevice = videoDeviceId;

    selfieSize = selectedSize;

    let camera = await cameraStream();
    if (camera === null) {
      setPermission(false);
    } else {
      setPermission(true);
      updateScreenRendering();
    }
  };

  function updateCameraStreamPosition(x, y) {
    if (cameraStreamState) {
      const videoPreview = document.getElementById("screen") as HTMLVideoElement;
      const scaleWidth = videoPreview.clientWidth / videoPreview.videoWidth;
      const scaleHeight = videoPreview.clientHeight / videoPreview.videoHeight;

      const offsetX = (videoPreview.offsetWidth - videoPreview.clientWidth) / 2;
      const offsetY = (videoPreview.offsetHeight - videoPreview.clientHeight) / 2;

      cameraStreamState.top = yy + y / scaleHeight - offsetY / scaleHeight;
      cameraStreamState.left = xx + x / scaleWidth - offsetX / scaleWidth;
    }
  }


  const bind = useDrag(
    ({ offset: [x, y] }) => {
      const selfieElement = cameraSelfieRef.current;
      selfieElement.style.transform = `translate(${x}px, ${y}px)`;
      updateCameraStreamPosition(x, y);
    },
    { eventOptions: { passive: false } }
  );

  useEffect(() => {
    initDb();
    let handlePermission = async () => {
      let camera = await cameraStream();
      if (camera === null) {
        setPermission(false);
      } else {
        setPermission(true);
      }
    };
    handlePermission();
  }, []);

  function updateScreenRendering() {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    let cameraWidth;
    let cameraHeight;
    switch (selfieSize) {
      case SelfieSize.None:
        cameraWidth = 0;
        cameraHeight = 0;
        break;
      case SelfieSize.SmallCircle:
        cameraWidth = 0.2 * screenWidth;
        cameraHeight = 0.2 * screenHeight;

        cameraStreamState.left = screenWidth - cameraWidth;
        cameraStreamState.top = screenHeight - cameraHeight - 20;

        break;
      case SelfieSize.Rectangle:
        cameraWidth = 0.5 * screenWidth;
        cameraHeight = 0.5 * screenHeight;

        cameraStreamState.left = screenWidth - (1.25 * cameraHeight);
        cameraStreamState.top = (screenHeight - cameraHeight) / 2;

        break;
      default:
        cameraWidth = 0;
        cameraHeight = 0;
        break;
    }

    cameraStreamState.width = cameraWidth;
    cameraStreamState.height = cameraHeight;

    setX(cameraStreamState.left);
    setY(cameraStreamState.top);

    switch (selfieSize) {
      case SelfieSize.SmallCircle:
        maskCameraStreamToCircle(cameraStreamState);
        break;
      case SelfieSize.Rectangle:
        maskCameraStreamToPortrait(cameraStreamState);
        break;
      default:
        break;
    }
      
    if (screenStreamState != null) {
      screenStreamState.fullcanvas = true;
      screenStreamState.width = screenWidth;
      screenStreamState.height = screenHeight;
      mixer = new MultiStreamsMixer([screenStreamState, cameraStreamState]);

      addStreamStopListener(screenStreamState, async function () {
        mixer.releaseStreams();
        if (videoPreview === document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        cameraStreamState.getTracks().forEach(function (track) {
          track.stop();
        });
        screenStreamState.getTracks().forEach(function (track) {
          track.stop();
        });
        setPermission(false);
      });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = screenWidth;
      canvas.height = screenHeight;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const emptyScreenStream = canvas.captureStream();
      emptyScreenStream.fullcanvas = true;
      emptyScreenStream.width = screenWidth;
      emptyScreenStream.height = screenHeight;
      mixer = new MultiStreamsMixer([emptyScreenStream, cameraStreamState]);
    }

    mixer.frameInterval = 1;
    mixer.startDrawingFrames();

    const videoPreview = document.getElementById("screen") as HTMLVideoElement;
    videoPreview.srcObject = mixer.getMixedStream();
  }

  async function screenStream() {
    let captureStream = null;
    try {
      if (navigator.mediaDevices.getDisplayMedia) {
        captureStream = await navigator.mediaDevices
          .getDisplayMedia({
            video: {
              displaySurface: 'monitor',
            }
          });
      }
    } catch (err) {
      alert("getDisplayMedia API is not supported by this browser.");
    }

    screenStreamState = captureStream;
    return captureStream;
  }

  async function cameraStream() {
    let captureStream = null;

    try {
      captureStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedVideoDevice,
          width: window.screen.width * 0.2,
          height: window.screen.height * 0.2,
          frameRate: 15
        },
        audio: {
          deviceId: selectedAudioDevice
        },
      });
    } catch (err) {
      console.error("Error: " + err);
    }

    cameraStreamState = captureStream;
    updateScreenRendering();
    return captureStream;
  }

  async function startRecording() {
    if (screenStreamState == null) {
      await screenStream();
      updateScreenRendering();
    }

    chunkIndexes = [0, 0, 0];
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

    const streams = [
      screenStreamState,
      cameraStreamState,
      mixer.getMixedStream(),
    ];

    try {
      mediaRecorders = streams.map((stream) => new MediaRecorder(stream, options));
    } catch (e) {
      console.error("Exception while creating MediaRecorder:", e);
      return;
    }

    mediaRecorders.forEach((recorder, idx) => {
      recorder.onstop = async (event) => {
        await stopRecording();
      };
      recorder.ondataavailable = (event) => handleDataAvailable(event, idx);
      recorder.start(1000);
    });
    setStart(true);

    if (!licenseKeyValid) {
      setTimeout(() => {
        stopRecording();
      }, 5 * 60 * 1000);
    }
  }

  async function stopRecording() {
    let stopPromises = mediaRecorders.map((recorder) => new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    }));
  
    await Promise.all(stopPromises);
  
    const blobs = await Promise.all(mediaRecorders.map((_, streamIdx) => readChunksAndDownload(streamIdx)));
    await createZipAndDownload(blobs);
  }

  async function handleDataAvailable(event: any, streamIdx: number) {
    if (event.data && event.data.size > 0) {
      console.log(`Stream ${streamIdx} data:`, event.data);

      await db.put(`${storeName}_${streamIdx}`, event.data, chunkIndexes[streamIdx]++);
    }
  }

  // This is inefficient cuz we need to pull all data into memory
  async function readChunksAndDownload(streamIdx) {
    const indexedDBStream = new IndexedDBStream(db, `${storeName}_${streamIdx}`, chunkIndexes[streamIdx]++);

    const readableStream = new ReadableStream({
      async pull(controller) {
        const chunk = await indexedDBStream.getNextChunk();
        if (chunk) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
    });

    // Read the stream into an array
    const reader = readableStream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Create a Blob from the array of chunks
    const blob = new Blob(chunks, { type: "video/webm" });

    // Reset the recording state
    setStart(false);

    return blob;
  }

  async function createZipAndDownload(blobs) {
    const zip = new JSZip();
  
    // Add each Blob to the zip archive
    zip.file(`Screen-${new Date().toISOString()}.webm`, blobs[0]);
    zip.file(`Camera-${new Date().toISOString()}.webm`, blobs[1]);
    zip.file(`Combined-${new Date().toISOString()}.webm`, blobs[2]);
  
    // Generate the zip archive
    const content = await zip.generateAsync({ type: "blob" });
  
    // Create a download link in the DOM and trigger the download
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(content);
    downloadLink.download = `Recordings-${new Date().toISOString()}.zip`;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  // async function readChunksAndDownload() {
  //   const indexedDBStream = new IndexedDBStream(db, storeName, chunkIndex);

  //   const readableStream = new ReadableStream({
  //     async pull(controller) {
  //       const chunk = await indexedDBStream.getNextChunk();
  //       if (chunk) {
  //         controller.enqueue(chunk);
  //       } else {
  //         controller.close();
  //       }
  //     },
  //   });

  //   async function requestFileHandle() {
  //     const fileName = "Recording-" + new Date().toISOString() + ".webm";
  //     const options = {
  //       types: [
  //         {
  //           description: "WebM files",
  //           accept: {
  //             "video/webm": [".webm"],
  //           },
  //         },
  //       ],
  //       excludeAcceptAllOption: true,
  //       suggestedName: fileName,
  //     };
  //     return await window.showSaveFilePicker && window.showSaveFilePicker(options);
  //   }

  //   async function createWritableStream(fileHandle) {
  //     return await fileHandle.createWritable();
  //   }

  //   const fileHandle = await requestFileHandle();
  //   const writableStream = await createWritableStream(fileHandle);

  //   if (readableStream && writableStream) {
  //     const reader = readableStream.getReader();
  //     reader
  //       .read()
  //       .then(async function processChunk({ done, value }) {
  //         if (done) {
  //           writableStream.close();
  //           setStart(false);
  //           return;
  //         }

  //         await writableStream.write(value);
  //         return reader.read().then(processChunk);
  //       });
  //   }
  // }

  return (
    <div className="App">
      <div className="layout">
        <div
          style={{
            display: "contents",
            alignItems: "center",
            width: "100%"
          }}
        >
          <div
            style={{
              position: "relative",
              height: permissionAllowed ? "100vh" : "80vh",
              width: "fit-content",
              alignSelf: "center"
            }}
          >
            <video
              id="screen"
              style={{
                height: "100%",
                backgroundColor: "#444"
              }}
              autoPlay
              muted
              playsInline
            >
              Your browser does not support the video tag.
            </video>
            <div
              className={"camera-selfie " + selfieSize}
              ref={cameraSelfieRef}
              {...bind()}
            ></div>
          </div>

          <MediaDeviceSelector hasDevicePermission={permissionAllowed} onDeviceSelect={handleDeviceSelect} onUpgrade={() => setLicenseKeyValid(true)} />

          {!permissionAllowed ? (
            <NoPermission />
          ) : (
            <Control
              started={started}
              onStart={startRecording}
              onStop={stopRecording}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
