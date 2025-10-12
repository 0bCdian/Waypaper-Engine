/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Custom color palette with CSS variables
                primary: {
                    50: 'hsl(var(--color-primary50, 239 246 255))',
                    100: 'hsl(var(--color-primary100, 219 234 254))',
                    200: 'hsl(var(--color-primary200, 191 219 254))',
                    300: 'hsl(var(--color-primary300, 147 197 253))',
                    400: 'hsl(var(--color-primary400, 96 165 250))',
                    500: 'hsl(var(--color-primary500, 59 130 246))',
                    600: 'hsl(var(--color-primary600, 37 99 235))',
                    700: 'hsl(var(--color-primary700, 29 78 216))',
                    800: 'hsl(var(--color-primary800, 30 64 175))',
                    900: 'hsl(var(--color-primary900, 30 58 138))',
                },
                secondary: {
                    50: 'hsl(var(--color-secondary50, 248 250 252))',
                    100: 'hsl(var(--color-secondary100, 241 245 249))',
                    200: 'hsl(var(--color-secondary200, 226 232 240))',
                    300: 'hsl(var(--color-secondary300, 203 213 225))',
                    400: 'hsl(var(--color-secondary400, 148 163 184))',
                    500: 'hsl(var(--color-secondary500, 100 116 139))',
                    600: 'hsl(var(--color-secondary600, 71 85 105))',
                    700: 'hsl(var(--color-secondary700, 51 65 85))',
                    800: 'hsl(var(--color-secondary800, 30 41 59))',
                    900: 'hsl(var(--color-secondary900, 15 23 42))',
                },
                neutral: {
                    50: 'hsl(var(--color-neutral50, 249 250 251))',
                    100: 'hsl(var(--color-neutral100, 243 244 246))',
                    200: 'hsl(var(--color-neutral200, 229 231 235))',
                    300: 'hsl(var(--color-neutral300, 209 213 219))',
                    400: 'hsl(var(--color-neutral400, 156 163 175))',
                    500: 'hsl(var(--color-neutral500, 107 114 128))',
                    600: 'hsl(var(--color-neutral600, 75 85 99))',
                    700: 'hsl(var(--color-neutral700, 55 65 81))',
                    800: 'hsl(var(--color-neutral800, 31 41 55))',
                    900: 'hsl(var(--color-neutral900, 17 24 39))',
                },
                // Theme-specific colors
                base: 'hsl(var(--color-base))',
                'base-content': 'hsl(var(--color-baseContent))',
                info: 'hsl(var(--color-info))',
                success: 'hsl(var(--color-success))',
                warning: 'hsl(var(--color-warning))',
                error: 'hsl(var(--color-error))',
            },
            fontFamily: {
                sans: ['var(--font-primary, Inter)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-mono, JetBrains Mono)', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'theme-transition': 'themeTransition 0.3s ease-in-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                themeTransition: {
                    '0%': { opacity: '0.8' },
                    '100%': { opacity: '1' },
                },
            },
            transitionProperty: {
                'theme': 'background-color, color, border-color, box-shadow',
            },
        },
    },
    plugins: [
        require("tailwind-scrollbar")({ nocompatible: true }),
        require("daisyui")
    ],
    daisyui: {
        themes: true, // Enable all 35 built-in DaisyUI themes
        darkTheme: "dark",
        base: true,
        styled: true,
        utils: true,
        rtl: false,
        prefix: "",
        logs: false,
    }
};
