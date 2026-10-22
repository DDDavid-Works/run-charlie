# Endless Runner Game Website — Project Specification

## 1. Project Overview

Build a lightweight, browser-based arcade game website. The first game is an original endless runner inspired by the simple, instantly playable format of Chrome's offline dinosaur game, but it must have its own name, character, art direction, obstacles, and visual identity.

The core gameplay loop is:

**Run → Jump → Slide → Avoid obstacles → Survive longer → Beat your best score**

The website is intended to be monetized primarily through display advertising after the game has been tested with real users and the site is eligible for an ad network.

This is a small, incremental project. Prioritize a fun, polished core game over a large feature set.

## 2. Product Goals

### Primary goals
- Start playing quickly, without registration or downloads.
- Make the game work on desktop and mobile browsers. Mobile is a first-class target, designed **portrait-first** (one-handed or two-thumb play on a phone held upright); landscape and desktop must also work.
- Be installable and playable offline as a Progressive Web App (PWA) on mobile (see Phase 5; no backend or build step needed).
- Keep controls responsive and easy to understand.
- Make jump and slide equally important gameplay actions.
- Increase difficulty gradually as the run continues.
- Save the player's personal best locally.
- Keep the website lightweight, fast, accessible, and easy to maintain.
- Leave room to add more games and marketing pages later.

### Non-goals for the first release
Do not build these unless explicitly requested later:
- User accounts or authentication
- Backend services or a database
- Online/global leaderboard
- Multiplayer
- Payments or subscriptions
- A game framework or physics engine
- Daily challenge infrastructure
- Complex level progression or unlock systems
- Ad integration before the core gameplay has been tested
- Analytics that collect unnecessary personal information

## 3. Technical Direction

Use a simple, dependency-light stack:
- HTML
- CSS
- Vanilla JavaScript
- HTML5 Canvas for gameplay rendering
- `localStorage` for the local best score and any simple local preferences

No frontend framework, build step, backend, or external game engine is required for the initial version.

Keep the code organized into understandable modules/files. A suggested structure is:

```text
/
├── index.html
├── styles/
│   └── main.css
├── scripts/
│   ├── main.js
│   ├── game.js
│   ├── player.js
│   ├── obstacles.js
│   ├── input.js
│   └── storage.js
├── assets/
│   ├── images/
│   └── audio/
├── README.md
└── CLAUDE.md
```

This is a suggested structure, not a requirement to over-engineer. If a smaller structure is clearer, use it.

Avoid dependencies unless they provide a clear, meaningful benefit. The game should run locally by opening it through a simple local development server.

## 4. Originality and Visual Identity

The game may use familiar endless-runner mechanics, but must not copy Google's dinosaur character, official graphics, branding, or other proprietary assets.

Create an original visual theme:
- An original player character or distinctive silhouette
- Original obstacle designs
- A consistent environment and color palette
- Simple but satisfying animation
- Clear visual distinction between jumpable ground obstacles and slide-under overhead obstacles

Use simple shapes or original lightweight assets for the prototype. Do not block gameplay implementation on polished artwork. Keep assets replaceable so the visual style can improve later.

Do not settle on a permanent game name or domain without the project owner choosing it.

## 5. Core Gameplay

### 5.1 Game states

Implement clear game states:
1. **Ready** — display a short instruction and a clear way to start.
2. **Playing** — the character runs and obstacles approach.
3. **Game Over** — stop the run, show the final score and best score, and provide a restart action.

Avoid unnecessary menus. The player should be able to understand the game immediately.

### 5.2 Running
- The character runs automatically once the game starts.
- Obstacles move toward the player to create the illusion of forward movement.
- The game should use a reliable animation loop, preferably `requestAnimationFrame`.
- Use delta time or another frame-rate-independent approach so gameplay is not unfairly tied to display refresh rate.
- Pause or safely handle the game when the browser tab is hidden, then resume in a predictable way.

### 5.3 Jump
Desktop controls:
- `Space` or `ArrowUp` initiates a jump.
- Prevent page scrolling when a gameplay key is used while the game is active.
- Do not repeatedly trigger multiple jumps from a single held key.
- A second jump or double-jump is not part of version one.

Mobile controls:
- Provide a large, easy-to-tap Jump control.
- A tap on the game area may trigger a jump only if it does not conflict with another control or a UI action.

Jump behavior:
- Use simple, tunable gravity and jump velocity.
- The player should return to the ground predictably.
- Only allow jumping when grounded, unless a later design explicitly changes this.
- The jump arc must be consistent enough for players to learn obstacle timing.

