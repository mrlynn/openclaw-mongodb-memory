# MongoDB Brand Colors - Web Dashboard

This document explains how to use MongoDB brand colors in the web dashboard.

## CSS Custom Properties

All MongoDB brand colors are available as CSS custom properties (variables) defined in `styles/globals.css`.

### Primary Palette

```css
--mongodb-spring-green: #00ed64; /* Primary brand accent */
--mongodb-forest-green: #00684a; /* Primary dark green */
--mongodb-evergreen: #023430; /* Deep brand anchor */
--mongodb-slate-blue: #001e2b; /* Primary dark UI background */
--mongodb-white: #ffffff; /* Pure white */
--mongodb-mist: #e3fcf7; /* Soft background */
--mongodb-lavender: #f9ebff; /* Accent backgrounds */
```

### Secondary Colors

```css
--mongodb-chartreuse: #b1ff05;
--mongodb-violet: #5400f8;
--mongodb-purple: #7c25ff;
--mongodb-sky: #00d2ff;
--mongodb-chrome-yellow: #ff9f10;
```

### Neutral Grays

```css
--mongodb-gray-dark: #21313c;
--mongodb-gray-medium: #5c6c75;
--mongodb-gray-light: #c1c7c6;
--mongodb-gray-lighter: #e8edeb;
```

## Theme Variables

These variables automatically switch between light and dark themes:

### Light Theme

```css
--bg-primary: #ffffff (white) --bg-secondary: #e3fcf7 (mist) --bg-tertiary: #f9ebff (lavender)
  --text-primary: #001e2b (slate blue) --text-secondary: #00684a (forest green)
  --text-tertiary: #5c6c75 (gray medium) --border-color: #e8edeb (gray lighter)
  --accent-primary: #00ed64 (spring green) --accent-hover: #00684a (forest green);
```

### Dark Theme

```css
--bg-primary: #001e2b (slate blue) --bg-secondary: #023430 (evergreen) --bg-tertiary: #00684a
  (forest green) --text-primary: #ffffff (white) --text-secondary: #c1c7c6 (gray light)
  --text-tertiary: #5c6c75 (gray medium) --border-color: rgba(255, 255, 255, 0.15)
  --accent-primary: #00ed64 (spring green) --accent-hover: #b1ff05 (chartreuse);
```

## Usage Examples

### In Component Styles (CSS Modules)

```css
.myComponent {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.myButton {
  background-color: var(--accent-primary);
  color: var(--mongodb-slate-blue);
}

.myButton:hover {
  background-color: var(--accent-hover);
}
```

### Inline Styles (React)

```tsx
<div
  style={{
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
  }}
>
  Content
</div>
```

### Direct Brand Colors

When you need a specific MongoDB brand color that shouldn't change with theme:

```css
.brandLogo {
  color: var(--mongodb-spring-green); /* Always green */
}

.darkBackground {
  background: var(--mongodb-slate-blue); /* Always dark blue */
}
```

## Utility Classes

Pre-built utility classes are available in `globals.css`:

```html
<!-- Accent colors -->
<span class="accent-primary">Spring Green Text</span>
<div class="bg-accent-primary">Spring Green Background</div>
<button class="accent-hover">Hover Effect</button>

<!-- Glass morphism -->
<div class="glass-card">Frosted glass effect</div>

<!-- MongoDB green glow -->
<div class="glow-green">Glowing element</div>

<!-- Status colors -->
<span class="status-success">Success</span>
<span class="status-warning">Warning</span>
<span class="status-error">Error</span>
```

## Accessibility Guidelines

MongoDB follows WCAG 2.1 AA standards (4.5:1 contrast ratio minimum).

### ✅ Approved High-Contrast Combinations

**On Dark Backgrounds:**

- White on Slate Blue (#FFFFFF on #001E2B)
- White on Evergreen (#FFFFFF on #023430)
- White on Forest Green (#FFFFFF on #00684A)
- Spring Green on Slate Blue (#00ED64 on #001E2B)
- Spring Green on Evergreen (#00ED64 on #023430)
- Spring Green on Forest Green (#00ED64 on #00684A)

**On Light Backgrounds:**

- Slate Blue on White (#001E2B on #FFFFFF)
- Forest Green on White (#00684A on #FFFFFF)
- Evergreen on White (#023430 on #FFFFFF)
- Forest Green on Mist (#00684A on #E3FCF7)
- Evergreen on Mist (#023430 on #E3FCF7)

### ❌ Avoid These Combinations

- Spring Green on White (fails contrast)
- Spring Green on Mist (fails contrast)
- Spring Green on Lavender (fails contrast)
- Light colors on White
- Mist or Lavender text on White

## Design Principles

1. **Use Spring Green (#00ED64) as the primary brand signal**
   - CTAs (call-to-action buttons)
   - Key highlights
   - Interactive elements
   - **Not for body text** (contrast issues)

2. **Use Slate Blue (#001E2B) for primary dark UI**
   - Main backgrounds in dark mode
   - Documentation headers
   - Technical contexts

3. **Use Mist (#E3FCF7) and Lavender (#F9EBFF) for light accents**
   - Card backgrounds
   - Section dividers
   - Hover states

4. **Maintain consistent combinations**
   - Don't create arbitrary tints
   - Use predefined colors from the palette
   - Test contrast before shipping

## Testing Contrast

Before releasing any new UI component:

1. Visit https://webaim.org/resources/contrastchecker/
2. Enter your foreground and background hex values
3. Verify it meets WCAG AA (4.5:1 minimum)
4. For large text (18pt+ or 14pt bold), 3:1 is acceptable

## LeafyGreen UI Integration

The MongoDB LeafyGreen UI library automatically uses brand colors. Our custom theme variables work alongside LeafyGreen components.

**Example:**

```tsx
import Button from "@leafygreen-ui/button";
import { useThemeMode } from "@/contexts/ThemeContext";

function MyComponent() {
  const { darkMode } = useThemeMode();

  return (
    <Button darkMode={darkMode} variant="primary">
      Click Me
    </Button>
  );
}
```

LeafyGreen's `darkMode` prop automatically switches component styles to match our theme.

## Migration Checklist

When updating existing components to use MongoDB brand colors:

- [ ] Replace hardcoded hex colors with CSS variables
- [ ] Use theme variables (`--bg-primary`, `--text-primary`, etc.) for theme-aware colors
- [ ] Use direct brand colors (`--mongodb-spring-green`, etc.) for fixed brand elements
- [ ] Test both light and dark themes
- [ ] Verify contrast ratios with WCAG checker
- [ ] Update any component-specific CSS modules
- [ ] Test on mobile (responsive breakpoints)

## Resources

- **Brand Guidelines:** `/BRAND.md` (project root)
- **Global Styles:** `/packages/web/styles/globals.css`
- **LeafyGreen UI:** https://mongodb.design/
- **WCAG Contrast Checker:** https://webaim.org/resources/contrastchecker/
