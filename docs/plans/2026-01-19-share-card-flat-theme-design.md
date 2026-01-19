# Share Card Flat Theme Design

## Goal
Improve the share-card image aesthetics by making it flatter, cleaner, and easier to read, while reducing the outer card corner radius.

## Constraints
- Canvas-only rendering inside `float_panel.js`.
- No new fonts, no remote assets, no permission changes.
- Keep changes localized to share image generation.

## Approach
Introduce a small theme configuration object inside `generateShareImageFromSummary` to centralize visual tokens:
- Background fill color
- Card fill, border, radius, and shadow values
- Header band fill and divider line
- Text colors for title, body, headings, blockquote, and footer
- Badge colors for domain label

Replace the previous gradient + wave header and heavier shadow with a flat band, thinner divider line, and lighter shadow. Reduce card corner radius to create a flatter look.

## Data Flow
1. Parse summary content blocks.
2. Measure layout and compute card height.
3. Apply theme tokens for drawing background, card, header, body, and footer.
4. Export PNG to clipboard.

## Risks
- Minor visual regressions if the new palette is too low-contrast on some pages.

## Validation
- Generate share image in light and dark themes.
- Test with headings, lists, and blockquotes for alignment and contrast.
- Paste into common apps (WeChat, Feishu, Notion) to verify clarity.
