# Pizarra virtual

Pizarra colaborativa con salas en tiempo real. Los trazos se conservan en memoria mientras el servidor está activo; la persistencia en base de datos queda como extensión opcional.

## Requisitos

- Node.js 18 o posterior
- npm

## Iniciar

```sh
npm install
npm start
```

Abre <http://localhost:3000> en dos o más navegadores e ingresa el mismo ID de sala para compartir la pizarra. Para ejecutar las pruebas: `npm test`.

## Organización

- `public/`: interfaz, canvas y cliente Socket.io.
- `server.js`: servidor Express y configuración de Socket.io.
- `src/sockets/pizarraSocket.js`: eventos del namespace `/pizarra`.
- `src/services/salaService.js`: historial en memoria independiente por sala.
- `src/utils/`: validación del protocolo y logs.
- `src/db/`: reservado para una persistencia opcional.

## Protocolo

El cliente se conecta a `/pizarra`, se une con `unirseSala` y recibe su historial con `historial`. Al completar un trazo envía `dibujar`; el servidor valida y guarda el trazo, y lo reenvía a los demás miembros de esa sala. `limpiar` vacía el historial de la sala y sincroniza los canvas.

Las coordenadas `x` e `y` se expresan como proporciones entre `0` y `1`, según `CONTRATO.md`, para conservar la posición del dibujo en distintos tamaños de canvas. El color debe ser `#rrggbb` y el grosor un número entre `1` y `20`.

El cliente espera que Socket.IO sirva `/socket.io/socket.io.js` en la misma dirección de la aplicación y exponga el namespace `/pizarra` con los eventos de `CONTRATO.md`. `public/js/socket.js` solo adapta esos eventos a la interfaz; no define el servidor ni un protocolo alternativo. El estado de conexión se muestra en pantalla; el canvas solo permite dibujar después de recibir el historial de la sala, y las solicitudes de limpieza realizadas durante una interrupción se envían tras recuperar la conexión y unirse a la sala.
