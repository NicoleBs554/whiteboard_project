function registrar(nivel, metodo) {
  return (mensaje, ...args) => {
    const encabezado = `[${nivel}] ${new Date().toISOString()} ${mensaje}`;
    if (args.length > 0) {
      console[metodo](encabezado, ...args);
    } else {
      console[metodo](encabezado);
    }
  };
}

export const log = {
  debug: registrar("DEBUG", "debug"),
  info: registrar("INFO", "info"),
  warning: registrar("WARNING", "warn"),
  error: registrar("ERROR", "error"),
};
