# Guía Generalista de SN Assistant

Una explicación humana de cómo está montada tu app, por qué está hecha así y cómo se conectan sus piezas.

Si alguna vez has pensado:

- "Vale, funciona... pero, ¿qué demonios está pasando por debajo?"
- "Sé leer un poco de código, pero no quiero sentir que he entrado en Mordor"
- "Quiero entender mi app sin hacer un máster en extensiones de Chrome"

Entonces este documento es para ti.

---

## 1. La idea general en una frase

**SN Assistant** es una **extensión de Chrome** que se mete dentro de ServiceNow, detecta en qué pantalla estás, te muestra un panel lateral y usa un modelo de IA para ayudarte a explicar, refactorizar, comentar o documentar scripts y Update Sets.

Dicho de forma menos seria:

ServiceNow pone la pantalla, tu código pone la lógica, y la extensión hace de "copiloto con café".

---

## 2. Qué tecnologías usa realmente

No hay mucha magia rara aquí. Eso es bueno.

### Lenguajes principales

- **JavaScript**: es el corazón del proyecto
- **HTML**: para la página de opciones y las páginas públicas
- **CSS**: para los estilos del panel, settings y web pública
- **Markdown (`.md`)**: para documentación y contenido explicativo

### Frameworks

Aquí viene una parte importante:

**La extensión NO usa React, Vue, Angular ni bundlers complejos para la parte principal.**

Eso significa que:

- no hay build pesado para la extensión
- no dependes de una cadena enorme de herramientas
- el proyecto es más fácil de cargar como extensión desempaquetada
- hay menos piezas "invisibles" haciendo cosas por detrás

En otras palabras: aquí se apostó por **vanilla JavaScript** a propósito.

No es porque alguien odiara los frameworks una noche de tormenta.
Es porque **ServiceNow tiene restricciones de CSP** y porque una extensión pequeña y directa se beneficia mucho de ser simple.

### Plataforma base

- **Chrome Extension Manifest V3**

Esto define:

- qué permisos tiene la extensión
- qué scripts se cargan
- qué páginas forman parte de la extensión
- cómo se comunica el fondo de la extensión con la página

Piensa en `manifest.json` como el **DNI + plano eléctrico básico** de la extensión.

Archivo clave: [manifest.json](/c:/Dev/ServiceNow-Copilot-Extension/manifest.json)

---

## 3. El mapa mental más útil: 4 capas

La app se entiende mucho mejor si la divides en estas 4 capas:

1. **La capa visible en ServiceNow**
2. **La capa de configuración**
3. **La capa de IA y routing**
4. **La capa de documentación y conocimiento**

Vamos una por una.

---

## 4. Capa 1: lo que ves dentro de ServiceNow

### Archivo clave: `content.js`

Archivo: [content.js](/c:/Dev/ServiceNow-Copilot-Extension/content.js)

Este archivo es probablemente el más importante del proyecto.

Su trabajo es:

- entrar en la página de ServiceNow
- detectar dónde estás
- ver si hay un editor o un Update Set
- crear el botón/trigger
- crear el panel lateral
- recoger el contexto visible de la página
- hablar con el `service-worker` para pedir respuestas al modelo

### Por qué existe `content.js`

Porque la IA no vive "dentro" de ServiceNow por arte de magia.
Alguien tiene que:

- mirar el DOM
- encontrar el editor
- leer el script o los datos del Update Set
- pintar la interfaz del panel

Ese "alguien" es `content.js`.

### Un detalle muy importante: es un script clásico

En `CLAUDE.md` esto se deja clarísimo:

- `content.js` **no puede ser módulo**
- no debe usar `import` estático

¿Por qué?

Porque **ServiceNow tiene CSP estricta**.

Traducción al castellano llano:

ServiceNow pone normas de seguridad bastante serias sobre qué scripts puede ejecutar y cómo.
Si `content.js` se montara como módulo moderno, hay muchas probabilidades de que la integración se rompa o deje de funcionar en ciertos contextos.

Así que aquí se eligió compatibilidad y robustez por encima de postureo tecnológico.
Muy sensato, la verdad.

### Qué detecta `content.js`

Detecta cosas como:

- el tipo de registro (`sys_script`, `sys_script_include`, `sys_update_set`, etc.)
- si estás en un editor Monaco
- si hay un formulario compatible
- si estás en un Update Set

Eso permite que la extensión no funcione "a ciegas", sino con contexto real.

