# Plan de salida pública en dos carriles: tú + yo

## Resumen

Objetivo: dejar la extensión lista para publicación pública en **Chrome Web Store y Edge Add-ons a la vez**.

Decisión tomada: vamos a **intentar incluir UI Scripts, Transform Scripts y Background Scripts** en la promesa pública, pero solo si pasan una validación manual seria. Si uno falla, no hay drama ni heroísmo innecesario: vuelve a estado experimental y no se promete en público.

Interfaces públicas que podrían cambiar:
- No hay cambios de API/runtime previstos por este plan.
- Sí puede cambiar la **promesa pública** en `README`, wiki y páginas públicas según el resultado de la validación manual de esos tres contextos.

## Plan para ti: guía de burro, sin magia negra

### 1. Prepara el terreno
1. Crea o verifica tus cuentas de publicación:
   - Chrome Web Store publisher account.
   - Microsoft Partner Center para Edge.
2. Ten a mano:
   - una instancia real de ServiceNow donde puedas probar sin miedo,
   - credenciales reales de los providers que quieras validar,
   - Chrome y Edge con perfiles limpios o casi limpios.
3. Usa como referencia estos docs:
   - `[PublicLaunchChecklist.md](/c:/Dev/ServiceNow-Copilot-Extension/docs/release/PublicLaunchChecklist.md)`
   - `[SmokeTestChecklist.md](/c:/Dev/ServiceNow-Copilot-Extension/docs/release/SmokeTestChecklist.md)`

### 2. Haz la prueba manual que yo no puedo hacer por ti
1. En **Chrome**:
   - instala la extensión unpacked,
   - abre Options desde el toolbar,
   - guarda settings,
   - exporta/importa settings,
   - comprueba que todo sigue viéndose bien.
2. Para cada provider:
   - Anthropic
   - OpenAI
   - Gemini
   - OpenRouter
   - Custom Endpoint
   - Local LLM
3. En cada provider haz al menos:
   - `Save configuration`
   - `Test connection`
   - una acción real sobre un script
   - confirmar que la respuesta llega o que el error es claro
4. Valida contextos ya soportados:
   - Business Rules
   - Script Includes
   - Client Scripts
   - Fix Scripts
   - UI Actions
   - Scripted REST Resources
   - Scheduled Scripts
   - Update Sets
5. Valida también los tres contextos que quieres intentar meter en soporte público:
   - UI Scripts
   - Transform Scripts
   - Background Scripts
6. En Update Sets prueba:
   - `Document UpdateSet` en `List-first`
   - `Document UpdateSet` en `Deep`
   - que el execution trace llegue hasta generación y descarga
7. Repite el bloque esencial en **Edge**:
   - instalación limpia,
   - toolbar,
   - options,
   - providers,
   - un smoke real por contexto clave,
   - y de nuevo los 3 contextos experimentales.

### 3. Apunta resultados de forma útil
Usa una tabla muy simple, aunque sea en Notion, Markdown o papel con dignidad:
- navegador
- provider
- contexto
- acción
- resultado: `PASS` / `FAIL`
- nota corta con el síntoma si falla

Regla de oro:
- Si `UI Scripts`, `Transform Scripts` o `Background Scripts` fallan en un navegador, en un provider importante, o de forma inconsistente, **no se incluyen en soporte público**.
- Si sale un fallo raro, me lo pasas con repro corto y paro ahí para arreglarlo.

### 4. Prepara lo que solo tú puedes cerrar
1. Haz las capturas finales de store con la UI real actual.
2. Prepara:
   - icono 128x128,
   - small promo tile,
   - release notes.
3. Revisa que el listing diga claramente:
   - que el usuario trae su propio provider/endpoint,
   - que el soporte es best-effort,
   - que no hay promesa de corrección garantizada ni afiliación oficial con ServiceNow.
4. Cuando yo deje el repo limpio, subes el paquete correcto:
   - generar build,
   - comprimir **solo** `dist/sn-assistant-extension`,
   - subir a Chrome y Edge.

### 5. Criterio humano de “sí, envío”
Puedes enviar cuando se cumplan estas 5 cosas:
1. Chrome y Edge pasan el smoke básico.
2. Los providers importantes responden bien o fallan de forma clara.
3. Ya tienes capturas, assets y cuentas de publicación.
4. La promesa pública coincide con lo que realmente pasó en pruebas.
5. No queda ninguna duda fea tipo “esto funciona a veces si Mercurio está retrógrado”.

## Plan para mí: lo que sí puedo ejecutar desde el repo

### Fase A. Limpieza técnica inmediata
1. Eliminar la dependencia remota de Google Fonts en `[sidebar.css](/c:/Dev/ServiceNow-Copilot-Extension/sidebar.css)` y pasar el panel a fuentes locales/system.
2. Eliminar el `chat.js` duplicado de la raíz y dejar `api/chat.js` como fuente única, verificando antes que no haya imports rotos.
3. Rehacer la comprobación estática de dependencias remotas para confirmar que no quedan fuentes/estilos remotos en superficies de store review.
4. Revalidar empaquetado con `npm run package:extension`.

### Fase B. Alineación documental y de promesa pública
1. Auditar `README`, wiki y páginas públicas para asegurar que la promesa pública está alineada con:
   - storage real,
   - providers reales,
   - soporte best-effort,
   - alcance realmente validado.
2. Esperar tu resultado manual sobre:
   - UI Scripts
   - Transform Scripts
   - Background Scripts
3. Aplicar una de estas dos salidas, sin improvisar:
   - Si pasan de forma consistente en Chrome y Edge, actualizo docs y copy pública para meterlos en soporte público.
   - Si no pasan, los dejo explícitamente como experimentales en todos los sitios donde importe.

### Fase C. Cierre de release técnico
1. Generar una revisión final tipo go/no-go basada en:
   - dependencias remotas eliminadas,
   - paquete generado correctamente,
   - manifiesto y permisos revisados,
   - docs y trust surface consistentes.
2. Dejarte una mini checklist final de submission para que solo tengas que subir y enviar.

## Plan de pruebas y aceptación

### Checks que haré yo
- búsqueda global de fuentes/estilos remotos en superficies relevantes,
- verificación de que no queda referencia útil al `chat.js` duplicado,
- empaquetado correcto con `npm run package:extension`,
- revisión estática de consistencia entre `manifest`, README, wiki y páginas públicas.

### Checks que harás tú
- smoke real en Chrome y Edge,
- validación por provider,
- validación por contexto soportado,
- validación de `Document UpdateSet` en `List-first` y `Deep`,
- decisión factual sobre los 3 contextos experimentales basada en resultados reales.

### Aceptación final
- Launch dual Chrome + Edge listo.
- Sin dependencias remotas problemáticas en la extensión.
- Sin archivos duplicados confusos en el repo.
- Store copy y trust pages alineadas con la realidad.
- Contextos experimentales promovidos solo si han demostrado que se lo merecen.

## Suposiciones y defaults

- Publicación en Chrome y Edge en la misma ola.
- `UI Scripts`, `Transform Scripts` y `Background Scripts` solo entran en soporte público si pasan validación manual consistente.
- Si aparece un bug serio en tus pruebas, el plan cambia de “release” a “arreglo + nueva validación”.
- No se añaden features nuevas para lanzar, salvo que tus pruebas descubran un bloqueo real.
