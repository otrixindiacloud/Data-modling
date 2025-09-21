// Smart Color Palette Generator for Data Model Themes
import { colord, Colord } from "colord";

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  // Additional shades for UI elements
  primaryLight: string;
  primaryDark: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
}

export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  baseColor: string;
  palette: ColorPalette;
  category: 'professional' | 'vibrant' | 'muted' | 'monochrome' | 'custom';
}

export interface ColorHarmony {
  name: string;
  colors: string[];
  description: string;
}

// Predefined professional color themes
export const PROFESSIONAL_THEMES: ColorTheme[] = [
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme perfect for business applications',
    baseColor: '#2563eb',
    category: 'professional',
    palette: generatePaletteFromBase('#2563eb')
  },
  {
    id: 'modern-purple',
    name: 'Modern Purple',
    description: 'Contemporary purple theme with sophisticated accents',
    baseColor: '#7c3aed',
    category: 'professional',
    palette: generatePaletteFromBase('#7c3aed')
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural green theme for environmental and sustainability themes',
    baseColor: '#059669',
    category: 'professional',
    palette: generatePaletteFromBase('#059669')
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Warm orange theme for creative and energy-focused models',
    baseColor: '#ea580c',
    category: 'vibrant',
    palette: generatePaletteFromBase('#ea580c')
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    description: 'Calming teal theme for data lake and analytics platforms',
    baseColor: '#0891b2',
    category: 'professional',
    palette: generatePaletteFromBase('#0891b2')
  },
  {
    id: 'tech-slate',
    name: 'Tech Slate',
    description: 'Modern slate gray theme for technical and engineering models',
    baseColor: '#475569',
    category: 'muted',
    palette: generatePaletteFromBase('#475569')
  }
];

// Generate a complete color palette from a base color
export function generatePaletteFromBase(baseColor: string): ColorPalette {
  const base = colord(baseColor);
  
  // Generate harmonious colors using color theory
  const analogous = base.rotate(30);
  const triadic = base.rotate(120);
  const complement = base.rotate(180);
  
  return {
    primary: base.toHex(),
    secondary: analogous.toHex(),
    accent: triadic.toHex(),
    neutral: colord('#64748b').toHex(),
    success: colord('#10b981').toHex(),
    warning: colord('#f59e0b').toHex(),
    error: colord('#ef4444').toHex(),
    info: colord('#3b82f6').toHex(),
    primaryLight: base.lighten(0.3).toHex(),
    primaryDark: base.darken(0.2).toHex(),
    background: base.lighten(0.45).alpha(0.05).toHex(),
    surface: colord('#ffffff').toHex(),
    border: base.lighten(0.3).alpha(0.3).toHex(),
    text: colord('#1f2937').toHex(),
    textMuted: colord('#6b7280').toHex()
  };
}

// Generate color harmonies based on color theory
export function generateColorHarmonies(baseColor: string): ColorHarmony[] {
  const base = colord(baseColor);
  
  return [
    {
      name: 'Analogous',
      description: 'Colors adjacent on the color wheel - creates harmony and comfort',
      colors: [
        base.rotate(-30).toHex(),
        base.toHex(),
        base.rotate(30).toHex(),
        base.rotate(60).toHex()
      ]
    },
    {
      name: 'Triadic',
      description: 'Three colors evenly spaced on the color wheel - vibrant and balanced',
      colors: [
        base.toHex(),
        base.rotate(120).toHex(),
        base.rotate(240).toHex()
      ]
    },
    {
      name: 'Complementary',
      description: 'Opposite colors on the wheel - high contrast and energy',
      colors: [
        base.toHex(),
        base.rotate(180).toHex()
      ]
    },
    {
      name: 'Split Complementary',
      description: 'Base color with two adjacent to its complement - balanced contrast',
      colors: [
        base.toHex(),
        base.rotate(150).toHex(),
        base.rotate(210).toHex()
      ]
    },
    {
      name: 'Tetradic',
      description: 'Four colors forming a rectangle - rich and varied palette',
      colors: [
        base.toHex(),
        base.rotate(90).toHex(),
        base.rotate(180).toHex(),
        base.rotate(270).toHex()
      ]
    },
    {
      name: 'Monochromatic',
      description: 'Different shades and tints of the same color - sophisticated and cohesive',
      colors: [
        base.darken(0.3).toHex(),
        base.darken(0.15).toHex(),
        base.toHex(),
        base.lighten(0.15).toHex(),
        base.lighten(0.3).toHex()
      ]
    }
  ];
}

