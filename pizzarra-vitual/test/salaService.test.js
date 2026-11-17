import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarTrazo,
  obtenerHistorial,
  limpiarSala,
  cargarHistorial,
} from "../src/services/salaService.js";
import { configurarPool } from "../src/db/dbComponent.js";

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

test("cargarHistorial recupera trazos desde la base de datos si la sala no esta en memoria", async () => {
  const trazoBD = { x: [0.2, 0.4], y: [0.3, 0.5], color: "#112233", grosor: 5 };
  const mockPool = {
    async query(sql, params) {
      if (sql.startsWith("SELECT")) {
        return {
          rows: [
            { id: 1, sala: params[0], datos: JSON.stringify(trazoBD) },
          ],
        };
      }
      return { rows: [] };
    },
  };

  configurarPool(mockPool);

  const historial = await cargarHistorial("sala-persistida");
  assert.deepEqual(historial, [trazoBD]);

  // La segunda llamada debe responder desde memoria (cache)
  const historialCache = obtenerHistorial("sala-persistida");
  assert.deepEqual(historialCache, [trazoBD]);

  limpiarSala("sala-persistida");
  configurarPool(null);
});
