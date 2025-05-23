"use client"

import useSelected from "@/hooks/useSelected";

export default function HeroSection() {
    const { selected } = useSelected()
    return (
        <section className={`justify-center pt-12 pb-8 relative ${selected ? 'hidden' : 'flex'}`}>
            <div className="flex gap-4 flex-col">
                <h1 className="text-5xl md:text-[5rem] max-w-2xl tracking-tighter text-center font-regular">
                    <span className="text-spektr-cyan-50">Generate memes in <span className="font-bold animate-gradient bg-gradient-to-r from-[#6a7bd1] via-[#8a9cf1] to-[#6a7bd1] pr-2 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-flow">seconds</span></span>
                </h1>
                <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
                    without dealing with a messy ui
                </p>
            </div>
        </section>
    )
}