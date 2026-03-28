# Guia de publicacion personal

Esta guia es para ti, humano valiente, no para el navegador ni para el algoritmo.

La idea es muy simple: separar lo que solo puedes hacer tu de lo que ya puede dejarte preparado el repo. Si sigues esto en orden, reduces bastante la probabilidad de publicar algo a medias y luego descubrirlo con una review de tienda o, peor, con un usuario real.

## Antes de empezar

Necesitas tener a mano:

- una instancia de ServiceNow donde puedas probar sin miedo
- Chrome y Edge
- al menos las credenciales de los providers que quieras validar de verdad
- paciencia razonable y algo de cafe, aunque el cafe no es obligatorio a nivel de protocolo

Apoyate en estos docs:

- [PublicLaunchChecklist.md](./PublicLaunchChecklist.md)
- [SmokeTestChecklist.md](./SmokeTestChecklist.md)
- [Plantilla-Resultados-Smoke.md](./Plantilla-Resultados-Smoke.md)

## Tu mision, en version muy clara

### 1. Deja listas las cuentas de publicacion

Haz esto primero para no llegar al final y descubrir que falta el peaje administrativo:

1. Verifica la cuenta de Chrome Web Store publisher.
2. Verifica la cuenta de Microsoft Partner Center para Edge Add-ons.
3. Confirma que puedes entrar, crear draft y subir assets.

Si una de las dos cuentas no esta lista, no estas bloqueado tecnicamente, pero si estas bloqueado de verdad. Es la version burocratica de un `return false`.

### 2. Haz el smoke test real en Chrome

1. Instala la extension unpacked.
2. Abre Options desde el toolbar.
3. Guarda settings.
4. Exporta settings y confirma que el aviso sobre secretos se ve.
5. Importa ese mismo fichero y comprueba que todo vuelve a renderizar bien.

Despues valida providers:

- Anthropic
- OpenAI
- Gemini
- OpenRouter
- Custom Endpoint
- Local LLM

Para cada provider, haz como minimo esto:

1. `Save configuration`
2. `Test connection`
3. una accion real sobre un script
4. confirmar que la respuesta llega o que el error es claro

### 3. Valida contextos soportados

No hace falta volverse poeta aqui. Solo comprobar que funciona donde decimos que funciona:

- Business Rules
- Script Includes
- Client Scripts
- Fix Scripts
- UI Actions
- Scripted REST Resources
- Scheduled Scripts
- Update Sets

En los contextos de script, intenta al menos una accion real de las importantes:

- `Explain`
- `Ask`
- `Refactor`
- `Comment`
- `Document`

No hace falta ejecutar las cinco en todos los contextos si ya has cubierto el flujo con cabeza, pero si uno da guerra, anotalo.

### 4. Valida los contextos que podrian ascender de categoria

Estos tres solo entran en promesa publica si pasan bien:

- UI Scripts
- Transform Scripts
- Background Scripts

Regla sencilla:

- si funcionan de forma consistente en Chrome y Edge, podemos considerar promoverlos
- si fallan, si son raros, o si dependen de demasiados "si haces esto primero, luego reinicias, y rezas un poco", se quedan como experimentales

### 5. Haz la prueba seria de Update Sets

Prueba:

1. `Document UpdateSet` en `List-first`
2. `Document UpdateSet` en `Deep`
3. que el execution trace avance por captura, prompt, generacion y descarga

Si `Deep` se rompe en una instancia muy custom, no asumas automaticamente que todo esta roto. Apunta si el problema parece del producto o del contexto de esa instancia.

### 6. Repite lo esencial en Edge

No hace falta sufrirlo todo dos veces al maximo nivel, pero si repetir lo importante:

1. instalacion limpia
2. toolbar
3. options
4. providers
5. uno o varios scripts soportados
6. Update Sets
7. UI Scripts, Transform Scripts y Background Scripts

La clave aqui es confirmar que Edge no te regala una sorpresa de ultima hora.

## Como apuntar resultados sin odiar tu propia vida

Usa la plantilla:

- [Plantilla-Resultados-Smoke.md](./Plantilla-Resultados-Smoke.md)

Rellena una fila por caso real. Lo importante es que cada fallo tenga:

- navegador
- provider
- contexto
- accion
- `PASS` o `FAIL`
- sintoma corto

Si un fallo necesita una novela para explicarse, seguramente aun no esta bien entendido. Mejor dejar una frase corta y luego pasarme repro limpio.

## Que me tienes que pasar si algo falla

Si ves un problema raro, mandame:

1. navegador
2. provider
3. contexto
4. accion
5. que esperabas
6. que paso en realidad
7. error visible, si existe
8. si se reproduce tras recargar extension y refrescar la pagina

Con eso ya puedo trabajar bastante bien. Sin eso, entramos en la noble disciplina de "a ver si lo adivino", que no suele dar buenos resultados.

## Assets y submission

Cuando la parte tecnica este limpia y las pruebas esten razonablemente bien:

1. Haz las screenshots finales con la UI actual.
2. Prepara:
   - icono 128x128
   - small promo tile
   - release notes
3. Revisa el listing para que diga claramente:
   - que el usuario trae su propio provider o endpoint
   - que el soporte es best-effort
   - que esto no promete correccion garantizada ni afiliacion oficial con ServiceNow

## Mini checklist final de "vale, ahora si"

Marca esto antes de enviar:

- Chrome pasa el smoke basico
- Edge pasa el smoke basico
- los providers importantes responden bien o fallan de forma clara
- Update Sets funciona en `List-first` y `Deep`
- ya tienes screenshots y assets finales
- las cuentas de Chrome y Edge estan listas
- el listing dice BYO provider, best-effort support y alcance real
- los contextos experimentales solo se promocionan si han pasado de verdad

Si todo eso esta en verde, ya no estas improvisando. Estas publicando.
