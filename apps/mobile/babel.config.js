module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // Disable Expo's auto worklets/reanimated injection — nativewind/babel already
      // registers react-native-worklets/plugin. Running both breaks style application.
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          worklets: false,
          reanimated: false,
        },
      ],
      "nativewind/babel",
    ],
  };
};
