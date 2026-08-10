import type { ComponentProps } from "react";
import type { ImageSourcePropType } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../styles/colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type PopularService = {
  id: string;
  label: string;
  /** Primary keyword for provider matching (aligned with service categories). */
  filterLabel: string;
  glow: keyof typeof appColors.glow;
  /** Photorealistic circular image when set; otherwise falls back to `icon`. */
  image?: ImageSourcePropType;
  /** Outline icon fallback (kept for Battery). */
  icon?: IoniconName;
};

export type HomeCategory = {
  id: string;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  /** Tailwind-friendly token key for card background. */
  tone: keyof typeof appColors.category;
  /** Keywords OR-matched against provider catalog / category fields. */
  filterKeywords: string[];
};

export const POPULAR_SERVICES: PopularService[] = [
  {
    id: "mechanic",
    label: "Mechanic",
    filterLabel: "Engine Diagnostics",
    glow: "violet",
    image: require("../../assets/home-popular/mechanic.png"),
  },
  {
    id: "car-wash",
    label: "Car Wash",
    filterLabel: "Car Wash",
    glow: "blue",
    image: require("../../assets/home-popular/car-wash.png"),
  },
  {
    id: "tyres",
    label: "Tyres",
    filterLabel: "Tire Service",
    glow: "amber",
    image: require("../../assets/home-popular/tyres.png"),
  },
  {
    id: "battery",
    label: "Battery",
    filterLabel: "Battery Service",
    icon: "battery-charging-outline",
    glow: "purple",
  },
];

export const HOME_CATEGORIES: HomeCategory[] = [
  {
    id: "wash-cleaning",
    title: "Wash & Cleaning",
    subtitle: "Mobile wash, detail & interior",
    image: require("../../assets/home-categories/wash-cleaning.png"),
    tone: "wash",
    filterKeywords: [
      "Car Wash",
      "Car Detailing",
      "Interior Cleaning",
      "Car Polishing",
    ],
  },
  {
    id: "tyres-wheels",
    title: "Tyres & Wheels",
    subtitle: "Tyre change & wheel care",
    image: require("../../assets/home-categories/tyres-wheels.png"),
    tone: "tyres",
    filterKeywords: ["Tire Service"],
  },
  {
    id: "mechanic-repairs",
    title: "Mechanic & Repairs",
    subtitle: "Fix it fast, stress free",
    image: require("../../assets/home-categories/mechanic-repairs.png"),
    tone: "mechanic",
    filterKeywords: [
      "Engine Diagnostics",
      "Brake Service",
      "Oil Change",
      "AC Service",
      "Vehicle Inspection",
    ],
  },
  {
    id: "battery-power",
    title: "Battery & Power",
    subtitle: "Jump starts & replacements",
    image: require("../../assets/home-categories/battery-power.png"),
    tone: "battery",
    filterKeywords: ["Battery Service"],
  },
  {
    id: "roadside-help",
    title: "Roadside Help",
    subtitle: "Help when you need it",
    image: require("../../assets/home-categories/roadside-help.png"),
    tone: "roadside",
    filterKeywords: ["Roadside Assistance"],
  },
];