// Generate entity-specific color assignments
export function generateEntityColors(
  baseTheme: ColorPalette,
  entities: { type: string; items: string[] }[]
): Record<string, Record<string, string>> {
  const assignments: Record<string, Record<string, string>> = {};
  
  // Color pools for different entity types
  const colorPools = {
    domain: generateColorShades(baseTheme.primary, 8),
    dataArea: generateColorShades(baseTheme.secondary, 8),
    sourceSystem: generateColorShades(baseTheme.accent, 12),
    targetSystem: generateColorShades(baseTheme.info, 8),
    objectType: generateColorShades(baseTheme.neutral, 6)
  };
  
  entities.forEach(({ type, items }) => {
    assignments[type] = {};
    const colors = colorPools[type as keyof typeof colorPools] || generateColorShades(baseTheme.primary, items.length);
    
    items.forEach((item, index) => {
      assignments[type][item] = colors[index % colors.length];
    });
  });
  
  return assignments;
}

// Generate color shades for a given base color
export function generateColorShades(baseColor: string, count: number): string[] {
  const base = colord(baseColor);
  const shades: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const hueShift = (i * 360) / count;
    const shade = base.rotate(hueShift).toHex();
    shades.push(shade);
  }
  
  return shades;
}

// Analyze color accessibility and contrast
export function analyzeColorAccessibility(color: string, backgroundColor: string = '#ffffff'): {
  contrast: number;
  rating: 'AAA' | 'AA' | 'Fail';
  suggestions: string[];
} {
  const foreground = colord(color);
  const background = colord(backgroundColor);
  // Calculate contrast ratio using relative luminance
  const getLuminance = (color: any) => {
    const rgb = color.toRgb();
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const contrast = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
  
  let rating: 'AAA' | 'AA' | 'Fail';
  const suggestions: string[] = [];
  
  if (contrast >= 7) {
    rating = 'AAA';
  } else if (contrast >= 4.5) {
    rating = 'AA';
    suggestions.push('Consider increasing contrast for AAA compliance');
  } else {
    rating = 'Fail';
    suggestions.push('Increase contrast to meet accessibility standards');
    suggestions.push(`Current contrast ratio: ${contrast.toFixed(2)}, minimum required: 4.5`);
  }
  
  return { contrast, rating, suggestions };
}

// Generate theme variations (light/dark modes)
export function generateThemeVariations(baseTheme: ColorPalette): {
  light: ColorPalette;
  dark: ColorPalette;
} {
  const base = colord(baseTheme.primary);
  
  return {
    light: baseTheme,
    dark: {
      ...baseTheme,
      background: colord('#0f172a').toHex(),
      surface: colord('#1e293b').toHex(),
      text: colord('#f8fafc').toHex(),
      textMuted: colord('#cbd5e1').toHex(),
      border: base.darken(0.2).alpha(0.3).toHex(),
      neutral: colord('#64748b').lighten(0.2).toHex()
    }
  };
}

// Smart color suggestions based on industry/domain
export function suggestColorsForDomain(domainName: string): ColorTheme[] {
  const domainColorMap: Record<string, string[]> = {
    'finance': ['#1d4ed8', '#059669', '#dc2626'], // Blue, Green, Red for financial themes
    'healthcare': ['#0891b2', '#10b981', '#f59e0b'], // Teal, Green, Orange for medical themes
    'manufacturing': ['#7c3aed', '#ea580c', '#64748b'], // Purple, Orange, Gray for industrial themes
    'retail': ['#ec4899', '#f59e0b', '#3b82f6'], // Pink, Orange, Blue for commerce themes
    'technology': ['#6366f1', '#8b5cf6', '#06b6d4'], // Indigo, Violet, Cyan for tech themes
    'education': ['#3b82f6', '#10b981', '#f59e0b'], // Blue, Green, Orange for academic themes
    'government': ['#1e40af', '#374151', '#dc2626'], // Navy, Gray, Red for government themes
    'nonprofit': ['#059669', '#3b82f6', '#f59e0b'] // Green, Blue, Orange for social themes
  };
  
  const normalizedDomain = domainName.toLowerCase();
  const suggestedColors = domainColorMap[normalizedDomain] || domainColorMap['technology'];
  
  return suggestedColors.map((color, index) => ({
    id: `${normalizedDomain}-theme-${index + 1}`,
    name: `${domainName} Theme ${index + 1}`,
    description: `Optimized color theme for ${domainName} domain`,
    baseColor: color,
    category: 'professional' as const,
    palette: generatePaletteFromBase(color)
  }));
}

// Export color theme to CSS variables
export function exportThemeToCSS(theme: ColorPalette): string {
  return Object.entries(theme)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `  --color-${cssKey}: ${value};`;
    })
    .join('\n');
}

// Convert hex to HSL for better color manipulation
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const color = colord(hex);
  return color.toHsl();
}

// Generate gradient backgrounds
export function generateGradient(color1: string, color2: string, direction: string = '135deg'): string {
  return `linear-gradient(${direction}, ${color1}, ${color2})`;
}