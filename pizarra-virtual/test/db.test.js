import test from "node:test";
import assert from "node:assert/strict";
import { db, configurarPool } from "../src/db/dbComponent.js";

test("dbComponent maneja sentencias y parametros correctamente con el pool", async () => {
  const consultasEjecutadas = [];
  const mockPool = {
    async query(sql, params) {
      consultasEjecutadas.push({ sql, params });
      if (sql.startsWith("SELECT")) {
        return {
          rows: [
            { id: 1, sala: "sala1", datos: { x: [0.1], y: [0.2], color: "#ff0000", grosor: 2 } },
          ],
        };
      }
      return { rows: [] };
    },
  };

  configurarPool(mockPool);
  assert.equal(db.estaHabilitada(), true);

  const trazo = { x: [0.1], y: [0.2], color: "#ff0000", grosor: 2 };
  await db.exeQuery("guardarTrazo", ["sala1", JSON.stringify(trazo)]);

  const resultado = await db.exeQuery("cargarTrazos", ["sala1"]);
  assert.equal(resultado.rows.length, 1);
  assert.deepEqual(resultado.rows[0].datos, trazo);

  await db.exeQuery("borrarTrazos", ["sala1"]);

  assert.equal(consultasEjecutadas.length, 3);
  assert.ok(consultasEjecutadas[0].sql.includes("INSERT INTO trazo"));
  assert.deepEqual(consultasEjecutadas[0].params, ["sala1", JSON.stringify(trazo)]);
  assert.ok(consultasEjecutadas[1].sql.includes("SELECT datos FROM trazo"));
  assert.ok(consultasEjecutadas[2].sql.includes("DELETE FROM trazo"));

  configurarPool(null);
});

test("db.exeQuery lanza error si la sentencia no existe", async () => {
  const mockPool = { async query() {} };
  configurarPool(mockPool);

  await assert.rejects(
    () => db.exeQuery("consultaInexistente", []),
    /Consulta SQL desconocida/
  );

  configurarPool(null);
});

test("db.exeQuery lanza error si no hay conexion configurada", async () => {
  delete process.env.DATABASE_URL;
  configurarPool(null);

  await assert.rejects(
    () => db.exeQuery("cargarTrazos", ["sala1"]),
    /Base de datos no configurada/
  );
});
