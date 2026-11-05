<p align="center"><img src="assets/menu.jpg" alt="Xato Ds" width="640"></p>

# Xato S3erver Dev

Plataforma de **3 servidores** de sesiones de WhatsApp, cada uno con un limite de **5 registros** (15 en total), y el bot automatico **Xato Ds**. El usuario escribe su numero, el sistema genera un QR y al escanearlo desde WhatsApp el bot queda activo. Incluye modo administrador para eliminar sesiones.

## Requisitos
- Node.js 20 o superior
- Git instalado (algunas dependencias de Baileys se descargan desde GitHub)

## Instalacion
```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y cambia ADMIN_PASSWORD
npm start
```
Abre **http://localhost:3000**

## Vincular por codigo o QR, y `!sebot`
**Desde el panel** (`http://localhost:3000`) elige *Codigo QR* o *Codigo de vinculacion*:
- **QR:** escaneas desde WhatsApp > Dispositivos vinculados > Vincular dispositivo (necesitas mostrar el QR en otra pantalla).
- **Codigo:** el panel muestra el codigo fijo **XATO-D3VS**; en el telefono del numero registrado: Dispositivos vinculados > Vincular dispositivo > *Vincular con el numero de telefono* y escribes el codigo. Es el metodo mas comodo si solo tienes un telefono.

El codigo se define en `PAIRING_CODE` (por defecto `XATOD3VS`, 8 caracteres). **Importante:** WhatsApp genera sus propios codigos sin las letras O, I, U ni el 0, y tu codigo lleva una O. En muchos telefonos funciona, pero si el tuyo lo rechaza (error o no vincula) cambia `PAIRING_CODE` por uno que use solo `1-9 A-H J-N P-T V-Z`, por ejemplo `XATQD3VS`.

**`!sebot`** permite que otro usuario vincule su propio WhatsApp y se convierta en bot:
```
!sebot                      codigo de vinculacion para tu mismo numero
!sebot codigo 51999999999   codigo para otro numero
!sebot qr                   QR (se envia como imagen; escanealo desde otro dispositivo)
```
- Solo funciona **por privado** (un QR a la vista de un grupo permitiria robar la sesion).
- Genera el codigo o el QR, sigue la vinculacion y avisa cuando termina (o cuando expira a los 3 minutos). Cada intento tiene 2 minutos de espera por usuario.
- Cuenta dentro de los **15 cupos** (3 servidores x 5). Si no hay cupos, avisa.
- La cuenta de un SeBot **no es dueña global**: no puede usar `!restart` ni `!broadcast`; si puede usar `!modo`, `!setname`, `!setstatus`, `!setpfp`, `!join` y `!leave` sobre su propio bot. En el panel admin aparece con la etiqueta *SeBot* y se puede eliminar.

## Si el bot no responde en grupos
1. Ejecuta `npm install` otra vez: el proyecto ahora usa **Baileys 7**, la version que entiende los IDs `@lid` que WhatsApp usa en los grupos (requiere Node 20+).
2. Vuelve a vincular el numero: en el panel entra como Admin, elimina la sesion y escanea un QR nuevo. Asi WhatsApp envia al bot los datos de grupos y LID.
3. Verifica que el bot sea miembro del grupo y que no este silenciado el chat en el telefono vinculado.
4. Pon `DEBUG=1` en el `.env`, reinicia (`pm2 restart xato`) y mira `pm2 logs xato`:
   - Si ves lineas `upsert(notify) ...@g.us`, los mensajes llegan; revisa el registro con `!reg nombre.edad`.
   - Si no aparece nada al escribir en el grupo, es un problema de conexion de la sesion: repite el paso 2.
5. Cada comando ejecutado se imprime en el log como `!comando de NUMERO (grupo|privado)`.

