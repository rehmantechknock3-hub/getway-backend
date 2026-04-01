/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./base", "expo"],
  rules: {
    "import/no-unresolved": "off",
  },
};
