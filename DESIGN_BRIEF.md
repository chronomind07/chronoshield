# ChronoShield — Design Brief para Rediseño Completo

> Documento de referencia para Claude Design. Describe el estado actual del producto:
> estructura de páginas, design system, tokens, componentes y descripción visual de cada pantalla.

---

## 1. Contexto del Producto

**ChronoShield** es un SaaS de ciberseguridad para inmobiliarias. Monitoriza dominios, emails
y detecta brechas de seguridad en tiempo real.

**Stack frontend:** Next.js 14 (App Router) · React 18 · TypeScript 5.6 · Tailwind CSS 3.4 · Supabase Auth

**Planes de producto:**
| Plan     | Precio actual | Precio desde mes 2 | Límites |
|----------|--------------|-------------------|---------|
| Free     | 0 €          | —                 | 1 dominio, 0 emails |
| Starter  | 24 €/mes     | 29,99 €/mes       | 1 dominio, 5 emails, 5 créditos |
| Business | 59 €/mes     | 68,99 €/mes       | 2 dominios, 15 emails, 15 créditos |

---

## 2. Mapa de Rutas (todas las páginas)

### Páginas Públicas
| Ruta | Descripción |
|------|-------------|
| `/` | Landing page principal (Hero, Features, How It Works, Pricing, Extension promo, Footer) |
| `/login` | Login + Register en una misma página (modo switchable) |
| `/forgot-password` | Formulario de recuperación de contraseña por email |
| `/reset-password` | Reset con token (enlace de email) |
| `/select-plan` | Selección de plan Starter / Business (post-registro) |
| `/contacto` | Formulario de contacto |
| `/privacidad` | Política de privacidad |
| `/terminos` | Términos y condiciones |
| `/cookies` | Política de cookies |

### Dashboard (requiere auth)
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Overview: score ring, KPI cards, últimas alertas, resumen dominios |
| `/dashboard/domains` | Lista y gestión de dominios monitorizados |
| `/dashboard/emails` | Emails monitorizados + resultados de brecha |
| `/dashboard/alerts` | Centro de alertas (activas + resueltas, filtros) |
| `/dashboard/darkweb` | Monitor de Dark Web (emails comprometidos) |
| `/dashboard/assistant` | ChronoAI chat (análisis de seguridad con Claude Haiku) |
| `/dashboard/uptime` | Monitoreo de disponibilidad por dominio (timeline visual) |
| `/dashboard/history` | Historial de eventos con filtros (categoría, fecha, problemas) |
| `/dashboard/reports` | Generación y descarga de informes (NIS2, semanales, mensuales) |
| `/dashboard/settings` | Preferencias de notificaciones, idioma, perfil |

### Admin (requiere rol admin/superadmin)
| Ruta | Descripción |
|------|-------------|
| `/admin` | Estadísticas globales de la plataforma |
| `/admin/users` | Listado y gestión de usuarios |
| `/admin/users/[id]` | Detalle de usuario individual |
| `/admin/leads` | Gestión de leads y waitlist Enterprise |
| `/admin/audit` | Log de auditoría del sistema |
| `/admin/platform` | Métricas de plataforma (MRR, churn, etc.) |
| `/admin/team` | Gestión del equipo interno |

---

## 3. Layout del Dashboard

El dashboard usa un layout compartido en `src/app/dashboard/layout.tsx`:

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (220px fijo, position: fixed)                       │
│  ┌──────────────────────┐                                    │
│  │ Logo ChronoShield    │  ← height: 64px, border-bottom    │
│  ├──────────────────────┤                                    │
│  │ PRINCIPAL            │  ← sección label uppercase        │
│  │   Overview           │                                    │
│  │   AI Assistant       │                                    │
│  │   Dark Web           │                                    │
│  ├──────────────────────┤                                    │
│  │ MONITOR              │                                    │
│  │   Emails             │                                    │
│  │   Dominios           │                                    │
│  │   Alertas     [3]    │  ← badge rojo con unread count     │
│  ├──────────────────────┤                                    │
│  │ [Avatar] usuario ∨   │  ← profile dropdown               │
│  └──────────────────────┘                                    │
│                                                              │
│  TOPBAR (height: 64px, position: fixed, left: 220px)        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🏠 Dashboard › Título página    [créditos] [🔔 3]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  MAIN CONTENT (margin-left: 220px, padding-top: 64px)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [Banner upgrade FREE si aplica]                     │   │
│  │  {children} — contenido de cada página               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Profile dropdown** (abre hacia arriba desde el footer del sidebar):
- Nombre + email del usuario (no clickable)
- Links: Disponibilidad, Historial, Informes
- Toggle de tema: Claro / Oscuro / Sistema
- Links: Ajustes, Cerrar sesión

