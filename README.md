# Nexus Ops RTB

Repositorio de documentación para el proyecto **Nexus Ops RTB**: contexto de negocio, diseño de páginas y definición técnica de la plataforma.

## Índices principales

- Contexto (métricas, alcance y bases de datos): [contexto/00_INDICE.md](contexto/00_INDICE.md)
- Diseño de páginas (especificación funcional por pantalla): [diseno_paginas/00_INDICE_PAGINAS.md](diseno_paginas/00_INDICE_PAGINAS.md)
- Estructura del proyecto (arquitectura, stack, despliegue y seguridad): [estructura_proyecto/00_INDICE.md](estructura_proyecto/00_INDICE.md)

## Estructura del repositorio

- `contexto/`: fuente de verdad del negocio (qué se mide y con qué definiciones).
- `diseno_paginas/`: especificación de UI/UX y trazabilidad de métricas (dónde/cómo se muestra).
- `estructura_proyecto/`: guía técnica (arquitectura, backend, frontend, BD, n8n, Docker, seguridad).

## Convenciones de contribución (recomendado)

- Ramas: `docs/tema`, `feature/tema`, `bugfix/tema`
- Commits (Conventional Commits): `docs: ...`, `feat: ...`, `fix: ...`
- Integración: PR hacia `main` con revisión y checks pasando
