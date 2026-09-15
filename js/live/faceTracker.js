/*
 * Webcam + MediaPipe Face Landmarker, loaded from CDN (nothing installed).
 * Per frame: 478 3D landmarks, 52 expression blendshapes, 4x4 head transform.
 */

const VERSION = '0.10.14';
const BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const named = (name) => Object.assign(new Error(name), { name });
const withTimeout = (promise, ms, name) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(named(name)), ms); }),
  ]).finally(() => clearTimeout(timer));
};

/** Human-readable (Romanian) explanation for a camera start failure. */
export function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accesul la cameră a fost refuzat · permite camera din bara de adrese';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nu am găsit nicio cameră';
    case 'NotReadableError':
    case 'AbortError':
      return 'Camera e folosită de altă aplicație · închide-o și încearcă din nou';
    case 'CameraTimeout':
      return 'Camera nu răspunde · verifică Setări macOS › Confidențialitate › Cameră › Chrome';
    case 'NoFrames':
      return 'Camera nu trimite imagine · încearcă din nou';
    case 'TrackEnded':
      return 'Camera s-a oprit · verifică dacă altă aplicație o folosește';
    case 'ModelTimeout':
      return 'Modelul facial nu s-a încărcat · verifică internetul';
    case 'NoMediaDevices':
      return 'Browserul nu permite accesul la cameră pe această pagină';
    default:
      return `Camera nu a putut porni (${err?.name || err})`;
  }
}

export class FaceTracker {
  constructor(video) {
    this.video = video;
    this.mp = null;
    this.landmarker = null;
    this.stream = null;
    this.lastVideoTime = -1;
  }

  async start(onStatus = () => {}) {
    if (!navigator.mediaDevices?.getUserMedia) throw named('NoMediaDevices');

    onStatus('Cer acces la cameră…');
    console.info('[camera] requesting stream');
    const request = navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    let timedOut = false;
    let stream;
    try {
      stream = await withTimeout(request, 20000, 'CameraTimeout');
    } catch (err) {
      if (err.name === 'CameraTimeout') {
        timedOut = true;
        // If permission arrives after we gave up, release the camera instead of leaking it.
        request.then((s) => { if (timedOut) s.getTracks().forEach((t) => t.stop()); }).catch(() => {});
      }
      throw err;
    }
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    console.info('[camera] stream ok:', track?.label);

    onStatus('Aștept imaginea camerei…');
    this.video.srcObject = stream;
    this.video.play().catch(() => {});
    // Wait for real frames: a 2x2 placeholder or a frozen clock means the camera isn't delivering.
    await withTimeout(new Promise((resolve, reject) => {
      const check = () => {
        if (!track || track.readyState === 'ended') return reject(named('TrackEnded'));
        if (this.video.videoWidth > 16 && this.video.currentTime > 0) return resolve();
        setTimeout(check, 100);
      };
      check();
    }), 10000, 'NoFrames');
    console.info('[camera] frames:', this.video.videoWidth, 'x', this.video.videoHeight);

    if (!this.landmarker) {
      onStatus('Încarc modelul facial…');
      await withTimeout(this.#loadModel(), 60000, 'ModelTimeout');
      console.info('[camera] face landmarker ready');
    }
  }

  async #loadModel() {
    this.mp = await import(BUNDLE);
    const fileset = await this.mp.FilesetResolver.forVisionTasks(WASM);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await this.mp.FaceLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
      this.landmarker = await this.mp.FaceLandmarker.createFromOptions(fileset, options('CPU'));
    }
  }

  /**
   * @returns undefined when there is no new video frame, null when no face was found,
   *          otherwise { landmarks, blendshapes, matrix, aspect }.
   */
  detect(now) {
    const v = this.video;
    if (!this.landmarker || !this.stream || v.readyState < 2 || v.currentTime === this.lastVideoTime) return undefined;
    this.lastVideoTime = v.currentTime;
    const r = this.landmarker.detectForVideo(v, now);
    if (!r.faceLandmarks?.length) return null;
    return {
      landmarks: r.faceLandmarks[0],
      blendshapes: r.faceBlendshapes?.[0]?.categories ?? [],
      matrix: r.facialTransformationMatrixes?.[0]?.data ?? null,
      aspect: v.videoWidth / v.videoHeight,
    };
  }

  /** True when the camera was started but its video track has since ended. */
  get ended() {
    const track = this.stream?.getVideoTracks()[0];
    return !!track && track.readyState === 'ended';
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.lastVideoTime = -1;
  }
}
