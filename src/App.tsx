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

const CAMERA_SIZE = 0.2;

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
  const [cameraStreamState, setCameraStreamState] = useState(null);
  const [screenStreamState, setScreenStreamState] = useState(null);
  const [xx, setX] = useState(0);
  const [yy, setY] = useState(0);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");

  const handleDeviceSelect = async (audioDeviceId: string, videoDeviceId: string) => {
    setSelectedAudioDevice(audioDeviceId);
    setSelectedVideoDevice(videoDeviceId);

    /*screenStreamState.getTracks().forEach(function (track) {
      track.stop();
    });*/

    let camera = await startCameraAndScreen();
    if (camera === null) {
      setPermission(false);
    } else {
      setPermission(true);
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
      setScreenStreamState(screenStream);

      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const cameraWidth = CAMERA_SIZE * screenWidth;
      const cameraHeight = CAMERA_SIZE * screenHeight;

      cameraStream.width = cameraWidth;
      cameraStream.height = cameraHeight;
      cameraStream.top = screenHeight - cameraHeight - 20;
      cameraStream.left = screenWidth - cameraHeight - 20;

      setX(cameraStream.left);
      setY(cameraStream.top);

      screenStream.width = screenWidth;
      screenStream.height = screenHeight;
      maskCameraStreamToCircle(cameraStream);

      mixer = new MultiStreamsMixer([screenStream, cameraStream]);
      mixer.frameInterval = 1;
      mixer.startDrawingFrames();

      const videoPreview = document.getElementById("screen") as HTMLVideoElement;
      videoPreview.srcObject = mixer.getMixedStream();
      // videoPreview.srcObject = screenStream;
      // const cameraPreview = document.getElementById("camera") as HTMLVideoElement;
      // cameraPreview.srcObject = cameraStream;

      // stop listener
      addStreamStopListener(screenStream, async function () {
        mixer.releaseStreams();
        if (videoPreview === document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        cameraStream.getTracks().forEach(function (track) {
          track.stop();
        });
        screenStream.getTracks().forEach(function (track) {
          track.stop();
        });
        setPermission(false);
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
        .getDisplayMedia({ video: {
          displaySurface: 'monitor',
        } 
      });
    }

    alert("getDisplayMedia API is not supported by this browser.");
    return null;
  }

  async function cameraStream() {
    let captureStream = null;

    try {
      captureStream = navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedVideoDevice,
          width: window.screen.width * CAMERA_SIZE,
          height: window.screen.height * CAMERA_SIZE,
          frameRate: 15
        },
        audio: {
          deviceId: selectedAudioDevice
        },
      });
    } catch (err) {
      console.error("Error: " + err);
    }
    return captureStream;
  }

  function startRecording() {
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
      return await window.showSaveFilePicker && window.showSaveFilePicker(options);
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
