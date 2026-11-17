# Pizarra virtual

Pizarra colaborativa con salas en tiempo real. Los trazos se conservan en memoria mientras el servidor está activo; la persistencia en base de datos queda como extensión opcional.

## Requisitos

- Node.js 18 o posterior
- npm

## Iniciar

```sh
cd pizzarra-vitual
npm install
npm start
```

Abre <http://localhost:3000> en hasta tres navegadores e ingresa el mismo ID de sala para compartir la pizarra. Para ejecutar las pruebas: `npm test`.

## Organización

El proyecto se ejecuta desde `pizzarra-vitual/`, con una separación pequeña por responsabilidad:

- `pizzarra-vitual/public/`: interfaz, canvas y clientes Socket.io/WebRTC.
- `pizzarra-vitual/server.js`: servidor Express, Socket.io y configuración ICE.
- `pizzarra-vitual/src/sockets/`: eventos de pizarra y señalización WebRTC.
- `pizzarra-vitual/src/services/`: historial en memoria por sala.
- `pizzarra-vitual/src/utils/`: validación del protocolo y logs.
- `pizzarra-vitual/turnserver.conf.example`: plantilla de Coturn, que se despliega fuera de Node.js.

## Protocolo

El cliente se conecta a `/pizarra`, se une con `unirseSala` y recibe su historial con `historial`. Al completar un trazo envía `dibujar`; el servidor valida y guarda el trazo, y lo reenvía a los demás miembros de esa sala. `limpiar` vacía el historial de la sala y sincroniza los canvas.

Las coordenadas `x` e `y` se expresan como proporciones entre `0` y `1`, según `CONTRATO.md`, para conservar la posición del dibujo en distintos tamaños de canvas. El color debe ser `#rrggbb` y el grosor un número entre `1` y `20`.

El cliente espera que Socket.IO sirva `/socket.io/socket.io.js` en la misma dirección de la aplicación y exponga el namespace `/pizarra` con los eventos de `CONTRATO.md`. `public/js/socket.js` solo adapta esos eventos a la interfaz; no define el servidor ni un protocolo alternativo. El estado de conexión se muestra en pantalla; el canvas solo permite dibujar después de recibir el historial de la sala, y las solicitudes de limpieza realizadas durante una interrupción se envían tras recuperar la conexión y unirse a la sala.

## Videollamada

La videollamada usa la librería PeerJS para establecer conexiones peer-to-peer en malla y admite hasta tres participantes por sala (dos conexiones P2P por navegador). Al entrar, cada persona puede activar cámara y micrófono. El servidor Express monta el servicio de señalización en `/peerjs`, mientras que el audio y el video se transmiten directamente entre los navegadores. Cada cliente solo negocia con participantes de su misma sala.

```powershell
$env:RTC_ICE_SERVERS='[{"urls":"stun:TU_SERVIDOR:3478"},{"urls":"turn:TU_SERVIDOR:3478?transport=udp","username":"USUARIO","credential":"CONTRASENA"}]'
npm start
```

Coturn es un servicio separado, no una dependencia npm. `pizzarra-vitual/turnserver.conf.example` contiene una plantilla inicial: reemplaza todos los valores de ejemplo y configura los puertos de escucha/relay y el firewall del VPS. No uses credenciales de ejemplo en producción. La cámara requiere HTTPS fuera de `localhost`; TURN es necesario cuando las conexiones directas no pueden atravesar NAT o firewalls.