## Como funciona
| Parte | Descripcion |
|---|---|
| Servidores 1, 2 y 3 | Procesos independientes (puertos 3001, 3002, 3003) con su propia carpeta en `data/serverN`. Maximo 5 registros cada uno |
| Panel / gateway | Puerto 3000. Asigna cada numero nuevo al primer servidor con cupo libre |
| Registro | Numero con codigo de pais (ej. `51912345678`) > QR > WhatsApp > Dispositivos vinculados |
| Cupos | Si el QR no se escanea en 3 minutos, el cupo se libera solo |
| Modo admin | Boton "Admin" > clave de `.env` > ver y eliminar sesiones de los 3 servidores |

Las sesiones se guardan en `data/` (ignorado por Git) y se reconectan solas al reiniciar.

## Registro obligatorio
Nadie puede usar el bot hasta registrarse:
```
!reg nombre.edad        ejemplo: !reg Juan.20
```
Al registrarse recibe un mensaje de **registro exitoso** con **su propia foto de perfil de WhatsApp** (si es privada o no tiene, se usa `assets/registro.jpg`), un ID unico y 500 monedas de bono. Quien escribe un comando sin registro recibe el aviso de acceso restringido con las instrucciones. Los datos se guardan por servidor en `data/serverN/db.json`.

## Comandos del bot (prefijo `!`) - 216 comandos
Adaptados del HuTao y de tu bot original. Para ver todos escribe `!menu`.

| Categoria | Comandos |
|---|---|
| General | `!menu`, `!sebot`, `!ping`, `!info`, `!servidor`, `!id`, `!owner`, `!reglas`, `!estado` |
| Registro / Perfil | `!reg`, `!unreg`, `!perfil [@user]`, `!level`, `!setbirth`, `!delbirth`, `!setdesc`, `!deldesc`, `!setgenre`, `!delgenre`, `!sethobby`, `!delhobby`, `!marry`, `!aceptar`, `!rechazar`, `!divorce` |
| Economia | `!saldo`, `!banco`, `!depositar`, `!retirar`, `!diario`, `!trabajar`, `!tienda`, `!comprar`, `!transferir`, `!top`, `!tiempos` |
| RPG | `!crime`, `!pescar`, `!cazar`, `!minar`, `!ritual`, `!robar` |
| Casino | `!apostar`, `!slot`, `!ruleta`, `!cf` |
| Gacha | `!rw` (invoca), `!claim`, `!harem`, `!charinfo`, `!sell`, `!givechar`, `!waifutop` (1350 personajes) |
| Anime | `!abrazar`, `!acariciar`, `!besar`, `!acurrucar`, `!bofetada`, `!morder`, `!picar`, `!saludar`, `!bailar`, `!llorar`, `!reir`, `!sonreir`, `!guinar`, `!cosquillas`, `!golpear`, `!chocar5`, `!manos`, `!puchero`, `!sonrojar`, `!mirar`, `!dormir`, `!pensar`, `!alimentar` |
| Juegos / Diversion | `!ahorcado`, `!trivia`, `!adivina`, `!ppt`, `!dado`, `!moneda`, `!elegir`, `!bola`, `!frase`, `!ship`, `!matrimonio` |
| Grupos | `!grupo`, `!tagall`, `!hidetag`, `!kick`, `!add`, `!promote`, `!demote`, `!antilink`, `!bienvenida`, `!despedida`, `!setwelcome`, `!setbye`, `!silenciar`, `!abrir`, `!advertir`, `!perdonar`, `!warns`, `!setwarnlimit`, `!setgp`, `!setgpdesc`, `!setgpbanner`, `!sorteo`, `!link`, `!options`, `!bot on/off` |
| Utilidades | `!calc`, `!say`, `!foto`, `!tourl`, `!setmeta`, `!delmeta`, `!suggest`, |
| Matematicas / Finanzas | `!suma`, `!resta`, `!multiplicacion`, `!division`, `!potencia`, `!raiz`, `!porcentaje`, `!cambio`, `!dolar`, `!euro`, `!cripto`, `!igv` |
| Mundo / Informacion | `!hora`, `!paises`, `!clima`, `!noticias`, `!sismo`, `!feriados`, `!pais`, `!ip`, `!pelicula`, `!serie`, `!musica`, `!letra`, `!inflacion`, `!pbi` |
| Multimedia | `!imagen`, `!sticker`, `!toimg`, `!tts`, `!qr`, `!blanconegro`, `!blur`, `!invertir`, `!meme` |
| Descargas | `!play`, `!play2`, `!tiktok`, `!tiktokmp3`, `!facebook`, `!instagram`, `!twitter`, `!mediafire`, `!pinterest`, `!apk`, `!ytsearch`, `!dl` |
| Herramientas / Estudio | `!traducir`, `!wiki`, `!convertir`, `!clave`, `!ia`, `!resumir`, `!corregir`, `!recordatorio`, `!alarma` |
| Owner | `!modo`, `!broadcast`, `!join`, `!leave`, `!setname`, `!setstatus`, `!setpfp`, `!restart` |

