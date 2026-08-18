'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DopplerEngine,
  DEFAULT_CONFIG,
  CHORDS,
  WAVEFORMS,
  MAX_ORBIT_DIAMETER,
  MAX_SPEED,
} from '@/lib/DopplerEngine';

const fmtDistance = (m) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 100 ? 2 : 1)} m`;

/* ---------- controles reutilizables ---------- */

function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <label className="ctl">
      <span className="ctl-label">{label}</span>
      <span className="ctl-value">
        {typeof value !== 'number'
          ? value
          : Math.abs(value) >= 100 || step >= 1
            ? Math.round(value).toLocaleString('es-AR')
            : value.toFixed(2)}
        {unit ? <em>{unit}</em> : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <label className="ctl">
      <span className="ctl-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Swatch({ label, value, onChange }) {
  return (
    <label className="ctl ctl-color">
      <span className="ctl-label">{label}</span>
      <span className="swatch">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  );
}

function Toggle({ label, value, onChange, disabled, note }) {
  return (
    <label className={disabled ? 'ctl ctl-toggle is-disabled' : 'ctl ctl-toggle'}>
      <span className="ctl-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        className={value ? 'switch on' : 'switch'}
        onClick={() => !disabled && onChange(!value)}
      >
        <i />
      </button>
      {note ? <span className="ctl-note">{note}</span> : null}
    </label>
  );
}


/* ---------- modo análisis: ecuación y gráfico ---------- */

const fmt = (n, d = 2) =>
  Math.abs(n) >= 10000 ? n.toExponential(2) : n.toFixed(d);

function DerivativeGraph({ data }) {
  const W = 440;
  const H = 208;
  const M = { l: 46, r: 46, t: 14, b: 26 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  const pts = data.points;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = data.dMax - data.dMin || 1;
  const pad = span * 0.08;
  const lo = data.dMin - pad;
  const hi = data.dMax + pad;
  const vAbs = data.vAbs || 1;

  const X = (t) => M.l + ((t - t0) / (t1 - t0)) * iw;
  const Yd = (d) => M.t + ih - ((d - lo) / (hi - lo)) * ih;
  const Yv = (v) => M.t + ih / 2 - (v / vAbs) * (ih / 2) * 0.88;

  const path = (sel, Y) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(sel(p)).toFixed(1)}`).join(' ');

  // Tangente en el instante actual: su pendiente es la velocidad radial
  const d0 = pts[Math.floor(pts.length / 2)].d;
  const k = data.vrCurve;
  const tSpan = (t1 - t0) * 0.16;

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva de distancia y su derivada">
      <rect x="0" y="0" width={W} height={H} fill="#000" />
      <g className="g-grid">
        <line x1={M.l} y1={M.t} x2={M.l} y2={M.t + ih} />
        <line x1={M.l} y1={M.t + ih} x2={M.l + iw} y2={M.t + ih} />
        <line className="g-zero" x1={M.l} y1={Yv(0)} x2={M.l + iw} y2={Yv(0)} />
        <line className="g-now" x1={X(0)} y1={M.t} x2={X(0)} y2={M.t + ih} />
      </g>

      <path className="g-v" d={path((p) => p.v, Yv)} />
      <path className="g-d" d={path((p) => p.d, Yd)} />

      <line
        className="g-tan"
        x1={X(-tSpan)}
        y1={Yd(d0 - k * tSpan)}
        x2={X(tSpan)}
        y2={Yd(d0 + k * tSpan)}
      />
      <circle className="g-dot" cx={X(0)} cy={Yd(d0)} r="3.6" />

      <text className="g-tick" x={M.l - 6} y={Yd(data.dMax) + 4} textAnchor="end">
        {fmt(data.dMax / 1000, 2)}k
      </text>
      <text className="g-tick" x={M.l - 6} y={Yd(data.dMin) + 4} textAnchor="end">
        {fmt(data.dMin / 1000, 2)}k
      </text>
      <text className="g-axis" x={M.l - 6} y={M.t - 3} textAnchor="end">
        d (m)
      </text>
      <text className="g-axis" x={M.l + iw + 6} y={M.t - 3}>
        v (m/s)
      </text>
      <text className="g-tick" x={M.l + iw + 6} y={Yv(vAbs) + 4}>
        +{fmt(vAbs, 0)}
      </text>
      <text className="g-tick" x={M.l + iw + 6} y={Yv(-vAbs) + 4}>
        −{fmt(vAbs, 0)}
      </text>
      <text className="g-tick" x={M.l} y={H - 8}>
        −T/2
      </text>
      <text className="g-tick" x={X(0)} y={H - 8} textAnchor="middle">
        t actual
      </text>
      <text className="g-tick" x={M.l + iw} y={H - 8} textAnchor="end">
        +T/2
      </text>
    </svg>
  );
}

