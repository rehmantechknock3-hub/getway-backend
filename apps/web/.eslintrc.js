/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@repo/config/eslint/next"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