### Decoracion (tabla de caracteres)
Todas las respuestas usan simbolos Unicode de tabla de caracteres: marcos `┏ ┃ ┗`, vinetas `❯ ❖ ✦ ⌬ ➜` y letras especiales (𝗫𝗔𝗧𝗢 𝗗𝗦). El menu, la bienvenida y el registro tienen su diseño propio; las respuestas simples de cualquier comando se enmarcan solas (`src/bot/deco.js`). Para cambiar los simbolos edita ese archivo y `src/bot/style.js`. Con `!simbolos` y `!fuente` los usuarios pueden copiar la tabla y estilos de letra.

### Menu con botones
`!menu` llega en **un solo mensaje**: imagen, datos del bot, 8 secciones numeradas y botones (*Ver menu*, *Mi perfil*, *Diario*, *Ver todo*). Al tocar una seccion, o al escribir su numero (por ejemplo `3`) o su nombre (`!menu rpg`, `!menu anime`), el bot envia los comandos de esa seccion. `!menu todo` envia todos juntos. El numero solo se acepta durante 3 minutos despues de pedir el menu.

Los botones se envian con los nodos binarios que usa WhatsApp para mensajes interactivos y respetando sus limites (cuerpo 1024 caracteres, titulo de boton 20, lista maximo 10 filas). Como son mensajes interactivos enviados desde una cuenta vinculada, **algunos dispositivos o chats pueden no mostrarlos**, y WhatsApp acepta el mensaje igual aunque no lo dibuje. Para averiguar que funciona en tu WhatsApp escribe, como dueño, **`!testbotones`**: envia 6 variantes (respuestas rapidas, lista, mixto con imagen, enlace; con y sin envoltorio view-once) y al tocar un boton responde con lo que recibio. Notas:
- Los botones de respuesta rapida **no funcionan en el chat contigo mismo** ("mensaje a ti mismo"); prueba desde otro numero.
- Ajustes en el `.env`: `BUTTONS=on|off`, `BUTTONS_STYLE=mixed|list` (`list` = un solo boton con todo dentro de la lista, sin botones de respuesta rapida) y `BUTTONS_WRAP=plain|viewonce`.
- Si no se pueden enviar, el menu se manda como imagen + texto con el mismo contenido y la navegacion por numero sigue funcionando.

### Comandos gratuitos nuevos (sin clave de API)
| Tipo | Comandos |
|---|---|
| Mascotas y humor | `!chiste`, `!perro`, `!gato`, `!zorro`, `!pato` |
| Informacion | `!pokemon`, `!apod` (NASA), `!receta`, `!coctel`, `!libro`, `!anime`, `!iss` (Estacion Espacial), `!juegogratis` |
| Herramientas con internet | `!diccionario`, `!acortar`, `!github`, `!npm`, `!whois` |
| Herramientas locales | `!fuente` (9 estilos de letras), `!simbolos` (tabla de caracteres), `!color`, `!edad`, `!zodiaco`, `!dias`, `!hash`, `!b64`, `!morse`, `!binario`, `!reverso`, `!contar`, `!uuid`, `!tirar` (dados 2d6+3), `!random` |

