# DADES Design System

This document records the implemented DADES interface. It is an extraction from
`src/styles/recent.css`, `src/styles/glass-interactions.css`,
`src/styles/immersive-pages.css`, `src/styles/wiki-articles.css`,
`src/styles/issue-archive.css`, `src/styles/pattern-surfaces.css`, and the Astro
components that consume those styles. Where Recent measurements and DADES
values differ, the rendered DADES value is the contract and the Recent value is
retained only to explain the translation.

Reference measurements come from:

- `/home/seory0/recent-reference/about-2026-09-06/findings.md`
- `/home/seory0/recent-reference/articles-2026-09-06/report.md`

## 0. Home Editorial Research Log — 2026-09-06

The September 2026 home revision replaces the campaign-like, viewport-snapped
landing sequence with an issue-led magazine front. The evidence baseline is
`artifacts/qa/baseline/home-{desktop,mobile}.png`: the old desktop page measured
roughly 5,000px tall for one five-story issue, reserved near-viewport-height
fields around short copy, repeated the same three stories in multiple sections,
and delayed article summaries until the issue page.

Live editorial references were reviewed on 2026-09-06. Only layout grammar and
content hierarchy are inputs; no brand assets, copy, photography, or proprietary
type is reused.

| Reference | Keep | Explicitly leave behind |
| --- | --- | --- |
| [Monocle](https://monocle.com/) | Publication-scale masthead, section rules, visible issue/read metadata, dense but ordered index | Commerce density, yellow brand color, and its wordmark treatment |
| [Kinfolk Stories](https://www.kinfolk.com/stories/) | Quiet paper field, large image-led browsing, restrained serif/sans hierarchy, issue labels | Lifestyle photography and category copy |
| [AIGA Eye on Design](https://eyeondesign.aiga.org/) | Category-first metadata, short decks, scannable text-led story entries | AIGA identity and archive-specific taxonomy |
| [Wallpaper*](https://www.wallpaper.com/) | One decisive lead, supporting-story hierarchy, strong editorial rails | Advertising and newsletter conversion density |
| [It's Nice That](https://www.itsnicethat.com/) | Compact current-feed rhythm and intentionally varied story scale | Loud campaign graphics and commercial modules |
| [Apartamento](https://www.apartamentomagazine.com/) | Current-issue focus and direct, low-friction navigation | Store banner, membership, and product-card hierarchy |

The selected direction is **the issue desk**: warm paper opens with a very large
DADES nameplate, one cobalt pattern acts as the current issue cover, and every
story in that issue follows immediately in an asymmetric but predictable grid.
The memorable moment is the nameplate-to-cover handoff, not a scroll effect.
Cobalt remains the only action ink; black rules, warm paper, editorial serif,
and mono folios make the page read as a periodical rather than an AI product
landing page.

## 1. Atmosphere & Identity

DADES is a Korean editorial observatory for a noisy AI landscape. It uses a
precise glass capsule for persistent navigation, warm paper for reading, dark
fields for reference and status surfaces, cobalt pattern media for issue art,
and oversized editorial type for a recognisable independent-magazine voice.

The home signature is now a printed-front-page sequence: publication nameplate,
current-issue cover, complete contents, then editor's note and department index.
It uses normal document scroll at every breakpoint. Immersive About and Status
routes retain their scene grammar, while issue and wiki routes retain their
dark-hero-to-paper reading transition.

Implementation authority is layered in this order:

1. `global.css` supplies the reset and legacy magazine primitives.
2. `recent.css` supplies shared DADES tokens, themes, home scenes, reading
   primitives, and footer.
3. `glass-interactions.css` supplies the final chrome dimensions, glass layers,
   menu choreography, wide page modes, and shared reveal behavior.
4. `pattern-surfaces.css` supplies Book of Shapes color fields, blend modes,
   media glow, card backgrounds, and adaptive fallbacks without changing page
   geometry.
5. `home-editorial.css` supplies the home-only nameplate, cover, contents grid,
   editor's note, and department index.
6. A route stylesheet supplies the immersive, wiki/article, or issue/archive
   composition where that route opts into one.

## 2. Color & Material Tokens

### Theme-aware core palette

`paper` is the default. `white` changes the paper ramp but keeps dark ink;
`ink` reverses the shared editorial surfaces. Status colors and the small
electric highlight do not change by theme.

| Role | Token | Paper | White | Ink |
| --- | --- | --- | --- | --- |
| Canvas | `--surface-canvas` | `#f2f1ec` | `#ffffff` | `#111315` |
| Raised surface | `--surface-raised` | `#fbfaf6` | `#f7f8fa` | `#1b1e22` |
| Soft surface | `--surface-soft` | `#e5e5df` | `#eef0f2` | `#282c31` |
| Inverse surface | `--surface-inverse` | `#121416` | `#121416` | `#f3f4f6` |
| Primary text | `--text-primary` | `#17191b` | `#17191b` | `#f3f4f6` |
| Secondary text | `--text-secondary` | `#585d63` | `#555b61` | `#b7bdc5` |
| Inverse text | `--text-inverse` | `#ffffff` | `#ffffff` | `#141619` |
| Structural rule | `--rule-default` | `#c8c9c5` | `#d6d9dc` | `#3a3f45` |
| Soft rule | `--rule-soft` | `#deded8` | `#e9ebed` | `#2a2f34` |
| Primary action | `--accent-primary` | `#315de8` | `#315de8` | `#7698ff` |
| Strong action | `--accent-strong` | `#183ebf` | `#183ebf` | `#9ab0ff` |
| Selected wash | `--accent-wash` | `#dfe7ff` | `#e6ecff` | `#222d55` |
| Electric detail | `--electric-highlight` | `#f1c75b` | `#f1c75b` | `#f1c75b` |
| Stable | `--status-success` | `#287457` | `#287457` | `#287457` |
| Watch | `--status-warning` | `#9a5f13` | `#9a5f13` | `#9a5f13` |
| Changed/error | `--status-error` | `#b63a45` | `#b63a45` | `#b63a45` |

Shared scene fallback material:

| Token | Value | Rendered role |
| --- | --- | --- |
| `--hero-fallback` | `#0b1b49` | Media fallback and cobalt scene base |
| `--hero-scrim-soft` | `rgba(7, 18, 47, 0.2)` | Base hero-scrim stop; replaced on pattern scenes |
| `--hero-scrim` | `rgba(7, 18, 47, 0.4)` | Base hero-scrim stop; replaced on pattern scenes |
| `--media-scrim` | transparent at 38% to `rgba(6, 10, 20, 0.84)` | Base card scrim; replaced on pattern cards |
| `--topic-glow` | cobalt radial glow at 18%/12% plus yellow glow at 82%/74% | Home editorial-lenses atmosphere |
| `--footer-surface` | `#121416` | Persistent dark footer band |
| `--footer-text` | `#ffffff` | Footer primary copy |
| `--footer-text-muted` | `rgba(255, 255, 255, 0.6)` | Footer metadata |
| `--footer-accent` | `#9ab0ff` | Footer link hover |

Book of Shapes exports are integrated through a separate pattern layer:

| Token | Value | Rendered role |
| --- | --- | --- |
| `--pattern-field-dark` | `#07112b` | Deep vector-field base |
| `--pattern-field-mid` | `#102554` | Mid-tone hero field |
| `--pattern-field-soft` | `#233f7c` | Card radial highlight |
| `--pattern-line-glow` | `rgba(126, 157, 255, 0.42)` | SVG line glow |
| `--pattern-gold-glow` | `rgba(241, 199, 91, 0.2)` | Restrained electric-sheep light |
| `--pattern-card-bg` | two cobalt radial gradients over `#07112b` | Base story/media backing field; route backgrounds may override it |

The `--paper`, `--ink`, `--muted`, `--rule`, `--link`, `--wash`, font, and type
variables in `recent.css` are compatibility aliases. Existing magazine
components continue to consume them, but their values resolve back to the core
tokens above.

### Article palette

The wiki uses a fixed dark/light article palette. Issue and archive backgrounds,
dark-field headings, and structural rules also use fixed `--ia-*` values, while
their light-body text and media-overlay text still resolve through shared
theme-aware text tokens.

| Role | Wiki token | Issue/archive token | Value |
| --- | --- | --- | --- |
| Dark page | `--wiki-dark` | `--ia-dark` | `#191919` |
| Dense black | `--wiki-ink` | `--ia-dark-ink` | `#0c0c0c` |
| Cool light copy | `--wiki-light` | `--ia-dark-text` | `#dde0e5` |
| Bright media copy | `--wiki-white` | `--text-inverse` | `#fafaf9`; issue/archive is `#ffffff` in paper/white and `#141619` in ink |
| Muted dark-field copy | `--wiki-muted` | `--ia-dark-muted` | `#a5abb0` |
| Reading paper | `--wiki-paper` | `--ia-light` | `#fbfaf6` |
| Inline article link | `--wiki-link` | `--ia-blue` | `#0099ff` / `#227aff` |
| DADES cobalt | Not used | `--ia-blue-deep` | `#315de8` |
| Source acid accent | Not used | `--ia-green` / `--accent-acid` | `#bef263` |
| Acid pressed state | Not used | `--accent-acid-press` | `#a1ea27` |
| Chrome ink | Not used | `--chrome-ink` / `--chrome-ink-strong` | `#191919` / `#0c0c0c` |

Immersive pages do inherit the selected DADES theme. Their
`--immersive-paper`, `--immersive-ink`, `--immersive-muted`, blue, and rule
tokens are aliases of the core palette. Their full-bleed overlays are fixed at
`rgba(4, 10, 24, 0.48)` for the hero and `rgba(0, 0, 0, 0.5)` for the blurred
foundation scene.

### Color rules

- Cobalt signals DADES actions and editorial selection. It is not an ambient
  purple AI gradient.
- The source acid green has exactly two homes: the issue/archive dark-field link
  language, and the global navigation CTA. The CTA carries Recent's measured
  "Button - Green" recipe — `--accent-acid` fill with a near-black `--chrome-ink`
  label — and inverts on hover/focus to `--chrome-ink-strong` with
  `--accent-acid-press` copy. It is the one accent that does not change by theme,
  because it is brand rather than page ink.
- Hero and card copy never relies on an image alone for contrast; a declared
  scrim sits between media and text.
- Wiki reading copy is fixed black on warm paper. Issue/archive reading paper
  stays warm while its copy resolves through the selected shared theme.
- Pattern SVG strokes use screen compositing. Home, article, and positional card
  variants use declared cobalt fields; later route styles can replace a backing
  without changing the exported stroke colors or semantic action tokens.
- Route-local fixed palettes are deliberate. The footer and article surfaces do
  not pretend to be theme-variable when their CSS is fixed.

## 3. Typography

### Families and translation

| Role | DADES family | Recent measurement translated |
| --- | --- | --- |
| Interface, Korean display, body | `'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif` | Waldenburg Normal/Buch/Halbfett |
| Editorial accent and reading prose | `'Fraunces', Georgia, 'Times New Roman', serif` | Bradford LL Light/Regular |
| Metadata and controls | `'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace` | Aeonik Mono / Fragment Mono |

Pretendard Variable is loaded from the Orioncactus jsDelivr distribution.
Fraunces and IBM Plex Mono are loaded through Google Fonts. Recent's proprietary
font files are reference evidence only and are not shipped by DADES.

### Shared scale

| Level | Token | Size | Weight | Line height | Tracking | Primary use |
| --- | --- | --- | --- | --- | --- | --- |
| Hero | `--type-hero` | `clamp(2.4rem, 5.5vw, 5.25rem)` | 520 | 1.02 | `-0.045em` | Home masthead |
| Nameplate | `--type-nameplate` | `clamp(5rem, 17vw, 14rem)` | 600 | `.72` | `-0.075em` | Home publication name |
| Cover | `--type-cover` | `clamp(2.4rem, 5vw, 5rem)` | 520 | `.98` | `-0.05em` | Current-issue cover title |
| Compact nameplate | `--type-nameplate-compact` | `clamp(5rem, 27vw, 7.25rem)` | 600 | `.74` | `-0.075em` | Home name below 810px |
| Compact cover | `--type-cover-compact` | `clamp(2rem, 9vw, 2.75rem)` | 520 | `1` | `-0.05em` | Home cover title below 810px |
| Display | `--type-display` | `clamp(2.5rem, 5vw, 4.75rem)` | 520 | 1.06 | `-0.04em` | Home scene statements |
| H1 | `--type-h1` | `clamp(2rem, 4vw, 3.75rem)` | 600 | 1.08 | `-0.035em` | Contained reading title |
| H2 | `--type-h2` | `clamp(1.55rem, 2.4vw, 2.4rem)` | 600 | 1.15 | `-0.025em` where applied | Section title |
| H3 | `--type-h3` | `clamp(1.2rem, 1.8vw, 1.6rem)` | 620 | 1.25 | `-0.015em` where applied | Entry/card title |
| Body large | `--type-body-lg` | `clamp(1.1rem, 1.6vw, 1.4rem)` | 430 | 1.55 | `-0.01em` | Deck and intro |
| Body | `--type-body` | `1rem` | 420 | 1.7 | `-0.008em` | Default Korean copy |
| Small | `--type-small` | `0.8125rem` | 500 | 1.45 | `0` | Secondary copy |
| Label | `--type-label` | `0.75rem` | 500–560 | 1.2 | `0.02em–0.08em` | Mono metadata |

### Route-specific measured scale

These values intentionally step outside the fluid shared scale to preserve the
captured editorial compositions.

| Surface | Desktop | Tablet/mobile |
| --- | --- | --- |
| Immersive hero H1 | `60px/60px`, 520, no tracking | `clamp(36px, 10vw, 56px)`, line-height `.96` |
| Immersive foundation/paper H2 | `40px/44px`, 520 | `clamp(30.4px, 9vw, 40px)` |
| Immersive foundation body | `22px/28.6px` | `18px/26.1px` on mobile |
| Immersive paper body | `18px/23.4px` | `15.2px/21.6px` on mobile |
| Wiki listing rail title | `40px/44px` | `30px/33px` below 1200px |
| Wiki featured card title | `21.6px/25.92px` | `18px/23.4px` on mobile |
| Wiki standard card title | `18px/23.4px` | `18px/23.4px` |
| Wiki detail deck | Fraunces `50px/50px`, 360 | Fraunces `26px/26px` on mobile |
| Wiki detail H1 | Pretendard `50px/55px`, 520 | `26px/28.6px` on mobile |
| Wiki reading prose | Fraunces `24px/33.6px` | Fraunces `18px/25.2px` on mobile |
| Issue hero H1 | `50px/55px`, 520 | `26px/28.6px` on mobile |
| Issue entry summary | Fraunces `24px`, line-height `1.42` | `18px`, line-height `1.4` |
| Archive listing H1 | `40px/44px`, 520 | `30px/33px` on mobile |
| Archive media-card title | `21.6px`, line-height `1.2` | `18px`, line-height `1.2` |

Korean headings use `word-break: keep-all`, balanced wrapping, and
`overflow-wrap: anywhere` on the long-form hero systems. Utility labels use
tabular figures and uppercase only where the string is Latin or numeric.

## 4. Spacing, Geometry & Layout Modes

### Spacing and shape tokens

All semantic spacing follows a 4px base.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-1` | `4px` | Optical gap, capsule padding |
| `--space-2` | `8px` | Inline icon/label and dense grid gap |
| `--space-3` | `12px` | Card grid and compact inset |
| `--space-4` | `16px` | Control inset and mobile safe gap |
| `--space-5` | `20px` | Mobile page gutter |
| `--space-6` | `24px` | Card inset and text grouping |
| `--space-8` | `32px` | Component grouping |
| `--space-10` | `40px` | Desktop outer gutter |
| `--space-12` | `48px` | Section header gap |
| `--space-16` | `64px` | Major section rhythm |
| `--space-20` | `80px` | Scene/body transition |
| `--space-24` | `96px` | Maximum shared spacing step |

| Geometry | Token/value | Role |
| --- | --- | --- |
| Wide frame | `--frame-max: 90rem` | Home, footer, and full-width page inset |
| Reading measure | `--reading-max: 48rem` | Default reading pages and issue results |
| Wide article media | `70.5rem` / `1128px` | Issue and wiki hero media |
| Control radius | `--radius-control: 8px` | Small controls and cells |
| Media radius | `--radius-media: 10px` | Story imagery |
| Card radius | `--radius-card: 16px` | Editorial panels |
| Menu radius | `--radius-menu: 20px` | Legacy mobile panel alias |
| Pill radius | `--radius-pill: 999px` | Navigation and controls |

Breakpoints match the captured Framer bands: mobile is `<=809.98px`, tablet is
`810px–1199.98px`, and desktop is `>=1200px`. Desktop wide pages use 40px
gutters, tablet shared frames use 24px, and mobile uses 20px.

### Base layout modes

`Base.astro` accepts `reading`, `listing`, `article`, or `immersive`. The `home`
boolean takes precedence and produces the `home` mode. The mode is emitted on
both body (`mode-*`) and main (`page-*`) so the chrome and route styles can
respond without page-specific JavaScript.

| Mode | Main geometry | Scroll owner and use |
| --- | --- | --- |
| `reading` | Contained `48rem`; `8.75rem` top and `6rem` bottom on desktop; 20px gutters and `4rem` vertical padding on mobile | Normal document scroll for utility/legacy reading pages |
| `home` | Full width, no base padding | Document scroll; mandatory vertical snap at desktop only |
| `listing` | Full width; route stylesheet owns inset | Dark editorial canvases for wiki and archive indexes |
| `article` | Full width; route stylesheet owns dark hero and light body | Normal document scroll for wiki details, issues, and archive tag results |
| `immersive` | Full width and zero padding | Proximity snap at desktop; normal stacked document flow below 1200px |

The shared `48rem` child constraint is scoped to
`.page-reading > :not(.sr-only)` only. Listing, article, immersive, and home
children are not captured by a generic non-home selector.

### Exact glass navigation geometry

Recent's measured desktop shell is `663.42 × 46.20px`, fixed at `top: 30px`,
with a `30px` radius, gray `0.7` alpha fill, and `9px` blur. DADES keeps those
outer measurements exactly in `glass-interactions.css` while adapting the inner
content to six DADES destinations and a dynamic latest-issue CTA.

#### Top capsule (`>=810px`)

| Part | Implemented metric/material |
| --- | --- |
| Fixed wrapper | Full viewport width, `top: 30px`, `z-index: 50`, pointer events disabled outside the shell |
| Shell | `width: min(663.42px, 100% - 40px)`; `min-height: 46.2px`; `padding: 4px`; `border-radius: 30px`; border-box sizing |
| Interior track | `38.2px` available height; brand, nav links, and CTA render at `38px` |
| Fill | Painted on the shell itself at `rgba(212, 215, 222, 0.7)` — no separate fill/highlight layer |
| Blur | `blur(9px)` |
| Rim/depth | Two hairline white insets, `0 0.36px 0.36px -1.375px` at `.08` and `0 3px 3px -2.75px` at `.07`; no outer shadow and no scrolled variant |
| DADES brand slot | Lockup, not a raster: `SheepMark` glyph at `37 × 26px` plus a `DADES` wordmark at Pretendard `17px/700`, `-0.02em`, in a `38px` row with `4.4px` gap |
| Link hit box | `38.2px` high; four primary destinations shown; Pretendard `14px/18.2px`; padding `10px 15px`; `--chrome-ink` at rest, `--chrome-ink-strong` on hover/focus/current |
| Active layer | `inset: 3px`, `rgba(255,255,255,.73)`, `blur(75px)`, opacity `.6`, over a `.46` white base pill |
| Hover layer | `inset: 0`, `rgb(120,124,128)`, `blur(18px)`, opacity `.16` on hover/focus |
| CTA | Recent's "Button - Green": `37px` pill, `9px 15px` padding, `13px/14.3px`, radius `50px`, `--accent-acid` fill with `--chrome-ink` label; inverts to `--chrome-ink-strong` with `--accent-acid-press` copy on hover/focus |

In the `ink` theme the capsule keeps every one of those measurements and only
reverses its material: the shell fill becomes `rgba(46, 51, 58, 0.72)` (desktop
only — on mobile the shell is transparent and the menu panel behind it is the
glass), link and brand ink lift to `--text-primary`, the route-current pill
becomes a `rgba(255,255,255,.12)` wash, and the mobile panel darkens to
`rgba(46, 51, 58, 0.8)`. Without that reversal the light-panel recipe left the
capsule as a pale bar under near-white labels at `1.44:1`. The acid CTA is
deliberately excluded — it is brand, not page ink.

The captured Recent inner row was `650.42 × 38.20px` with a 35px visual gap,
a `116.81 × 26px` logo lockup, `14px/18.2px` links, and a
`121.67 × 37px` CTA. DADES preserves the shell and state-layer measurements,
but its logo slot, 4px flex gaps, labels, and CTA width follow DADES content.

#### Mobile/tablet dock (`<=809.98px`)

| Part | Implemented metric/material |
| --- | --- |
| Position | Fixed `30px + env(safe-area-inset-bottom)` above the viewport bottom |
| Visible shell | `width: min(100% - 40px, 350px)`; `min-height: 42.3px`; `padding: 4px`; `border-radius: 25px` |
| Fill and blur | `rgba(217,217,217,.7)` with `blur(9px) saturate(122%)` |
| Interior controls | `34.3px` high; brand `66px` wide; menu toggle `42px` wide; CTA is `12px` type, capped at `200px`, with 12px horizontal padding |
| Body clearance | `5.75rem + safe-area inset` prevents content from sitting under the dock |
| Menu panel | Same maximum `350px` width; `height: 343.3px`; `max-height: 100svh - 60px - safe-area`; bottom edge aligns with the dock at `30px + safe-area` |
| Menu shape | `25px` radius; 12px side/top padding and `54.3px` bottom padding so the dock overlays its bottom row; 40px link rows |
| Menu motion | Bottom-origin `scaleY(.82)` plus 18px translation to open; six rows stagger by 28ms increments |

At `390 × 844px` with no safe-area inset, the DADES dock is `350 × 42.3px`
at `x=20, y=771.7`, and the expanded panel is `350 × 343.3px` at
`x=20, y=470.7`; both share a bottom edge at `y=814`. Recent measured the same
`350 × 42.3px` visible dock and a `350 × 342.87px` panel at
`x=20, y=471.12`, so DADES now follows the captured outer geometry while using
40px rows to fit its six routes.

## 5. Components & Page Patterns

### Shared shell

#### `Base`

- **Structure:** metadata, theme bootstrap, skip link, `SiteHeader`, mode-aware
  `<main id="main">`, `SiteFooter`, and small native client scripts.
- **Variants:** the five layout modes above.
- **State:** selected theme, menu state, scroll depth, reveal state, clip count,
  interest highlighting, and visit baseline.
- **Accessibility:** Korean document language, canonical/OG metadata, skip link,
  semantic main landmark, and preference-aware initialization before paint.

#### `SiteHeader` / capsule navigation

- **Structure:** a single self-filling glass capsule (no separate fill/highlight
  layers), a linked `SheepMark` + `DADES` wordmark lockup, four desktop
  destinations, hamburger/X toggle, acid latest-issue CTA, and one six-link
  mobile panel closing with RSS/GitHub links.
- **States:** default, scrolled, route-current, link hover/focus, CTA
  hover/focus/press, menu closed/open, and forced colors.
- **Behavior:** opening moves focus to the first link; Escape and outside click
  close; crossing into `min-width: 810px` closes; closed content is both
  `aria-hidden` and `inert`; the toggle label and `aria-expanded` stay in sync;
  page scroll locks while open.
- **Motion:** 160ms color/highlight response and 260ms spatial response. The
  two hamburger lines rotate into an X.

#### `SiteFooter`

- **Structure:** pale inset field, large cobalt latest-issue link, DADES mark,
  utility links, three theme buttons, colophon metadata, and linked Book of
  Shapes/Nikolaj Sokolowski pattern credit.
- **Desktop:** 40px outer inset; CTA minimum height is
  `min(38rem, 72svh)`; footer grid is brand / links / metadata.
- **Mobile:** 20px outer inset; CTA minimum height is `27rem`; action expands to
  full width and the footer grid becomes one column.
- **State:** CTA rises 3px and deepens its shadow; its inner action shifts 8px.
  Theme buttons expose the selected state through `aria-pressed`.

### Home: issue desk

The home owns normal document scroll at every breakpoint. It does not force a
reader through viewport-sized scenes and does not reserve blank space to make
short copy fill a screen.

| Region | Desktop composition | Mobile composition |
| --- | --- | --- |
| Publication nameplate | 90rem frame below the fixed capsule; mono identity line, `DADES` at `--type-nameplate`, then a ruled issue strap | 20px gutters; nameplate stays on one line, issue strap becomes a compact two-row folio |
| Current cover | `7 / 5` editorial split; 3:2 cobalt pattern lead at left, issue title/deck/signals/action at right | One column; art first at 4:3, then title, concise deck, signals, and full-width action |
| Complete contents | Twelve-column asymmetric grid: lead story spans 7 columns, second spans 5, remaining stories use a balanced three-column row; every item carries image, section/origin, title, and a short deck | One-column reading list below 672px; at 672–809px the lead stays full width and supporting stories form two columns. No horizontal carousel and stable document order |
| Editor's note / departments | Ruled `5 / 7` split; mission and visit pulse at left, source-based department list at right | One column with note first and department rows below |
| Past issues, when present | Framed semantic issue table after the current issue | Same table in document flow |
| Footer | Normal footer; home CTA is capped at `min(26rem, 52svh)` rather than a full-viewport scene | Normal footer above fixed dock clearance; home CTA is 22rem |

`Masthead` is now semantic issue-front content and contains no pointer-tracking
script. The current-cover link reuses the documented story-media hover/focus
mechanism: a small image scale and color lift indicate clickability; reduced
motion removes the transform without removing the state change.

#### Home primitives

- **Publication nameplate:** identity line, publication name, and issue strap.
  It is typographic rather than a raster logo and has no interactive state.
- **Current cover:** one linked pattern-art surface plus an issue brief. States
  are default, hover/focus, press, and reduced motion; the link has an explicit
  Korean accessible name.
- **Story tile:** a semantic `<article>` with one media link and one title link
  to the same issue anchor. The deck remains visible. Variants are lead,
  secondary, and standard; all use the same metadata and state contract.
- **Department row:** index, Korean source label, first story title, and count in
  a ruled link row. Hover/focus shifts only the title by `--space-2`.
- **Editor's note:** text-only mission block with an optional enhanced
  `HomePulse`; hidden pulse state does not reserve space.

`HomePulse` is text-first enhancement. It reads a session-stable visit baseline
and browser-local interests, then reports new issues, action signals, status
changes, and interest hits. With no baseline it remains hidden; no server state
or layout reservation is required.

### About and Status: immersive scenes

The shared `ImmersiveHero` is a full-viewport media scene with a radial/linear
scrim, centered copy, and an optional glass definition list. Desktop stats use
the CSS default of five equal tracks inside a `58rem` panel, 40px from the
bottom, with `30px` blur and `140%` saturation. Status fills all five tracks;
About supplies four items and therefore leaves the fifth track unpopulated.
Below 1200px the list becomes a two-column panel; on mobile it sits 128px above
the viewport bottom. With no safe-area inset, that leaves a 55.7px gap above
the dock's top edge.

The common scene grammar is:

| Scene | Desktop | Below 1200px |
| --- | --- | --- |
| Hero | `100svh`, centered, snap-aligned | Still `100svh`; content and stats reposition for the dock |
| Foundation | `100svh`, full media, black `.5` overlay, `30px` backdrop blur, centered 54rem copy | Auto height with 144px vertical padding |
| Paper | `100svh`, 40px horizontal inset, `clamp(128px,11vw,160px)` top padding, `.9fr / 1.1fr`, 64px gap | Auto height, 20px inset, single block flow |

At desktop, the immersive document uses `scroll-snap-type: y proximity` and the
footer is a snap start. Below 1200px the foundation and paper scenes return to
auto height with no snap alignment; the immersive hero deliberately remains
`100svh`.

About uses this exact sequence:

1. DADES premise hero with four summary facts.
2. Blurred foundation statement.
3. Three editorial values in equal columns with a 304px minimum card height on
   desktop; below 1200px they become one auto-height column.
4. Four capability links in 112px rows that invert to cobalt on hover/focus;
   mobile reduces their minimum height to 96px.
5. Colophon rows that pair mono labels with production details.

Status uses this sequence:

1. Current-answer hero with date, item, stable, watch, and changed counts.
2. Blurred decision-principle foundation.
3. One paper scene per board.
4. A final paper changelog scene with linked issue evidence.

The desktop status table is
`minmax(8rem,.7fr) / minmax(0,1.55fr) / minmax(6rem,.45fr) /
minmax(6rem,.4fr)`, with 20px gaps and 72px minimum rows. Below 1200px it
becomes two columns arranged as three rows: area/date in row one, the answer
with its nested note across row two, and the status badge in column one of row
three. The header row is hidden throughout this below-1200px layout; on mobile
each data row also becomes content-sized. Table semantics remain through
`role="table"`, `row`, `columnheader`, and `cell`.

### Articles translation: wiki listing and detail

The wiki uses DADES data inside the measured Recent Articles composition.

#### Listing

| Band | Composition |
| --- | --- |
| Desktop | 120px/20px/128px page inset; `457px + 1fr` split with 15px gap. The left rail is at least 680px. At 1440px the right feature resolves to `928 × 680px`. Two secondary cards use equal columns, 15px gap, 430px card height, and 308px image height. |
| Tablet | At the implemented `810–1199.98px` band, cards use the full `100vw - 40px` listing width, fixed 485px height, and 48px vertical gaps. Recent measured `728 × 485px` at 768px, but DADES classifies 768px as mobile and renders a `728 × 347px` card there. |
| Mobile | 60px/20px/88px page inset; intro paragraph hidden; cards resolve to `350 × 347px` at 390px viewport with `350 × 233px` images. DADES uses 34px stack gaps; the Recent capture measured about 14–15px between comparable card blocks. |

The complete term list is `928px` wide and right-aligned on desktop. Each group
uses a `190px + 1fr` grid; rows have a 44px minimum linked area. Tablet narrows
the group label to 150px, and mobile stacks label, title, definition, and source
metadata.

`StoryCard` is one linked surface: image, scrim, mono category/date/source count,
Korean term, optional English term in Fraunces, and sourced one-liner. Hover or
focus scales the image to `1.025` with a small saturation/contrast lift; press
returns it to `1.012`. There is no nested control inside the card link.

#### Detail

| Band | Hero | Reading body |
| --- | --- | --- |
| Desktop | 136px top inset; centered 987px copy; 50px deck + 50px H1; figure width `min(1128px, 100vw - 312px)`, fixed 603px height, 76px top gap, and 20px top corners; resolves to `1128 × 603px` at 1440px | 711px column, 78px top and 104px bottom; Fraunces `24px/33.6px` |
| Tablet | 96px top inset; 728px copy and `728 × 485px` figure | Up to 711px within 40px side gutters |
| Mobile | 74px top inset; 342px copy at 390px; 26px deck/H1; `357 × 250px` figure after 54px | `100% - 78px` column; 58px top and 88px bottom; Fraunces `18px/25.2px` |

`ArticleHero` chooses a repository-local editorial media role by entry slug, then
renders category, English deck, Korean H1, update/source metadata, cited
one-liner, and meaningful alt text. The light body contains cited sense rows,
body paragraphs, numbered sources, a copy-link button, and related `StoryCard`
links. Inline citations and article links use `#0099ff`. Copy success/failure is
announced in an `aria-live="polite"` status and the button label resets after
2400ms.

### Issue and archive patterns

#### Issue detail

The issue surface mirrors the article dark-hero/light-body split. Desktop hero
minimum height is 1080px with 140px top padding. Its H1 is 50px/55px, the media
is at most `1128 × 603px`, begins 80px below the copy, and has 20px top corners.
Tablet uses a content-height hero and 24px side gutters. At mobile the hero
starts at 75px, H1 is 26px/28.6px, and media is `357 × 250px` inside 16px
gutters.

`IssueHero` includes issue number, date, collection period, item count, intro,
and an accessible signal summary. Its lead visual comes from the first matched
story-media role and falls back to the general issue-media role.

The light reading body uses a 48rem measure, 80px/96px desktop padding, and
hairline-separated `Entry` rows instead of cards. Issues with relatively few
source groups render section headings; when source-group count exceeds half the
item count, entries stay in publication order without heavy repeated headings.
The pager is a 1128px rule-separated row and becomes a vertical stack on mobile.

#### `Entry`

- **Structure:** external title, source/origin metadata, optional signal chip,
  independent clip button, summary, optional editor note, tags, and optional
  issue backlink.
- **States:** title hover, clip default/pressed, interest-highlighted row, tag
  links, and keyboard focus. `aria-pressed` is the authoritative clip state.
- **Layout:** issue/archive variants are flat ruled rows. The older contained
  reading variant remains a raised 16px-radius card.
- **Type:** flat entry titles are 25.6px desktop; summaries use Fraunces at 24px.
  Mobile summaries become 18px.

#### Archive listing and tag result

Desktop archive listing is a dark 800px-minimum hero with 120px/40px/64px
padding and a `minmax(18rem,.48fr) / minmax(0,.98fr)` split. The right media
grid uses two columns at `>=1200px`; the first card spans two rows and is at
least 680px high, while companion cards have a 192px minimum. Images scale to
`1.025` on hover/focus.

Tablet stacks the split, uses a 288px intro rail, a 485px lead card, 384px
companion cards, and a two-column tag index. Mobile uses 20px gutters, hides the
long intro paragraph, stacks `350:233` media cards with 30px gaps, and collapses
the index to one column.

The light archive body is 1128px wide with 80px/96px vertical padding. Its tag
index uses three columns on desktop, two on tablet, and one on mobile. Interest
stars write only to `dades:interests:v1`; their `aria-pressed` state is restored
on load and `pageshow`. Pagefind is mounted only when the production search
assets respond successfully. Tag-result pages use a compact dark centered hero
and the same light ruled `Entry` list, including issue backlinks.

## 6. Motion & Interaction

### Timing

| Token | Value | Use |
| --- | --- | --- |
| `--motion-micro` / `--chrome-fast` | `160ms` | Color, underline, pill opacity, press response |
| `--motion-standard` / `--chrome-state` | `260ms` | Menu, card image, glass depth, shared reveal |
| `--motion-emphasis` | `500ms` | Home and immersive scene reveal |
| `--ease-out` / `--chrome-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | Spatial movement |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Tint and opacity |

`Base` observes `[data-reveal]` once at threshold `.12` with bottom root margin
`-12%`, adds `.is-revealed`, then unobserves the element. Shared wiki/chrome
reveals begin 18px lower and use 260ms. Immersive reveals begin 20px lower and
issue/archive reveals begin 24px lower; both use 500ms. Editorial content is
visible by default; the hidden starting state is gated by `.has-reveal-js`, so
blocking JavaScript does not remove the reading surface.

### State contract

| Pattern | Hover/focus | Active/selected |
| --- | --- | --- |
| Desktop nav link | Reveals the blurred gray inner pill | Current route shows light active pill and `aria-current="page"` |
| Latest-issue nav CTA | Dark fill, yellow copy/rim, rises 1px | Moves down 1px and scales to `.985` |
| Mobile menu | Current/hover/focus row gets `.34` white field and strong accent | `aria-expanded`, `aria-hidden`, `inert`, body scroll lock |
| Home current-cover link | Image scales `1.018`, cobalt field deepens, and the directional label shifts 8px | Returns to baseline and scales `.99` |
| Text pill | Cobalt fill with inverse text, rises 2px | Returns and scales `.985` |
| Home story tile | Title underline strengthens and image scales `1.018` with a small color lift | Image settles to `1.008`; reduced motion removes scale |
| Wiki/archive media card | Image scales `1.025` and gains saturation/contrast | Wiki image settles to `1.012` |
| Status linked answer | Strong cobalt and 1px rise; row gets accent wash | Native link activation |
| About capability row | Entire row inverts to cobalt/white | Native link activation |
| Clip button | Hover gets cobalt/inverse; focus keeps the shared outline without hover fill | `aria-pressed="true"` persists in local storage and applies the cobalt fill |
| Interest button | Hover gets accent border/wash; focus keeps the shared outline | `aria-pressed="true"` persists in local storage and applies the selected treatment |
| Theme button | Hover gets white fill/dark text; focus keeps the shared outline | `aria-pressed="true"` applies the same fill and persists the theme |
| Copy link | Black fill/warm-paper text | 1px downward press; live copied/failed result |

There are two continuous pointer responses. `Base` tracks every pointer type to
move the navigation sheen, while the home hero adds a second, mouse-only handler
for parallax and its local glass highlight. Other motion communicates hover,
press, reveal, menu, or state change.

### Reduced motion

`prefers-reduced-motion: reduce` is a complete alternate path:

- Global smooth scrolling and every vertical/horizontal snap mode are disabled.
- The home parallax listener is not installed.
- Global CSS animations run once at `0.01ms`; route-specific reduced-motion
  transitions range from `0.01ms` to `1ms`, keeping state changes effectively
  instantaneous.
- Reveal content is immediately visible and untransformed.
- The mobile menu panel and its rows open without animated translation or
  scaling. The hamburger lines still rotate instantly, and the toggle retains
  its instantaneous active-press transform.
- Wiki-story and archive-card image scaling is removed. Home feature state
  changes remain available but occur without a perceptible transition.
- Immersive desktop proximity snap is explicitly removed.
- `pattern-surfaces.css` requests `filter: none` for pattern media. Later
  route-specific static color filters can still win in the cascade; no motion
  is required to see the content.

## 7. Depth & Surface Strategy

The strategy is mixed, with one material assigned to each role.

### Fixed chrome

The glass navigation is not a single blur. Its recipe is:

1. transparent fixed positioning wrapper;
2. isolated, clipped rounded shell;
3. separate `.glass-fill-layer` with measured gray alpha;
4. pointer-relative radial sheen plus top linear highlight;
5. `9px` backdrop blur and `122%` saturation;
6. two inset white rims and a low outside shadow;
7. separate blurred hover and active pills below labels;
8. stronger outside shadow only after the document has scrolled 8px.

The declared `--chrome-highlight` mirrors the captured white highlight value;
the rendered sheen currently uses explicit `.58` radial and `.5` linear alpha
stops so its falloff can be controlled independently.

### Content surfaces

- Full-bleed heroes get depth from vector pattern, color field, blend mode, and
  layered scrims.
- Home feature, wiki story, and archive cards get depth from the image/scrim
  stack; they do not carry permanent generic card shadows.
- Immersive hero statistics use transparent inverse fill, a 1px light rim,
  inset highlight, `30px` blur, and subtle per-cell light fields.
- Paper pages use tonal hierarchy and hairline rules. Issue and archive entries
  are flat rows, not floating cards.
- The home topic field uses two radial light sources rather than a flat dark
  fill.
- The footer uses a pale outer field around a cobalt CTA, then a fixed charcoal
  information band.

Radii are contextual: 30px desktop chrome, 25px mobile chrome, 20px article
hero corners, 16px panels, 10px media, 8px controls, and full pills for compact
actions.

### Book of Shapes pattern layer

`pattern-surfaces.css` changes material while leaving the Recent-derived layout
metrics untouched. It is imported by `Base` before route-specific styles, so
its declarations are defaults unless a later immersive, wiki, or issue/archive
selector replaces the same property:

- The home scene receives the final three-source field: a cobalt `.58` radial
  at 16%/18%, a gold `.2` radial at 84%/76%, and a 145-degree `#102554` to
  `#07112b` gradient ending at 62%. Immersive route CSS later restores its own
  fallback field and scrims.
- Immersive hero/foundation SVGs retain opacity `.88` and
  `mix-blend-mode: screen`; mobile lowers their opacity to `.8`. The home media
  declaration starts at the same opacity, but `hero-arrive` uses `fill-mode:
  both` and holds the final computed opacity at `1` on desktop and mobile. The
  mobile home crop changes from center/46% to 52%/center. The pattern layer
  declares a 32px line glow, while the home entry animation and later immersive
  color-grade filters own the final computed `filter` on those selectors.
- Card and article SVGs retain opacity `.9` and the screen blend. The pattern
  layer declares a 20px line glow and `--pattern-card-bg`; later route
  backgrounds, scrims, static filters, and hover filters take precedence where
  their selectors target the same property. The issue hero's static
  saturation/contrast filter is one such override.
- Second and third card positions receive distinct blue/gold backing fields so
  repeated patterns do not flatten into one tile treatment.
- Home pattern cards use the three-stop navy scrim ending at
  `rgba(4,9,24,.92)`. Wiki and archive route styles later supply their own
  scrims. Issue and article hero figures retain an inset white `.12` rim and
  `0 22px 56px rgba(0,0,0,.18)` shadow.
- Forced colors sets pattern media to opacity `1`, normal blending, and no
  pattern filter. Later route declarations remain governed by normal cascade
  order. Wiki and archive then apply their own opaque forced-color scrims; the
  later normal home pattern scrims continue to outrank the earlier shared
  forced-scrim declarations.

## 8. Accessibility Constraints & Current Exceptions

### Contract

- Target WCAG level is 2.2 AA. Body text targets 4.5:1; large text and UI
  boundaries target 3:1.
- A 3px accent outline with 3px offset is the shared `:focus-visible` treatment.
- The skip link becomes fixed and visible when focused.
- Navigation uses real links/buttons, route-current state, accurate menu labels,
  `aria-expanded`, `aria-hidden`, `inert`, Escape close, outside close, initial
  focus, and focus return when close would otherwise strand focus inside.
- Mobile menu is a disclosure, not a modal dialog; it locks page scroll but does
  not claim a focus trap.
- Story cards contain one link and no nested action. Clip, interest, theme, and
  copy controls expose state separately through native buttons and ARIA.
- Status data retains table roles after responsive visual reflow. Wiki sources
  remain numbered lists and citations return to source anchors.
- Decorative full-bleed media uses empty alt text and/or `aria-hidden`; media
  that identifies a story or issue carries Korean descriptive alt text.
- Korean long-form surfaces use keep-all wrapping with anywhere overflow as a
  last resort. The body clips accidental horizontal overflow rather than
  allowing a second page axis.
- Forced-colors mode removes decorative glass/highlight layers, restores Canvas
  fills and CanvasText borders, and requests normal blending and opacity `1`
  for pattern SVGs. Wiki and archive cards receive opaque contrast scrims. Home
  retains its later pattern scrims, so this document does not claim an opaque
  forced-color scrim on that route.
- Reduced motion never removes content or controls; it only removes movement,
  snap, and delayed reveal.

### Target-size exception

Project-owned editorial controls such as clip, interest, theme, share, text CTA,
and status evidence use a `2.75rem` / 44px minimum. The fixed navigation deliberately
preserves Recent's smaller measured chrome: 38px desktop controls and 34.3px
mobile inner controls, with a 42px-wide menu toggle inside a 42.3px shell and
40px menu rows. The implementation therefore does not claim a universal 44px
touch target. This is a documented source-fidelity exception, not an
unrecorded assumption.

### Theme interaction exception

Wiki article colors are fixed. Issue/archive backgrounds are also fixed, but
their light-body copy uses `--text-primary`/`--text-secondary` and media-overlay
copy uses `--text-inverse`. Selecting `ink` therefore leaves the issue/archive
paper at `#fbfaf6` while those shared text tokens change to their ink-theme
values. Contrast for that mixed fixed/theme-aware combination is not claimed.

### Accepted debt

No accessibility or design debt is recorded as accepted in the current design
state. This document describes current exceptions without treating them as user
acceptance.

## 9. Asset Provenance & Reference Boundary

### Book of Shapes exports

The illustration layer consists of six SVG patterns generated in and customized
from Book of Shapes. The machine-readable control values, selected colors,
export entry names, byte sizes, roles, and source URLs are recorded in
`artifacts/book-of-shapes/exports.json`. Each public SVG also carries its source
URL in its opening comment.

| Local export | Book of Shapes source | DADES role |
| --- | --- | --- |
| `public/patterns/dades-flow-lines.svg` | [Flow Lines](https://bookofshapes.com/patterns/flow_lines) | Home masthead, immersive foundation, and issue fallback field |
| `public/patterns/dades-interference-mesh.svg` | [Interference Mesh](https://bookofshapes.com/patterns/interference-mesh) | About/status immersive hero and context-window article field |
| `public/patterns/dades-isometric-noise.svg` | [Isometric Noise Field](https://bookofshapes.com/patterns/iso_test_noise_field) | Hardware/compute stories and cards |
| `public/patterns/dades-node-garden.svg` | [Node Garden](https://bookofshapes.com/patterns/node_garden) | MCP and agent-network stories and cards |
| `public/patterns/dades-rect-void.svg` | [Rectangle Field Void](https://bookofshapes.com/patterns/rect_field_void) | Black-box and model-scale stories and cards |
| `public/patterns/dades-spiral-mesh.svg` | [Spiral Mesh](https://bookofshapes.com/patterns/spiral_mesh) | Editorial, prompt-injection, token, and citation stories |

Book of Shapes identifies itself in its home/pattern-page footer as
`© 2026 Book of Shapes — created by Nikolaj Sokolowski`. Its Download SVG action
produces a ZIP containing optimized and raw SVG variants; the repository copies
above are the customized DADES exports, not remote runtime embeds. The DADES
footer repeats a linked plain-language credit to Book of Shapes and Nikolaj
Sokolowski on every route.

During provenance review, `https://bookofshapes.com/terms` and
`https://bookofshapes.com/license` returned 404, and no public reuse grant was
found. These six exports are therefore documented for local prototype use only.
Production or commercial reuse permission is not published and should be
confirmed with Book of Shapes or the creator before such use.

### Other assets and exclusions

| Asset class | Provenance rule | Delivery rule |
| --- | --- | --- |
| Recent reference evidence | Screenshots, DOM, computed styles, and interaction captures are measurement-only inputs | Never bundled into the public site |
| DADES brand | Original DADES lettering, wool/spiral counterform, and electric detail; an externally supplied editorial mark was a style reference only | Repository-local raster variants for navigation, footer, icons, manifest, and touch icon |
| Fonts | Pretendard Variable via Orioncactus/jsDelivr; Fraunces and IBM Plex Mono via Google Fonts | CSS-loaded web fonts with declared local/system fallbacks |

No Recent logo, agency copy, project photograph, article photograph,
proprietary Waldenburg/Bradford/Aeonik font binary, or Atlantic trademarked
composition is part of the shipped asset set. Recent contributes measurements
and layout grammar only. Pattern exports are resolved through the
base-path-aware `href()` helper, include intrinsic dimensions, load eagerly only
above the fold, and use Korean descriptive alt text when they identify a story;
decorative scene use remains empty-alt and/or `aria-hidden`.
