const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

function resolveExisting(...candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const reactPath = resolveExisting(
  path.resolve(projectRoot, "node_modules/react"),
  path.resolve(workspaceRoot, "node_modules/react")
);
const reactNativePath = resolveExisting(
  path.resolve(projectRoot, "node_modules/react-native"),
  path.resolve(workspaceRoot, "node_modules/react-native"),
  path.resolve(workspaceRoot, "nm/rn")
);

const resolveRoots = [
  projectRoot,
  path.resolve(projectRoot, "node_modules"),
  workspaceRoot,
  path.resolve(workspaceRoot, "node_modules"),
  reactNativePath,
  reactPath,
];

const config = getDefaultConfig(projectRoot);

// Watch only mobile + shared packages — not apps/api / Nest deps (Metro ENOENT on pnpm tmp dirs).
// `nm/*` holds Windows junctions for react-native and related packages used by Metro.
config.watchFolders = [
  path.resolve(workspaceRoot, "packages/api-client"),
  path.resolve(workspaceRoot, "packages/hooks"),
  path.resolve(workspaceRoot, "packages/schemas"),
  path.resolve(workspaceRoot, "packages/ui"),
  path.resolve(workspaceRoot, "packages/utils"),
  path.resolve(workspaceRoot, "packages/config"),
  path.resolve(workspaceRoot, "nm"),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

const forcedModules = {
  react: reactPath,
  "react-native": reactNativePath,
};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...forcedModules,
};

/**
 * pnpm + Windows junctions break Metro subpath resolution for `react-native/...`
 * when hierarchical lookup is disabled. Resolve those (and react) via Node.
 *
 * IMPORTANT: register this BEFORE withNativeWind(). NativeWind wraps resolveRequest
 * to remap globals.css onto its virtual platform CSS modules. Overwriting
 * resolveRequest after withNativeWind() silently disables all className styles.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isForced =
    moduleName === "react" ||
    moduleName === "react-native" ||
    moduleName.startsWith("react/") ||
    moduleName.startsWith("react-native/");

  if (isForced) {
    try {
      const filePath = require.resolve(moduleName, { paths: resolveRoots });
      return { type: "sourceFile", filePath };
    } catch {
      // Fall through to Metro default.
    }
  }

  // Avoid recursion: call Metro's default resolver, not this custom hook.
  return context.resolveRequest(
    {
      ...context,
      resolveRequest: undefined,
    },
    moduleName,
    platform
  );
};

const withNw = withNativeWind(config, { input: "./src/globals.css" });

// Keep forced module roots, but never replace NativeWind's resolveRequest wrapper.
withNw.resolver = withNw.resolver ?? {};
withNw.resolver.extraNodeModules = {
  ...(withNw.resolver.extraNodeModules ?? {}),
  ...forcedModules,
};
withNw.resolver.nodeModulesPaths = config.resolver.nodeModulesPaths;
withNw.resolver.disableHierarchicalLookup = true;

module.exports = withNw;