### Por qué eso es importante

Porque esta app no quiere ser un chat genérico pegado encima de ServiceNow.
Quiere saber:

- qué tabla estás viendo
- qué tipo de script es
- si debe ofrecer `Explain`, `Refactor`, `Document`, etc.

Es decir: **la UX depende del contexto real**, no de una caja de texto mágica flotando porque sí.

---

## 5. Capa 2: la interfaz del panel dentro de ServiceNow

### Archivo clave: `sidebar.css`

Archivo: [sidebar.css](/c:/Dev/ServiceNow-Copilot-Extension/sidebar.css)

Este archivo da estilo al panel lateral dentro de ServiceNow.

Controla:

- el header del panel
- botones de acciones
- textarea de preguntas
- zona de respuesta
- grounding
- execution trace
- estados de carga
- comportamiento de arrastre y resize

### Por qué está separado

Porque separar estilos del comportamiento hace la vida más fácil.

- `content.js` decide **qué hacer**
- `sidebar.css` decide **cómo se ve**

Una app sin esta separación acaba siendo como una tostada con todo mezclado encima.
Nutritiva, quizá. Elegante, no.

---

## 6. Capa 3: el cerebro de fondo de la extensión

### Archivo clave: `service-worker.js`

Archivo: [service-worker.js](/c:/Dev/ServiceNow-Copilot-Extension/service-worker.js)

Este archivo es el **backend interno de la extensión**.

No es un backend en la nube.
No está en un servidor tuyo.
Pero sí es el lugar donde vive la lógica "de fondo" que no debe ejecutarse directamente en la página de ServiceNow.

### Qué hace

- inicializa defaults cuando instalas la extensión
- responde al click del icono de la extensión
- recibe mensajes desde `content.js`
- prepara llamadas a los providers de IA
- transmite chunks de respuesta
- maneja el streaming

### Por qué existe este archivo

Porque el `content.js` está pegado al DOM de ServiceNow y debería centrarse en:

- UI
- detección
- contexto
- mensajería

Las llamadas a IA, el routing y la gestión de flujo se mandan al `service-worker`.

Esta separación es muy buena decisión arquitectónica porque:

- reduce acoplamiento
- evita meter demasiada responsabilidad en `content.js`
- respeta mejor la seguridad y el modelo de extensiones

### Una idea útil

Piensa así:

- `content.js` = la persona que habla contigo en recepción
- `service-worker.js` = la trastienda donde realmente se tramitan las cosas

La recepcionista no se pone a construir el pedido.
Solo lo toma bien y lo envía donde toca.

---

## 7. Capa 4: la pantalla de configuración

### Archivos clave

- [options.html](/c:/Dev/ServiceNow-Copilot-Extension/options.html)
- [options.js](/c:/Dev/ServiceNow-Copilot-Extension/options.js)

Esta es la zona donde configuras:

- proveedores
- modelos
- idioma preferido
- routing por acción
- RAG
- modo de documentación de Update Sets

### Qué hace `options.html`

Es la estructura visual de la página de settings.

### Qué hace `options.js`

Se encarga de:

- cargar la configuración guardada
- pintar formularios y selects
- guardar cambios
- mostrar badges de providers
- activar o desactivar secciones según el estado

### Por qué está así

Porque la página de opciones forma parte nativa del modelo de extensiones Chrome.

No hace falta montar una SPA enorme para esto.
Con HTML + JS modular es suficiente.

De hecho aquí sí se usan imports ES module en `options.js`, porque esa página no está sometida al mismo problema de CSP que `content.js`.

Y eso es importante:

- `content.js` = script clásico por necesidad
- `options.js` = módulo moderno porque ahí sí tiene sentido

Es una decisión práctica, no una contradicción.

---

## 8. Dónde se guardan los ajustes y por qué

### Archivo clave: `storage/schema.js`

Archivo: [storage/schema.js](/c:/Dev/ServiceNow-Copilot-Extension/storage/schema.js)

Este archivo define:

- la estructura base de settings
- los valores por defecto
- cómo se migran ajustes viejos
- cómo se separan secretos y preferencias normales

### La decisión importante aquí

La app separa:

- **preferencias no sensibles** en `chrome.storage.sync`
- **secretos** en `chrome.storage.local`

Eso significa:

#### `chrome.storage.sync`

Guarda cosas como:

- idioma
- routing
- RAG
- modo de Update Set
- qué providers están activos

