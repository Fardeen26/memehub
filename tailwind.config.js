/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-geist-sans)'],
                mono: ['var(--font-geist-mono)'],
            },
            keyframes: {
                'fade-in': {
                    '0%': {
                        opacity: '0',
                        transform: 'scale(0.98)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'scale(1)'
                    },
                }
            },
            animation: {
                'fade-in': 'fade-in 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            },
        },
    },
    plugins: [],
} 