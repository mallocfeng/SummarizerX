# Summary Card Title Block Design

## Goal
Show the page title at the top of the summary card so users can immediately see what the summary refers to, before the key points begin.

## Constraints
- Keep changes localized to the summary card rendering in `float_panel.js`.
- No new fonts or external assets.
- Must respect existing i18n rules (add new strings in `i18n.js`).

## Approach
Insert a small title block above the summary markdown output. The block consists of a label (e.g., “标题/Title”) and the page title text. The label is localized via i18n, while the title text uses the current page `document.title`, with a safe fallback to history metadata when a history entry is active or PDF name when available. The block is styled with existing theme tokens (`--surface-2`, `--border`, `--text`) to blend with the current card layout.

To align with the output language, the title text is translated via the existing background translation pipeline when the title appears to be in a different language than the configured output. The label also follows the output language setting.

## Data Flow
1. Render summary markdown as before.
2. Compute `titleText` from history group title → PDF name → document title.
3. Compute `titleLabel` from `i18n.tSync`.
4. Prepend a title block to the summary HTML if `titleText` is non-empty.
5. If output language differs from detected title language, request a translation and update the title text.

## Risks
- Title may be empty on some pages; block is omitted in that case.
- For history entries, the title may reflect the stored source instead of the current page.

## Validation
- Check both zh/en UI language; confirm label updates.
- Verify summary card shows the title above key points.
- Confirm styling in light and dark themes.
