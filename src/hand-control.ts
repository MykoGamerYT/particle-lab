import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handLandmarker: HandLandmarker | null = null;
let cameraStream: MediaStream | null = null;
let animationFrame = 0;
let video: HTMLVideoElement;
let statusText: HTMLElement;
let cameraButton: HTMLButtonElement;
let panel: HTMLDivElement;

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function updateSlider(id: string, amount: number) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    if (!slider) return;

    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    slider.value = String(min + clamp(amount, 0, 1) * (max - min));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
}

function stopCamera() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;

    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;

    if (video) {
        video.pause();
        video.srcObject = null;
    }

    cameraButton.textContent = 'Enable Camera';
    statusText.textContent = 'Camera is off';
}

async function startCamera() {
    try {
        statusText.textContent = 'Requesting camera permission...';

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Camera access requires HTTPS or localhost.');
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        video.srcObject = cameraStream;
        await video.play();

        statusText.textContent = 'Loading hand tracking model...';

        if (!handLandmarker) {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
            );

            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numHands: 1
            });
        }

        cameraButton.textContent = 'Disable Camera';
        statusText.textContent = 'Show one hand to the camera';

        detectHands();
    } catch (error) {
        stopCamera();
        statusText.textContent = error instanceof Error
            ? error.message
            : 'Could not start the camera.';
        console.error('Particle Lab camera error:', error);
    }
}

function detectHands() {
    if (!video || !handLandmarker || !cameraStream) return;

    if (video.readyState >= 2) {
        const result = handLandmarker.detectForVideo(video, performance.now());
        const hand = result.landmarks?.[0];

        if (hand) {
            const wrist = hand[0];
            const thumbTip = hand[4];
            const indexTip = hand[8];

            // Hand position controls force and speed.
            updateSlider('force', 1 - wrist.x);
            updateSlider('speed', 1 - wrist.y);

            // Thumb/index distance controls particle spread.
            const distance = Math.hypot(
                thumbTip.x - indexTip.x,
                thumbTip.y - indexTip.y
            );

            updateSlider('spread', clamp(distance / 0.35, 0, 1));
            statusText.textContent = 'Hand detected — controlling particles!';
        } else {
            statusText.textContent = 'No hand detected — show your hand';
        }
    }

    animationFrame = requestAnimationFrame(detectHands);
}

function mountCameraControl() {
    if (document.getElementById('particle-camera-button')) return;

    const style = document.createElement('style');
    style.textContent = `
      #particle-camera-button {
        position:fixed; right:24px; bottom:24px; z-index:10000;
        border:1px solid #42d9e8; border-radius:12px;
        background:#10232b; color:#b9faff; padding:13px 18px;
        font:600 13px system-ui; cursor:pointer;
        box-shadow:0 0 24px #19cce522;
      }
      #particle-camera-panel {
        position:fixed; right:24px; bottom:82px; z-index:10000;
        width:min(320px,calc(100vw - 32px)); padding:14px;
        background:#101820; color:#d9edf2; border:1px solid #29434d;
        border-radius:14px; box-shadow:0 12px 40px #0009;
        font:13px system-ui;
      }
      #particle-camera-panel video {
        width:100%; display:block; border-radius:9px;
        transform:scaleX(-1); background:#05090d;
      }
      #particle-camera-status { margin-top:10px; color:#69dce8; }
      #particle-camera-help { color:#9aabb5; line-height:1.5; }
    `;
    document.head.appendChild(style);

    cameraButton = document.createElement('button');
    cameraButton.id = 'particle-camera-button';
    cameraButton.textContent = 'Enable Camera';

    panel = document.createElement('div');
    panel.id = 'particle-camera-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <strong>HAND CONTROL</strong>
      <p id="particle-camera-help">
        Move your hand left/right to change force.<br>
        Move up/down to change speed.<br>
        Change the distance between your thumb and index finger to change spread.
      </p>
      <video id="particle-camera-video" autoplay muted playsinline></video>
      <div id="particle-camera-status">Camera is off</div>
    `;

    document.body.append(cameraButton, panel);

    video = panel.querySelector('video')!;
    statusText = panel.querySelector('#particle-camera-status')!;

    cameraButton.addEventListener('click', async () => {
        panel.hidden = false;

        if (cameraStream) {
            stopCamera();
        } else {
            await startCamera();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCameraControl, { once: true });
} else {
    mountCameraControl();
}
