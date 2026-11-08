import './hand-control';

import './style.css';
import * as THREE from 'three';

type Mode = 'VORTEX' | 'GRAVITY' | 'EXPLOSION' | 'FLUID' | 'WAVE';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('Application root #app not found');

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon">P</div>
        <div>
          <div class="brand-name">PARTICLE LAB</div>
          <div class="brand-sub">REALTIME PHYSICS ENVIRONMENT</div>
        </div>
      </div>
      <div class="top-status">
        <span class="live-dot"></span>
        SIMULATION ACTIVE
        <span class="version">v0.1.0</span>
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        <div class="panel-heading">EXPERIMENTS</div>
        <div class="mode-list">
          ${(['VORTEX', 'GRAVITY', 'EXPLOSION', 'FLUID', 'WAVE'] as Mode[])
            .map((mode, i) => `
              <button class="mode-button ${i === 0 ? 'selected' : ''}" data-mode="${mode}">
                <span class="mode-symbol">${['◉', '◎', '✳', '≈', '∿'][i]}</span>
                <span>${mode}</span>
                <span class="mode-arrow">›</span>
              </button>
            `).join('')}
        </div>

        <div class="panel-divider"></div>
        <div class="panel-heading">SIMULATION</div>

        <div class="control-group">
          <div class="control-label">
            PARTICLES <output id="count-value">12000</output>
          </div>
          <input id="particle-count" type="range" min="1000" max="30000" step="1000" value="12000">
        </div>

        <div class="control-group">
          <div class="control-label">
            FORCE <output id="force-value">1.0</output>
          </div>
          <input id="force" type="range" min="0" max="3" step="0.1" value="1">
        </div>

        <div class="control-group">
          <div class="control-label">
            SPEED <output id="speed-value">1.0</output>
          </div>
          <input id="speed" type="range" min="0" max="3" step="0.1" value="1">
        </div>

        <div class="control-group">
          <div class="control-label">
            SPREAD <output id="spread-value">1.0</output>
          </div>
          <input id="spread" type="range" min="0.3" max="3" step="0.1" value="1">
        </div>

        <div class="panel-divider"></div>
        <div class="panel-heading">RENDERING</div>

        <label class="toggle-row">
          <span>Glow effect</span>
          <input id="glow" type="checkbox" checked>
          <span class="toggle"></span>
        </label>

        <label class="toggle-row">
          <span>Auto rotate</span>
          <input id="rotate" type="checkbox" checked>
          <span class="toggle"></span>
        </label>

        <button class="reset-button" id="reset">↻ &nbsp; RESET EXPERIMENT</button>
      </aside>

      <section class="viewport">
        <div class="viewport-top">
          <div>
            <div class="eyebrow">CURRENT EXPERIMENT</div>
            <div class="experiment-title" id="experiment-title">Vortex Field</div>
          </div>
          <div class="viewport-actions">
            <button id="pause" class="action-button">Ⅱ PAUSE</button>
            <button id="fullscreen" class="action-button">⛶ VIEW</button>
          </div>
        </div>

        <div id="canvas-container" class="canvas-container">
          <div class="loading" id="loading">INITIALIZING GPU ENGINE...</div>
          <div class="canvas-hint">DRAG TO ROTATE · SCROLL TO ZOOM</div>
          <div class="center-crosshair">+</div>
        </div>

        <div class="viewport-bottom">
          <span><span class="live-dot"></span> LIVE RENDER</span>
          <span>WEBGL2 / GLSL</span>
          <span id="render-state">RUNNING</span>
        </div>
      </section>

      <aside class="inspector">
        <div class="panel-heading">LIVE TELEMETRY</div>
        <div class="telemetry-grid">
          <div class="metric">
            <span class="metric-label">FRAME RATE</span>
            <strong id="fps">--</strong>
            <small>FPS</small>
          </div>
          <div class="metric">
            <span class="metric-label">PARTICLES</span>
            <strong id="telemetry-count">12K</strong>
            <small>INSTANCES</small>
          </div>
        </div>

        <div class="panel-divider"></div>
        <div class="panel-heading">ENGINE STATUS</div>

        <div class="status-row">
          <span>Renderer</span><strong id="renderer-name">Starting</strong>
        </div>
        <div class="status-row">
          <span>GPU animation</span><strong class="status-ok">ACTIVE</strong>
        </div>
        <div class="status-row">
          <span>Simulation</span><strong id="simulation-status">Running</strong>
        </div>

        <div class="panel-divider"></div>
        <div class="panel-heading">EXPERIMENT INFO</div>
        <p class="description" id="description">
          A rotating force field pulls particles into a dynamic spiral.
          Change the force and speed to explore its behavior.
        </p>

        <div class="panel-divider"></div>
        <div class="panel-heading">CONTROLS</div>
        <div class="key-row"><kbd>DRAG</kbd> Rotate camera</div>
        <div class="key-row"><kbd>SCROLL</kbd> Zoom in / out</div>
        <div class="key-row"><kbd>SPACE</kbd> Pause / resume</div>
        <div class="key-row"><kbd>R</kbd> Reset</div>
      </aside>
    </main>

    <footer class="footer">
      <span>PARTICLE LAB <span class="muted">/ EXPERIMENTAL SOFTWARE</span></span>
      <span>GPU-ACCELERATED PARTICLE ENGINE</span>
      <span>BUILD 0001</span>
    </footer>
  </div>