### 5.4 Slide
Sliding is a **short, momentum-based slide**, not a static crouch.

Desktop controls:
- Hold `ArrowDown` or `S` to initiate and maintain the slide.
- Releasing the key ends the input, but the animation should finish gracefully rather than snapping abruptly.
- Do not trigger browser page scrolling while using the slide key during active gameplay.

Mobile controls:
- Provide a dedicated Slide button.
- Holding the button should initiate the slide; releasing it should request the end of the slide.
- Make the button large enough for touch use and keep it separate from Jump.

Slide behavior:
- Lower the player's collision height while sliding.
- Visually move the character into a slide pose, with a clear sense of forward momentum.
- Use a short, tunable minimum slide animation duration to make the movement feel intentional.
- The slide should not become an unlimited invulnerability state.
- A slide should pass under designated overhead obstacles when the player's collision box clears them.
- If the player releases the slide input, return to running after the minimum animation duration.
- Do not automatically cancel a slide in a way that causes the player to collide with an overhead obstacle they were already passing beneath.
- Keep the collision model predictable and visually aligned with the character.

Important implementation detail: separate the visual sprite dimensions from the collision hitbox where useful. Collision dimensions should change deliberately during jump and slide.

### 5.5 Obstacles
Include at least two clear obstacle categories:
- **Ground obstacles:** intended to be avoided by jumping.
- **Overhead obstacles:** intended to be avoided by sliding.

Requirements:
- Make obstacle types recognizable before the player reaches them.
- Use fair spacing and avoid unavoidable combinations.
- Do not spawn obstacles so close together that the player cannot recover from a required action.
- Introduce one obstacle type at a time early in a run, then mix types as difficulty rises.
- Collision detection must be consistent and testable.
- A collision should end the run and show Game Over.

Avoid random generation that produces impossible sequences. Use minimum spacing, action/recovery windows, and sensible pattern rules.

### 5.6 Scoring and difficulty
- Increase the score over time survived or distance traveled.
- Display the current score clearly during gameplay.
- Increase speed gradually, within tunable limits.
- Adjust obstacle spacing carefully as speed increases.
- Difficulty should feel challenging but fair, not randomly punishing.
- Store the best score locally in `localStorage`.
- Handle missing, malformed, or unavailable local storage without crashing the game.
- Format large scores consistently.

Do not add coins, power-ups, missions, or unlock systems to version one.

## 6. Responsive Design and Controls

The game must be playable on both desktop and mobile.

### Desktop
- Use `Space` or `ArrowUp` for Jump.
- Use `ArrowDown` or `S` for Slide.
- Provide a visible restart action after Game Over.
- Avoid keyboard controls that interfere with normal page behavior outside active gameplay.

### Mobile
- **Portrait-first layout:** the game canvas fills the screen width at the top, with large Jump and Slide buttons below it in the thumb zone (Slide on the left, Jump on the right). Do not require rotating the phone. In landscape (and short viewports) the buttons sit beside the canvas.
- The canvas keeps a fixed logical world size scaled to its container, and is rendered at the device pixel ratio so it stays crisp.
- Respect safe-area insets (notches, home indicator) and use dynamic viewport units so browser toolbars don't cause overflow.
- Show separate Jump and Slide controls during gameplay.
- Support touch and pointer events robustly.
- Prevent accidental text selection and unwanted page scrolling on the game/control surface.
- Use CSS such as `touch-action` only where appropriate, without disabling normal scrolling across the whole site.
- Ensure the game canvas resizes correctly on orientation or viewport changes.
- Make controls reachable without covering important gameplay elements.
- Do not rely on hover interactions.

### Accessibility and usability
- Use sufficient contrast for the character, obstacles, controls, and score.
- Provide concise text instructions.
- Use semantic HTML for buttons and surrounding page content.
- Make buttons keyboard accessible.
- Respect reduced-motion preferences for nonessential interface animation where practical.
- Do not communicate obstacle type using color alone.

## 7. Website and Landing Page

The initial website should focus on getting the visitor into the game quickly.

Suggested page layout:
1. Simple header with the original game name/logo placeholder.
2. A short, clear headline explaining the game.
3. The game canvas in a prominent position.
4. Brief control instructions for desktop and mobile.
5. Current score, best score, and restart UI.
6. A short original description or “How to play” section below the game.
7. A small footer with links to Privacy Policy and Contact/About pages when appropriate.

Avoid excessive navigation, pop-ups, forced sign-ups, and long content above the game.

The layout must work on narrow screens and must not make the playable area awkwardly small on mobile.

## 8. Advertising and Monetization

