import React, { useState, useEffect } from "react";
import "./App.css";
import MultiStreamsMixer from "multistreamsmixer";
import Control from "./Control";
import NoPermission from "./NoPermission"
import { useDrag } from "react-use-gesture";
import { openDB } from "idb";

const dbName = "videoChunksDB";
const storeName = "videoChunks";
let db;
var videoPreview: HTMLVideoElement;
let mixer: MultiStreamsMixer;
let mediaRecorder: MediaRecorder;
let recordedBlobs = [];
let chunkIndex = 0;

class IndexedDBStream {
  db: any;
  storeName: string;
  chunkCount: number;
  currentChunk: number;

  constructor(db: any, storeName: string, chunkCount: number) {
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

const App: React.FC = () => {
  const [permissionAllowed, setPermission] = useState(false);
  const [started, setStart] = useState(false);
  const cameraSelfieRef = React.useRef(null);
  const [cameraStreamState, setCameraStreamState] = useState(null);
  const [xx, setX] = useState(0);
  const [yy, setY] = useState(0);

  function updateCameraStreamPosition(x, y) {
    if (cameraStreamState) {
      cameraStreamState.top = yy + y;
      cameraStreamState.left = xx + x;
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
      let camera = await startCameraAndScreen();
      if (camera === null) {
        setPermission(false);
      } else {
        setPermission(true);
      }
    };
    handlePermission();
    initDb();
  }, []);

  function afterScreenCaptured(screenStream) {
    cameraStream().then(async function (cameraStream) {
      screenStream.fullcanvas = true;
      setCameraStreamState(cameraStream);

      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const cameraWidth = (20 / 100) * screenWidth;
      const cameraHeight = (20 / 100) * screenHeight;

      cameraStream.width = cameraWidth;
      cameraStream.height = cameraHeight;
      cameraStream.top = screenHeight - cameraHeight - 20;
      cameraStream.left = screenWidth - cameraWidth - 20;

      setX(cameraStream.left);
      setY(cameraStream.top);

      screenStream.width = screenWidth;
      screenStream.height = screenHeight;

      mixer = new MultiStreamsMixer([screenStream, cameraStream]);
      mixer.frameInterval = 1;
      mixer.startDrawingFrames();

      videoPreview = document.getElementById("screen") as HTMLVideoElement;
      videoPreview.srcObject = mixer.getMixedStream();
      //videoPreview.srcObject = screenStream;
      // const cameraPreview = document.getElementById("camera") as HTMLVideoElement;
      // cameraPreview.srcObject = cameraStream;

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

    console.log(
      "Created MediaRecorder",
      mediaRecorder,
      "with options",
      options
    );
    mediaRecorder.onstop = async (event) => {
      console.log("Recorder stopped: ", event);
      console.log("Recorded Blobs: ", recordedBlobs);
      await readChunksAndDownload();
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(1000);
    console.log("MediaRecorder started", mediaRecorder);
    setStart(true);
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
  
    async function requestFileHandle() {
      const fileName = "Recording-" + new Date().toISOString() + ".webm";
      const options = {
        types: [
          {
            description: "WebM files",
            accept: {
              "video/webm": [".webm"],
            },
          },
        ],
        excludeAcceptAllOption: true,
        suggestedName: fileName,
      };
      return await window.showSaveFilePicker(options);
    }

    async function createWritableStream(fileHandle) {
      return await fileHandle.createWritable();
    }

    const fileHandle = await requestFileHandle();
    const writableStream = await createWritableStream(fileHandle);

  
    if (readableStream && writableStream) {
      const reader = readableStream.getReader();
      reader
        .read()
        .then(async function processChunk({ done, value }) {
          if (done) {
            writableStream.close();
            setStart(false);
            //videoPreview.pause();
            //videoPreview.src = null;
            return;
          }
  
          await writableStream.write(value);
          return reader.read().then(processChunk);
        });
    }
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
            id="screen"
            style={{ height: permissionAllowed ? "100vh" : "80vh", backgroundColor: "#444" }}
            autoPlay
            muted
            playsInline
          >
            Your browser does not support the video tag.
          </video>
          <div
            className="camera-selfie"
            ref={cameraSelfieRef}
            {...bind()}>
          </div>

          {!permissionAllowed ? <NoPermission /> : <Control started={started} onStart={startRecording} onStop={stopRecording} />}
        </div>
      </div>
    </div>
  );
}

export default App;