`;

const container = document.querySelector<HTMLDivElement>('#canvas-container')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;

if (!THREE.WebGLRenderer) {
  throw new Error('Three.js renderer unavailable');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#080b12');

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 0, 9);

let renderer: THREE.WebGLRenderer;

try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
} catch {
  loading.textContent = 'WEBGL INITIALIZATION FAILED';
  throw new Error('Your browser could not initialize WebGL.');
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.prepend(renderer.domElement);

const vertexShader = `
  uniform float uTime;
  uniform float uForce;
  uniform float uSpeed;
  uniform float uSpread;
  uniform float uMode;
  uniform float uGlow;

  attribute float aRandom;
  attribute float aSize;

  varying float vAlpha;
  varying float vColor;

  void main() {
    float t = uTime * uSpeed;
    vec3 p = position * uSpread;

    float radius = length(p.xy) + 0.001;
    float angle = atan(p.y, p.x);

    if (uMode < 0.5) {
      float spin = angle + t * (0.7 + uForce / radius);
      p.xy = vec2(cos(spin), sin(spin)) * radius;
      p.z += sin(t + aRandom * 12.0) * 0.25;
    } else if (uMode < 1.5) {
      float pull = 0.15 * uForce * sin(t * 0.6 + aRandom * 9.0);
      p *= 1.0 - pull;
      p.z += sin(t + aRandom * 20.0) * 0.35;
    } else if (uMode < 2.5) {
      float pulse = sin(t * 1.4 + aRandom * 6.283);
      p *= 1.0 + pulse * 0.3 * uForce;
    } else if (uMode < 3.5) {
      p.x += sin(p.y * 2.0 + t + aRandom * 5.0) * 0.35 * uForce;
      p.y += cos(p.x * 2.0 + t * 0.8) * 0.25 * uForce;
      p.z += sin(p.x + p.y + t) * 0.3;
    } else {
      float wave = sin(radius * 3.0 - t * 2.0);
      p.z += wave * 0.7 * uForce;
      p.x += sin(t + p.y * 2.0) * 0.12;
    }

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = clamp(
      aSize * (uGlow > 0.5 ? 2.0 : 1.0) * (35.0 / -mvPosition.z),
      1.0, 12.0
    );

    vAlpha = 0.6 + 0.4 * sin(t * 1.2 + aRandom * 20.0);
    vColor = aRandom;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vColor;
  uniform float uGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    if (d > 0.5) discard;

    float core = 1.0 - smoothstep(0.0, 0.5, d);
    float glow = exp(-d * 12.0);

    vec3 blue = vec3(0.12, 0.65, 1.0);
    vec3 purple = vec3(0.65, 0.25, 1.0);
    vec3 cyan = vec3(0.15, 1.0, 0.88);

    vec3 color = mix(blue, purple, vColor);
    color = mix(color, cyan, smoothstep(0.75, 1.0, vColor));

    float intensity = uGlow > 0.5 ? glow : core;
    gl_FragColor = vec4(color * (0.7 + intensity), core * vAlpha);
  }