The business model is primarily display advertising. However, do not add ads before the game and website are functional and have been tested.

Initial requirements:
- Keep ad integration out of core game logic.
- Reserve clearly defined ad placement areas only if needed for layout testing.
- Do not use fake ad code or pretend the site has been approved by an ad network.
- Never place ads where they can be mistaken for Jump, Slide, Restart, or other game controls.
- Avoid overlays that interrupt active gameplay.
- Do not create accidental-click layouts or deceptive buttons.
- Keep the game usable if ad scripts fail to load.
- Do not make unsupported claims about ad revenue or network approval.

Before launching real ads, verify the chosen network's current eligibility, privacy, consent, and placement requirements. Add the necessary policy and consent features based on the actual audience and applicable rules.

## 9. Marketing and Discovery

Marketing should begin with a playable, reliable game. The initial plan is organic-first.

### Search visibility
- Use a descriptive page title and meta description.
- Ensure the page can be indexed and the game is usable without sign-in.
- Write original instructions and useful content rather than generating many thin, near-identical pages.
- Set up Google Search Console after deployment.
- Create additional game or guide pages only when they provide genuine value.

### Social content
Create short clips showing:
- A last-second jump or slide
- A close call or funny failure
- A jump-then-slide obstacle sequence
- A high-score challenge
- New obstacle types or improvements

Use a clear call to action, such as challenging viewers to beat a score. Reuse suitable clips across short-form video platforms.

### Community launch
- Invite a small group of testers before public launch.
- Share the game only in communities that allow it.
- Read each community's self-promotion rules first.
- Ask for specific gameplay feedback rather than posting repetitive advertisements.
- Use feedback to improve fairness, responsiveness, and replayability.

### Sharing
- Let players share a score and a direct link using the Web Share API where available.
- Provide a copy-link fallback.
- Do not require an account to share a score.
- Do not claim that a score is verified or globally ranked; version one uses local scores only.

## 10. Analytics and Privacy

Keep the first version privacy-conscious.

- Do not collect names, email addresses, or account information.
- Do not build a backend just for score tracking.
- Local best score should remain in the player's browser.
- Add analytics only when there is a clear purpose and configure it in line with applicable privacy requirements.
- If analytics or advertising technologies are added, provide appropriate privacy disclosures and consent mechanisms where required.
- Do not include secret keys or sensitive credentials in frontend code.

## 11. Development Phases

Work incrementally. Keep the game runnable at the end of each phase.

### Phase 1 — Playable prototype
- Create the page and canvas.
- Implement the game loop and game states.
- Implement automatic running and jumping.
- Add one ground obstacle.
- Add collision detection and Game Over.
- Add restart.

**Exit criteria:** a player can start, jump over an obstacle, lose, and restart.

### Phase 2 — Slide mechanic
- Implement hold-to-slide desktop input.
- Implement the slide animation and momentum feel.
- Change the hitbox during the slide.
- Add an overhead obstacle.
- Verify that sliding avoids the intended overhead obstacle.
- Test releasing the slide at different points.

**Exit criteria:** jumping and sliding are both necessary, feel distinct, and work reliably.

### Phase 3 — Complete core loop
- Add multiple obstacle variations.
- Implement fair obstacle patterns and spacing.
- Add score, speed progression, and difficulty tuning.
- Add local best score.
- Polish the Ready and Game Over states.

**Exit criteria:** a complete, replayable endless runner works on desktop.

### Phase 4 — Mobile support and polish
*(Pulled forward by the project owner and built right after Phase 3; portrait-first. PWA work is in Phase 5.)*
- Portrait-first responsive layout: canvas on top, large Jump and Slide buttons below; landscape layout with buttons beside the canvas.
- Hi-DPI canvas scaling and resize/orientation handling.
- Add touch controls for Jump and Slide.
- Test on narrow screens and different viewport sizes.
- Improve collision consistency and animation timing.
- Check keyboard, pointer, and touch edge cases.
- Add clear instructions and responsive layout.

**Exit criteria:** the game is comfortably playable on desktop and mobile.

### Phase 5 — Website launch preparation
- Add title, description, favicon, and original visual identity.
- Make it a PWA: web app manifest (standalone display, portrait orientation, theme colors), icons (including maskable and Apple touch icon), and a small versioned service worker that precaches the app shell for offline play. Registration must never break the game if it fails. Requires HTTPS when deployed (localhost is exempt). Use a placeholder name until the owner chooses one.
- Test performance and loading behavior.
- Add About/Contact and privacy-related pages as appropriate.
- Test in current major desktop and mobile browsers.
- Deploy to a chosen static hosting provider.
- Test the deployed version, not only local development.

