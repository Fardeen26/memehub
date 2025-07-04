"use client"

import { ExternalLinkIcon, GithubIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
// import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function Navbar() {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    return (
        <nav className="w-full bg-white dark:bg-black">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0">
                        <Link href="/">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center -space-x-2.5">
                                <span>
                                    <span className="px-2 py-0.5 bg-transparent"></span>Meme <span className="bg-[#6a7bd1] rounded-sm text-white px-2 py-0.5">Hub</span>
                                </span>
                            </h1>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="p-2 rounded-md bg-black/80 text-white dark:bg-white/20 border dark:border-gray-200/20 transition-colors"
                        >
                            {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={() => window.open("https://github.com/Fardeen26/meme-generator", "_blank")}
                            className="max-[350px]:hidden py-2 px-4 h-8 rounded-md bg-black/80 text-white dark:bg-white/20 border dark:border-gray-200/20 transition-colors flex items-center gap-2"
                        >
                            <GithubIcon className="h-4 w-4" /> <span className="text-sm font-semibold"> Give it a star </span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
} 