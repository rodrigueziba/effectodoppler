import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Constantes del modelo
 * ------------------------------------------------------------------ */

export const CHORDS = {
  maj7: { label: 'Mayor 7', steps: [0, 4, 7, 11] },
  min7: { label: 'Menor 7', steps: [0, 3, 7, 10] },
  maj: { label: 'Mayor', steps: [0, 4, 7] },
  min: { label: 'Menor', steps: [0, 3, 7] },
  sus4: { label: 'Suspendido 4', steps: [0, 5, 7] },
  dim: { label: 'Disminuido', steps: [0, 3, 6, 9] },
  pent: { label: 'Pentatónica', steps: [0, 2, 4, 7, 9] },
};

export const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'];

// Diámetro orbital máximo. El plano lejano de la cámara es 10× este valor,
// y con buffer de profundidad logarítmico el z-buffer sigue siendo estable.
export const MAX_ORBIT_DIAMETER = 8000;
export const MAX_SPEED = 100;

export const DEFAULT_CONFIG = {
  // Órbitas
  orbitDiameter: MAX_ORBIT_DIAMETER,
  sphereCount: 4,
  speed: 1.0,
  sphereRadius: 40,
  randomSize: true,
  glow: 1.0,
  sphereLights: true,

  // Sonido
  soundType: 'tone',
  waveform: 'sine',
  chord: 'maj7',
  arpRate: 5,
  freqMin: 160,
  freqMax: 520,
  volume: 0.45,

  // Modelo Doppler
  waveSpeed: 343, // velocidad del sonido en aire, m/s
  exaggeration: 1.0,
  smoothing: 0.16,

  // Color
  colorMode: 'doppler',
  colorFar: '#ff2f45',
  colorNear: '#3a7bff',
  colorNeutral: '#f2f5ff',
  useNeutral: true,
  autoRange: true,
  vRef: 150,
  distMin: 200,
  distMax: 4000,

  // Observador
  fov: 70,
  moveSpeed: 4.0,
  sensitivity: 0.0022,

  // Escenario
  starCount: 7000,
  starSize: 1.0,
  showOrbits: true,
  showGrid: false,
  paused: false,
};

const PLATFORM_SIZE = 10;
const EYE_HEIGHT = 1.65;
const WALK_LIMIT = PLATFORM_SIZE / 2 - 0.35;
const STAR_RADIUS = 900;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const semitoneRatio = (n) => Math.pow(2, n / 12);

/* ------------------------------------------------------------------ *
 *  Texturas procedurales
 * ------------------------------------------------------------------ */

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.09)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Regolito lunar: mapa de color y mapa de altura generados con maria
 * oscuros, cráteres de radio variable y grano fino.
 */
function makeMoonTextures(size = 1024) {
  const albedo = document.createElement('canvas');
  const height = document.createElement('canvas');
  albedo.width = albedo.height = size;
  height.width = height.height = size;
  const a = albedo.getContext('2d');
  const h = height.getContext('2d');

  a.fillStyle = '#8f8d87';
  a.fillRect(0, 0, size, size);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, size, size);

  // Maria: manchas basálticas oscuras y poco profundas
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = rand(size * 0.07, size * 0.26);
    const g = a.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(74,72,70,0.55)');
    g.addColorStop(1, 'rgba(74,72,70,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, r, 0, Math.PI * 2);
    a.fill();

    const gh = h.createRadialGradient(x, y, 0, x, y, r);
    gh.addColorStop(0, 'rgba(96,96,96,0.6)');
    gh.addColorStop(1, 'rgba(96,96,96,0)');
    h.fillStyle = gh;
    h.beginPath();
    h.arc(x, y, r, 0, Math.PI * 2);
    h.fill();
  }

  // Cráteres: piso hundido y borde elevado
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.pow(Math.random(), 2.4) * size * 0.075 + 2;

    const ga = a.createRadialGradient(x, y, r * 0.1, x, y, r);
    ga.addColorStop(0.0, 'rgba(58,56,54,0.62)');
    ga.addColorStop(0.62, 'rgba(70,68,66,0.42)');
    ga.addColorStop(0.82, 'rgba(196,194,188,0.5)');
    ga.addColorStop(1.0, 'rgba(150,148,142,0)');
    a.fillStyle = ga;
    a.beginPath();
    a.arc(x, y, r, 0, Math.PI * 2);
    a.fill();

    const gh = h.createRadialGradient(x, y, r * 0.1, x, y, r);
    gh.addColorStop(0.0, 'rgba(40,40,40,0.85)');
    gh.addColorStop(0.66, 'rgba(64,64,64,0.7)');
    gh.addColorStop(0.85, 'rgba(228,228,228,0.85)');
    gh.addColorStop(1.0, 'rgba(128,128,128,0)');
    h.fillStyle = gh;
    h.beginPath();
    h.arc(x, y, r, 0, Math.PI * 2);
    h.fill();
  }

  // Grano fino del regolito
  const grain = (ctx, amount) => {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  };
  grain(a, 34);
  grain(h, 26);

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const bump = new THREE.CanvasTexture(height);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