**Exit criteria:** visitors can load and play the game reliably, and the website is ready to begin gathering feedback.

### Phase 6 — Soft launch and validation
- Invite testers and collect feedback.
- Fix major gameplay and mobile issues.
- Publish a small number of genuine gameplay clips.
- Submit to relevant game directories or communities where permitted.
- Review basic traffic and returning-visitor trends if measurement is configured.

**Exit criteria:** there is enough real usage and feedback to decide what to improve next.

### Phase 7 — Monetization and expansion
Only after the core game and site are stable:
- Evaluate ad network eligibility and requirements.
- Add unobtrusive ad placements outside interactive controls.
- Measure performance and user experience after ads are enabled.
- Consider a daily challenge, additional game, or online leaderboard only if user feedback justifies it.

## 12. Testing Checklist

Test at minimum:
- Starting the game from Ready.
- Jumping while grounded.
- Attempting to jump while airborne.
- Holding and releasing Slide.
- Sliding beneath overhead obstacles.
- Jumping over ground obstacles.
- Jump-to-slide and slide-to-jump sequences.
- Collision during each action.
- Restarting after Game Over.
- Score increase and speed progression.
- Best score persistence after refresh.
- Malformed or unavailable local storage.
- Resizing the window and changing orientation.
- Touch controls on a real mobile device when possible.
- Preventing unwanted page scroll during gameplay controls.
- Switching tabs and returning.
- Missing or slow-loading assets.
- The game remaining playable if advertising scripts are blocked or fail.

Tune obstacle speed, spawn distance, jump strength, gravity, slide duration, and collision boxes through named constants rather than scattering magic numbers throughout the code.

## 13. Code Quality Expectations

- Prefer clear, readable vanilla JavaScript.
- Use small functions with focused responsibilities.
- Keep game state explicit and predictable.
- Keep tuning values in one configuration section.
- Avoid unnecessary abstractions and premature optimization.
- Comment non-obvious gameplay and collision logic.
- Handle input cleanup when the game ends, loses focus, or restarts.
- Avoid leaving held-key or held-touch state stuck after focus changes.
- Do not add libraries or features without a reason.
- Update README instructions when setup or controls change.

## 14. How Claude Should Work

1. Inspect the existing repository before editing files.
2. If the repository is empty, create the simplest sensible structure.
3. Present a short implementation plan before making broad changes.
4. Build one phase at a time; do not implement all future features at once.
5. After each phase, run available checks and manually verify the stated exit criteria where possible.
6. If a browser or automated test environment is unavailable, state what could not be verified and provide exact manual test steps.
7. Do not claim that tests passed unless they were actually run.
8. Keep dependencies and configuration minimal.
9. Ask the project owner before choosing a permanent game name, domain, paid service, ad network, or adding a backend.
10. When making a design decision that is not specified here, choose the simplest reversible option and document it.
11. Keep this file updated when the owner approves a meaningful change to the project scope or behavior.

## 15. Definition of Done for Version One

Version one is complete when:
- The game has an original identity rather than copied Google assets or branding.
- A visitor can start playing immediately.
- Jump and momentum-based slide both work with desktop controls.
- Separate mobile controls make both actions usable on touchscreens, comfortably in portrait orientation.
- The site can be installed to a phone's home screen and played offline (PWA).
- Ground and overhead obstacles are visually distinct.
- Collision detection feels consistent and fair.
- Difficulty increases gradually.
- Score and locally saved best score work.
- Restart is immediate and reliable.
- The site is responsive, lightweight, and deployable as a static website.
- Instructions and basic site metadata are present.
- No account, backend, or external game engine is required.
- The README explains how to run the project locally.
- The game has been tested on desktop and mobile before public promotion.
- Ads are not required for the core game to function and are integrated only after a separate review.

---

## Current Product Summary

**Genre:** Original endless runner  
**Core actions:** Run, jump, slide  
**Slide behavior:** Hold-to-slide with momentum and a shorter collision hitbox  
**Platforms:** Desktop and mobile web browsers; portrait-first mobile; installable PWA (Phase 5)  
**Initial stack:** HTML, CSS, vanilla JavaScript, Canvas  
**Persistence:** Local best score via `localStorage`  
**Backend:** None for version one  
**Business model:** Display ads after launch validation and eligibility checks  
**Initial marketing:** Search visibility, short gameplay videos, score challenges, and relevant communities  
**Priority:** Fun, responsive, fair gameplay before extra features or monetization