Usan servicios publicos gratuitos (JokeAPI, Dog CEO, cataas, RandomFox, Random-d.uk, PokeAPI, NASA con DEMO_KEY, TheMealDB, TheCocktailDB, Open Library, Free Dictionary API, Jikan, Open Notify, FreeToGame, is.gd, GitHub, npm y RDAP). Si alguno cambia o se cae, solo ese comando avisa del error. La NASA con `DEMO_KEY` permite unas 30 consultas por hora por IP.

### Aspecto (simbolos de tabla de caracteres)
Todos los mensajes usan marcos y simbolos Unicode (`┏ ┃ ┗ ⬣`, `✦ ❖ ⌬ ❯ ➜`) y letras especiales (𝗡𝗲𝗴𝗿𝗶𝘁𝗮). `src/bot/deco.js` los centraliza: `skin()` convierte los marcos antiguos al estilo nuevo en cualquier mensaje y `frame()` enmarca las respuestas de texto simple (usa `reply(texto, { raw: true })` para enviar sin marco). Para cambiar el estilo edita `deco.js` y `style.js`. `!simbolos` te muestra la tabla completa para copiar mas simbolos y `!fuente` convierte cualquier texto a 9 tipos de letra.

### Economia y RPG
Los montos estan ajustados a la economia de Xato Ds (empiezas con 500 monedas). El dinero del **banco** no se puede robar ni se pierde en el RPG; solo se apuesta lo que tienes en la **cartera**. `!robar` solo funciona con usuarios inactivos hace una hora. Los tiempos de espera se ven con `!tiempos`.

### Gacha
`!rw` invoca un personaje al azar (cada 3 min); `!claim` lo reclama si esta libre (cada 10 min); cada personaje tiene un solo dueño por servidor. `!sell` lo vende a un precio segun su valor. Las imagenes se obtienen de AniList.

### Anime
Las interacciones usan GIFs de nekos.best. Con **ffmpeg** instalado se envian como GIF animado; sin ffmpeg se envian como imagen.

### Bienvenida y menu juntos
El mensaje de bienvenida de los grupos usa el mismo estilo del menu, incluye la foto de perfil del nuevo integrante, el aviso de `!reg nombre.edad`, la lista de categorias del bot y el credito **Desarrollador: Xato D3v**. Se puede personalizar con `!setwelcome` y `!setbye` (variables `{user}`, `{group}`, `{count}`).

Los comandos de grupo de administracion (`kick`, `add`, `promote`, etc.) exigen que quien los use sea admin del grupo y que el bot tambien lo sea. `!antilink on` borra enlaces y suma advertencias; a las 3 expulsa. `!bienvenida` y `!despedida` estan activas por defecto.

### Bienvenida y menu juntos
El mensaje de bienvenida de los grupos usa el mismo estilo del menu (negritas, cursivas, emojis), incluye la imagen, el aviso de `!reg nombre.edad`, la lista de categorias del bot y el credito **Desarrollador: Xato D3v**.

### Servicios publicos usados (sin API key)
open.er-api.com (divisas), CoinGecko (cripto), wttr.in (clima), MyMemory (traductor), Wikipedia, Google Noticias RSS, USGS (sismos), Nager.Date (feriados), REST Countries, ipwho.is, iTunes Search (peliculas, series, musica), lyrics.ovh, BCRP y Banco Mundial (inflacion y PBI), Pollinations (imagenes e IA, limite ~1 peticion/15 s sin clave) y TikWM (TikTok), FxTwitter (X) y yt-search (busqueda en YouTube). Si alguno cambia, solo ese comando avisa del error.

