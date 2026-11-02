---
name: Governed Intelligence
colors:
  surface: '#fcf8ff'
  surface-dim: '#dad7f1'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2ff'
  surface-container: '#efecff'
  surface-container-high: '#e8e5ff'
  surface-container-highest: '#e2e0fa'
  on-surface: '#1a1a2c'
  on-surface-variant: '#484554'
  inverse-surface: '#2f2f42'
  inverse-on-surface: '#f2efff'
  outline: '#797586'
  outline-variant: '#c9c4d7'
  surface-tint: '#6142d5'
  primary: '#5a3bce'
  on-primary: '#ffffff'
  primary-container: '#7357e8'
  on-primary-container: '#f9f3ff'
  inverse-primary: '#cabeff'
  secondary: '#5f49c5'
  on-secondary: '#ffffff'
  secondary-container: '#9581ff'
  on-secondary-container: '#2b0090'
  tertiary: '#575764'
  on-tertiary: '#ffffff'
  tertiary-container: '#706f7d'
  on-tertiary-container: '#f7f4ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cabeff'
  on-primary-fixed: '#1c0062'
  on-primary-fixed-variant: '#4823bc'
  secondary-fixed: '#e5deff'
  secondary-fixed-dim: '#c9bfff'
  on-secondary-fixed: '#1b0063'
  on-secondary-fixed-variant: '#462eac'
  tertiary-fixed: '#e3e0f1'
  tertiary-fixed-dim: '#c7c5d5'
  on-tertiary-fixed: '#1a1a26'
  on-tertiary-fixed-variant: '#464553'
  background: '#fcf8ff'
  on-background: '#1a1a2c'
  surface-variant: '#e2e0fa'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an enterprise-grade digital environment for autonomous workforce orchestration, human-in-the-loop validation, and systemic governance. The target audience comprises enterprise operations leaders, compliance officers, risk managers, and autonomous workflow architects who require absolute operational transparency and control over automated systems.

The visual style synthesizes **Corporate / Modern** precision with **Tonal Ambient Surfaces**. It communicates supreme calm, authority, and reliability through an airy, disciplined layout model. The interface avoids aggressive visual noise in favor of spacious white surfaces grounded on soft lavender canvas backgrounds, high-contrast slate typography, precise hairline borders, and distinct status signifiers that indicate autonomous actions, approval thresholds, and verified governance events.

## Colors

The color palette reinforces clarity, trust, and structural hierarchy:

- **Primary & Interactive Accents**: `#7357E8` serves as the primary action and key focus indicator, paired with deep purple `#5741BD` for hover states, selected structural nav items, and high-emphasis controls. `#F1EEFF` acts as a soft tint for selected states, active tab pills, and secondary focus areas.
- **Surface & Canvas Structure**: The main application canvas sits on `#F7F7FC`, providing subtle warmth and contrast against pure `#FFFFFF` cards, modals, and persistent panels. Hairline boundary borders use `#EAE9F1`.
- **Text & Neutral Contrast**: Primary text is anchored by `#202033` for uncompromising legibility. Secondary labels, hints, and structural outlines leverage `#77778C`, with subtle metadata borders utilizing `#D4D3E0`.
- **Operational & Governance Tokens**:
  - `Success / Verified`: `#269B72` (background tint `#E8F7F1`)
  - `Warning / Threshold Pending`: `#E6A23C` (background tint `#FEF7ED`)
  - `Danger / Escalation / Blocked`: `#D95362` (background tint `#FDF2F3`)
  - `Info / Telemetry Active`: `#4688D8` (background tint `#EDF4FC`)

## Typography

The typography pairings balance contemporary elegance with high-density data readability. Headings use **Plus Jakarta Sans**, offering friendly yet disciplined geometric forms that maintain warmth across dashboards and enterprise inspection headers. All computational data, workflow logs, table rows, and body content leverage **Inter** for neutral legibility and clarity under high-frequency interaction.

For audit logs and machine-generated execution traces, monospaced tokens inherit systematic character spacing with tabular numerals applied across financial and performance counters.

