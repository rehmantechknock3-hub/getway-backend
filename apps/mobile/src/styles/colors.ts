export const appColors = {
  /** WayNow royal blue — light-flow CTAs */
  primary: {
    50:  "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#2D5BFF",
    600: "#2547E6",
    700: "#1E3AC4",
    800: "#1A2F9E",
    900: "#172A7A",
  },
  ink: {
    DEFAULT: "#1C1917",
    soft:    "#44403C",
    muted:   "#78716C",
    subtle:  "#A8A29E",
    faint:   "#E8E6E1",
  },
  canvas: {
    DEFAULT: "#F8F9FB",
    raised:  "#FFFFFF",
    sunken:  "#F0F1F5",
  },
  /** Dark "All Services" home surface */
  surface: {
    night:    "#070B14",
    card:     "#121826",
    elevated: "#1A2233",
    border:   "#2A3348",
    muted:    "#8B93A7",
    soft:     "#C5CAD6",
  },
  /** Popular-row glow accents */
  glow: {
    purple: "#8B5CF6",
    blue:   "#3B82F6",
    amber:  "#F59E0B",
    violet: "#A855F7",
  },
  /** Category card gradient bases (car marketplace home) */
  category: {
    wash:     "#3B1F6B",
    tyres:    "#1E3A5F",
    mechanic: "#1A4D3E",
    battery:  "#2A1F5C",
    roadside: "#5C3D1E",
  },
  onPrimary: "#FFFFFF",
  semantic: {
    warning:     "#F59E0B",
    disabled:    "#D6D3D1",
    destructive: "#B91C1C",
    info:        "#3B82F6",
    success:     "#10B981",
  },
} as const;