#### `chrome.storage.local`

Guarda cosas como:

- API keys
- headers sensibles

### Por qué esta separación es buena

Porque no es lo mismo guardar:

- "prefiero respuestas en español"

que guardar:

- "aquí tienes la llave de mi proveedor de IA"

Una se puede sincronizar más tranquilamente.
La otra mejor mantenerla local.

Es una decisión muy sensata de seguridad y privacidad.

---

## 9. Cómo decide la app qué proveedor usar

### Archivo clave: `providers/manager.js`

Archivo: [providers/manager.js](/c:/Dev/ServiceNow-Copilot-Extension/providers/manager.js)

Este archivo hace de **director de orquesta**.

No llama a un modelo concreto porque sí.
Antes resuelve:

- qué acción estás ejecutando
- qué provider toca
- qué modelo se usará
- si debe entrar RAG o no
- cómo se construye el prompt final

### Qué providers soporta

Ahora mismo el proyecto soporta:

- Anthropic
- OpenAI
- Gemini
- OpenRouter
- Custom Endpoint
- Local LLM

Cada uno tiene su propio archivo adapter en `providers/`.

### Por qué usar adapters separados

Porque cada proveedor habla un "dialecto" diferente:

- unos esperan una API key concreta
- otros un formato distinto
- unos hacen streaming de una manera
- otros de otra

Separar cada proveedor en su adapter evita convertir el proyecto en una paella de `if/else` gigantes.

Es la típica decisión que no se nota cuando todo va bien... y que te salva la salud mental cuando quieres cambiar o añadir un proveedor.

### Regla arquitectónica importante

Toda llamada a providers pasa por el `service-worker`, no por `content.js`.

Eso es importante por limpieza, seguridad y mantenimiento.

---

## 10. Cómo se construyen los prompts

### Archivos relacionados

- `providers/prompts.js`
- `providers/manager.js`

La app no manda simplemente:

> "Explícame este código"

Hace algo más inteligente:

- toma la acción (`Explain`, `Ask`, `Refactor`, etc.)
- añade contexto de ServiceNow
- añade idioma preferido
- añade grounding RAG si toca
- añade contexto del Update Set si aplica

Eso hace que el resultado sea más útil y menos genérico.

Dicho de otra forma:

la diferencia entre una IA genérica y una IA bien guiada suele estar en el prompt.

Y aquí eso está bastante cuidado.

---

## 11. Qué es RAG en esta app y por qué existe

### Archivos clave

- [rag/engine.js](/c:/Dev/ServiceNow-Copilot-Extension/rag/engine.js)
- `rag/index.js`
- `rag/retrieval.js`
- `rag/config.js`

### Versión sencilla

RAG significa, simplificando mucho:

> "Antes de responder, voy a buscar conocimiento relevante para no inventarme demasiado."

En esta app, el conocimiento viene sobre todo de **Breaking Trail**, empaquetado localmente.

### Lo bonito de esta implementación

No depende de un servicio externo de búsqueda.

La extensión lleva un índice local y hace retrieval dentro de su propio runtime.

Eso da varias ventajas:

- más control
- menos dependencia externa
- mejor privacidad
- respuestas más aterrizadas en ServiceNow

### Qué decide `rag/engine.js`

Decide si el RAG:

- está activado globalmente
- está activado para esa acción concreta
- tiene fuentes activas
- puede recuperar fragmentos útiles

Si no toca usarlo, devuelve un estado de "saltado" o "desactivado" en vez de fingir.

Y eso está muy bien.

La app no hace teatro tecnológico.
No pone RAG por poner una etiqueta brillante.

### Por qué no se usa siempre

Porque no todo necesita grounding.

Por ejemplo:

- `Ask` y `Explain` se benefician mucho
- `Comment` o `Refactor` no siempre
- `Document UpdateSet` puede requerir otro flujo

Usarlo selectivamente mejora equilibrio entre:

- calidad
- coste
- velocidad

---

## 12. Cómo funciona la documentación de Update Sets

### Archivos clave

- [change-documentation/planner.js](/c:/Dev/ServiceNow-Copilot-Extension/change-documentation/planner.js)
- `change-documentation/schema.js`

Esta parte es bastante especial del proyecto.

No se limita a documentar un script.
También intenta entender un **paquete de cambios**.

### Qué hace esta capa