/* ------------------------------------------------------------------ *
 *  Shader del campo de estrellas
 * ------------------------------------------------------------------ */

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * uPixelRatio;
  }
`;

const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 2.6);
    gl_FragColor = vec4(vColor * core, core);
  }
`;

/* ------------------------------------------------------------------ *
 *  Motor
 * ------------------------------------------------------------------ */

export class DopplerEngine {
  constructor(container, config = {}) {
    this.container = container;
    this.cfg = { ...DEFAULT_CONFIG, ...config };

    this.spheres = [];
    this.t = 0;
    this.audioTime = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.locked = false;
    this.audio = null;
    this.fileBuffer = null;
    this.fileName = null;
    this.focus = null;

    this.avgDt = 1 / 60; // Δt promedio entre frames
    this.vObserved = 1; // pico de velocidad radial, para el rango automático
    this.dNear = 1;
    this.dFar = 10;

    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._aPos = new THREE.Vector3();
    this._aTan = new THREE.Vector3();
    this._aDir = new THREE.Vector3();
    this._aQuat = new THREE.Quaternion();
    this._sample = new THREE.Vector3();
    this._colorTmp = new THREE.Color();
    this._colorFar = new THREE.Color();
    this._colorNear = new THREE.Color();
    this._colorNeutral = new THREE.Color();

    this.lastDt = 1 / 60;
    this.clock = new THREE.Clock();
    this._raf = null;
    this._disposed = false;
  }

  /* ---------------- ciclo de vida ---------------- */

  mount() {
    const { container } = this;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(this.cfg.fov, w / h, 0.1, MAX_ORBIT_DIAMETER * 10);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_HEIGHT, 0);

    // Escena y cámara aparte para el cielo: comparten orientación pero la
    // cámara queda fija en el origen, así el campo estelar está siempre en el
    // infinito por más grandes que sean las órbitas.
    this.starScene = new THREE.Scene();
    this.starCamera = new THREE.PerspectiveCamera(this.cfg.fov, w / h, 1, STAR_RADIUS * 4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000004, 1);
    container.appendChild(this.renderer.domElement);

    this.glowTexture = makeGlowTexture();
    this.moon = makeMoonTextures();

    this._buildSky();
    this._buildStage();
    this.rebuildSpheres();
    this._bindEvents();

