"use client"

import { Heart, MoonIcon, SunIcon, Laugh, Video } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function Navbar() {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme, setTheme } = useTheme()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    const currentTheme = resolvedTheme === "dark" ? "dark" : "light"
    const nextTheme = currentTheme === "dark" ? "light" : "dark"

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
                        <Link
                            href="/video-editor"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#6a7bd1]/60 bg-[#6a7bd1]/10 px-3 text-xs font-semibold text-[#4d5fbe] transition-colors hover:bg-[#6a7bd1]/20 dark:text-[#c5ccff]"
                        >
                            <Video className="h-3.5 w-3.5" /> Video editor
                        </Link>
                        <button
                            onClick={() => setTheme(nextTheme)}
                            aria-label={`Switch to ${nextTheme} theme`}
                            className="p-2 rounded-md bg-black/80 text-white dark:bg-white/20 border dark:border-gray-200/20 transition-colors cursor-pointer"
                        >
                            {currentTheme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={() => window.open("https://github.com/sponsors/Fardeen26", "_blank")}
                            className="max-[350px]:hidden py-2 px-4 h-8 rounded-md bg-black/80 text-white dark:bg-white/20 border dark:border-gray-200/20 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <div><Heart className="h-4 w-4 text-red-400" /></div> <div className="text-sm mb-[1px] font-semibold"> Sponsor </div>
                        </button>
                        <button
                            onClick={() => window.open("https://x.com/fardeentwt", "_blank")}
                            className="max-[510px]:hidden py-2 px-4 h-8 rounded-md bg-black/80 text-white dark:bg-white/20 border dark:border-gray-200/20 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <div><Laugh className="h-4 w-4 text-yellow-400" /></div> <div className="text-sm mb-[1px] font-semibold"> built by fardeentwt </div>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
