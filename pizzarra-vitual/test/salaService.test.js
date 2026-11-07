import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarTrazo,
  obtenerHistorial,
  limpiarSala,
} from "../src/services/salaService.js";

test("mantiene y limpia historiales de forma independiente por sala", () => {
  const trazo = { x: [0.1], y: [0.2], color: "#0000ff", grosor: 4 };
  agregarTrazo("test-sala-a", trazo);
  agregarTrazo("test-sala-b", trazo);

  const historial = obtenerHistorial("test-sala-a");
  assert.deepEqual(historial, [trazo]);
  historial[0].x[0] = 0.9;
  assert.deepEqual(obtenerHistorial("test-sala-a"), [trazo]);

  limpiarSala("test-sala-a");
  assert.deepEqual(obtenerHistorial("test-sala-a"), []);
  assert.deepEqual(obtenerHistorial("test-sala-b"), [trazo]);
  limpiarSala("test-sala-b");
});
