const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind }   = require("nativewind/metro");
const path = require("path");

const projectRoot  = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Enable monorepo support
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force single copies of React to prevent "multiple copies" errors in pnpm monorepos
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react/jsx-runtime": path.resolve(projectRoot, "node_modules/react/jsx-runtime"),
};

module.exports = withNativeWind(config, { input: "./src/globals.css" });
