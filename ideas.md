# Tribull Home Page Design Direction

## Reference Ground Truth

This is a Figma-to-code reproduction task. The supplied Figma prototype and Home Page node `103:83` are the source of truth. The implementation must preserve the reference composition, spacing, typography, image treatment, colors, and section ordering rather than introduce a new visual direction.

## Design Movement

Editorial streetwear commerce with a restrained, material-led fashion catalogue sensibility.

## Core Principles

1. **Fidelity before invention.** Match the Figma hierarchy and proportions before adding any polish.
2. **Material contrast.** Use the specified dark green, cream, and white surfaces to create quiet visual tension.
3. **Image-led storytelling.** Product and promotional imagery carry the page; text supports discovery without competing with it.
4. **Controlled motion.** Reveal, hover, and scroll transitions are short, subtle, and disabled for reduced-motion users.

## Color Philosophy

Dark green `#1B362D` is the anchoring brand color and communicates confidence, groundedness, and premium utility. Cream `#F1E8CB` is the warm canvas that softens the composition and keeps the apparel imagery tactile. White is reserved for contrast and breathing room. No additional accent palette should distract from the source design.

## Layout Paradigm

A wide editorial flow with full-bleed promotion, compact category tiles, four-column product merchandising, large negative space, and broad horizontal banners. The layout should feel like a lookbook rather than a generic centered marketing grid.

## Signature Elements

- Repeating announcement ticker reading `100% Cotton.Shop Now` on dark green.
- Dark-green category cards with cream typography and generous internal breathing room.
- Cream editorial bands that punctuate the product sections and carry the footer.

## Interaction Philosophy

Interactions should feel tactile and premium: cards lift slightly, images scale gently within their frame, and buttons shift with a short easing curve. Navigation and visual-only product cards must remain non-destructive and must not introduce new backend or commerce behavior.

## Animation

Use a page-load fade with a slight upward reveal, a restrained hero image reveal, section fade-ins using `IntersectionObserver` or existing reveal components, and hover transitions under 300ms. Product and category imagery may scale by a small amount on hover. Respect `prefers-reduced-motion`.

## Typography System

Use Poppins for bold display headings and logo-adjacent emphasis, Inter for medium-weight interface copy, and Maname where the reference uses its distinctive editorial character. If the exact font is unavailable, preserve the hierarchy and proportions with the closest available web-safe fallback rather than changing layout.

## Brand Essence

**A grounded streetwear storefront for people who want expressive, graphic-led essentials with a deliberate visual point of view.** Personality: grounded, expressive, deliberate.

## Brand Voice

Headlines are concise and declarative. CTAs are direct and product-oriented. Microcopy is confident without hype.

Example lines:

- `Wear what moves you.`
- `Find your next everyday uniform.`

## Wordmark & Logo

Preserve the existing Tribull logo asset and its placement from the reference. Do not replace it with a default text wordmark or a newly drawn approximation.

## Signature Brand Color

`#1B362D` — Tribull Deep Green.

## Asset Decision

The archive contains reusable product SVG assets but no obvious exported Figma hero or category image set. The implementation will use the existing exact archive assets where available and will not silently invent replacement product imagery. Any unavailable Figma-specific asset will be documented at delivery.