`;

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uForce: { value: 1 },
    uSpeed: { value: 1 },
    uSpread: { value: 1 },
    uMode: { value: 0 },
    uGlow: { value: 1 }
  },
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const geometry = new THREE.BufferGeometry();
let particleCount = 12000;

function randomizeParticles(count: number) {
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const radius = Math.sqrt(Math.random()) * 3.5;
    const angle = Math.random() * Math.PI * 2;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 3;

    randoms[i] = Math.random();
    sizes[i] = 1.2 + Math.random() * 2.0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();
}

randomizeParticles(particleCount);

const particles = new THREE.Points(geometry, material);
scene.add(particles);

const grid = new THREE.GridHelper(20, 30, 0x142a43, 0x101c2b);
grid.position.y = -4;
scene.add(grid);

const modes: Mode[] = ['VORTEX', 'GRAVITY', 'EXPLOSION', 'FLUID', 'WAVE'];
const names = ['Vortex Field', 'Gravity Field', 'Particle Explosion', 'Fluid Dynamics', 'Wave Propagation'];
const descriptions = [
  'A rotating force field pulls particles into a dynamic spiral.',
  'Particles respond to a changing central gravitational field.',
  'A pulsing field expands and contracts a cloud of particles.',
  'A turbulent flow field creates fluid-like particle motion.',
  'Traveling waves propagate through the particle field.'
];
let paused = false;
let autoRotate = true;
let elapsed = 0;
let previousTime = performance.now();
let frameCount = 0;
let fpsTime = previousTime;

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function setMode(mode: Mode) {
  const index = modes.indexOf(mode);

  material.uniforms.uMode.value = index;
  $('experiment-title').textContent = names[index];
  $('description').textContent = descriptions[index];

  document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach(button => {
    button.classList.toggle('selected', button.dataset.mode === mode);
  });
}

document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode as Mode));
});

function connectSlider(id: string, uniform: string, output: string, decimals: number) {
  const slider = $<HTMLInputElement>(id);
  const display = $(output);

  const update = () => {
    const value = Number(slider.value);
    material.uniforms[uniform].value = value;
    display.textContent = value.toFixed(decimals);
  };

  slider.addEventListener('input', update);
  update();
}

connectSlider('force', 'uForce', 'force-value', 1);
connectSlider('speed', 'uSpeed', 'speed-value', 1);
connectSlider('spread', 'uSpread', 'spread-value', 1);

$('particle-count').addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value);
  particleCount = value;
  randomizeParticles(value);
  $('count-value').textContent = value.toLocaleString();
  $('telemetry-count').textContent = `${value / 1000}K`;
});

$('glow').addEventListener('change', () => {
  material.uniforms.uGlow.value = $<HTMLInputElement>('glow').checked ? 1 : 0;
});

$('rotate').addEventListener('change', () => {
  autoRotate = $<HTMLInputElement>('rotate').checked;
});

function togglePause() {
  paused = !paused;
  $('pause').textContent = paused ? '▶ RESUME' : 'Ⅱ PAUSE';
  $('render-state').textContent = paused ? 'PAUSED' : 'RUNNING';
  $('simulation-status').textContent = paused ? 'Paused' : 'Running';
}

$('pause').addEventListener('click', togglePause);

$('reset').addEventListener('click', () => {
  $<HTMLInputElement>('force').value = '1';
  $<HTMLInputElement>('speed').value = '1';
  $<HTMLInputElement>('spread').value = '1';

  connectSlider('force', 'uForce', 'force-value', 1);
  connectSlider('speed', 'uSpeed', 'speed-value', 1);
  connectSlider('spread', 'uSpread', 'spread-value', 1);

  setMode('VORTEX');
  randomizeParticles(particleCount);
  camera.position.set(0, 0, 9);
});

$('fullscreen').addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await container.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) {
    event.preventDefault();
    togglePause();
  }

  if (event.key.toLowerCase() === 'r' && !(event.target instanceof HTMLInputElement)) {
    $('reset').click();
  }
});

// Simple camera drag controls
let dragging = false;
let lastX = 0;
let lastY = 0;
let rotationX = 0;
let rotationY = 0;

renderer.domElement.addEventListener('pointerdown', event => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging) return;

  rotationY += (event.clientX - lastX) * 0.005;
  rotationX += (event.clientY - lastY) * 0.005;
  rotationX = THREE.MathUtils.clamp(rotationX, -1.2, 1.2);

  lastX = event.clientX;
  lastY = event.clientY;
});

renderer.domElement.addEventListener('pointerup', () => dragging = false);
renderer.domElement.addEventListener('pointercancel', () => dragging = false);

renderer.domElement.addEventListener('wheel', event => {
  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z + event.deltaY * 0.008, 4, 20
  );
}, { passive: true });

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

const observer = new ResizeObserver(resize);
observer.observe(container);

function animate(now: number) {
  requestAnimationFrame(animate);

  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (!paused) elapsed += delta;

  material.uniforms.uTime.value = elapsed;

  if (autoRotate && !dragging) {
    rotationY += delta * 0.08;
  }

  particles.rotation.x = rotationX;
  particles.rotation.y = rotationY;

  renderer.render(scene, camera);

  frameCount++;

  if (now - fpsTime >= 1000) {
    $('fps').textContent = String(Math.round(frameCount * 1000 / (now - fpsTime)));
    frameCount = 0;
    fpsTime = now;
  }
}

resize();
loading.remove();
$('renderer-name').textContent = 'Three.js / WebGL';
requestAnimationFrame(animate);

console.log('PARTICLE LAB ENGINE INITIALIZED');
console.log('Particles:', particleCount);
console.log('Renderer:', renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL');


