# wa-contactos-grupos

Extrae a un Excel los contactos de un WhatsApp vinculándolo por QR como dispositivo (igual que
WhatsApp Web). Corre entero en la PC: no sube nada a ningún servidor, no guarda mensajes y no
envía nada. Al terminar cierra la sesión y borra la carpeta `sesion/`.

## Cómo se usa

Requisitos: Node 20 o superior.

```
npm install
npm run extraer        # o doble clic en extraer.bat (Windows)
```

Se abre `http://localhost:3210` con el QR. Antes de escanear se eligen las casillas:

| Casilla | Qué trae |
|---|---|
| Miembros de grupos | Todos los miembros de todos los grupos de la cuenta |
| Los que se fueron | Quienes salieron o fueron sacados de los grupos |
| Mis contactos | Agenda del teléfono + chats privados |
| Historial completo | Pide a WhatsApp el historial entero: más teléfonos y nombres, tarda hasta 20 min. Solo se puede elegir antes de escanear |

Se escanea desde el teléfono (Dispositivos vinculados → Vincular un dispositivo) y al terminar
deja un `contactos-grupos-AAAA-MM-DD-HHhMM.xlsx` en la carpeta, más un `*-diagnostico.txt` con
cantidades (sin datos de personas).

`extraer-con-mas-nombres.bat` es lo mismo con "Historial completo" tildado de entrada
(variable de entorno `MAS_NOMBRES=1`).

## Archivos

| Archivo | Qué hace |
|---|---|
| `extraer.mjs` | Programa principal: servidor local con el QR y las casillas, conexión con WhatsApp (librería [Baileys](https://github.com/WhiskeySockets/Baileys) 7), espera de la agenda, recorrido de grupos y cierre de sesión |
| `excel.mjs` | Arma el Excel (exceljs): hojas Por grupo, Grupos, Únicos, Con username, Se fueron, Mis contactos. Columnas Nombre, Teléfono, País y enlace `wa.me`, ordenado por país → nombre, con filtros |
| `salidas.mjs` | Junta a los que se fueron: `pastParticipants` del historial + avisos de "salió / lo sacaron" (stub 32 / 28) en los mensajes sincronizados. Excluye a quien volvió a entrar |
| `paises.mjs` | País a partir del prefijo telefónico (separa EE.UU. y Canadá por código de área) |

## Lo que se aprendió en las corridas reales (octubre 2026)

- **Teléfonos:** la lista de miembros de un grupo sí trae el teléfono (≈97–100% en grupos
  normales). Faltan sobre todo en "Avisos de comunidad", donde WhatsApp da el miembro como `lid`
  (identificador anónimo, no es un teléfono). Con "Historial completo" sube el cruce lid → teléfono.
- **Nombres:** WhatsApp no manda el nombre de un miembro de grupo que no está agendado. Los nombres
  salen de la agenda del teléfono; por eso en "Miembros de grupos" la mayoría vienen vacíos y en
  "Mis contactos" casi todos tienen nombre.
- A veces WhatsApp manda como nombre el teléfono enmascarado (`+34∙∙∙∙∙∙∙12`): se descarta.
- La agenda llega en tandas después de conectar; el programa espera hasta que deja de llegar
  información nueva (45 s a 3 min en modo normal, 3 a 20 min en modo completo).
- Presentarse como "Desktop" hace que WhatsApp corte con 428 antes del QR; por eso se usa el perfil
  de navegador Chrome.

## Cuidado

- **Bloqueo de vinculación:** varias vinculaciones seguidas (o escanear un QR vencido) hacen que el
  teléfono responda "no se pueden vincular dispositivos por ahora". Es un freno temporal, no un
  baneo. Una sola corrida limpia por día y escanear apenas aparece el QR.
- Los Excel contienen datos personales: están en `.gitignore` y no deben subirse al repo.
- La carpeta `sesion/` mientras existe da acceso a la cuenta de WhatsApp; el programa la borra al
  terminar y también está en `.gitignore`.
