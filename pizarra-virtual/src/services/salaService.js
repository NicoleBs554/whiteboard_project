const salas = new Map();

export function obtenerHistorial(idSala) {
  return (salas.get(idSala) ?? []).map((trazo) => ({
    ...trazo,
    x: [...trazo.x],
    y: [...trazo.y],
  }));
}

export function agregarTrazo(idSala, trazo) {
  const trazos = salas.get(idSala) ?? [];
  trazos.push({
    ...trazo,
    x: [...trazo.x],
    y: [...trazo.y],
  });
  salas.set(idSala, trazos);
}

export function limpiarSala(idSala) {
  salas.delete(idSala);
}
