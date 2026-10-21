# wa-contactos-grupos

Herramienta para sacar a un Excel los contactos de una cuenta de WhatsApp: los miembros de todos
sus grupos, las personas que salieron de esos grupos y los contactos de la agenda.

Se conecta a WhatsApp escaneando un código QR, igual que WhatsApp Web, y corre entera en la
computadora: no sube datos a ningún servidor, no guarda mensajes y no envía nada. Al terminar
cierra la sesión sola, y el dispositivo desaparece de "Dispositivos vinculados" del teléfono.

> **Aviso.** Usa una conexión **no oficial** a WhatsApp (la librería
> [Baileys](https://github.com/WhiskeySockets/Baileys)). No está hecha ni avalada por WhatsApp o
> Meta, y va contra sus condiciones de uso. Antes de usarla lee [Riesgos y uso
> responsable](#riesgos-y-uso-responsable).

---

## Índice

1. [Qué se obtiene](#qué-se-obtiene)
2. [Requisitos](#requisitos)
3. [Instalación](#instalación)
4. [Cómo se usa](#cómo-se-usa)
5. [Opciones de la página](#opciones-de-la-página)
6. [Qué tan completos salen los datos](#qué-tan-completos-salen-los-datos)
7. [Privacidad y seguridad](#privacidad-y-seguridad)
8. [Riesgos y uso responsable](#riesgos-y-uso-responsable)
9. [Problemas frecuentes](#problemas-frecuentes)
10. [Cómo está hecho](#cómo-está-hecho)

---

## Qué se obtiene

Un archivo `contactos-grupos-AAAA-MM-DD-HHhMM.xlsx` en la misma carpeta del programa, con estas
hojas (solo las que se eligieron en la página):

| Hoja | Qué contiene | Columnas principales |
|---|---|---|
| **Por grupo** | Una fila por cada miembro de cada grupo | Grupo, Nombre, Teléfono, País, Admin, Usuario |
| **Grupos** | Una fila por grupo | Grupo, Tipo (grupo normal, comunidad, avisos de comunidad), Miembros, Con teléfono, Se fueron |
| **Únicos** | Cada teléfono una sola vez, con todos los grupos donde está | Nombre, Teléfono, País, En cuántos grupos, Grupos, WhatsApp |
| **Con username** | Miembros que usan nombre de usuario y no muestran el teléfono | Usuario, Nombre, En cuántos grupos, Grupos |
| **Se fueron** | Personas que salieron o fueron sacadas de un grupo y no volvieron a entrar | Grupo, Nombre, Teléfono, País, Qué pasó, Fecha, WhatsApp |
| **Mis contactos** | La agenda del teléfono y las personas con chat privado | Nombre, Teléfono, País, Agendado, Chat privado, Grupo en común, Grupos en común, WhatsApp |

Detalles del formato:

- **Orden:** por país, después por nombre, después por teléfono. Los que no tienen nombre van al
  final de su país, y los que no tienen teléfono, al final de todo.
- **Filtros:** cada título tiene la flechita de Excel para filtrar (por ejemplo, un solo país) o
  reordenar.
- **País:** sale del prefijo del teléfono. Estados Unidos y Canadá, que comparten el +1, se separan
  por código de área.
- **Columna WhatsApp:** un enlace `https://wa.me/<número>` que abre el chat con un clic.

Junto al Excel queda un `*-diagnostico.txt` con cantidades (nombres encontrados, chats, salidas).
No tiene datos de personas; sirve para entender un resultado raro.

---

## Requisitos

- **Node.js 24** (es la versión con la que se probó). Se descarga de <https://nodejs.org>.
- Un teléfono con la cuenta de WhatsApp que se quiere leer, a mano para escanear el QR.
- Windows para el doble clic en los `.bat`. En Mac o Linux funciona igual desde la terminal.

---

## Instalación

Una sola vez, en la carpeta del proyecto:

```
npm install
```

---

## Cómo se usa

1. **Abrir el programa.**
   - En Windows: doble clic en `extraer.bat`.
   - En cualquier sistema: `npm run extraer`.

   Se abre una ventana negra (no hay que cerrarla) y el navegador en `http://localhost:3210`. Si el
   navegador no se abre solo, entrar a esa dirección a mano.
2. **Elegir las opciones** en la página, antes de escanear (ver la tabla de abajo).
3. **Escanear el QR** desde el teléfono: WhatsApp → Dispositivos vinculados → Vincular un
   dispositivo. El código se renueva solo cada 20 segundos; siempre sirve el que está en pantalla.
4. **Esperar a que la página diga "Listo".** En modo normal tarda entre 1 y 3 minutos; con
   historial completo, hasta 20. La página va mostrando lo que lleva leído.
5. El Excel se abre solo. La sesión ya quedó cerrada y la ventana negra se puede cerrar.

Si nadie escanea en 15 minutos, el programa deja de pedir códigos y avisa en la página.

---

## Opciones de la página

| Casilla | Qué hace | ¿Se puede cambiar después de escanear? |
|---|---|---|
| Miembros de mis grupos | Hojas Por grupo, Grupos, Únicos y Con username | Sí, hasta que diga "Listo" |
| Los que se fueron de los grupos | Hoja Se fueron | Sí, hasta que diga "Listo" |
| Mis contactos | Hoja Mis contactos (agenda y chats privados) | Sí, hasta que diga "Listo" |
| Historial completo | Le pide a WhatsApp todo el historial en vez del reciente | **No.** Se elige antes de escanear; al cambiarla aparece un QR nuevo |

Con "Historial completo" se consiguen más teléfonos (sobre todo en canales de avisos de
comunidades), salidas de grupos más antiguas y los chats privados viejos. A cambio tarda mucho más
y baja más información a la computadora (que igual se descarta).

`extraer-con-mas-nombres.bat` abre el programa con "Historial completo" ya tildado.

---

## Qué tan completos salen los datos

Medido en corridas reales con cuatro cuentas distintas (octubre de 2026):

- **Teléfonos de miembros de grupos:** salen entre el 96% y el 100% en grupos normales. Los que
  faltan están casi todos en **canales de avisos de comunidades**, donde WhatsApp entrega a cada
  persona con un identificador anónimo (`lid`) en vez del número. El modo completo recupera parte.
- **Usernames:** quien activó un nombre de usuario en WhatsApp puede no mostrar el teléfono; esas
  personas van a la hoja "Con username".
- **Nombres de miembros de grupos:** WhatsApp **no** informa el nombre de un miembro que no está en
  la agenda del teléfono. Por eso en las hojas de grupos la mayoría de los nombres quedan vacíos
  (entre el 3% y el 25% traen nombre). No es un error del programa.
- **Mis contactos:** la agenda viene completa, con nombre en más del 90% de los casos, aunque nunca
  se haya hablado con la persona. La marca "Chat privado" en modo normal cubre solo los chats
  **recientes**: que esté vacía no quiere decir que nunca haya habido conversación.
- **Los que se fueron:** WhatsApp guarda los "participantes anteriores" por un tiempo limitado; las
  salidas más viejas solo aparecen si el aviso "salió del grupo" sigue en el historial que se
  sincroniza.

---

## Privacidad y seguridad

- Todo corre en la computadora. La página del QR solo escucha en `127.0.0.1` (no es accesible desde
  otra máquina).
- De los mensajes solo se usa quién los mandó y con qué nombre; el contenido no se guarda ni se lee.
- La carpeta `sesion/` existe solo mientras el programa está conectado y **da acceso a la cuenta de
  WhatsApp**. El programa la borra al terminar. Si se corta a la mitad (por ejemplo, se cierra la
  ventana negra), conviene borrarla a mano y cerrar la sesión desde el teléfono: WhatsApp →
  Dispositivos vinculados → tocar el dispositivo → Cerrar sesión.
- Los Excel tienen datos personales. Están en `.gitignore` junto con `sesion/` y los diagnósticos:
  **no se suben nunca al repositorio**.

---

## Riesgos y uso responsable

- **Cuenta de WhatsApp:** al ser una conexión no oficial, WhatsApp puede restringir o bloquear el
  número. Leer (que es lo único que hace esta herramienta) es de bajo riesgo, pero no es cero.
  Conviene no usarla con un número del que dependa el negocio sin aceptar ese riesgo.
- **Freno de vinculación:** vincular y desvincular muchas veces seguidas, o escanear códigos
  vencidos, hace que el teléfono responda *"no se pueden vincular dispositivos por ahora"*. Es una
  pausa temporal de WhatsApp (suele durar horas), no un bloqueo de la cuenta. Recomendación: **una
  corrida por cuenta por día** y escanear apenas aparece el QR.
- **Qué se hace con la lista:** escribirles en frío a miles de personas que no tienen el número
  agendado es lo que más bloqueos provoca, porque la gente lo reporta. Además, en muchos países
  (por ejemplo, el RGPD en Europa) usar datos personales para contactar a alguien exige una base
  legal. Esta herramienta no envía mensajes; cómo se use la lista es responsabilidad de quien la
  usa.

---

## Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| El navegador no se abre | Entrar a mano a `http://localhost:3210` |
| La página dice "El programa se cerró" | Es una pestaña vieja: cerrarla y volver a abrir `extraer.bat` |
| El QR no aparece o dice "Renovando el código…" por mucho rato | Esperar unos segundos; si sigue igual, cerrar la ventana negra y volver a abrir |
| El teléfono dice "no se pueden vincular dispositivos por ahora" | No insistir. Cerrar el programa y probar unas horas después |
| "Pasó mucho tiempo sin escanear el código" | Pasaron 15 minutos sin escanear: volver a abrir `extraer.bat` |
| Error de certificados o de TLS al conectar | `extraer.bat` ya usa `--use-system-ca`; con `npm run extraer`, correr antes `set NODE_OPTIONS=--use-system-ca` (Windows) |
| El puerto 3210 está ocupado | Quedó otra copia abierta: cerrar las ventanas negras del programa |
| Salieron pocos nombres en las hojas de grupos | Es normal; ver [Qué tan completos salen los datos](#qué-tan-completos-salen-los-datos) |

---

## Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `extraer.mjs` | Programa principal: página local con el QR y las casillas, conexión con WhatsApp, espera de la agenda y el historial, recorrido de los grupos, armado de la lista de contactos propios y cierre de la sesión |
| `excel.mjs` | Arma el Excel con [exceljs](https://github.com/exceljs/exceljs): hojas, orden, filtros y enlaces `wa.me` |
| `salidas.mjs` | Junta a los que se fueron: la lista de "participantes anteriores" que manda WhatsApp más los avisos de "salió / lo sacaron" de los mensajes sincronizados; descarta a quien volvió a entrar |
| `paises.mjs` | País de cada teléfono según el prefijo internacional |
| `extraer.bat` / `extraer-con-mas-nombres.bat` | Accesos directos para Windows |

Recorrido de una corrida:

1. Se levanta la página local y se pide un QR a WhatsApp (perfil de navegador Chrome; presentarse
   como "Desktop" hace que WhatsApp corte la conexión antes de mostrar el QR).
2. Después de escanear, WhatsApp manda en tandas la agenda, los chats y el historial. El programa
   espera hasta que deja de llegar información nueva (45 s a 3 min en modo normal, 3 a 20 min en
   modo completo).
3. Pide la lista de grupos con sus miembros y cruza cada identificador anónimo (`lid`) con su
   teléfono cuando WhatsApp lo dio.
4. Escribe el Excel y el diagnóstico, cierra la sesión y borra `sesion/`.

Librerías: [Baileys](https://github.com/WhiskeySockets/Baileys) (conexión con WhatsApp),
[exceljs](https://github.com/exceljs/exceljs), [qrcode](https://github.com/soldair/node-qrcode) y
[pino](https://github.com/pinojs/pino).
