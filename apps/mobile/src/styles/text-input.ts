import type { TextStyle } from "react-native";

/** iOS can render TextInput placeholders with broken per-character spacing when letterSpacing is unset/inherited. */
export const textInputBaselineStyle: TextStyle = { letterSpacing: 0 };
