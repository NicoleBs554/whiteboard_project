import pg from "pg";
import { readFileSync } from "node:fs";

const sentences = JSON.parse(
  readFileSync(new URL("./sentences.json", import.meta.url), "utf-8")
);

let pool = null;

export function obtenerPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export function configurarPool(nuevoPool) {
  pool = nuevoPool;
}

export const db = {
  async exeQuery(idQuery, params = []) {
    const p = obtenerPool();
    if (!p) {
      throw new Error("Base de datos no configurada (DATABASE_URL no definida).");
    }
    const sql = sentences[idQuery];
    if (!sql) {
      throw new Error(`Consulta SQL desconocida: "${idQuery}".`);
    }
    return p.query(sql, params);
  },
  estaHabilitada() {
    return Boolean(process.env.DATABASE_URL || pool);
  },
  async cerrar() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};
