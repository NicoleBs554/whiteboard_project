-- Tabla para persistencia de trazos en PostgreSQL
CREATE TABLE IF NOT EXISTS trazo (
  id SERIAL PRIMARY KEY,
  sala VARCHAR(30) NOT NULL,
  datos JSONB NOT NULL,
  creado TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trazo_sala ON trazo (sala);