---

## 4. Design System — Tokens

### 4.1 Paleta de Colores (modo oscuro, por defecto)

```css
/* Fondos */
--bg:           #0b0b0b   /* fondo base, toda la app */
--surface:      #151515   /* superficies: sidebar, cards, inputs */
--card:         #151515   /* tarjetas */
--card-hover:   #1c1c1c   /* tarjetas en hover */

/* Bordes */
--border:       #1a1a1a   /* bordes estándar */
--border-hover: #262626   /* bordes en hover */

/* Texto */
--text-1:  #f5f5f5   /* texto principal, headings */
--text-2:  #b3b4b5   /* texto secundario, subtítulos */
--text-3:  #71717a   /* texto terciario, labels, placeholders */

/* Accent (verde mint — color de marca principal) */
--accent:     #3ecf8e              /* accent base */
--accent-dim: rgba(62,207,142,0.10) /* accent translúcido para fondos */

/* Semánticos */
--danger:     #ef4444              /* errores, alertas críticas */
--danger-dim: rgba(239,68,68,0.10)
--warn:       #f59e0b              /* advertencias */
--warn-dim:   rgba(245,158,11,0.10)
--info:       #3b82f6              /* información */
--info-dim:   rgba(59,130,246,0.10)
```

**Landing page** usa variantes ligeramente diferentes:
```
Fondo: #050507 / #0b0b0b
Texto bright: #f0f0f5
Texto muted: #9999ad
Accent landing: #00e5bf / #00ffd5  (cian más brillante)
Accent alternativo: #3ecf8e (mint)
```

### 4.2 Paleta Modo Claro `[data-theme="light"]`

```css
--bg:           #f5f5f7
--surface:      #ffffff
--card:         #ffffff
--card-hover:   #f0f0f2
--border:       #e0e0e5
--border-hover: #d0d0d8
--text-1:       #1a1a2e
--text-2:       #4a4a5e
--text-3:       #8a8a9e
--accent:       #00c4a3   /* variante más apagada del mint para light */
```

### 4.3 Tipografía

| Variable CSS | Fuente | Pesos | Uso |
|---|---|---|---|
| `--font-dm-sans` | DM Sans | 300–800 | Body, UI, navegación (fuente principal) |
| `--font-dm-mono` | DM Mono | 300, 400, 500 | Código, tokens, labels uppercase, badges |
| `--font-serif` | Instrument Serif | 400 (normal + italic) | Títulos hero de la landing |
| `--font-jakarta` | Plus Jakarta Sans | 300–800 | Subtítulos y descripciones en landing |
| `--font-syne` | Syne | variable | Disponible, uso puntual en marcas |

**Escala tipográfica utilizada:**
```
0.6rem  — micro labels (uppercase, tracking 0.15em)
0.68rem — meta texto, timestamps, ayudas
0.72rem — labels de sección, subtexto
0.78rem — texto secundario en cards
0.82rem — body text estándar
0.875rem — body/descripciones
0.9rem  — botones
1rem    — headings pequeños
1.5rem  — títulos de página
2.4rem  — precio en tarjetas de plan
clamp(1.8rem, 4vw, 2.6rem) — select-plan h1
clamp(3rem, 6.5vw, 5.5rem) — hero landing
```

### 4.4 Espaciados y Radios

```
Sidebar width:   220px
Topbar height:    64px
Card padding:   16–20px (interior) / 24–36px (páginas públicas)
Card radius:     12–16px (dashboard) / 20px (landing/select-plan)
Border width:    0.8px (dashboard) / 1px (landing, componentes)
Gap estándar:    8–12px (elementos inline) / 16–24px (grids)
Max width content: 860px (reports) / 900px (select-plan) / 1100px (landing pricing)
```

### 4.5 Sombras y Efectos

```
Card shadow:     0 8px 32px rgba(0,0,0,0.4)
Glow accent:     0 0 24px rgba(62,207,142,0.15)
Glow danger:     0 0 0 4px rgba(239,68,68,0)  [animado]
Topbar blur:     backdrop-filter: blur(12px), background rgba(11,11,11,0.85)
Noise overlay:   SVG fractalNoise, opacity 0.018, fixed position, z-index 9999
Ambient orbs:    radial-gradient verde/índigo, fixed, animados (float/breathe)
```

