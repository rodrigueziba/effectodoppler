# Simulación del Efecto Doppler — corrimiento al rojo y al azul

Simulación interactiva en primera persona. El observador camina por una plataforma de
10 × 10 m de superficie lunar que flota en el vacío, rodeada de estrellas en todas las
direcciones, mientras varias esferas sonoras recorren órbitas elípticas de hasta 8 km de
diámetro en planos orientados al azar en el espacio. El tono que se escucha y el color de
cada esfera dependen de su velocidad radial respecto de la cámara.

Stack: **Next.js 15 (App Router) + Three.js + Web Audio API**. Sin dependencias extra.

---

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:3000
```

## Cómo subirlo a Vercel

**Opción A — desde el repositorio**

```bash
git init && git add . && git commit -m "Simulación efecto Doppler"
git remote add origin <tu-repo>
git push -u origin main
```

Después, en vercel.com: *Add New → Project → Import*. Vercel detecta Next.js solo; no hay
variables de entorno ni configuración adicional.

**Opción B — desde la terminal**

```bash
npm i -g vercel
vercel        # preview
vercel --prod # producción
```

## Controles

| Tecla | Acción |
| --- | --- |
| `W` `A` `S` `D` | caminar por la plataforma |
| Mouse | mirar alrededor (requiere hacer clic para capturar el cursor) |
| `Shift` | abrir y cerrar la consola de controles |
| `Espacio` | entrar y salir del modo análisis |
| `Esc` | soltar el cursor |

## Modo análisis

Con `Espacio` se detienen todas las órbitas. Mientras el modo está activo, apuntar a una
esfera abre un segundo recuadro, en verde sobre negro, con el modelo matemático de esa
esfera: la ecuación con la que se calcula su distancia al observador en cada frame, la
tabla de variables con su significado y su valor actual, y la curva d(t) sobre un período
completo con su derivada y la tangente en el instante congelado, que es exactamente la
pendiente que entra en la fórmula del Doppler.

El recuadro de análisis se ancla a la izquierda y su borde derecho termina 20 px antes de
la ficha de la esfera, así que no pueden solaparse; en pantallas angostas pasa a la mitad
superior, por encima de la mira. Al salir del modo, desaparece y las órbitas retoman el
estado de pausa que tenían antes.

La pendiente graficada se calcula por diferencia centrada sobre la curva analítica, y
coincide con la diferencia finita hacia atrás que usa el loop en tiempo real dentro de
0,16 m/s sobre un rango de ±116 m/s, o sea 0,14 % del fondo de escala.

Al apuntar la mira hacia una esfera aparece su ficha: distancia al observador, velocidad
radial, frecuencia percibida, frecuencia en reposo, muestra de color con su código
hexadecimal, y una barra espectral que marca dónde cae esa esfera entre los dos extremos
del degradado.

## Qué se puede editar en la consola

- **Órbitas**: diámetro orbital (12 m a 8 km), cantidad de esferas (1–16) y multiplicador
  de velocidad (0 a 100×).
- **Esferas**: radio, radios aleatorios, intensidad del halo, si iluminan la superficie, y
  un botón para sortear órbitas nuevas. Al mover el diámetro orbital el radio acompaña en
  proporción, para que el tamaño aparente desde la cámara no cambie.
- **Sonido**: tono puro, acorde arpegiado (con tipo de acorde y notas por segundo) o un
  archivo de audio cargado desde la máquina; forma de onda, rango de frecuencias base y
  volumen.
- **Modelo Doppler**: velocidad de la onda simulada, exageración del efecto y suavizado de
  la derivada.
- **Color**: mapeo desde velocidad radial o desde distancia, color de inicio y de fin del
  degradado, color intermedio opcional, y el umbral que satura el degradado. Con el rango
  automático activado el degradado se reescala solo al pico observado, así sigue siendo
  legible con cualquier tamaño de órbita.
- **Escenario y observador**: campo de visión, velocidad al caminar, sensibilidad del
  mouse, cantidad y tamaño de las estrellas, trayectorias visibles, grilla de 1 m y pausa
  de las órbitas.

---

## El modelo

En cada frame, para cada esfera:

1. **Posición.** La esfera recorre una elipse paramétrica `(a·cos θ, 0, b·sin θ)` dentro de
   un pivote centrado en el observador y con orientación sorteada uniformemente en SO(3):
   la órbita puede caer en cualquier plano del espacio, pasando por arriba, por abajo y por
   cualquier eje. El semieje mayor es el radio orbital elegido (por defecto el máximo:
   4 km, o sea 8 km de diámetro) y el menor es una fracción aleatoria de entre 0,25 y 0,7
   de ese valor. La excentricidad está garantizada a propósito: si la órbita fuese circular
   alrededor del observador la distancia sería constante y no habría efecto Doppler.
   Fase, sentido de giro y velocidad lineal (60 a 300 m/s) se sortean al iniciar y son
   distintos para cada esfera; la velocidad angular se deriva de la lineal, así que el
   efecto se mantiene al cambiar la escala de la órbita.

2. **Velocidad radial.** Se toma la derivada numérica de la distancia entre la esfera y la
   cámara: `v_r = (d − d_anterior) / Δt`. Positiva significa que se aleja. Se suaviza con un
   filtro exponencial para que el ruido del frame no haga temblar el tono.

3. **Frecuencia percibida.** Se aplica la forma clásica del efecto Doppler para una fuente
   en movimiento y un observador en reposo relativo:

   ```
   f_obs = f_fuente · c / (c + v_r)
   ```

   donde `c` es la velocidad de propagación de la onda. A la escala por defecto no hace
   falta exagerar nada: con órbitas de kilómetros las esferas se mueven a más de 100 m/s,
   así que con la velocidad real del sonido en aire (343 m/s) un tono de 440 Hz se percibe
   entre 326 y 677 Hz. Si se achican mucho las órbitas, el factor de exageración compensa.

   Cuando la velocidad radial de acercamiento supera a `c`, el denominador cruza cero: es
   la barrera de Mach 1. El modelo acota el denominador para saturar en el agudo máximo en
   lugar de invertir el signo del tono, y la ficha del objeto avisa que esa esfera está en
   régimen supersónico.

4. **Traducción a audio.** Con tono puro o arpegio se escribe la frecuencia directamente en
   el `OscillatorNode`; con un archivo cargado se modifica el `playbackRate` del
   `AudioBufferSourceNode`, que es el análogo digital de comprimir o estirar la onda. Cada
   esfera pasa además por un `PannerNode` con modelo HRTF, así que la espacialización y la
   atenuación por distancia son reales, y el conjunto pasa por un compresor suave.

5. **Traducción a color.** La misma velocidad radial se normaliza contra un umbral editable
   y se interpola entre el color de alejamiento (rojo) y el de acercamiento (azul), con un
   punto neutro intermedio. El material y el halo de la esfera adoptan ese color con un
   `lerp` por frame para que la transición sea continua. También existe el modo alternativo
   que mapea el degradado contra la distancia en lugar de la velocidad.

## Cómo presentarlo

- **Sistema estudiado**: el comportamiento de las ondas —sonoras y lumínicas— emitidas por
  cuerpos en movimiento relativo respecto de un punto de observación.
- **Modelo**: matemático-computacional. Se extrae la derivada de la posición respecto del
  tiempo (velocidad radial) y con ella se alteran dos variables del sistema: la frecuencia
  del oscilador o el `playbackRate` del buffer, que modelan la compresión de la onda
  acústica; y el color del material, que modela el desplazamiento electromagnético.
- **Simulación**: la ejecución dinámica de la escena, donde al caminar o al esperar el paso
  de cada esfera se percibe el efecto en tiempo real, sin necesidad de construir un entorno
  físico a escala.

El corrimiento al rojo cosmológico real tiene un origen distinto —la expansión del espacio,
no el movimiento a través de él— pero para velocidades no relativistas la fórmula usada
acá es la aproximación estándar y es la que corresponde al caso acústico exacto.

## Notas de implementación

- **Cielo.** El campo estelar vive en una escena aparte con su propia cámara fija en el
  origen, que solo copia la orientación de la cámara del jugador. Así queda siempre en el
  infinito y envuelve la escena en todas las direcciones por más grandes que sean las
  órbitas. Los puntos se dibujan con un shader propio: cada estrella lleva su tamaño en
  píxeles y su color ya multiplicado por la magnitud, con un 1 % de gigantes muy brillantes
  y una banda de mayor densidad que hace de vía láctea.
- **Superficie.** El regolito se genera por código en un canvas: maria basálticos, unos 420
  cráteres de radio variable con piso hundido y borde elevado, y grano fino encima. Ese
  canvas se usa a la vez como mapa de color, mapa de relieve y mapa de desplazamiento, así
  que los cráteres deforman la malla de verdad. Un sol rasante alarga las sombras y el
  ambiente es apenas la luz de las estrellas, como corresponde al vacío.
- **Profundidad.** Con órbitas de kilómetros y una plataforma de metros, el rango del
  z-buffer es enorme, así que el render usa buffer de profundidad logarítmico.

## Estructura

```
app/
  layout.js        tipografías y metadatos
  page.js          punto de entrada
  globals.css      HUD, consola y pantalla de inicio
components/
  DopplerSim.jsx   capa React: mira, ficha de lectura, consola de controles
lib/
  DopplerEngine.js escena, órbitas, modelo Doppler, audio espacial
```

Toda la simulación vive en `DopplerEngine`; React solo lee su estado y le pasa
configuración, así que el loop de render nunca dispara re-renders.
