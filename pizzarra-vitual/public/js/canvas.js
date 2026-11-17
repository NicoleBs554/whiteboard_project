const canvas = document.getElementById("pizarra");
const ctx = canvas.getContext("2d");

let dibujando = false;
let trazoActual = null;

function getMouseXY(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height,
  };
}

function configurar(color, grosor) {
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export function pintarTrazo(t) {
  if (!t || !Array.isArray(t.x) || !Array.isArray(t.y) || t.x.length === 0
      || t.x.length !== t.y.length
      || !t.x.every((x) => Number.isFinite(x) && x >= 0 && x <= 1)
      || !t.y.every((y) => Number.isFinite(y) && y >= 0 && y <= 1)
      || typeof t.color !== "string" || !/^#[\da-fA-F]{6}$/.test(t.color)
      || typeof t.grosor !== "number" || !Number.isFinite(t.grosor)
      || t.grosor < 1 || t.grosor > 20) return;
  configurar(t.color, t.grosor);
  ctx.beginPath();
  ctx.moveTo(t.x[0] * canvas.width, t.y[0] * canvas.height);
  if (t.x.length === 1) {
    ctx.lineTo(t.x[0] * canvas.width, t.y[0] * canvas.height);
  }
  for (let i = 1; i < t.x.length; i++) {
    ctx.lineTo(t.x[i] * canvas.width, t.y[i] * canvas.height);
  }
  ctx.stroke();
}

export function pintarHistorial(lista) {
  if (!Array.isArray(lista)) return;
  lista.forEach(pintarTrazo);
}

export function limpiarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function pintarUltimoTramo(t) {
  const n = t.x.length;
  if (n < 2) return pintarTrazo(t);
  configurar(t.color, t.grosor);
  ctx.beginPath();
  ctx.moveTo(t.x[n - 2] * canvas.width, t.y[n - 2] * canvas.height);
  ctx.lineTo(t.x[n - 1] * canvas.width, t.y[n - 1] * canvas.height);
  ctx.stroke();
}

function empezar(punto, getColor, getGrosor, puedeDibujar) {
  if (!puedeDibujar()) return;
  dibujando = true;
  trazoActual = { x: [punto.x], y: [punto.y], color: getColor(), grosor: getGrosor() };
  pintarTrazo(trazoActual);
}

function mover(punto) {
  if (!dibujando) return;
  trazoActual.x.push(punto.x);
  trazoActual.y.push(punto.y);
  pintarUltimoTramo(trazoActual);
}

function terminar(alTerminarTrazo) {
  if (!dibujando) return;
  dibujando = false;
  const trazo = trazoActual;
  trazoActual = null;
  alTerminarTrazo(trazo);
}

export function iniciarCanvas(alTerminarTrazo, getColor, getGrosor, puedeDibujar = () => true) {
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // solo botón izquierdo
    empezar(getMouseXY(e), getColor, getGrosor, puedeDibujar);
  });
  canvas.addEventListener("mousemove", (e) => mover(getMouseXY(e)));
  window.addEventListener("mouseup", () => terminar(alTerminarTrazo));

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) empezar(getMouseXY(e.touches[0]), getColor, getGrosor, puedeDibujar);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) mover(getMouseXY(e.touches[0]));
  }, { passive: false });
  window.addEventListener("touchend", () => terminar(alTerminarTrazo));
  window.addEventListener("touchcancel", () => terminar(alTerminarTrazo));
}