---

## 5. Componentes Reutilizables

### 5.1 Navigation Item (`NavItem`)
```
Altura: auto (padding 10px 11px)
Radio: 6px
Activo: background rgba(240,240,240,0.18), color #f5f5f5, weight 500
Inactivo: color #b3b4b5, weight 400
Hover: color #e5e5e5, background rgba(255,255,255,0.06)
Accento izquierdo: pseudo ::before, 2px verde, animado en height al hover
Hover effect: translateX(2px)
Badge (unread): min-width 18px, height 18px, bg #ef4444, radius 9px, mono font
```

### 5.2 Toast System (custom, no react-hot-toast)
```
Posición: fixed top-right (top: 16px, right: 16px)
Width: 320px
Background: #161616
Border: 1px solid #222222
Radius: 12px
Animación entrada: translateX(110%) → translateX(0), 250ms ease-out
Animación salida: translateX(0) → translateX(110%), 200ms ease-in
Progress bar: 2px en bottom, anima de 100% → 0% en 4s (color por tipo)
Tipos: success (#3ecf8e), error (#ef4444), warning (#f59e0b), info (#3b82f6)
Icono: círculo 28px de fondo semitransparente + símbolo central
```

### 5.3 WelcomeToast
```
Tipo: standalone (no usa el sistema de toast)
Icono: SVG escudo + rayo, fondo rgba(62,207,142,0.08), border accent
Border-left: 3px solid #3ecf8e (accent)
Glow icono: drop-shadow animado 4px→10px, ciclo 2.4s
Entrada: cubic-bezier(0.22, 1, 0.36, 1), bounce overshoot -7px
Duración: 3 segundos
Trigger: sessionStorage "cs-welcome" = "1" (set en login, consume en layout)
```

### 5.4 FeatureGate
```
Propósito: bloquear contenido de páginas premium para usuarios free
Features cubiertos: emails, alerts, darkweb, assistant, reports, history, uptime
Muestra: overlay con slides de demo, botón "Ver demo" + "Mejorar plan"
```

### 5.5 ScoreRing
```
Tipo: SVG multi-anillo animado
Métricas: SSL, Uptime, Email Security, Dark Web (breach)
Formula: overall = breach*0.30 + ssl*0.25 + uptime*0.25 + email_sec*0.20
Grades: A+(≥95), A(≥90), B(≥80), C(≥70), D(≥60), F(<60)
Colores: verde (#3ecf8e) alto score → rojo (#ef4444) bajo score
Animación: orbiting particles CSS + score glow radial
```

### 5.6 Skeleton Loaders
```
Clase: cs-skeleton
Animación: linear-gradient shimmer, 400px background-size, 1.4s infinite
Variantes:
  - SkeletonBlock: primitiva genérica (w, h, radius configurables)
  - OverviewSkeleton: score ring + 4 KPI cards + 3 alert rows
  - DomainsSkeleton: header + add-card + 2 domain rows con badges
  - GenericPageSkeleton: header + stat cards + N content rows
```

### 5.7 Metric Cards (`m-card`)
```
Background: var(--card) = #151515
Border: 1px solid var(--border)
Radius: 1rem (16px)
Padding: 18px 20px
Hover: background card-hover, border-color border-hover
Variantes por color: v-green, v-accent, v-red, v-amber, v-blue, v-cyan
Cada variante colorea el icono, badge y progress bar en su color semántico
Progress bar: 2px, animada desde 0 con progressGrow keyframe
```

---

## 6. Animaciones y Transiciones

### Globales
```css
csFadeUp:    opacity 0→1 + translateY(18px→0), 0.45s cubic-bezier(.4,0,.2,1)
csPageIn:    opacity 0→1 + translateY(8px→0), 0.3s — transición entre páginas
csSkeleton:  shimmer gradient, 1.4s ease infinite
csDropUp:    opacity 0→1 + translateY(6px→0), 0.18s — dropdown del perfil
```

### Landing Page
```css
titleReveal:  translateY(32px→0) + opacity, 1s cubic-bezier(0.16,1,0.3,1)
fadeInDown:   translateY(-16px→0), 0.8s
shimmer:      translateX(-100%→100%), 0.6s — hover en botones CTA
reveal:       clase Intersection Observer, 0.9s cubic-bezier
orbBreathe:   scale 1→1.1 + opacity, 8s/12s — orbs de fondo hero
scanMove:     top 15%→82%→15%, 6s linear — línea de escaneo en hero
```

