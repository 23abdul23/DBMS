import expoConfig from "eslint-config-expo/flat.js"
export default [
  ...expoConfig,
  {
    ignores: ["android/**", "ios/**", "dist/**", "web-build/**", ".expo/**", "eslint.config.js"],
  },
]