import Link from "next/link";

export default function Footer() {
    return (
        <footer className="py-10 w-full text-center">
            <p className="text-sm text-center text-black/50 dark:text-white/40">built by this retard <Link href='https://x.com/fardeentwt' target="_blank" className="cursor-none hover:underline">@fardeen</Link></p>
        </footer>
    )
}