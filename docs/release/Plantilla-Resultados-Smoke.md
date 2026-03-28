# Plantilla de resultados de smoke test

Usa esto como plantilla rapida para tus pruebas manuales. No hace falta que quede bonito; hace falta que te permita decidir.

## Resumen rapido

- Fecha:
- Version probada:
- Build o zip usado:
- Resultado general:
- Decision provisional:

## Casos ejecutados

| Navegador | Provider | Contexto | Accion | Resultado | Nota corta |
|---|---|---|---|---|---|
| Chrome | Anthropic | Business Rule | Explain | PASS | |
| Chrome | OpenAI | Update Set | Document UpdateSet Deep | PASS | |
| Edge | Gemini | UI Script | Explain | FAIL | Trigger visible pero respuesta no vuelve |

## Promocion de contextos experimentales

| Contexto | Chrome | Edge | Decision | Nota |
|---|---|---|---|---|
| UI Scripts | PASS/FAIL | PASS/FAIL | Promote / Keep experimental | |
| Transform Scripts | PASS/FAIL | PASS/FAIL | Promote / Keep experimental | |
| Background Scripts | PASS/FAIL | PASS/FAIL | Promote / Keep experimental | |

Regla:

- si un contexto falla en un navegador o de forma inconsistente, se queda experimental
- solo se promueve si pasa con confianza razonable en ambos navegadores

## Fallos que merecen arreglo antes de publicar

| Severidad | Navegador | Provider | Contexto | Sintoma | Repro corta |
|---|---|---|---|---|---|
| Alta |  |  |  |  |  |
| Media |  |  |  |  |  |

## Observaciones finales

- Que fue bien:
- Que sigue dando mala espina:
- Que puedes publicar tal cual:
- Que no deberia prometerse todavia:
