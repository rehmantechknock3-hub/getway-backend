/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@repo/config/eslint/expo"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
