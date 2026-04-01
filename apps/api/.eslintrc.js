/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@repo/config/eslint/base"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
