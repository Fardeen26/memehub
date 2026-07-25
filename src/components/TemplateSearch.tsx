"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight } from "lucide-react";
import { templates as curatedTemplates } from "@/data/templates";
import MainContainer from "./MainContainer";
import { motion } from "framer-motion";
import useSelected from "@/hooks/useSelected";
import { useTrendingTemplates } from "@/hooks/useTrendingTemplates";
import {
    curatedToEditorTemplates,
    mergeCuratedAndTrending,
} from "@/lib/templateUtils";

export default function TemplateSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const { selected, setCurrentPage } = useSelected();
    const { templates: trendingTemplates } = useTrendingTemplates();

    const allTemplates = useMemo(() => {
        const curated = curatedToEditorTemplates(curatedTemplates);
        return mergeCuratedAndTrending(curated, trendingTemplates);
    }, [trendingTemplates]);

    const filteredTemplates = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allTemplates;

        return Object.fromEntries(
            Object.entries(allTemplates).filter(([key, template]) => {
                const displayName = template.displayName || key.replace(/-/g, " ");
                return (
                    key.toLowerCase().includes(query) ||
                    displayName.toLowerCase().includes(query)
                );
            })
        );
    }, [allTemplates, searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, setCurrentPage]);

    const hasNoResults = Object.keys(filteredTemplates).length === 0;

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={`justify-center pb-16 relative w-full ${selected ? "hidden" : "flex"}`}
            >
                <motion.div
                    className="relative w-full max-w-md"
                    whileFocus={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                >
                    <label htmlFor="template-search" className="sr-only">
                        Search meme templates
                    </label>
                    <motion.input
                        id="template-search"
                        type="text"
                        placeholder="search templates"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-3xl text-sm py-2 pl-4 pr-10 w-full bg-[#0f0f0f] border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#6a7bd1] transition"
                        style={{
                            boxShadow:
                                "0 0 0 2px rgba(106,123,209,0.3), 0 4px 24px 0px rgba(106,123,209,0.5), 0 0 0 0 transparent",
                        }}
                    />
                    <motion.span
                        aria-hidden="true"
                        className="bg-white rounded-full p-1 text-black absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center shadow-md"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ArrowDownRight className="w-4 h-4" />
                    </motion.span>
                </motion.div>
            </motion.div>

            {!selected && hasNoResults && (
                <div className="mb-6 flex flex-col items-center gap-3" role="status">
                    <p className="text-center">No templates found</p>
                    <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a7bd1]"
                    >
                        Clear search
                    </button>
                </div>
            )}

            <MainContainer templates={filteredTemplates} />
        </>
    );
}
