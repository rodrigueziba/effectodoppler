'use client';

/* Notación compacta para números que van de milímetros a kilómetros */
const num = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.001 || a >= 1e6)) return v.toExponential(2);
  return v.toFixed(a >= 1000 ? 1 : digits);
};

const signed = (v, digits = 2) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), digits)}`;

/* ------------------------------------------------------------------ *
 *  Gráfico: d(t) con su recta tangente, y debajo d'(t)
 * ------------------------------------------------------------------ */

function Plot({ data }) {
  const W = 372;
  const H1 = 122;
  const H2 = 104;
  const PAD = { l: 46, r: 10, t: 12, b: 16 };

  const { curve, period, dMin, dMax, vMin, vMax, dist, vrRaw } = data;
  if (!curve || curve.length < 2) return null;

  const T = period;
  const innerW = W - PAD.l - PAD.r;

  const x = (t) => PAD.l + ((t + T / 2) / T) * innerW;

  const padY = (lo, hi) => {
    const span = hi - lo || 1;
    return [lo - span * 0.08, hi + span * 0.08];
  };

  const [d0, d1] = padY(dMin, dMax);
  const [v0, v1] = padY(Math.min(vMin, 0), Math.max(vMax, 0));

  const yD = (d) => PAD.t + (1 - (d - d0) / (d1 - d0)) * (H1 - PAD.t - PAD.b);
  const yV = (v) => PAD.t + (1 - (v - v0) / (v1 - v0)) * (H2 - PAD.t - PAD.b);

  const pathD = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${yD(p.d).toFixed(1)}`).join(' ');
  const pathV = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${yV(p.v).toFixed(1)}`).join(' ');

  // Recta tangente en t = 0: la pendiente es exactamente la velocidad radial
  const slope = curve[Math.floor(curve.length / 2)].v;
  const win = T / 7;
  const tanX1 = x(-win);
  const tanX2 = x(win);
  const tanY1 = yD(dist - slope * win);
  const tanY2 = yD(dist + slope * win);

  const zeroY = yV(0);

  return (
    <div className="an-plot">
      <svg viewBox={`0 0 ${W} ${H1}`} role="img" aria-label="Distancia en función del tiempo">
        <rect x="0" y="0" width={W} height={H1} fill="#000" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H1 - PAD.b} className="an-axis" />
        <line x1={PAD.l} y1={H1 - PAD.b} x2={W - PAD.r} y2={H1 - PAD.b} className="an-axis" />
        <line x1={x(0)} y1={PAD.t} x2={x(0)} y2={H1 - PAD.b} className="an-guide" />
        <path d={pathD} className="an-curve" />
        <line x1={tanX1} y1={tanY1} x2={tanX2} y2={tanY2} className="an-tangent" />
        <circle cx={x(0)} cy={yD(dist)} r="3.4" className="an-dot" />
        <text x="4" y={PAD.t + 8} className="an-tick">
          {num(d1, 0)}
        </text>
        <text x="4" y={H1 - PAD.b} className="an-tick">
          {num(d0, 0)}
        </text>
        <text x={PAD.l} y={H1 - 4} className="an-tick">
          −T/2
        </text>
        <text x={x(0) - 8} y={H1 - 4} className="an-tick">
          t
        </text>
        <text x={W - PAD.r - 22} y={H1 - 4} className="an-tick">
          +T/2
        </text>
        <text x={PAD.l + 6} y={PAD.t + 9} className="an-caption">
          d(t) · distancia en metros
        </text>
      </svg>

      <svg viewBox={`0 0 ${W} ${H2}`} role="img" aria-label="Derivada de la distancia">
        <rect x="0" y="0" width={W} height={H2} fill="#000" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H2 - PAD.b} className="an-axis" />
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} className="an-axis" />
        <line x1={x(0)} y1={PAD.t} x2={x(0)} y2={H2 - PAD.b} className="an-guide" />
        <path d={pathV} className="an-curve" />
        <circle cx={x(0)} cy={yV(slope)} r="3.4" className="an-dot" />
        <text x="4" y={PAD.t + 8} className="an-tick">
          {num(v1, 0)}
        </text>
        <text x="4" y={zeroY + 3} className="an-tick">
          0
        </text>
        <text x="4" y={H2 - PAD.b} className="an-tick">
          {num(v0, 0)}
        </text>
        <text x={PAD.l + 6} y={PAD.t + 9} className="an-caption">
          d′(t) · velocidad radial en m/s
        </text>
      </svg>

      <p className="an-legend">
        La pendiente de la tangente marcada en d(t) es el punto marcado en d′(t): {signed(slope, 2)} m/s.
        Positiva significa que se aleja.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Panel
 * ------------------------------------------------------------------ */

export default function AnalysisPanel({ data }) {
  if (!data) return null;

  const { observer: o, source: p } = data;
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const dz = p.z - o.z;

  const deltaD = data.dist - data.dPrev;

  return (
    <aside className="analysis" aria-label="Modelo matemático del objeto apuntado">
      <header className="an-head">
        <span>Modelo · {data.label}</span>
        <span className="an-flag">órbitas detenidas</span>
      </header>

      <div className="an-scroll">
        <section>
          <h3>1 · Posición de la fuente en el frame</h3>
          <div className="an-eq">θ(t) = φ + ω · t</div>
          <div className="an-eq">p(t) = C + R · ( a·cos θ , 0 , b·sen θ )</div>
        </section>

        <section>
          <h3>2 · Distancia al observador</h3>
          <div className="an-eq">
            d(t) = ‖ p(t) − o ‖ = √( (pₓ−oₓ)² + (p_y−o_y)² + (p_z−o_z)² )
          </div>
          <div className="an-sub">
            d = √( ({num(p.x)} − {num(o.x)})² + ({num(p.y)} − {num(o.y)})² + ({num(p.z)} −{' '}
            {num(o.z)})² )
          </div>
          <div className="an-sub">
            d = √( {num(dx * dx, 0)} + {num(dy * dy, 0)} + {num(dz * dz, 0)} ) ={' '}
            <b>{num(data.dist)} m</b>
          </div>
        </section>

        <section>
          <h3>3 · Velocidad radial: derivada numérica</h3>
          <div className="an-eq">v_r = dd/dt ≈ ( dₙ − dₙ₋₁ ) / Δt</div>
          <div className="an-sub">
            v_r = ( {num(data.dist)} − {num(data.dPrev)} ) / {num(data.dtFrame, 4)} ={' '}
            <b>{signed(data.vrRaw)} m/s</b>
          </div>
          <div className="an-eq">v̄ ← v̄ + α · ( v_r − v̄ )</div>
          <div className="an-sub">
            Con α = {num(data.alpha, 2)}, el valor filtrado en uso es <b>{signed(data.vr)} m/s</b>.
            El filtro saca el ruido de medir sobre un solo frame.
          </div>
        </section>

        <section>
          <h3>4 · Del modelo a lo que se percibe</h3>
          <div className="an-eq">f_obs = f₀ · c / ( c + v̄ )</div>
          {data.soundType === 'file' ? (
            <div className="an-sub">
              Con archivo cargado el factor c/(c+v̄) = <b>{num(data.doppler, 3)}</b> se aplica al
              playbackRate del buffer, que es el equivalente digital de comprimir la onda.
            </div>
          ) : (
            <div className="an-sub">
              f_obs = {num(data.baseFreq, 1)} · {num(data.waveSpeed, 0)} / ({num(data.waveSpeed, 0)}{' '}
              {signed(data.vr * data.exaggeration, 1)} ) = <b>{num(data.freq, 1)} Hz</b>
            </div>
          )}
          <div className="an-sub">
            El mismo v̄ normalizado alimenta la interpolación de color entre los dos extremos
            del degradado.
          </div>
        </section>

        <section>
          <h3>5 · d(t) sobre una vuelta completa</h3>
          <Plot data={data} />
        </section>

        <section>
          <h3>Variables</h3>
          <dl className="an-vars">
            <div>
              <dt>o</dt>
              <dd>
                posición del observador
                <span>
                  ({num(o.x, 1)}, {num(o.y, 1)}, {num(o.z, 1)}) m
                </span>
              </dd>
            </div>
            <div>
              <dt>C</dt>
              <dd>
                centro de la órbita, fijo en el observador
                <span>
                  ({num(data.center.x, 1)}, {num(data.center.y, 1)}, {num(data.center.z, 1)}) m
                </span>
              </dd>
            </div>
            <div>
              <dt>R</dt>
              <dd>
                rotación del plano orbital
                <span>cuaternión sorteado en SO(3)</span>
              </dd>
            </div>
            <div>
              <dt>a</dt>
              <dd>
                semieje mayor
                <span>{num(data.a, 1)} m</span>
              </dd>
            </div>
            <div>
              <dt>b</dt>
              <dd>
                semieje menor
                <span>{num(data.b, 1)} m</span>
              </dd>
            </div>
            <div>
              <dt>φ</dt>
              <dd>
                fase inicial
                <span>{num(data.phase, 3)} rad</span>
              </dd>
            </div>
            <div>
              <dt>ω</dt>
              <dd>
                velocidad angular
                <span>{num(data.omega, 4)} rad/s</span>
              </dd>
            </div>
            <div>
              <dt>θ</dt>
              <dd>
                ángulo actual sobre la elipse
                <span>{num(data.theta % (2 * Math.PI), 3)} rad</span>
              </dd>
            </div>
            <div>
              <dt>T</dt>
              <dd>
                período orbital
                <span>{num(data.period, 1)} s</span>
              </dd>
            </div>
            <div>
              <dt>Δt</dt>
              <dd>
                tiempo entre frames
                <span>{num(data.dtFrame, 4)} s</span>
              </dd>
            </div>
            <div>
              <dt>Δd</dt>
              <dd>
                cambio de distancia en ese frame
                <span>{signed(deltaD, 3)} m</span>
              </dd>
            </div>
            <div>
              <dt>α</dt>
              <dd>
                factor de suavizado del filtro
                <span>{num(data.alpha, 2)}</span>
              </dd>
            </div>
            <div>
              <dt>c</dt>
              <dd>
                velocidad de propagación de la onda
                <span>{num(data.waveSpeed, 0)} m/s</span>
              </dd>
            </div>
            <div>
              <dt>f₀</dt>
              <dd>
                frecuencia de la fuente en reposo
                <span>{num(data.baseFreq, 1)} Hz</span>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  );
}