### Descargas
| Comando | Que descarga | Sin clave de API |
|---|---|---|
| `!play`, `!ytmp3` | Audio de YouTube (busca por nombre o enlace, con ficha y miniatura) | Necesita yt-dlp |
| `!play2`, `!ytmp4` | Video de YouTube | Necesita yt-dlp |
| `!tiktok` (`--mp3` para audio), `!tiktokmp3` | TikTok sin marca de agua | Funciona (TikWM) |
| `!facebook`, `!fb` | Video de Facebook | Necesita yt-dlp |
| `!instagram`, `!ig`, `!reel` | Reels, posts y carruseles | Necesita yt-dlp |
| `!twitter`, `!x` | Videos e imagenes de X/Twitter | Funciona (FxTwitter) |
| `!mediafire`, `!mf` | Archivos de Mediafire (hasta 2 GB, el tope de WhatsApp) | Funciona (enlace directo) |
| `!pinterest`, `!pin` | Imagen o video de un pin (con clave tambien busca por texto) | Funciona con enlace |
| `!apk` | Aplicaciones APK desde Aptoide (hasta 2 GB, el tope de WhatsApp) | Funciona |
| `!ytsearch`, `!yts` | Lista de videos de YouTube con enlaces | Funciona |
| `!dl` | Otros sitios compatibles con yt-dlp | Necesita yt-dlp |

Cada comando prueba en este orden: **API opcional** (si la configuras), luego una **alternativa gratuita** y por ultimo **yt-dlp** instalado en el equipo. Para que YouTube, Facebook e Instagram funcionen instala yt-dlp y ffmpeg en el servidor (no hace falta ninguna clave):
```bash
pip install -U yt-dlp        # o el binario de github.com/yt-dlp/yt-dlp
# ffmpeg: https://ffmpeg.org/download.html  (Termux: pkg install ffmpeg)
```
Opcional: si tienes una clave de un servicio de descargas, completa `DL_API_KEY` / `DL_API2_KEY` en el `.env` para acelerar esos comandos. Los servicios de terceros pueden cambiar o caerse, por eso yt-dlp es la opcion mas estable.

Limites: sin tope propio de tamaño (solo el de WhatsApp, ~2 GB), 15 s de espera entre descargas por usuario y 3 descargas a la vez.

### Variables extra (.env)
- `OWNER_NUMBERS`: numeros dueños adicionales (con codigo de pais, separados por coma). La cuenta vinculada siempre es dueña.
- `POLLINATIONS_KEY`: clave gratuita opcional para subir el limite de la IA.
- `DL_API_URL`, `DL_API_KEY`, `DL_API2_URL`, `DL_API2_KEY`: APIs de descarga (ver seccion Descargas).

### Agregar un comando nuevo
Crea o edita un archivo en `src/bot/cmds/` (o `src/bot/commands.js`) y agrega un objeto al arreglo. Opciones: `noReg`, `group`, `admin`, `botAdmin`, `owner`:
```js
{
  name: 'hola',
  cat: 'Diversion',
  desc: 'Saluda al usuario',
  async run({ reply, user }) { await reply(`Hola ${user.name}, soy Xato Ds`); },
}
```
Usa `cat` para agrupar el comando en el menu. El menu se actualiza solo.

## Estructura
```
xato-server-dev/
  assets/          menu.jpg y menu.mp3 (usados por !menu)
  public/          panel web (HTML, CSS, JS)
  src/
    index.js       arranca los 3 servidores y el panel
    gateway.js     API publica + admin
    node-server.js un servidor de sesiones
    bot/           session-manager, handler, db, style, commands.js y cmds/ (comandos por categoria)
  data/            sesiones (no se sube a Git)
```

## Subir a GitHub
```bash
git init
git add .
git commit -m "Xato S3erver Dev"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/xato-server-dev.git
git push -u origin main
```

## Avisos
- Este proyecto usa Baileys, una libreria **no oficial** de WhatsApp Web. Usalo con cuidado: WhatsApp puede limitar numeros que hagan spam o abuso.
- `assets/menu.jpg`, `assets/registro.jpg` y `assets/menu.mp3` son obras con derechos de autor. Si el repositorio es publico, considera usar contenido propio o libre de derechos.