- normaliza los Customer Updates
- agrupa cambios por tipo
- intenta inferir el propósito funcional
- prepara un "brief" más estructurado para luego dárselo al modelo

### Por qué es importante ese brief

Porque un Update Set no es una línea de código aislada.
Es una colección de cambios.

Si mandaras todo al modelo "tal cual", podrías obtener una respuesta más caótica.
En cambio, aquí primero se organiza la información.

Es como hacer la maleta antes de salir, en vez de meter calcetines, portátil y jamón serrano todo suelto en una bolsa.

### Modos actuales

#### `List-first`

Usa:

- los datos visibles del Update Set
- la related list de Customer Updates

Es más rápido y ligero.

#### `Deep`

Intenta enriquecerse con:

- `sys_update_xml`
- previews más detalladas

Es más rico, pero también más costoso y delicado.

### Por qué hay dos modos

Porque en producto casi nunca existe el modo "perfecto para todo".

Normalmente eliges entre:

- más rapidez
- más profundidad

Aquí la app te deja elegir según el caso.

Eso es una decisión de producto bastante madura.

---

## 13. Cómo fluye una acción de principio a fin

Vamos con un ejemplo real.

### Caso: pulsas `Explain` en un script

1. Estás en ServiceNow
2. `content.js` detecta que hay un editor compatible
3. Se muestra el panel
4. Pulsas `Explain`
5. `content.js` recoge:
   - el código
   - tipo de registro
   - contexto de página
6. `content.js` abre un puerto con el `service-worker`
7. `service-worker.js` llama a `prepareActionExecution()`
8. `providers/manager.js`:
   - carga settings
   - resuelve provider
   - decide modelo
   - decide si entra RAG
   - construye prompt
9. El provider correspondiente hace la llamada al modelo
10. El resultado vuelve por streaming
11. `content.js` lo pinta en el panel

### Caso: pulsas `Document UpdateSet`

El flujo es parecido, pero con una diferencia importante:

antes de pedir al modelo la respuesta, la app:

- captura datos del Update Set
- normaliza Customer Updates
- construye un brief estructurado

O sea, hace más trabajo previo.

Eso explica por qué esta acción es más "pesada" y necesita execution trace más claro.

---

## 14. Qué piezas son UI pública y cuáles son la app real

Hay dos mundos dentro del repo:

### Mundo A: la extensión

Lo principal:

- `manifest.json`
- `content.js`
- `service-worker.js`
- `sidebar.css`
- `options.html`
- `options.js`
- `providers/`
- `storage/`
- `rag/`
- `change-documentation/`

Este es el producto funcional.

### Mundo B: la web pública / trust surface

Lo visible hacia fuera:

- `index.html`
- `privacy/index.html`
- `terms/index.html`
- `support/index.html`
- `site.css`

Esto sirve para:

- homepage pública
- política de privacidad
- términos
- soporte

No forma parte del runtime principal dentro de ServiceNow, pero sí forma parte del producto en sentido de confianza, publicación y presentación.

Es como el escaparate y la documentación legal de una tienda.
No cocina la comida, pero ayuda mucho a que la gente entre con confianza.

---

## 15. Qué NO hay en este proyecto

Esto también ayuda mucho a entenderlo.

No hay:

- React en la extensión principal
- backend obligatorio en la nube
- base de datos propia del producto
- autenticación de usuario obligatoria
- cuenta central necesaria para usarlo

### Por qué eso importa

Porque el producto actual apuesta por un enfoque muy claro:

**extensión ligera + configuración local + proveedor elegido por el usuario**

Eso hace que el producto sea:

- más simple
- más transparente
- más fácil de probar
- menos dependiente de infraestructura propia

También tiene un coste:

- algunas cosas complejas hay que resolverlas con cuidado dentro del modelo de extensión
- la UX depende mucho de cómo ServiceNow renderiza su interfaz

Pero en conjunto, para esta fase del producto, tiene bastante sentido.

---

## 16. Por qué `all_frames: true` en el manifest

Esto aparece en `manifest.json` y también está remarcado en `CLAUDE.md`.

### Qué significa

La extensión se inyecta en todos los frames, no solo en la página principal.

### Por qué hace falta

Porque ServiceNow mezcla:

- frame principal
- `gsft_main`
- iframes
- related lists
- layouts que no siempre están donde esperarías

Si la extensión se inyectara solo en un sitio, te arriesgas a que:

- en unos formularios funcione
- en otros no
- y en otros "casi", que es la categoría más irritante de todas

Así que `all_frames: true` no es capricho.
Es supervivencia.

---

## 17. Por qué el proyecto separa tanto responsabilidades

Verás que el repo insiste mucho en separar:

- UI del panel
- detección de contexto
- llamadas a providers
- settings
- RAG
- documentación de cambios

### Por qué esto es bueno

Porque cuando una app crece, si todo vive en dos archivos gigantes, pasa esto:

- cada cambio da miedo
- arreglas una cosa y rompes otra
- entender el proyecto se vuelve agotador

Aquí, aunque hay piezas grandes como `content.js`, el proyecto intenta mantener una lógica bastante limpia:

- la capa visual de ServiceNow
- la capa de coordinación en background
- la capa de providers
- la capa de conocimiento
- la capa de settings

Eso hace que el sistema sea más comprensible incluso para alguien generalista.
No trivial, pero sí razonable.

---

## 18. Si tuvieras que explicárselo a otra persona en 30 segundos

Podrías decir algo así:

> "Es una extensión MV3 de Chrome hecha sobre todo en JavaScript vanilla.  
> Se inyecta en ServiceNow con un content script que detecta scripts y Update Sets, pinta un panel lateral y recoge contexto.  
> La parte de IA vive en un service worker que resuelve provider, construye prompt, aplica RAG si toca y hace streaming de la respuesta.  
> La configuración se gestiona en una página de opciones propia y guarda secretos en local, no en sync.  
> Además tiene una capa específica para documentar Update Sets y una pequeña web pública para privacidad, términos y soporte."

Y sí, suena bastante más elegante de lo que parece cuando uno abre el repo por primera vez.

---

## 19. Qué archivos miraría yo para entender el proyecto poco a poco

Si quieres aprenderlo sin ahogarte, este es un orden bastante amable:

1. [README.md](/c:/Dev/ServiceNow-Copilot-Extension/README.md)
2. [manifest.json](/c:/Dev/ServiceNow-Copilot-Extension/manifest.json)
3. [content.js](/c:/Dev/ServiceNow-Copilot-Extension/content.js)
4. [service-worker.js](/c:/Dev/ServiceNow-Copilot-Extension/service-worker.js)
5. [storage/schema.js](/c:/Dev/ServiceNow-Copilot-Extension/storage/schema.js)
6. [providers/manager.js](/c:/Dev/ServiceNow-Copilot-Extension/providers/manager.js)
7. [options.js](/c:/Dev/ServiceNow-Copilot-Extension/options.js)
8. [rag/engine.js](/c:/Dev/ServiceNow-Copilot-Extension/rag/engine.js)
9. [change-documentation/planner.js](/c:/Dev/ServiceNow-Copilot-Extension/change-documentation/planner.js)

Ese orden va de:

- visión general
- estructura base
- runtime principal
- coordinación
- configuración
- inteligencia del sistema

O sea, primero el mapa y luego las calles.
Mucho mejor que empezar por el alcantarillado.

---

## 20. Resumen final: la filosofía del proyecto

La sensación que transmite esta app, viéndola por dentro, es esta:

- **quiere ser útil de verdad**
- **quiere respetar cómo funciona ServiceNow**
- **quiere evitar humo innecesario**
- **quiere ser flexible con providers**
- **quiere mantener control local y transparencia**

No está construida como una demo bonita de IA.
Está construida como una herramienta para trabajar.

Y eso se nota en decisiones como:

- usar vanilla JS
- separar content script y service worker
- guardar secretos con cuidado
- usar RAG selectivo
- estructurar los Update Sets antes de mandarlos al modelo
- publicar privacy/terms/support como parte seria del producto

En resumen:

**tu app está montada como una extensión pragmática, no como una caja mágica.**

Y sinceramente, eso suele acabar mejor.

---

## 21. Si quieres seguir aprendiendo

Si más adelante quieres, puedo prepararte cualquiera de estas guías también:

- una **guía visual del flujo completo** tipo diagrama paso a paso
- una **guía archivo por archivo** en plan "qué toca cada uno"
- una **guía de debugging** para que sepas dónde mirar cuando algo falla
- una **guía de arquitectura para no técnicos** todavía más resumida

La idea no es que memorices todo esto.
La idea es que el proyecto deje de parecer una máquina misteriosa y empiece a sentirse como algo tuyo, entendible y manejable.