### Dashboard
```css
spin:          rotate 360deg, 0.7s linear — spinners de carga (legacy)
csScoreGlow:  scale 0.95→1.02 + opacity, 3s — anillo de puntuación
csOrbit:      rotate 360deg translateX(84px), 6/9/12s — partículas orbitantes
csAmbFloat:  translateY 0→-24px + scale, 14/18s — orbs de fondo
csBellPulse: box-shadow 0→4px, 2s — notificación sin leer
csWelcomeIn: cubic-bezier spring, overshoot -7px — WelcomeToast
```

**Reducción de movimiento:**
```css
@media (prefers-reduced-motion: reduce) {
  /* Todas las animaciones desactivadas: cs-fadeup, skeleton,
     page transition, orbit, score glow, hover transforms */
}
```

---

## 7. Descripción Visual — Página por Página

### 7.1 Landing Page `/`

**Estructura de secciones:**
1. **Navbar** — fixed, blur on scroll, logo izquierda, nav links centro, CTA + login derecha + toggle idioma (ES/EN)
2. **Hero** — full viewport, dos orbs de color (verde cian + índigo) animados, grid subtle, scan line animada, título serif grande, subtítulo, dos botones CTA + social proof ("500+ inmobiliarias")
3. **StatsBar** — 4 métricas (dominios protegidos, uptime, brechas detectadas, alertas). Números grandes, mono font
4. **Features** — 6 cards en grid 3x2 (feature-card-cs). Cada una: icono SVG pequeño, título, descripción. Border top hover verde
5. **How It Works** — 3 pasos en secuencia (Conecta, Analiza, Protege)
6. **Pricing** — 3 columnas: Starter (gris), Business (featured, border verde, badge "Popular"), Enterprise (coming soon, indigo, waitlist)
7. **Extension Promo** — sección dedicada a la extensión de Chrome
8. **Footer** — links legales, redes sociales, copyright

