---
trigger: always_on
description: Writing style, practical vocabulary, and brand color guidelines
---

# Human Wording & Design Brand Consistency

## 1. Natural Everyday Language (Zero AI Slop Jargon)
- Never use robotic AI buzzwords or inflated marketing prose:
  - ❌ Avoid: "Seamlessly orchestrate", "Comprehensive ecosystem", "State-of-the-art workbench", "Empowering situational awareness", "Cutting-edge suite", "Synergistic".
  - ✅ Use: "Review Applicant", "Applicant List", "Details", "Photos", "Filters", "Queue", "Approve", "Deny", "Submitted ID".
- Keep UI labels, headers, and descriptions clear, short, and grounded in real-life municipal emergency response terminology.

## 2. Brand Colors & Visual Consistency
- **Primary Brand Red**: `#D32F2F` (`var(--app-red)`, `var(--ion-color-danger)`). Never use washed-out pinkish-reds like `#eb445a` or random crimson shades.
- **Public Safety Amber / Yellow**: `#F59E0B` to `#D97706` (`var(--app-yellow)`). Used for Public Safety / Hazard Report actions, matching the Android home widget.
- **Backgrounds**: Apple HIG Grouped Light (`#f2f2f7`, cards `#ffffff`) and OLED Pure Dark (`#000000`, cards `#1c1c1e`).
- **Tactile Surfaces**: Crisp 1px borders (`var(--card-border)`) with subtle tactile elevation.

## 3. Interactive Tours & Overlays
- When modifying panels, ensure all tour target IDs (e.g. `id="tour-..."`, `id="verification-card-first"`, `id="verify-actions-group"`, `id="verify-approve-btn"`) are preserved so the guided tutorial overlay highlights the correct elements accurately.
