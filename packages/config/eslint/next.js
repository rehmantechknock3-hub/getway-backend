/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./base", "next/core-web-vitals"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
};
