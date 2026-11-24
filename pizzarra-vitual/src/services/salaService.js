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

export function agregarTrazo(idSala, trazo) {
  const trazos = salas.get(idSala) ?? [];
  trazos.push(clonarTrazo(trazo));
  salas.set(idSala, trazos);
}

export function limpiarSala(idSala) {
  salas.delete(idSala);
}
