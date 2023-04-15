import React, { useState, useEffect } from "react";
import "./App.css";
import MultiStreamsMixer from "multistreamsmixer";
import Control from "./Control";
import NoPermission from "./NoPermission"
import MediaDeviceSelector from "./MediaDeviceSelector";
import { useDrag } from "react-use-gesture";
import { IDBPDatabase, openDB } from "idb";

let db: IDBPDatabase<unknown>;
const dbName = "videoChunksDB";
const storeName = "videoChunks";

let mixer: MultiStreamsMixer;
let mediaRecorder: MediaRecorder;
let chunkIndex = 0;
let cameraStreamState: MediaStream;
let screenStreamState: MediaStream;
let selectedAudioDevice: string = null;
let selectedVideoDevice: string = null;

let cameraSize = 0.2;

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
  db = await openDB(dbName, 1, {
    upgrade(db) {
      db.createObjectStore(storeName);
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

const App: React.FC = () => {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);
  const cameraSelfieRef = React.useRef(null);
  const [xx, setX] = useState(0);
  const [yy, setY] = useState(0);
  const [licenseKeyValid, setLicenseKeyValid] = useState(false);

  const handleDeviceSelect = async (audioDeviceId: string, videoDeviceId: string, selectedSize: string) => {
    selectedAudioDevice = audioDeviceId;
    selectedVideoDevice = videoDeviceId;

    if (selectedSize === 'Small Selfie Camera') {
      cameraSize = 0.2;
    } else if (selectedSize === 'Huge Selfie Camera') {
      cameraSize = 0.5;
    } else if (selectedSize === 'No Selfie Camera') {
      cameraSize = 0;
    }

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
    let handlePermission = async () => {
      let camera = await cameraStream();
      if (camera === null) {
        setPermission(false);
      } else {
        setPermission(true);
      }
    };
    handlePermission();
    initDb();
  }, []);

  function updateScreenRendering() {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    const cameraWidth = cameraSize * screenWidth;
    const cameraHeight = cameraSize * screenHeight;

    cameraStreamState.width = cameraWidth;
    cameraStreamState.height = cameraHeight;
    cameraStreamState.left = screenWidth - cameraWidth;
    cameraStreamState.top = screenHeight - cameraHeight - 20;

    setX(cameraStreamState.left);
    setY(cameraStreamState.top);

    maskCameraStreamToCircle(cameraStreamState);

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
          .getDisplayMedia({ video: {
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
          width: window.screen.width * cameraSize,
          height: window.screen.height * cameraSize,
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
    const stream = await screenStream();
    updateScreenRendering();

    chunkIndex = 0;
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

    mediaRecorder.onstop = async (event) => {
      await readChunksAndDownload();
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(1000);
    setStart(true);

    if (!licenseKeyValid) {
      setTimeout(() => {
        stopRecording();
      }, 5 * 60 * 1000);
    }
  }

  function stopRecording() {
    mediaRecorder.stop();
  }

  async function handleDataAvailable(event: any) {
    console.log("handleDataAvailable", event);
    if (event.data && event.data.size > 0) {
      await db.put(storeName, event.data, chunkIndex++);
    }
  }

  // This is inefficient cuz we need to pull all data into memory
  async function readChunksAndDownload() {
    const indexedDBStream = new IndexedDBStream(db, storeName, chunkIndex);
  
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
  
    // Create a Blob URL
    const url = URL.createObjectURL(blob);
  
    // Create an anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recording-${new Date().toISOString()}.webm`;
  
    // Append the anchor element to the document, click it, and remove it afterward
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  
    // Reset the recording state
    setStart(false);
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
              className="camera-selfie"
              ref={cameraSelfieRef}
              {...bind()}
            ></div>
          </div>

          <MediaDeviceSelector onDeviceSelect={handleDeviceSelect} />

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