    this._loop = this._loop.bind(this);
    this.clock.start();
    this._raf = requestAnimationFrame(this._loop);
  }

  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._unbindEvents();
    this._teardownAudio();
    const purge = (scene) =>
      scene?.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    purge(this.scene);
    purge(this.starScene);
    this.glowTexture?.dispose();
    this.moon?.map.dispose();
    this.moon?.bump.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  /* ---------------- cielo ---------------- */

  _buildSky() {
    if (this.stars) {
      this.starScene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.stars = null;
    }

    const n = Math.max(0, Math.floor(this.cfg.starCount));
    if (n === 0) return;

    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);
    const c = new THREE.Color();

    // Banda tipo vía láctea: un plano cualquiera con densidad extra
    const bandNormal = new THREE.Vector3(0.35, 0.86, -0.37).normalize();
    const u = new THREE.Vector3().crossVectors(bandNormal, new THREE.Vector3(1, 0, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(bandNormal, u).normalize();
    const p = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.35) {
        const ang = Math.random() * Math.PI * 2;
        const off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.22;
        p.copy(u)
          .multiplyScalar(Math.cos(ang))
          .addScaledVector(v, Math.sin(ang))
          .addScaledVector(bandNormal, off)
          .normalize();
      } else {
        // uniforme sobre toda la esfera celeste: arriba, abajo y alrededor
        const z = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        p.set(s * Math.cos(th), z, s * Math.sin(th));
      }

      pos[i * 3] = p.x * STAR_RADIUS;
      pos[i * 3 + 1] = p.y * STAR_RADIUS;
      pos[i * 3 + 2] = p.z * STAR_RADIUS;

      // Magnitud: la mayoría débiles, unas pocas claramente más brillantes
      const r = Math.random();
      let mag;
      let px;
      if (r > 0.988) {
        mag = rand(1.7, 2.9);
        px = rand(5.5, 9.5);
      } else if (r > 0.9) {
        mag = rand(0.9, 1.6);
        px = rand(3.0, 5.0);
      } else if (r > 0.6) {
        mag = rand(0.45, 0.85);
        px = rand(1.8, 2.8);
      } else {
        mag = rand(0.12, 0.42);
        px = rand(0.9, 1.7);
      }
      siz[i] = px;

      const t = Math.random();
      const hue = t < 0.62 ? rand(0.55, 0.66) : t < 0.86 ? rand(0.1, 0.16) : rand(0.02, 0.07);
      c.setHSL(hue, rand(0.15, 0.6), 0.62);
      col[i * 3] = c.r * mag;
      col[i * 3 + 1] = c.g * mag;
      col[i * 3 + 2] = c.b * mag;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uScale: { value: this.cfg.starSize },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.starScene.add(this.stars);
  }

  /* ---------------- superficie lunar ---------------- */

  _buildStage() {
    const group = new THREE.Group();

    // Relieve real: la malla se desplaza con el mapa de altura
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATFORM_SIZE, PLATFORM_SIZE, 200, 200),
      new THREE.MeshStandardMaterial({
        map: this.moon.map,
        bumpMap: this.moon.bump,
        bumpScale: 0.9,
        displacementMap: this.moon.bump,
        displacementScale: 0.34,
        displacementBias: -0.17,
        roughness: 1.0,
        metalness: 0.0,
        color: '#cfcbc2',
      })
    );
    surface.rotation.x = -Math.PI / 2;
    group.add(surface);

    // Bloque de roca: la plataforma es un pedazo de suelo flotando en el vacío
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_SIZE, 1.6, PLATFORM_SIZE),
      new THREE.MeshStandardMaterial({
        map: this.moon.map,
        bumpMap: this.moon.bump,
        bumpScale: 0.7,
        roughness: 1.0,
        metalness: 0.0,
        color: '#5c5952',
      })
    );
    body.position.y = -0.95;
    group.add(body);

    this.scene.add(group);

    this.grid = new THREE.GridHelper(PLATFORM_SIZE, PLATFORM_SIZE, '#7f8aa8', '#5c6480');
    this.grid.position.y = 0.22;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.4;
    this.grid.visible = this.cfg.showGrid;
    this.scene.add(this.grid);

    // Sol rasante: alarga la sombra de los cráteres. En el vacío casi no hay
    // relleno, así que el ambiente es apenas la luz de las estrellas.
    const sun = new THREE.DirectionalLight('#fff6e8', 2.6);
    sun.position.set(60, 22, -40);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight('#2a3459', '#05060c', 0.22));
    this.scene.add(new THREE.AmbientLight('#20263d', 0.5));
  }

  /* ---------------- esferas y órbitas ---------------- */

  get orbitRadius() {
    return Math.max(6, this.cfg.orbitDiameter / 2);
  }

  rebuildSpheres() {
    this.spheres.slice().forEach((s) => this._removeSphere(s));
    this.spheres = [];
    this.focus = null;
    const n = clamp(Math.floor(this.cfg.sphereCount), 1, 16);
    for (let i = 0; i < n; i++) this.spheres.push(this._createSphere(i));
    this._relabel();
    this._applyOrbitVisibility();
    if (this.audio) {
      this.spheres.forEach((s) => this._attachAudio(s));
      this._balanceGains();
    }
  }

  _syncSphereCount() {
    const n = clamp(Math.floor(this.cfg.sphereCount), 1, 16);
    while (this.spheres.length > n) {
      const s = this.spheres.pop();
      if (this.focus === s) this.focus = null;
      this._removeSphere(s);
    }
    while (this.spheres.length < n) {
      const s = this._createSphere(this.spheres.length);
      this.spheres.push(s);
      if (this.audio) this._attachAudio(s);
    }
    this._relabel();
    this._applyOrbitVisibility();
    this._balanceGains();
  }

  _relabel() {
    this.spheres.forEach((s, i) => {
      s.label = `Esfera ${String(i + 1).padStart(2, '0')}`;
    });
  }

  _removeSphere(s) {
    this._detachAudio(s);
    this.scene.remove(s.pivot);
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
    s.glow.material.dispose();
    s.line.geometry.dispose();
    s.line.material.dispose();
  }

  _createSphere(i) {
    // Excentricidad garantizada: si la órbita fuese circular alrededor del
    // observador la distancia sería constante y no habría efecto Doppler.
    const bRatio = rand(0.25, 0.7);

    // Orientación uniforme en SO(3): la órbita puede caer en cualquier plano
    // del espacio, pasando por arriba, por abajo y por cualquier eje, siempre
    // centrada en el observador.
    const pivot = new THREE.Group();
    pivot.position.set(0, EYE_HEIGHT, 0);
    pivot.quaternion.random();
    this.scene.add(pivot);

    const linSpeed = rand(60, 300); // m/s sobre la trayectoria
    const dir = Math.random() < 0.5 ? -1 : 1;

    const sizeFactor = this.cfg.randomSize ? rand(0.65, 1.5) : 1;
    const radius = this.cfg.sphereRadius * sizeFactor;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff' })
    );
    mesh.scale.setScalar(radius);
    pivot.add(mesh);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ffffff',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    glow.scale.setScalar(9 * this.cfg.glow);
    mesh.add(glow);

    let light = null;
    if (this.cfg.sphereLights && i < 8) {
      light = new THREE.PointLight('#ffffff', 0.35, 0, 0);
      pivot.add(light);
    }

    // Trayectoria en escala unitaria; se escala con el radio orbital
    const pts = [];
    for (let k = 0; k <= 160; k++) {
      const th = (k / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(th), 0, Math.sin(th) * bRatio));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#4b5894', transparent: true, opacity: 0.3 })
    );
    pivot.add(line);

    const s = {
      id: i,
      label: `Esfera ${String(i + 1).padStart(2, '0')}`,
      pivot,
      mesh,
      glow,
      light,
      line,
      bRatio,
      a: this.orbitRadius,
      b: this.orbitRadius * bRatio,
      linSpeed,
      dirSign: dir,
      omega: 0,
      phase: rand(0, Math.PI * 2),
      radius,
      sizeFactor,
      baseFreq: rand(
        Math.min(this.cfg.freqMin, this.cfg.freqMax),
        Math.max(this.cfg.freqMin, this.cfg.freqMax)
      ),
      arpOffset: Math.floor(rand(0, 8)),
      worldPos: new THREE.Vector3(),
      prevDist: null,
      vr: 0,
      dist: 0,
      doppler: 1,
      currentFreq: 0,
      rate: 1,
      colorNorm: 0.5,
      colorObj: new THREE.Color('#ffffff'),
      colorHex: '#ffffff',
      audio: null,
    };

    this._applyOrbitTo(s);
    return s;
  }

  _applyOrbitTo(s) {
    const R = this.orbitRadius;
    s.a = R;
    s.b = R * s.bRatio;
    s.line.scale.set(R, 1, R);
    // Velocidad angular derivada de la velocidad lineal deseada
    s.omega = s.dirSign * clamp(s.linSpeed / R, 0.015, 2.5);
  }

  _applyOrbitScale() {
    this.spheres.forEach((s) => this._applyOrbitTo(s));
    this._updatePanners();
  }

  _applySizes() {
    this.spheres.forEach((s) => {
      if (!this.cfg.randomSize) s.sizeFactor = 1;
      else if (s.sizeFactor === 1) s.sizeFactor = rand(0.65, 1.5);
      s.radius = this.cfg.sphereRadius * s.sizeFactor;
      s.mesh.scale.setScalar(s.radius);
    });
  }

  _applyLights() {
    this.spheres.forEach((s, i) => {
      const wanted = this.cfg.sphereLights && i < 8;
      if (wanted && !s.light) {
        s.light = new THREE.PointLight('#ffffff', 0.35, 0, 0);
        s.pivot.add(s.light);
      } else if (!wanted && s.light) {
        s.pivot.remove(s.light);
        s.light.dispose();
        s.light = null;
      }
    });
  }

  _applyOrbitVisibility() {
    this.spheres.forEach((s) => (s.line.visible = this.cfg.showOrbits));
  }

  /* ---------------- audio ---------------- */

  startAudio() {
    if (this._disposed) return;
    if (this.audio) {
      if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = this.cfg.volume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    this.audio = { ctx, master, limiter };
    this.spheres.forEach((s) => this._attachAudio(s));
    this._balanceGains();
  }

  _teardownAudio() {
    if (!this.audio) return;
    this.spheres.forEach((s) => this._detachAudio(s));
    try {
      this.audio.ctx.close();
    } catch (e) {
      /* noop */
    }
    this.audio = null;
  }

  _pannerSettings() {
    const R = this.orbitRadius;
    return { ref: Math.max(1, R * 0.15), max: R * 12 };
  }

  _attachAudio(s) {
    if (!this.audio || s.audio) return;
    const { ctx, master } = this.audio;
    const { ref, max } = this._pannerSettings();

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = ref;
    panner.rolloffFactor = 0.9;
    panner.maxDistance = max;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(panner);
    panner.connect(master);

    s.audio = { panner, gain, node: null, kind: null };
    this._buildSource(s);
    gain.gain.setTargetAtTime(this._voiceGain(), ctx.currentTime, 0.4);
  }

  _updatePanners() {
    if (!this.audio) return;
    const { ref, max } = this._pannerSettings();
    this.spheres.forEach((s) => {
      if (!s.audio) return;
      s.audio.panner.refDistance = ref;
      s.audio.panner.maxDistance = max;
    });
  }

  _voiceGain() {
    return 1.2 / Math.sqrt(Math.max(1, this.spheres.length));
  }

  _balanceGains() {
    if (!this.audio) return;
    const g = this._voiceGain();
    this.spheres.forEach((s) => {
      if (s.audio) s.audio.gain.gain.setTargetAtTime(g, this.audio.ctx.currentTime, 0.25);
    });
  }

  _detachAudio(s) {
    if (!s.audio) return;
    const { node, gain, panner } = s.audio;
    try {
      if (node) {
        node.stop?.();
        node.disconnect();
      }
    } catch (e) {
      /* noop */
    }
    gain.disconnect();
    panner.disconnect();
    s.audio = null;
  }

  _buildSource(s) {
    if (!this.audio || !s.audio) return;
    const { ctx } = this.audio;
    const a = s.audio;

    if (a.node) {
      try {
        a.node.stop?.();
        a.node.disconnect();
      } catch (e) {
        /* noop */
      }
      a.node = null;
    }

    if (this.cfg.soundType === 'file' && this.fileBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.fileBuffer;
      src.loop = true;
      src.playbackRate.value = 1;
      src.connect(a.gain);
      src.start(ctx.currentTime, Math.random() * Math.min(1, this.fileBuffer.duration));
      a.node = src;
      a.kind = 'buffer';
    } else {
      const osc = ctx.createOscillator();
      osc.type = this.cfg.waveform;
      osc.frequency.value = s.baseFreq;
      osc.connect(a.gain);
      osc.start();
      a.node = osc;
      a.kind = 'osc';
    }
  }

  rebuildSources() {
    this.spheres.forEach((s) => this._buildSource(s));
  }

  async loadAudioFile(file) {
    this.startAudio();
    if (!this.audio) throw new Error('El audio todavía no está activo.');
    const buf = await file.arrayBuffer();
    this.fileBuffer = await this.audio.ctx.decodeAudioData(buf);
    this.fileName = file.name;
    if (this.cfg.soundType === 'file') this.rebuildSources();
    return this.fileName;
  }

  _updateListener() {
    if (!this.audio) return;
    const l = this.audio.ctx.listener;
    const p = this.camera.position;
    this.camera.getWorldDirection(this._fwd);
    const now = this.audio.ctx.currentTime;

    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, now, 0.02);
      l.positionY.setTargetAtTime(p.y, now, 0.02);
      l.positionZ.setTargetAtTime(p.z, now, 0.02);
      l.forwardX.setTargetAtTime(this._fwd.x, now, 0.02);
      l.forwardY.setTargetAtTime(this._fwd.y, now, 0.02);
      l.forwardZ.setTargetAtTime(this._fwd.z, now, 0.02);
      l.upX.setTargetAtTime(0, now, 0.02);
      l.upY.setTargetAtTime(1, now, 0.02);
      l.upZ.setTargetAtTime(0, now, 0.02);
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(this._fwd.x, this._fwd.y, this._fwd.z, 0, 1, 0);
    }
  }

  _arpFrequency(s) {
    const chord = CHORDS[this.cfg.chord] || CHORDS.maj7;
    const up = [...chord.steps, 12];
    const seq = [...up, ...up.slice(1, -1).reverse()];
    const idx = Math.floor(this.audioTime * this.cfg.arpRate + s.arpOffset) % seq.length;
    return s.baseFreq * semitoneRatio(seq[idx]);
  }

  /* ---------------- entrada ---------------- */

  _bindEvents() {
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.cfg.sensitivity;
      this.pitch -= e.movementY * this.cfg.sensitivity;
      const lim = Math.PI / 2 - 0.02;
      this.pitch = clamp(this.pitch, -lim, lim);
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.renderer.domElement;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    };
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.starCamera.aspect = w / h;
      this.starCamera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.stars) {
        this.stars.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('resize', this._onResize);
  }

  _unbindEvents() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    window.removeEventListener('resize', this._onResize);
  }

  requestLock(retry = true) {
    const el = this.renderer?.domElement;
    if (!el?.requestPointerLock) return;
    let result;
    try {
      result = el.requestPointerLock();
    } catch (e) {
      result = null;
    }
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        if (retry) setTimeout(() => this.requestLock(false), 350);
      });
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _updateMovement(dt) {
    const c = this.camera;
    c.rotation.set(this.pitch, this.yaw, 0);
    c.position.y = EYE_HEIGHT;

    if (!this.locked) return;

    let ax = 0; // eje derecha
    let az = 0; // eje adelante
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) az += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) az -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ax += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ax -= 1;
    if (!ax && !az) return;

    // Los ejes se recalculan con el yaw actual en cada frame, así que la
    // dirección de avance sigue siempre a donde mira la cámara.
    this._fwd.set(0, 0, -1).applyAxisAngle(this._up, this.yaw);
    this._right.set(1, 0, 0).applyAxisAngle(this._up, this.yaw);

    this._move.set(0, 0, 0).addScaledVector(this._fwd, az).addScaledVector(this._right, ax);
    this._move.y = 0;
    if (this._move.lengthSq() === 0) return;
    this._move.normalize().multiplyScalar(this.cfg.moveSpeed * dt);

    c.position.x = clamp(c.position.x + this._move.x, -WALK_LIMIT, WALK_LIMIT);
    c.position.z = clamp(c.position.z + this._move.z, -WALK_LIMIT, WALK_LIMIT);
  }

  /* ---------------- loop ---------------- */

  _loop() {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (dt <= 0) return;
    this.lastDt = dt;

    const cfg = this.cfg;
    this.avgDt += (dt - this.avgDt) * 0.05;
    this.audioTime += dt;
    if (!cfg.paused) this.t += dt * cfg.speed;

    this._updateMovement(dt);
    this._updateListener();

    this._colorFar.set(cfg.colorFar);
    this._colorNear.set(cfg.colorNear);
    this._colorNeutral.set(cfg.colorNeutral);

    const ctx = this.audio?.ctx;
    const c = Math.max(1, cfg.waveSpeed);

    let frameVMax = 0;
    let frameDMin = Infinity;
    let frameDMax = 0;

    for (const s of this.spheres) {
      // 1. Posición sobre la elipse, en el plano propio del pivote
      const th = s.phase + this.t * s.omega;
      s.mesh.position.set(Math.cos(th) * s.a, 0, Math.sin(th) * s.b);
      if (s.light) s.light.position.copy(s.mesh.position);
      s.mesh.getWorldPosition(s.worldPos);

      // 2. Distancia al observador
      const dist = s.worldPos.distanceTo(this.camera.position);

      // 3. Velocidad radial: derivada de la distancia (positiva = se aleja).
      //    En modo análisis la órbita está congelada y la velocidad se retiene
      //    en su último valor, así el cuadro queda como una instantánea
      //    coherente: color, tono y lectura se mantienen. prevDist se sigue
      //    sincronizando para que al reanudar no haya un pico.
      if (!cfg.paused) {
        let vrRaw = 0;
        if (s.prevDist !== null) vrRaw = (dist - s.prevDist) / dt;
        s.vr += (vrRaw - s.vr) * cfg.smoothing;
      }
      s.prevDist = dist;
      s.dist = dist;

      if (Math.abs(s.vr) > frameVMax) frameVMax = Math.abs(s.vr);
      if (dist < frameDMin) frameDMin = dist;
      if (dist > frameDMax) frameDMax = dist;

      // 4. f_obs = f_fuente · c / (c + v_radial)
      // Si la fuente se acerca más rápido que la propia onda, el denominador
      // cruza cero: es la barrera de Mach 1. Se acota para que el modelo
      // sature en el agudo máximo en vez de invertir el signo del tono.
      const denom = Math.max(c * 0.25, c + s.vr * cfg.exaggeration);
      const doppler = clamp(c / denom, 0.25, 4);
      s.doppler = doppler;
      s.supersonic = Math.abs(s.vr * cfg.exaggeration) > c;

      // 5. Audio
      if (ctx && s.audio) {
        const p = s.audio.panner;
        if (p.positionX) {
          p.positionX.setTargetAtTime(s.worldPos.x, ctx.currentTime, 0.02);
          p.positionY.setTargetAtTime(s.worldPos.y, ctx.currentTime, 0.02);
          p.positionZ.setTargetAtTime(s.worldPos.z, ctx.currentTime, 0.02);
        } else if (p.setPosition) {
          p.setPosition(s.worldPos.x, s.worldPos.y, s.worldPos.z);
        }

        if (s.audio.kind === 'osc') {
          const base = cfg.soundType === 'arpeggio' ? this._arpFrequency(s) : s.baseFreq;
          s.currentFreq = base * doppler;
          s.rate = doppler;
          s.audio.node.frequency.setTargetAtTime(s.currentFreq, ctx.currentTime, 0.012);
          if (s.audio.node.type !== cfg.waveform) s.audio.node.type = cfg.waveform;
        } else {
          s.rate = doppler;
          s.currentFreq = null;
          s.audio.node.playbackRate.setTargetAtTime(doppler, ctx.currentTime, 0.03);
        }
      } else {
        const base = cfg.soundType === 'arpeggio' ? this._arpFrequency(s) : s.baseFreq;
        s.currentFreq = cfg.soundType === 'file' ? null : base * doppler;
        s.rate = doppler;
      }
    }

    // Rango automático: sigue el pico observado y decae despacio
    this.vObserved = Math.max(frameVMax, this.vObserved * 0.9985);
    if (frameDMin < Infinity) {
      this.dNear = Math.min(frameDMin, this.dNear + (frameDMin - this.dNear) * 0.02);
      this.dFar = Math.max(frameDMax, this.dFar + (frameDMax - this.dFar) * 0.02);
    }

    const vRef = cfg.autoRange ? Math.max(0.5, this.vObserved) : Math.max(0.5, cfg.vRef);
    const dLo = cfg.autoRange ? this.dNear : cfg.distMin;
    const dHi = cfg.autoRange ? Math.max(this.dFar, dLo + 1) : Math.max(cfg.distMax, dLo + 1);

    for (const s of this.spheres) {
      // 6. Color: corrimiento al rojo / azul
      let tCol;
      if (cfg.colorMode === 'distance') {
        tCol = 1 - clamp((s.dist - dLo) / (dHi - dLo), 0, 1);
      } else {
        tCol = 0.5 - clamp(s.vr / vRef, -1, 1) * 0.5;
      }

      if (cfg.useNeutral) {
        if (tCol >= 0.5) {
          this._colorTmp.copy(this._colorNeutral).lerp(this._colorNear, (tCol - 0.5) * 2);
        } else {
          this._colorTmp.copy(this._colorFar).lerp(this._colorNeutral, tCol * 2);
        }
      } else {
        this._colorTmp.copy(this._colorFar).lerp(this._colorNear, tCol);
      }

      s.colorNorm = tCol;
      s.colorObj.lerp(this._colorTmp, 0.14);
      s.mesh.material.color.copy(s.colorObj);
      s.glow.material.color.copy(s.colorObj);
      s.glow.material.opacity = 0.85 * cfg.glow;
      s.glow.scale.setScalar(9 * cfg.glow);
      if (s.light) {
        s.light.color.copy(s.colorObj);
        s.light.intensity = (2.4 / Math.max(1, this.spheres.length)) * cfg.glow;
      }
      s.colorHex = `#${s.colorObj.getHexString()}`;
    }

    // 7. Objeto apuntado por la mira
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.spheres.map((s) => s.mesh),
      false
    );
    this.focus = hits.length ? this.spheres.find((s) => s.mesh === hits[0].object) : null;

    // 8. Render: primero el cielo al infinito, después la escena
    this.renderer.clear();
    if (this.stars) {
      this.starCamera.quaternion.copy(this.camera.quaternion);
      this.renderer.render(this.starScene, this.starCamera);
      this.renderer.clearDepth();
    }
    this.renderer.render(this.scene, this.camera);
  }

  /* ---------------- API para la UI ---------------- */

  setConfig(partial) {
    const prev = this.cfg;
    this.cfg = { ...prev, ...partial };

    if ('volume' in partial && this.audio) {
      this.audio.master.gain.setTargetAtTime(this.cfg.volume, this.audio.ctx.currentTime, 0.05);
    }
    if ('fov' in partial) {
      this.camera.fov = this.cfg.fov;
      this.camera.updateProjectionMatrix();
      this.starCamera.fov = this.cfg.fov;
      this.starCamera.updateProjectionMatrix();
    }
    if ('starCount' in partial && partial.starCount !== prev.starCount) this._buildSky();
    if ('starSize' in partial && this.stars) {
      this.stars.material.uniforms.uScale.value = this.cfg.starSize;
    }
    if ('showOrbits' in partial) this._applyOrbitVisibility();
    if ('showGrid' in partial && this.grid) this.grid.visible = this.cfg.showGrid;

    if ('orbitDiameter' in partial && partial.orbitDiameter !== prev.orbitDiameter) {
      this._applyOrbitScale();
    }
    if ('sphereCount' in partial && partial.sphereCount !== prev.sphereCount) {
      this._syncSphereCount();
      this._applyLights();
    }
    if (
      ('sphereRadius' in partial && partial.sphereRadius !== prev.sphereRadius) ||
      ('randomSize' in partial && partial.randomSize !== prev.randomSize)
    ) {
      this._applySizes();
    }
    if ('sphereLights' in partial && partial.sphereLights !== prev.sphereLights) {
      this._applyLights();
    }
    if ('soundType' in partial && partial.soundType !== prev.soundType) this.rebuildSources();

    if (
      ('freqMin' in partial && partial.freqMin !== prev.freqMin) ||
      ('freqMax' in partial && partial.freqMax !== prev.freqMax)
    ) {
      const lo = Math.min(this.cfg.freqMin, this.cfg.freqMax);
      const hi = Math.max(this.cfg.freqMin, this.cfg.freqMax);
      this.spheres.forEach((s, i) => {
        s.baseFreq = lo + ((i + 0.5) / this.spheres.length) * (hi - lo);
      });
    }
  }

  /**
   * Datos del modelo matemático para el objeto apuntado. Solo devuelve algo en
   * modo análisis (órbitas congeladas), porque el muestreo describe la curva
   * completa d(t) alrededor del instante actual.
   *
   * La posición de la esfera es p(θ) = C + R·(a·cos θ, 0, b·sin θ), con R la
   * rotación del plano orbital. De ahí:
   *   d(θ)  = ‖p(θ) − o‖
   *   dd/dt = Ω · (R·p′(θ)) · û      con û = (p − o)/d
   * La derivada analítica es exacta; la simulación usa la diferencia finita
   * (dₙ − dₙ₋₁)/Δt, que converge a la misma cantidad.
   */
  getAnalysis(sampleCount = 181) {
    const s = this.focus;
    if (!s || !this.cfg.paused) return null;

    const o = this.camera.position;
    s.pivot.updateWorldMatrix(true, false);
    const M = s.pivot.matrixWorld;
    s.pivot.getWorldQuaternion(this._aQuat);

    const omega = s.omega;
    const rate = omega * Math.max(this.cfg.speed, 1e-6); // rad por segundo real
    const thetaNow = s.phase + this.t * omega;
    const period = (Math.PI * 2) / Math.abs(rate);

    const at = (theta) => {
      this._aPos.set(Math.cos(theta) * s.a, 0, Math.sin(theta) * s.b).applyMatrix4(M);
      const d = this._aPos.distanceTo(o);
      // p′(θ) rotada al mundo y proyectada sobre el versor esfera → observador
      this._aTan
        .set(-Math.sin(theta) * s.a, 0, Math.cos(theta) * s.b)
        .applyQuaternion(this._aQuat);
      this._aDir.subVectors(this._aPos, o).divideScalar(d || 1);
      return { d, dp: this._aTan.dot(this._aDir) * rate };
    };

    const samples = [];
    let dMin = Infinity;
    let dMax = -Infinity;
    let dpAbs = 0;
    for (let i = 0; i < sampleCount; i++) {
      const f = i / (sampleCount - 1) - 0.5; // −½ … +½ del período
      const theta = thetaNow + f * Math.PI * 2 * Math.sign(omega || 1);
      const { d, dp } = at(theta);
      samples.push({ t: f * period, d, dp });
      if (d < dMin) dMin = d;
      if (d > dMax) dMax = d;
      if (Math.abs(dp) > dpAbs) dpAbs = Math.abs(dp);
    }

    const now = at(thetaNow);
    const delta = {
      x: this._aPos.x - o.x,
      y: this._aPos.y - o.y,
      z: this._aPos.z - o.z,
    };
    const sphere = { x: this._aPos.x, y: this._aPos.y, z: this._aPos.z };

    const c = Math.max(1, this.cfg.waveSpeed);
    const base = this.cfg.soundType === 'arpeggio' ? this._arpFrequency(s) : s.baseFreq;

    return {
      label: s.label,
      a: s.a,
      b: s.b,
      omega,
      rate,
      speed: this.cfg.speed,
      theta: ((thetaNow % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      phase: ((s.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      period,
      center: { x: 0, y: EYE_HEIGHT, z: 0 },
      sphere,
      observer: { x: o.x, y: o.y, z: o.z },
      delta,
      dist: now.d,
      dMin,
      dMax,
      dpAbs,
      ddt: now.dp,
      vr: s.vr,
      dt: this.lastDt,
      alpha: this.cfg.smoothing,
      waveSpeed: c,
      exaggeration: this.cfg.exaggeration,
      baseFreq: base,
      freq: this.cfg.soundType === 'file' ? null : base * s.doppler,
      doppler: s.doppler,
      isFile: this.cfg.soundType === 'file',
      samples,
    };
  }

  /**
   * Modelo matemático de la esfera apuntada: parámetros de la órbita y la
   * curva d(t) muestreada sobre un período completo, centrada en el instante
   * actual, junto con su derivada.
   */
  getAnalysis(sampleCount = 161) {
    const s = this.focus;
    if (!s) return null;

    // Si la simulación está detenida, se grafica el ritmo que tendría al
    // reanudarse, no el congelado.
    const speed = this.cfg.speed > 0 ? this.cfg.speed : 1;
    const omegaEff = s.omega * speed;
    if (Math.abs(omegaEff) < 1e-9) return null;

    const period = (2 * Math.PI) / Math.abs(omegaEff);
    const thetaNow = s.phase + this.t * s.omega;
    const obs = this.camera.position;

    s.pivot.updateMatrixWorld(true);
    const m = s.pivot.matrixWorld;
    const p = this._sample;

    const distAt = (th) => {
      p.set(Math.cos(th) * s.a, 0, Math.sin(th) * s.b).applyMatrix4(m);
      return p.distanceTo(obs);
    };
    // dd/dt = (dd/dθ) · ω, por diferencia centrada en θ
    const slopeAt = (th) => {
      const h = 1e-3;
      return ((distAt(th + h) - distAt(th - h)) / (2 * h)) * omegaEff;
    };

    const sign = Math.sign(omegaEff) || 1;
    const points = [];
    let dMin = Infinity;
    let dMax = -Infinity;
    let vAbs = 0;

    for (let i = 0; i < sampleCount; i++) {
      const u = i / (sampleCount - 1) - 0.5; // -0.5 … 0.5 de período
      const th = thetaNow + u * Math.PI * 2 * sign;
      const d = distAt(th);
      const v = slopeAt(th);
      points.push({ t: u * period, d, v });
      if (d < dMin) dMin = d;
      if (d > dMax) dMax = d;
      if (Math.abs(v) > vAbs) vAbs = Math.abs(v);
    }

    const q = s.pivot.quaternion;

    return {
      label: s.label,
      a: s.a,
      b: s.b,
      bRatio: s.bRatio,
      phase: s.phase,
      omega: s.omega,
      omegaEff,
      speed,
      theta: ((thetaNow % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      period,
      dist: s.dist,
      vrCurve: slopeAt(thetaNow),
      vrMeasured: s.vr,
      dMin,
      dMax,
      vAbs,
      dtFrame: this.avgDt,
      waveSpeed: this.cfg.waveSpeed,
      baseFreq: s.baseFreq,
      quat: [q.x, q.y, q.z, q.w],
      center: [s.pivot.position.x, s.pivot.position.y, s.pivot.position.z],
      observer: [obs.x, obs.y, obs.z],
      points,
    };
  }

  getFocusInfo() {
    const s = this.focus;
    if (!s) return null;
    return {
      label: s.label,
      dist: s.dist,
      hex: s.colorHex || '#ffffff',
      freq: s.currentFreq,
      baseFreq: s.baseFreq,
      vr: s.vr,
      doppler: s.doppler,
      rate: s.rate,
      radius: s.radius,
      norm: s.colorNorm ?? 0.5,
      supersonic: !!s.supersonic,
    };
  }
}
