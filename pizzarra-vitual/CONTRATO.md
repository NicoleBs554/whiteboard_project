# CONTRATO.md - Pizarra Virtual

Única fuente de verdad entre Frontend (A), Tiempo real (B) y Estado/BD (C).
**Si algo cambia: se propone en el grupo, se actualiza este archivo y luego se cambia el código.**

Versión: 1.0 | Última modificación: ____/____/____ | Aprobado por: A [ ]  B [ ]  C [ ]

---

## 1. Conexión

| Dato | Valor |
|---|---|
| Servidor | `http://localhost:3000` |
| Namespace | `/pizarra` |
| Cliente | `const socket = io("/pizarra");` |
| ID de sala | Texto de 1 a 30 caracteres (ej. `"sala1"`) |

---

## 2. Formato del trazo

Un trazo = desde que se pulsa el botón izquierdo hasta que se suelta.

```json
{
  "x": [0.10, 0.12, 0.15, 0.20],
  "y": [0.30, 0.33, 0.37, 0.40],
  "color": "#ff0000",
  "grosor": 3
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `x` | array de números | Valores entre **0 y 1** (proporción del ancho del canvas) |
| `y` | array de números | Valores entre **0 y 1** (proporción del alto del canvas). Mismo largo que `x` |
| `color` | string | Formato hexadecimal `#rrggbb` |
| `grosor` | número | Entre 1 y 20 |

**Coordenadas normalizadas:** A convierte al enviar (`x / canvas.width`) y al pintar (`x * canvas.width`). Así el dibujo se ve igual en pantallas de distinto tamaño.

**Cuándo se envía:** al soltar el botón (`mouseup` / `touchend`).
> Mejora futura (opcional): enviar en lotes cada ~50 ms para verlo en vivo. Si se hace, se actualiza este contrato.

---

## 3. Eventos de Socket.io

| Evento | Dirección | Datos | Qué hace |
|---|---|---|---|
| `unirseSala` | Cliente -> Servidor | `idSala` (string) | El socket entra a la room |
| `historial` | Servidor -> Cliente | `[trazo, trazo, ...]` | Se envía solo al que entra, con lo ya dibujado |
| `dibujar` | Cliente -> Servidor | `trazo` | El servidor valida, guarda y reenvía |
| `dibujar` | Servidor -> Clientes de la sala | `trazo` | Los demás pintan el trazo (no se reenvía al emisor) |
| `limpiar` | Cliente -> Servidor | (sin datos) | Pide borrar la pizarra de la sala |
| `limpiar` | Servidor -> Todos en la sala | (sin datos) | Todos borran su canvas |
| `usuarios` | Servidor -> Clientes de la sala | `numero` | Cantidad de conectados (opcional) |

### Orden de eventos al entrar

1. Cliente: `socket.emit("unirseSala", "sala1")`
2. Servidor: `socket.join("sala1")`
3. Servidor: `socket.emit("historial", [...])`
4. Cliente: pinta todo el historial

---

## 4. Reglas del servidor

- Si el trazo es inválido (campos faltantes, `x` e `y` de distinto largo, valores fuera de rango): **se ignora** y se registra un `warning` en los logs. No se responde error al cliente.
- Si el socket no ha enviado `unirseSala`, se ignoran sus `dibujar` y `limpiar`.
- Los trazos se guardan **en memoria** por sala: `{ "sala1": [trazo, ...] }`. La base de datos es opcional.

---

## 5. Datos de prueba (para probar sin esperar al resto)

```json
{ "x": [0.1, 0.5, 0.9], "y": [0.1, 0.5, 0.1], "color": "#0000ff", "grosor": 4 }
```

- **A:** llamar `pintarTrazo(...)` con este ejemplo (convertido a píxeles). Debe verse una "V" invertida azul.
- **B:** emitir este trazo desde el servidor al unirse una sala y comprobar que llega al cliente.
- **C:** pasarlo por `validarTrazo()` (debe dar `true`) y probar una versión inválida (debe dar `false`).

---

## 6. Registro de cambios

| Fecha | Cambio | Propuesto por | Aprobado |
|---|---|---|---|
| ____/____/____ | Versión inicial | | |
