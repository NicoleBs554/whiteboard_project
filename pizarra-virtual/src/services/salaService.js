import { db } from "../db/dbComponent.js";
import { log } from "../utils/logger.js";

const salas = new Map();

function clonarTrazo(trazo) {
  return {
    ...trazo,
    x: [...trazo.x],
    y: [...trazo.y],
  };
}

export function obtenerHistorial(idSala) {
  return (salas.get(idSala) ?? []).map(clonarTrazo);
}

export async function cargarHistorial(idSala) {
  if (salas.has(idSala)) {
    return obtenerHistorial(idSala);
  }

  if (db.estaHabilitada()) {
    try {
      const resultado = await db.exeQuery("cargarTrazos", [idSala]);
      const trazosRecuperados = resultado.rows.map((fila) => {
        const datos = typeof fila.datos === "string" ? JSON.parse(fila.datos) : fila.datos;
        return clonarTrazo(datos);
      });
      salas.set(idSala, trazosRecuperados);
      return obtenerHistorial(idSala);
    } catch (error) {
      log.error(`Error al cargar trazos de la BD para la sala "${idSala}":`, error.message);
    }
  }

  return obtenerHistorial(idSala);
}

export function agregarTrazo(idSala, trazo) {
  const trazoClonado = clonarTrazo(trazo);
  const trazos = salas.get(idSala) ?? [];
  trazos.push(trazoClonado);
  salas.set(idSala, trazos);

  if (db.estaHabilitada()) {
    db.exeQuery("guardarTrazo", [idSala, JSON.stringify(trazoClonado)]).catch((error) => {
      log.error(`Error al persistir trazo en la BD para la sala "${idSala}":`, error.message);
    });
  }
}

export function limpiarSala(idSala) {
  salas.delete(idSala);

  if (db.estaHabilitada()) {
    db.exeQuery("borrarTrazos", [idSala]).catch((error) => {
      log.error(`Error al borrar trazos de la BD para la sala "${idSala}":`, error.message);
    });
  }
}