## Elevation & Depth

Visual hierarchy combines clean 1px hairline perimeter borders with soft, low-opacity ambient shadows to isolate white interactive surfaces from the `#F7F7FC` background:

- **Level 0 (Flat / Canvas)**: Primary application background at `#F7F7FC` with no shadow.
- **Level 1 (Card / Resting Surface)**: Pure `#FFFFFF` background, bordered with 1px solid `#EAE9F1`, supported by an ambient drop shadow: `0 2px 8px -2px rgba(32, 32, 51, 0.04), 0 1px 4px -1px rgba(32, 32, 51, 0.02)`.
- **Level 2 (Hover / Contextual Menu)**: Elevated card or popover: `0 8px 24px -4px rgba(115, 87, 232, 0.08), 0 2px 6px -1px rgba(32, 32, 51, 0.04)`.
- **Level 3 (Inspection Panels / Modals)**: Fixed overlay drawers and critical human-in-the-loop approval dialogs: `0 16px 40px -8px rgba(32, 32, 51, 0.12), 0 0 0 1px rgba(234, 233, 241, 0.8)`.

## Shapes

The design uses balanced, rounded geometry (`roundedness: 2`):

- **Cards & Data Modules**: Defined with `1rem` (16px) corner radius for approachable structure.
- **Standard Controls**: Buttons, input containers, and list row selectors use `0.5rem` (8px).
- **Pills & Badges**: Governance verification badges, live status tags, and avatar clips use full pill rounding (`9999px`).
- **Feature Banners & Promos**: Prominent dashboard highlights and hero panels use `1.25rem` (20px) to mirror modern enterprise card aesthetics.

## Components

### Buttons
- **Primary**: Background `#7357E8`, text `#FFFFFF`, border `none`, `0.5rem` radius. On hover: `#5741BD`.
- **Secondary**: Background `#F1EEFF`, text `#7357E8`, border `1px solid transparent`. On hover: `#E4DEFE`.
- **Tertiary / Outlined**: Background `transparent`, text `#202033`, border `1px solid #EAE9F1`. On hover: background `#FFFFFF`, border `#7357E8`.
- **Danger (Reject / Abort)**: Background `#FDF2F3`, text `#D95362`, border `1px solid #F8D7DA`. On hover: background `#D95362`, text `#FFFFFF`.

### Chips & Governance Badges
- **Verified State**: Pill shape with `#E8F7F1` background, `#269B72` label, accompanied by a checkmark icon.
- **Pending Human Approval**: `#FEF7ED` background, `#E6A23C` label, accompanied by an inspection pulse icon.
- **Active Agent Tag**: `#F1EEFF` background, `#7357E8` label, displaying agent model designation and runtime confidence.

### Input Fields
- Container height 40px, background `#FFFFFF`, border `1px solid #EAE9F1`, border radius `0.5rem`, padding `0 12px`.
- Text color `#202033`, placeholder `#77778C`.
- Focused state: border color `#7357E8`, box-shadow `0 0 0 3px rgba(115, 87, 232, 0.12)`.

### Checkboxes & Radio Buttons
- Checkbox uses an 18px rounded square (4px radius) with border `1.5px solid #D4D3E0`. Checked state renders background `#7357E8` with a white tick mark.
- Radio buttons feature a 18px circle with a centered 8px inner circle dot in `#7357E8` when active.

### Cards & Content Modules
- Rendered in pure `#FFFFFF`, enclosed in `1px solid #EAE9F1` with Level 1 ambient elevation.
- Internal padding standardizes to `1.5rem` (24px) on desktop, scaling to `1rem` (16px) on mobile. Header areas feature distinct divider rules or clean whitespace delineation.

### Inspection & Approval Drawer (Product-Specific)
- A persistent or collapsible right-hand panel dedicated to autonomous action review.
- Contains the originating AI agent ID, execution confidence score, exact prompt/context diff, structured audit timestamp, and explicit **Approve** (primary purple) vs **Override/Reject** (danger outline) trigger actions.