function AnalysisCard({ data }) {
  const rows = [
    ['C', 'centro de la órbita, sobre el observador', `(${data.center.map((n) => fmt(n, 2)).join(', ')})`],
    ['R', 'rotación del plano orbital (cuaternión)', `(${data.quat.map((n) => fmt(n, 3)).join(', ')})`],
    ['a', 'semieje mayor', `${fmt(data.a, 1)} m`],
    ['b', 'semieje menor', `${fmt(data.b, 1)} m`],
    ['φ', 'fase inicial sorteada', `${fmt(data.phase, 3)} rad`],
    ['ω', 'velocidad angular efectiva', `${fmt(data.omegaEff, 4)} rad/s`],
    ['θ', 'ángulo orbital actual', `${fmt(data.theta, 3)} rad`],
    ['T', 'período orbital', `${fmt(data.period, 1)} s`],
    ['p₀', 'posición del observador', `(${data.observer.map((n) => fmt(n, 2)).join(', ')})`],
    ['Δt', 'tiempo entre frames', `${fmt(data.dtFrame * 1000, 1)} ms`],
    ['d', 'distancia en este frame', `${fmt(data.dist, 1)} m`],
    ['vᵣ', 'velocidad radial, pendiente de d(t)', `${fmt(data.vrCurve, 2)} m/s`],
  ];

  return (
    <section className="analysis" aria-label="Modelo matemático">
      <header>
        <h2>Modelo · {data.label}</h2>
        <p>distancia por frame</p>
      </header>

      <pre className="eq">
{`θ(t)  = φ + ω·t

pₑ(t) = C + R · [ a·cos θ(t) , 0 , b·sin θ(t) ]

d(t)  = ‖ pₑ(t) − p₀ ‖
      = √( Δx² + Δy² + Δz² )

vᵣ    = dd/dt ≈ ( dₙ − dₙ₋₁ ) / Δt

f_obs = f₀ · c / ( c + vᵣ )`}
      </pre>

      <dl className="vars">
        {rows.map(([sym, meaning, value]) => (
          <div key={sym}>
            <dt>{sym}</dt>
            <dd className="mean">{meaning}</dd>
            <dd className="val">{value}</dd>
          </div>
        ))}
      </dl>

      <DerivativeGraph data={data} />

      <ul className="legend">
        <li className="k-d">d(t)</li>
        <li className="k-v">vᵣ = dd/dt</li>
        <li className="k-t">tangente en t actual</li>
      </ul>
      <p className="eqfoot">
        La simulación no deriva de forma simbólica: en cada frame mide d y la compara con la
        del frame anterior. La tangente es esa pendiente, y es la que entra en f_obs.
      </p>
    </section>
  );
}

/* ---------- componente principal ---------- */

