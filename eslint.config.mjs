import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default [
    { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,
    {
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off"
        }
    },
    {
        ignores: [
            "**/dist/*",
            "*.js",
            "cli/*",
            "dist-electron/*",
            "**/node_modules/*",
            "release/*"
        ]
    },
    {
        settings: {
            react: {
                version: "detect"
            }
        }
    }
];
