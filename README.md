# Biblioteca personal PWA

Aplicacion personal para administrar libros fisicos, estanterias y prestamos. Esta primera version incluye API REST, base PostgreSQL, frontend en español y ejecucion local con Docker Compose.

## Como correrla

1. Copia las variables de entorno:

```bash
cp .env.example .env
```

2. Levanta la aplicacion:

```bash
docker compose up --build
```

3. Abre la app:

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

La API crea las tablas automaticamente al iniciar el contenedor.

Si ya tenias una version anterior corriendo, reconstruye sin cache para asegurar que el navegador use la ruta nueva de API:

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

## Que incluye esta version

- Catalogo de libros.
- Ingreso manual de libros.
- Escaneo de ISBN con camara usando ZXing.
- Busqueda automatica de metadatos por ISBN en Open Library y Google Books como respaldo.
- Busqueda de libros sin ISBN por titulo y autor.
- Asistente de clasificacion con Dewey, LC y etiquetas libres usando Anthropic.
- Edicion y eliminacion de libros ya creados.
- Deteccion de duplicados por ISBN o titulo/autor aproximado.
- Gestion de generos y subgeneros con color e icono para organizar la coleccion.
- Precarga automatica de generos y subgeneros base al iniciar la API.
- Traduccion con IA de Dewey/subjects a genero personal sugerido.
- Repisas dedicadas a un genero literario dentro de cada estanteria.
- Advertencia suave cuando un libro se ubica en una repisa de otro genero.
- Edicion y eliminacion de estanterias y repisas desde menu.
- Generacion de tejuelos con vista previa, impresion a PDF y exportacion PNG.
- Busqueda por titulo, autor, ISBN, editorial, genero o año.
- Busqueda unificada no sensible a mayusculas ni tildes.
- Filtros desplegables por genero, subgenero y estanteria.
- Ordenamiento por titulo, autor, recientes u orden fisico de estanteria segun tejuelo.
- Creacion de estanterias y repisas.
- Asignacion de libros a ubicacion fisica.
- Registro y devolucion de prestamos.
- Base de datos PostgreSQL.

## Uso inicial

Al abrir la web veras directamente el catalogo. El boton `Herramientas` de la barra superior tiene solo dos opciones: `Crear nuevo libro` y `Gestion de estanterias`. Para empezar:

1. Crea una estanteria, por ejemplo `Estanteria sala`.
2. Si quieres organizar por genero, crea primero generos como `Historia`, `Filosofia` o `Novela`.
3. Crea una repisa, por ejemplo `Repisa 1`, y asignale el genero dedicado si corresponde.
4. Usa `Crear nuevo libro` para abrir el flujo de ingreso en cinco pasos: metodo de ingreso, datos, clasificacion por IA, ubicacion y tejuelo.
5. En el primer paso puedes escanear ISBN, buscar por ISBN, buscar sin ISBN por titulo/autor/editorial/año, o agregar manualmente.
6. Usa el boton `Prestar` en una tarjeta para registrar un prestamo.
7. Usa `Devolver` para marcarlo como devuelto.

Para usar la camara en movil, abre la app desde un contexto seguro. `localhost` funciona en el mismo dispositivo; para probar desde otro telefono en la red local normalmente necesitaras HTTPS.

## Asistente de clasificacion

Para activar las sugerencias con IA, agrega tu clave de Anthropic en `.env`:

```env
ANTHROPIC_API_KEY=tu_clave
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Luego reconstruye la API:

```bash
docker compose down
docker compose build --no-cache api web
docker compose up
```

La clasificacion aparece como el tercer paso del flujo de crear o editar libro. Tambien puedes abrirla desde el menu de opciones de una tarjeta de libro existente. La sugerencia siempre queda editable antes de guardarse.

## Tejuelos

El tejuelo aparece como el quinto paso del flujo de crear o editar libro. Tambien puedes generarlo desde el menu de opciones de una tarjeta de libro existente. Desde esa vista puedes:

- Elegir Dewey, LC o clasificacion propia.
- Usar tamaño pequeno, mediano o personalizado.
- Editar manualmente el seriado antes de guardarlo.
- Imprimir una etiqueta, un lote seleccionado o una estanteria completa.
- Exportar una etiqueta como PNG.

La opcion `PDF` abre una vista imprimible del navegador; en el dialogo de impresion elige `Guardar como PDF`.

## Busqueda y orden

La pantalla principal usa una sola barra de busqueda para titulo, autor, ISBN, editorial, genero y año. Los filtros de genero, subgenero y estanteria se combinan con la busqueda. Si seleccionas una estanteria, la app cambia automaticamente a `Orden de estanteria`, que ordena por el tejuelo simulando el orden fisico de biblioteca.

## Duplicados

Al escanear o guardar un libro nuevo, la app revisa coincidencias por ISBN y por similitud de titulo/autor. Si encuentra posibles duplicados, muestra el libro existente y permite:

- Actualizar el libro existente con la informacion nueva.
- Agregar el libro de todas formas.
- Cancelar el guardado.

## Generos y estanterias

Desde `Herramientas` > `Gestion de estanterias` puedes crear generos principales con color e icono, agregar subgeneros, crear estanterias, y marcar cada repisa como dedicada a un genero. En la ficha del libro puedes elegir genero, subgenero y conservar el genero exacto que vino de una API o clasificacion Dewey.

La API precarga una lista base de generos y subgeneros si aun no existen. La precarga no duplica generos creados previamente y puedes editar o eliminar esos elementos desde la app.

Si asignas un libro a una repisa cuyo genero dedicado no coincide con el genero del libro, la app muestra una advertencia, pero permite guardarlo igualmente.

Al escanear o buscar un ISBN, si `ANTHROPIC_API_KEY` esta configurada, la API intenta traducir el codigo Dewey y los subjects publicos a un genero personal. Si la confianza es alta y coincide con un genero existente, se preselecciona automaticamente. Con confianza media o baja, se muestra como sugerencia para confirmar o modificar antes de guardar.

## Siguientes pasos previstos

- Subida de portadas.
- Autenticacion familiar con JWT.