**Estética:**
- Ultra dark (#050507 fondo), partículas de luz, tipografía serif elegante para títulos
- Accent: verde cian brillante (#00e5bf), no el mint más apagado del dashboard
- Filosofía: luxury dark SaaS, minimalista y premium

---

### 7.2 Login/Register `/login`

**Layout:** dos columnas en desktop (brand panel izquierda, form derecha) — mobile: solo form

**Brand panel izquierda:**
- Fondo gradiente oscuro
- Logo + tagline
- Lista de features con checkmarks verdes

**Form panel derecha:**
- Fondo: #0b0b0b
- Card centrada, maxWidth ~440px
- Tabs login/register o modo switchable con link
- Input estilo: background #151515, border #1a1a1a, radius 8px, focus border #3ecf8e
- Google OAuth: botón outline con icono Google multicolor
- Error: texto rojo #ef4444 bajo el formulario
- Password: toggle show/hide con icono ojo SVG

---

### 7.3 Select Plan `/select-plan`

**Layout:** centrado, 2 cards lado a lado (maxWidth 720px)

**Card Starter (gris):**
```
Background: #0f0f0f
Border: 1px solid rgba(255,255,255,0.07)
Precio: ~~29,99€/mes~~ → 24€/mes (precio lanzamiento)
Badge: "PRECIO DE LANZAMIENTO · SOLO EL PRIMER MES" (verde, pill)
Features: lista con SVG checkmarks verdes
CTA: "Empezar con Starter" — botón outline blanco
```

**Card Business (destacada):**
```
Background: linear-gradient(160deg, rgba(62,207,142,0.06), #0f0f12)
Border: 1px solid rgba(62,207,142,0.25)
Badge "Popular": top-center, sobre el borde
Precio: ~~68,99€/mes~~ → 59€/mes
CTA: "Empezar con Business" — botón sólido verde (#3ecf8e)
Hover: glow sutil verde exterior
```

**Footer:** nota legal + "A partir del segundo mes: 29,99€/mes · 68,99€/mes"

---

### 7.4 Dashboard Overview `/dashboard`

**Layout en grid:**
```
┌─────────────────────────────────────────────────────────┐
│ Greeting + fecha + botón "Escanear ahora"               │
├──────────────────────────┬──────────────────────────────┤
│ ScoreRing + desglose     │ 4 KPI cards (2x2 grid)       │
│ (SSL/Uptime/Email/DWeb)  │  Dominios · Emails           │
│                          │  Alertas · Scans realizados  │
├──────────────────────────┴──────────────────────────────┤
│ Alertas recientes (tabla con severidad, título, hora)   │
├──────────────────────────┬──────────────────────────────┤
│ Dominios (lista compacta)│ Emails monitorizados          │
└──────────────────────────┴──────────────────────────────┘
```

**Colores de estado:**
- Score A+ / A: verde (#3ecf8e)
- Score B: azul (#3b82f6)
- Score C/D: amarillo (#f59e0b)
- Score F: rojo (#ef4444)

**Alertas — colores por severidad:**
- critical/high: #ef4444
- medium: #f59e0b
- low: #3b82f6

---

### 7.5 Domains `/dashboard/domains`

**Layout:** lista vertical de cards expandibles

**Cada domain card:**
```
Header: dot de estado (verde/rojo/amarillo) + nombre dominio + botones (Escanear, Eliminar)
Badges: SSL ✓/✗ · Uptime ✓/✗ · SPF ✓/✗ · DKIM ✓/✗ · DMARC ✓/✗
Expandible: detalle de cada check con fecha último scan
Score: número 0-100 + grade (A+/F)
```

**Add domain form:** input + botón al tope de la página (dentro de una card)

---

### 7.6 Emails `/dashboard/emails`

**Layout:** similar a dominios pero para emails monitorizados

**Por email:**
```
Email address + estado activo/inactivo
Breach count: número de brechas encontradas (rojo si > 0)
Última comprobación: timestamp
Botón: Escanear ahora (consume 1 crédito)
Botón: Eliminar
```

**Feature gated** para usuarios Free (requiere plan Starter+)

---

### 7.7 Alerts `/dashboard/alerts`

**Layout:** dos tabs/secciones — Alertas activas + Resueltas

**Por alerta:**
```
Severidad: dot de color + label (CRITICAL/HIGH/MEDIUM/LOW)
Título + mensaje
Timestamp relativo ("hace 3h")
Acciones: Marcar como leída, Archivar
```

**Filtros:** por tipo (breach/ssl/uptime/email_security) + por severidad + búsqueda

**Feature gated** para usuarios Free

---

### 7.8 Dark Web Monitor `/dashboard/darkweb`

**Layout:** resumen en stat cards + lista de findings por email

**Stats:**
- Total emails monitorizados
- Emails comprometidos (rojo si > 0)
- Total brechas encontradas

**Lista de brechas:** por email, con nombre de la brecha, fecha, datos expuestos

**Feature gated** para usuarios Free

---

### 7.9 Uptime `/dashboard/uptime`

**Layout:**
- Selector de dominio (dropdown/pills)
- Range selector: 24h / 7d / 30d
- 4 stat cards: uptime %, tiempo medio respuesta, checks, incidencias
- Timeline visual: barra de segmentos coloreados (verde=up, rojo=down, amarillo=degraded, gris=sin datos)

**Colores de estado:**
```
up:       #3ecf8e (verde)
down:     #ef4444 (rojo)
degraded: #f59e0b (amarillo)
sin datos: #1a1a1a (gris)
```

**Feature gated** para usuarios Free

---

### 7.10 History `/dashboard/history`

**Layout:** timeline de eventos con paginación

**Filtros:** por categoría (domain/email/darkweb/system), fecha, tipo de evento, toggle "solo problemas"

**Cada entrada:**
- Icono por categoría
- Título + descripción del evento
- Timestamp
- Badge de severidad si aplica

**Feature gated** para usuarios Free

---

### 7.11 Reports `/dashboard/reports`

**Layout:** dos secciones — NIS2 compliance + Listado de reportes generados

**NIS2:** checklist de cumplimiento con indicadores verde/rojo

**Reportes generados:** tabla con tipo (manual/weekly/monthly), fecha, botón descarga PDF

**Generación:** modal con selector de tipo y rango de fechas, consume créditos

**Feature gated** para usuarios Free

---

### 7.12 ChronoAI Assistant `/dashboard/assistant`

**Layout:** interfaz de chat

**Mensajes del asistente:** fondo surface, borde accent sutil, icono escudo
**Mensajes del usuario:** fondo accent translúcido, alineado derecha
**Input:** textarea con send button, mostrando créditos restantes

---

### 7.13 Settings `/dashboard/settings`

**Secciones:**
1. Preferencias de notificaciones (toggles por tipo de alerta)
2. Umbrales (días SSL para alerta, umbral bajada de score)
3. Idioma: ES / EN (toggle)
4. Información de cuenta (email, plan actual)
5. Portal de facturación (enlace a Stripe)

---

## 8. Archivos Clave

```
frontend/
├── src/
│   ├── app/
│   │   ├── globals.css                ← Design tokens + animaciones globales
│   │   ├── layout.tsx                 ← Fuentes (next/font), metadata raíz
│   │   ├── page.tsx                   ← Landing page completa
│   │   ├── login/page.tsx             ← Auth unificada
│   │   ├── select-plan/page.tsx       ← Selección de plan
│   │   └── dashboard/
│   │       ├── layout.tsx             ← Sidebar + topbar + CSS inline
│   │       ├── page.tsx               ← Overview dashboard
│   │       ├── domains/page.tsx
│   │       ├── emails/page.tsx
│   │       ├── alerts/page.tsx
│   │       ├── darkweb/page.tsx
│   │       ├── assistant/page.tsx
│   │       ├── uptime/page.tsx
│   │       ├── history/page.tsx
│   │       ├── reports/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── Skeleton.tsx               ← Loading states
│   │   ├── Toast.tsx                  ← Sistema de notificaciones
│   │   ├── WelcomeToast.tsx           ← Toast bienvenida post-login
│   │   ├── FeatureGate.tsx            ← Bloqueo de features por plan
│   │   ├── ScoreRing.tsx              ← Anillo SVG de puntuación
│   │   ├── BuyCreditsModal.tsx        ← Modal compra de créditos
│   │   ├── logos.tsx                  ← LogoFull y variantes
│   │   ├── LangSync.tsx               ← Sincronización idioma
│   │   ├── DynamicMeta.tsx            ← SEO dinámico
│   │   └── legal.tsx                  ← Componentes legales
│   ├── contexts/
│   │   ├── CreditsContext.tsx         ← Balance de créditos
│   │   ├── LanguageContext.tsx        ← ES/EN, función t()
│   │   └── PlanContext.tsx            ← Plan del usuario, isFree
│   └── lib/
│       ├── api.ts                     ← Axios client + todos los endpoints
│       ├── supabase.ts                ← Cliente Supabase
│       ├── translations.ts            ← Diccionario completo ES/EN
│       └── mode-context.tsx           ← Tech mode toggle (terminología técnica)
├── tailwind.config.ts
└── postcss.config.js
```

---

## 9. Dependencias UI Relevantes

| Paquete | Versión | Uso |
|---------|---------|-----|
| `tailwindcss` | 3.4.13 | Utilidades CSS base |
| `@radix-ui/react-dialog` | 1.1.2 | Modales accesibles |
| `@radix-ui/react-dropdown-menu` | 2.1.2 | Dropdowns |
| `@radix-ui/react-tooltip` | 1.1.3 | Tooltips |
| `recharts` | 2.12.7 | Gráficas (uptime timeline) |
| `lucide-react` | 0.447.0 | Iconos (disponible, uso puntual) |
| `date-fns` | 4.1.0 | Formateo de fechas |
| `clsx` + `tailwind-merge` | — | Class utilities |

**No se usa:** Framer Motion, React Spring, ni ninguna librería de animación — todo CSS puro.

---

## 10. Contextos de Estado Global

```typescript
// PlanContext
{ plan: "free" | "trial" | "starter" | "business", isFree: boolean, loading: boolean }

// CreditsContext
{ credits: number | null, decrementCredits(), refreshCredits() }

// LanguageContext
{ lang: "es" | "en", setLang(), t(key: string): string }

// TechMode (lib/mode-context.tsx)
{ techMode: boolean }  // muestra terminología técnica en lugar de friendly
```

---

## 11. Patrones de Código Relevantes para el Diseñador

### Guard de plan para usuarios Free
```tsx
// Patrón estándar en páginas con FeatureGate:
if (!planLoading && isFree) {
  return <FeatureGate feature="alerts" title="..." isFree={isFree}><></></FeatureGate>;
}
if (!data) return null;
// ... contenido real
```

### Skeleton en loading
```tsx
if (loading) return <GenericPageSkeleton rows={5} statCards={3} />;
```

### Internacionalización
```tsx
const { t } = useTranslation();
// t("nav.overview") → "Resumen" (ES) o "Overview" (EN)
// Fallback: t(key) ?? key (si no existe la key, devuelve la key misma)
```

---

*Generado automáticamente el 2026-04-18. Refleja el estado actual del codebase.*
*Para rediseño: mantener compatibilidad con los contextos de estado y rutas existentes.*
