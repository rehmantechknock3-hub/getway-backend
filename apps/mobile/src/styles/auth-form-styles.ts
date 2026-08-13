import { StyleSheet } from "react-native";

import { appColors } from "./colors";

/** Auth screens must not rely on NativeWind alone — Expo Go can drop className styles. */
export const authFormStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.canvas.DEFAULT,
  },
  scroll: {
    flex: 1,
  },
  backBtn: {
    marginHorizontal: 20,
    marginBottom: 32,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.primary[50],
    borderWidth: 1,
    borderColor: appColors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: appColors.ink.DEFAULT,
    marginBottom: 4,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: appColors.ink.muted,
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: appColors.ink.DEFAULT,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    backgroundColor: appColors.canvas.raised,
    borderWidth: 1,
    borderColor: appColors.ink.faint,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: appColors.ink.DEFAULT,
    letterSpacing: 0,
    marginBottom: 16,
  },
  inputRow: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  passwordWrap: {
    marginBottom: 24,
    position: "relative",
  },
  passwordInput: {
    width: "100%",
    backgroundColor: appColors.canvas.raised,
    borderWidth: 1,
    borderColor: appColors.ink.faint,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 48,
    fontSize: 16,
    color: appColors.ink.DEFAULT,
    letterSpacing: 0,
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    top: 14,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: appColors.primary[600],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: appColors.onPrimary,
    fontWeight: "600",
    fontSize: 16,
  },
  linkRow: {
    alignItems: "center",
    marginTop: 24,
  },
  muted: {
    fontSize: 16,
    color: appColors.ink.muted,
  },
  link: {
    color: appColors.primary[600],
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: appColors.ink.faint,
  },
  dividerText: {
    fontSize: 14,
    color: appColors.ink.subtle,
  },
  codeBox: {
    backgroundColor: appColors.canvas.raised,
    borderWidth: 1,
    borderColor: appColors.ink.faint,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  codeInput: {
    color: appColors.ink.DEFAULT,
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 12,
  },
  secondaryAction: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  stepActive: {
    height: 4,
    width: 32,
    borderRadius: 999,
    backgroundColor: appColors.primary[600],
  },
  stepDone: {
    height: 4,
    width: 16,
    borderRadius: 999,
    backgroundColor: appColors.primary[600],
  },
  stepIdle: {
    height: 4,
    width: 16,
    borderRadius: 999,
    backgroundColor: appColors.ink.faint,
  },
});
