const COLOR_HEXADECIMAL = /^#[\da-fA-F]{6}$/;

export function validarSala(id) {
  return typeof id === "string"
    && id.trim().length > 0
    && id.length <= 30
    && !/[\u0000-\u001f\u007f]/.test(id);
}

export function validarTrazo(trazo) {
  if (!trazo || typeof trazo !== "object"
      || !Array.isArray(trazo.x) || !Array.isArray(trazo.y)
      || trazo.x.length === 0 || trazo.x.length !== trazo.y.length
      || typeof trazo.color !== "string" || !COLOR_HEXADECIMAL.test(trazo.color)
      || typeof trazo.grosor !== "number" || !Number.isFinite(trazo.grosor)
      || trazo.grosor < 1 || trazo.grosor > 20) {
    return false;
  }

  return trazo.x.every((x) => Number.isFinite(x) && x >= 0 && x <= 1)
    && trazo.y.every((y) => Number.isFinite(y) && y >= 0 && y <= 1);
}
