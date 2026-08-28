# Design QA

## Comparison target

- Source visual truth:
  - `/var/folders/zj/2c733p79007ckhgs94ym6vs40000gn/T/codex-clipboard-04209e1f-3bed-4d22-ae72-63e3511fabd0.png`
  - `/var/folders/zj/2c733p79007ckhgs94ym6vs40000gn/T/codex-clipboard-3f48ba36-42e9-4754-a173-70248d1074e4.png`
- Rendered implementation:
  - `work/design-qa/roadlore-after-1528x1184.png`
  - `work/design-qa/campglass-after-1964x1018.png`
  - `work/design-qa/planner-autocomplete-1280x720.png`
- Full-view comparison evidence:
  - `work/design-qa/roadlore-source-vs-after.png`
  - `work/design-qa/campglass-source-vs-after.png`
- Focused comparison evidence:
  - `work/design-qa/roadlore-focus-source-vs-after.png`
  - `work/design-qa/campglass-focus-source-vs-after.png`

The supplied screenshots are defect references rather than fidelity mocks. The goal was to preserve Waypoint's established dark interface while removing the visible clipping, overflow, and floating annotation treatment.

## Viewports and state

| Surface | Source pixels | Implementation pixels | CSS viewport | Density handling | State |
| --- | ---: | ---: | ---: | --- | --- |
| RoadLore | 1528 × 1184 | 1528 × 1184 | 1528 × 1184 | Exact-size 1:1 comparison; source density treated as 1× because its pixels match the requested capture | Shorewood Hills manual origin, no destination, live Wikipedia story |
| Campglass | 1964 × 1018 | 1964 × 1018 | 1964 × 1018 | Exact-size 1:1 comparison; source density treated as 1× because its pixels match the requested capture | Shorewood Hills manual origin, no destination, live overnight forecast |
| Planner | n/a | 1280 × 720 | 1280 × 720 | Browser default at 1× | Origin selected; destination query returning live suggestions |

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the existing Inter family and weight hierarchy are preserved. Empty-rail copy now wraps within its track, address rows truncate long geographic names without overflowing, and the RoadLore player timing and status text no longer collide.
- Spacing and layout rhythm: RoadLore and Campglass now use explicit, non-overlapping tracks for the journey rail, content canvas, and right controls. The wide screenshots no longer hide or crop persistent controls.
- Colors and visual tokens: existing Waypoint tokens are preserved. Address focus, selected, loading, and error states use existing semantic colors with visible contrast.
- Image quality and asset fidelity: RoadLore keeps the live Wikipedia image at its natural crop and removes the diagonal CSS route drawing and floating story cards that obscured it.
- Copy and content: location, forecast, and story copy remain live and source-attributed. Autocomplete results show both a short name and the complete address.
- Accessibility and interaction: the planner exposes labeled combobox/listbox semantics, active descendant state, Arrow/Enter/Escape behavior, a polite status region, dialog focus trapping, and focus return to the settings trigger.

## Comparison history

### Pass 1 — blocked

- P0: each keystroke recreated the dialog close callback, reran the modal effect, and moved focus to the close button.
- P0: clearing a selected destination could briefly leave a stale route with a null destination and crash `JourneyRail`.
- P1: address lookup silently chose one backend result; there was no visible, selectable autocomplete.
- P1: RoadLore's diagonal route line and floating labels obscured the source image and collided with the rail at wide sizes.
- P1: Campglass allowed the empty rail copy and forecast canvas to clip while its controls were pushed out of the visible composition.

Fixes: stabilized modal focus management, guarded the stale-route transition, added a live Nominatim combobox, replaced RoadLore's CSS route art with a contained image caption, and assigned explicit content/control tracks to RoadLore and Campglass.

### Pass 2 — blocked

- P2: RoadLore's seek timing and narration status were too close at the 1280 × 720 Tesla-like viewport.
- P2: the Wikipedia source link inherited the browser's visited-link styling.

Fixes: increased player spacing and applied the established RoadLore action styling to links.

### Pass 3 — passed

- The full-view and focused combined comparisons show the clipped source rail and oversized canvases replaced by contained, readable regions.
- Sequential typing retained focus on the origin input.
- Live results appeared after the debounce; Enter and pointer selection both populated the complete address.
- Clearing a selected destination left the app rendered and returned it to the empty-route state.
- Closing the dialog returned focus to `Open trip settings`.
- A fresh browser tab reported no console errors after the complete interaction sequence.

## Primary browser interactions tested

- Open and close planner.
- Type continuously in origin and destination fields.
- Wait for live address results.
- Select results with Enter and pointer click.
- Clear an existing selected destination.
- Confirm focus remains in the active input and returns to the trigger on close.
- Navigate between RouteCast, RoadLore, and Campglass.
- Render RoadLore and Campglass at the exact supplied screenshot dimensions.

final result: passed
