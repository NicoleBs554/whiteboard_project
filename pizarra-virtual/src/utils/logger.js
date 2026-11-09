function registrar(nivel, metodo) {
  return (mensaje) => {
    console[metodo](`[${nivel}] ${new Date().toISOString()} ${mensaje}`);
  };
}

export const log = {
  debug: registrar("DEBUG", "debug"),
  info: registrar("INFO", "info"),
  warning: registrar("WARNING", "warn"),
  error: registrar("ERROR", "error"),
};