export default function DopplerSim() {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const fileRef = useRef(null);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [panelOpen, setPanelOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [focus, setFocus] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [analysis, setAnalysis] = useState(false);
  const [model, setModel] = useState(null);

  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;
  const configRef = useRef(config);
  configRef.current = config;
  const prevPausedRef = useRef(false);

  /* --- arranque del motor --- */
  useEffect(() => {
    const engine = new DopplerEngine(mountRef.current, DEFAULT_CONFIG);
    engine.onLockChange = (isLocked) => setLocked(isLocked);
    engine.mount();
    engineRef.current = engine;

    const hud = setInterval(() => {
      setFocus(engine.getFocusInfo());
      setModel(analysisRef.current ? engine.getAnalysis() : null);
    }, 110);

    return () => {
      clearInterval(hud);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  /* --- Shift abre y cierra el panel --- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') return;
      if (e.repeat) return;
      e.preventDefault();
      const opening = !panelOpenRef.current;
      setPanelOpen(opening);
      if (opening) engineRef.current?.releaseLock();
      else engineRef.current?.requestLock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* --- Espacio entra y sale del modo análisis --- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      // no robarle la barra a un control del panel que tenga el foco
      const tag = e.target?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      e.preventDefault();

      const entering = !analysisRef.current;
      setAnalysis(entering);
      if (entering) {
        prevPausedRef.current = configRef.current.paused;
        update({ paused: true });
      } else {
        setModel(null);
        update({ paused: prevPausedRef.current });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch) => {
    setConfig((prev) => {
      let applied = patch;
      // Al cambiar la escala de la órbita, el radio de las esferas acompaña en
      // proporción para que el tamaño aparente desde la cámara no cambie.
      if ('orbitDiameter' in patch && prev.orbitDiameter > 0) {
        const ratio = patch.orbitDiameter / prev.orbitDiameter;
        const radius = Math.max(0.05, Math.min(400, prev.sphereRadius * ratio));
        applied = { ...patch, sphereRadius: parseFloat(radius.toFixed(3)) };
      }
      engineRef.current?.setConfig(applied);
      return { ...prev, ...applied };
    });
  }, []);

  const enter = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startAudio();
    engine.requestLock();
    setStarted(true);
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      const name = await engineRef.current.loadAudioFile(file);
      setFileName(name);
      update({ soundType: 'file' });
    } catch (err) {
      setFileError('No se pudo decodificar ese archivo. Probá con un MP3, WAV u OGG.');
    }
  };

  const showOverlay = !locked && !panelOpen;
  const chordOptions = Object.entries(CHORDS).map(([k, v]) => ({ value: k, label: v.label }));

  /* --- lecturas del HUD --- */
  const approaching = focus ? focus.vr < -0.05 : false;
  const receding = focus ? focus.vr > 0.05 : false;
  const shiftPos = focus ? Math.max(0, Math.min(1, focus.norm)) : 0.5;

  return (
    <div className="stage">
      <div ref={mountRef} className="canvas-host" onClick={() => !panelOpen && enter()} />

      {/* Mira */}
      <div className={focus ? 'reticle locked' : 'reticle'} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Ficha del objeto apuntado */}
      {focus && locked && (
        <div className="readout" role="status">
          <header>
            <h2>{focus.label}</h2>
            <p>
              {focus.supersonic
                ? 'Supera Mach 1'
                : approaching
                  ? 'Acercándose'
                  : receding
                    ? 'Alejándose'
                    : 'Velocidad radial nula'}
            </p>
          </header>

          <dl>
            <div>
              <dt>Distancia</dt>
              <dd>{fmtDistance(focus.dist)}</dd>
            </div>
            <div>
              <dt>Velocidad radial</dt>
              <dd>
                {focus.vr >= 0 ? '+' : ''}
                {focus.vr.toFixed(Math.abs(focus.vr) < 10 ? 2 : 1)}
                <em> m/s</em>
              </dd>
            </div>
            <div>
              <dt>Frecuencia percibida</dt>
              <dd>
                {focus.freq != null ? (
                  <>
                    {focus.freq.toFixed(1)}
                    <em> Hz</em>
                  </>
                ) : (
                  <>
                    ×{focus.rate.toFixed(3)}
                    <em> pitch</em>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{focus.freq != null ? 'Frecuencia en reposo' : 'Factor Doppler'}</dt>
              <dd>
                {focus.freq != null ? (
                  <>
                    {focus.baseFreq.toFixed(1)}
                    <em> Hz</em>
                  </>
                ) : (
                  focus.doppler.toFixed(3)
                )}
              </dd>
            </div>
          </dl>

          <div className="color-row">
            <span className="chip" style={{ background: focus.hex }} />
            <code>{focus.hex.toUpperCase()}</code>
          </div>

          {/* elemento firma: la barra espectral */}
          <div
            className="spectrum"
            style={{
              backgroundImage: `linear-gradient(90deg, ${config.colorFar}, ${
                config.useNeutral ? `${config.colorNeutral}, ` : ''
              }${config.colorNear})`,
            }}
          >
            <i style={{ left: `${shiftPos * 100}%` }} />
            <span className="s-left">
              {config.colorMode === 'doppler' ? 'se aleja' : 'lejos'}
            </span>
            <span className="s-right">
              {config.colorMode === 'doppler' ? 'se acerca' : 'cerca'}
            </span>
          </div>
        </div>
      )}

      {/* Modo análisis */}
      {analysis && locked && (
        <p className="mode-badge">
          Modo análisis · órbitas detenidas
          {model ? '' : ' · apuntá a una esfera'}
        </p>
      )}

      {analysis && locked && model && <AnalysisCard data={model} />}

      {/* Pantalla de entrada */}
      {showOverlay && (
        <div className="overlay" onClick={enter}>
          <div className="overlay-card">
            <p className="eyebrow">Simulación · Efecto Doppler</p>
            <h1>
              Del Sonido 

              <br />
              al Color
            </h1>
            <p className="lede" >
            El Efecto Doppler ocurre cuando hay un movimiento relativo entre la fuente que emite una onda y el observador que la percibe.
            <br />En cada frame de la simulación, el código se pregunta: "¿La distancia entre el objeto y la cámara se está achicando o agrandando? ¿Y a qué velocidad?"
            <br />Estás parado sobre diez metros cuadrados de superficie lunar flotando en el vacío, con
            esferas sonoras que orbitan a kilómetros de distancia en todas las direcciones
            del espacio. <br />El tono que escuchás y el color que ves dependen de qué tan rápido
            cada esfera se acerca o se aleja de vos. <br />Es decir, la percepcion es relativa.
            </p>
            <button type="button" className="enter" onClick={enter}>
              {started ? 'Volver a la simulación' : 'Entrar a la simulación'}
            </button>
            <ul className="keys">
              <li>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> caminar
              </li>
              <li>
                <kbd>Mouse</kbd> mirar
              </li>
              <li>
                <kbd>Shift</kbd> abrir controles
              </li>
              <li>
                <kbd>Espacio</kbd> modo análisis
              </li>
              <li>
                <kbd>Esc</kbd> soltar el cursor
              </li>
            </ul>
            <p className="note">Necesita teclado, mouse y sonido activado.</p>
          </div>
        </div>
      )}

      {locked && !panelOpen && (
        <p className="hint">Shift · controles &nbsp;·&nbsp; Espacio · modo análisis</p>
      )}

      {/* Panel de depuración */}
      {panelOpen && (
        <aside className="panel" aria-label="Controles de la simulación">
          <div className="panel-head">
            <p className="eyebrow">Consola</p>
            <button
              type="button"
              className="close"
              onClick={() => {
                setPanelOpen(false);
                engineRef.current?.requestLock();
              }}
            >
              Cerrar
            </button>
          </div>

          <div className="panel-body">
            <section>
              <h3>Órbitas</h3>
              <Slider
                label="Diámetro orbital"
                value={config.orbitDiameter}
                min={12}
                max={MAX_ORBIT_DIAMETER}
                step={4}
                unit=" m"
                onChange={(v) => update({ orbitDiameter: v })}
              />
              <Slider
                label="Cantidad de esferas"
                value={config.sphereCount}
                min={1}
                max={16}
                step={1}
                onChange={(v) => update({ sphereCount: v })}
              />
              <Slider
                label="Velocidad orbital"
                value={config.speed}
                min={0}
                max={MAX_SPEED}
                step={0.05}
                unit="×"
                onChange={(v) => update({ speed: v })}
              />
              <p className="foot">
                Arriba de ~20× el desplazamiento por frame supera el arco visible y la
                trayectoria se ve estroboscópica: es aliasing temporal, no un error del modelo.
              </p>
            </section>

            <section>
              <h3>Esferas</h3>
              <Slider
                label="Radio"
                value={config.sphereRadius}
                min={0.05}
                max={400}
                step={0.05}
                unit=" m"
                onChange={(v) => update({ sphereRadius: v })}
              />
              <Toggle
                label="Radios aleatorios"
                value={config.randomSize}
                onChange={(v) => update({ randomSize: v })}
              />
              <Slider
                label="Intensidad del halo"
                value={config.glow}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(v) => update({ glow: v })}
              />
              <Toggle
                label="Iluminan la plataforma"
                value={config.sphereLights}
                onChange={(v) => update({ sphereLights: v })}
              />
              <button
                type="button"
                className="wide"
                onClick={() => engineRef.current?.rebuildSpheres()}
              >
                Sortear órbitas nuevas
              </button>
            </section>

            <section>
              <h3>Sonido</h3>
              <Choice
                label="Fuente"
                value={config.soundType}
                options={[
                  { value: 'tone', label: 'Tono puro' },
                  { value: 'arpeggio', label: 'Acorde arpegiado' },
                  { value: 'file', label: 'Archivo cargado' },
                ]}
                onChange={(v) => update({ soundType: v })}
              />
              {config.soundType !== 'file' && (
                <Choice
                  label="Forma de onda"
                  value={config.waveform}
                  options={WAVEFORMS.map((w) => ({ value: w, label: w }))}
                  onChange={(v) => update({ waveform: v })}
                />
              )}
              {config.soundType === 'arpeggio' && (
                <>
                  <Choice
                    label="Acorde"
                    value={config.chord}
                    options={chordOptions}
                    onChange={(v) => update({ chord: v })}
                  />
                  <Slider
                    label="Notas por segundo"
                    value={config.arpRate}
                    min={1}
                    max={16}
                    step={0.5}
                    onChange={(v) => update({ arpRate: v })}
                  />
                </>
              )}
              <div className="file-row">
                <button type="button" className="wide" onClick={() => fileRef.current?.click()}>
                  {fileName ? `Reemplazar ${fileName}` : 'Cargar un MP3'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={onFile}
                />
                {fileError && <p className="error">{fileError}</p>}
              </div>
              <Slider
                label="Frecuencia mínima"
                value={config.freqMin}
                min={40}
                max={900}
                step={5}
                unit=" Hz"
                onChange={(v) => update({ freqMin: v })}
              />
              <Slider
                label="Frecuencia máxima"
                value={config.freqMax}
                min={60}
                max={1600}
                step={5}
                unit=" Hz"
                onChange={(v) => update({ freqMax: v })}
              />
              <Slider
                label="Volumen"
                value={config.volume}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update({ volume: v })}
              />
            </section>

            <section>
              <h3>Modelo Doppler</h3>
              <Slider
                label="Velocidad de la onda"
                value={config.waveSpeed}
                min={5}
                max={20000}
                step={5}
                unit=" m/s"
                onChange={(v) => update({ waveSpeed: v })}
              />
              <Slider
                label="Exageración del efecto"
                value={config.exaggeration}
                min={0}
                max={12}
                step={0.1}
                unit="×"
                onChange={(v) => update({ exaggeration: v })}
              />
              <Slider
                label="Suavizado"
                value={config.smoothing}
                min={0.02}
                max={1}
                step={0.01}
                onChange={(v) => update({ smoothing: v })}
              />
              <p className="foot">
                f<sub>obs</sub> = f<sub>fuente</sub> · c / (c + v<sub>radial</sub>)
                <br />
                Si la velocidad radial supera a c, la fuente cruza Mach 1 y el modelo satura
                en el agudo máximo. Subí la velocidad de la onda para volver al régimen
                subsónico.
              </p>
            </section>

            <section>
              <h3>Color</h3>
              <Choice
                label="Se mapea desde"
                value={config.colorMode}
                options={[
                  { value: 'doppler', label: 'Velocidad radial' },
                  { value: 'distance', label: 'Distancia' },
                ]}
                onChange={(v) => update({ colorMode: v })}
              />
              <Swatch
                label={config.colorMode === 'doppler' ? 'Alejándose' : 'Más lejos'}
                value={config.colorFar}
                onChange={(v) => update({ colorFar: v })}
              />
              <Swatch
                label={config.colorMode === 'doppler' ? 'Acercándose' : 'Más cerca'}
                value={config.colorNear}
                onChange={(v) => update({ colorNear: v })}
              />
              <Toggle
                label="Color intermedio"
                value={config.useNeutral}
                onChange={(v) => update({ useNeutral: v })}
              />
              {config.useNeutral && (
                <Swatch
                  label="Punto neutro"
                  value={config.colorNeutral}
                  onChange={(v) => update({ colorNeutral: v })}
                />
              )}
              <Toggle
                label="Rango automático"
                value={config.autoRange}
                onChange={(v) => update({ autoRange: v })}
              />
              {!config.autoRange &&
                (config.colorMode === 'doppler' ? (
                  <Slider
                    label="Velocidad que satura"
                    value={config.vRef}
                    min={1}
                    max={2000}
                    step={1}
                    unit=" m/s"
                    onChange={(v) => update({ vRef: v })}
                  />
                ) : (
                  <>
                    <Slider
                      label="Distancia más cercana"
                      value={config.distMin}
                      min={1}
                      max={MAX_ORBIT_DIAMETER / 2}
                      step={1}
                      unit=" m"
                      onChange={(v) => update({ distMin: v })}
                    />
                    <Slider
                      label="Distancia más lejana"
                      value={config.distMax}
                      min={2}
                      max={MAX_ORBIT_DIAMETER}
                      step={1}
                      unit=" m"
                      onChange={(v) => update({ distMax: v })}
                    />
                  </>
                ))}
              {config.autoRange && (
                <p className="foot">
                  El degradado se reescala solo al pico de velocidad o de distancia que se
                  viene observando, así sigue siendo legible con cualquier tamaño de órbita.
                </p>
              )}
            </section>

            <section>
              <h3>Escenario y observador</h3>
              <Slider
                label="Campo de visión"
                value={config.fov}
                min={20}
                max={140}
                step={1}
                unit="°"
                onChange={(v) => update({ fov: v })}
              />
              <Slider
                label="Velocidad al caminar"
                value={config.moveSpeed}
                min={1}
                max={14}
                step={0.5}
                unit=" m/s"
                onChange={(v) => update({ moveSpeed: v })}
              />
              <Slider
                label="Sensibilidad del mouse"
                value={config.sensitivity * 1000}
                min={0.5}
                max={8}
                step={0.1}
                onChange={(v) => update({ sensitivity: v / 1000 })}
              />
              <Slider
                label="Cantidad de estrellas"
                value={config.starCount}
                min={0}
                max={40000}
                step={250}
                onChange={(v) => update({ starCount: v })}
              />
              <Slider
                label="Tamaño de las estrellas"
                value={config.starSize}
                min={0.2}
                max={4}
                step={0.05}
                unit="×"
                onChange={(v) => update({ starSize: v })}
              />
              <Toggle
                label="Mostrar trayectorias"
                value={config.showOrbits}
                onChange={(v) => update({ showOrbits: v })}
              />
              <Toggle
                label="Grilla de 1 m"
                value={config.showGrid}
                onChange={(v) => update({ showGrid: v })}
              />
              <Toggle
                label="Órbitas en pausa"
                value={config.paused}
                disabled={analysis}
                note={analysis ? 'lo maneja el modo análisis' : null}
                onChange={(v) => update({ paused: v })}
              />
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
