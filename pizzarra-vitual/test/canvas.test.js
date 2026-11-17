import test from "node:test";
import assert from "node:assert/strict";

test("normaliza los puntos del mouse y pinta proporcionalmente al canvas", async () => {
  const eventosCanvas = new Map();
  const eventosVentana = new Map();
  const operaciones = [];
  const contexto = {
    beginPath() {},
    clearRect() {},
    lineTo(x, y) {
      operaciones.push(["lineTo", x, y]);
    },
    moveTo(x, y) {
      operaciones.push(["moveTo", x, y]);
    },
    stroke() {},
  };
  const canvas = {
    width: 1200,
    height: 600,
    getContext: () => contexto,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 600, height: 300 }),
    addEventListener(evento, listener) {
      eventosCanvas.set(evento, listener);
    },
  };

  globalThis.document = { getElementById: () => canvas };
  globalThis.window = {
    addEventListener(evento, listener) {
      eventosVentana.set(evento, listener);
    },
  };

  const { iniciarCanvas, pintarTrazo } = await import("../public/js/canvas.js");
  let trazoEnviado;
  let puedeDibujar = false;
  iniciarCanvas(
    (trazo) => {
      trazoEnviado = trazo;
    },
    () => "#0000ff",
    () => 4,
    () => puedeDibujar,
  );

  eventosCanvas.get("mousedown")({ button: 0, clientX: 70, clientY: 80 });
  assert.equal(trazoEnviado, undefined);

  puedeDibujar = true;
  eventosCanvas.get("mousedown")({ button: 0, clientX: 70, clientY: 80 });
  eventosCanvas.get("mousemove")({ clientX: 310, clientY: 170 });
  eventosVentana.get("mouseup")();

  assert.deepEqual(trazoEnviado, {
    x: [0.1, 0.5],
    y: [0.2, 0.5],
    color: "#0000ff",
    grosor: 4,
  });

  operaciones.length = 0;
  pintarTrazo({ x: [0.1], y: [0.2], color: "#0000ff", grosor: 4 });
  assert.deepEqual(operaciones, [["moveTo", 120, 120], ["lineTo", 120, 120]]);
});
