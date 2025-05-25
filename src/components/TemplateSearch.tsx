"use client"

import { useState } from "react";
import { ArrowDownRight } from "lucide-react";
import { templates } from "@/data/templates";
import MainContainer from "./MainContainer";
import { motion } from "framer-motion";
import useSelected from "@/hooks/useSelected";

export default function TemplateSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const { selected } = useSelected()

    const filteredTemplates = Object.entries(templates).filter(([key]) =>
        key.toLowerCase().replace(/-/g, ' ').includes(searchQuery.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className={`justify-center pb-16 relative w-full ${selected ? 'hidden' : 'flex'}`}>
                <motion.div
                    className="relative w-full max-w-md"
                    whileFocus={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.input
                        type="text"
                        placeholder="Search template"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-3xl !cursor-none text-sm py-2 pl-4 pr-10 w-full bg-[#0f0f0f] border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#6a7bd1] transition"
                        style={{
                            boxShadow: "0 0 0 2px rgba(106,123,209,0.3), 0 4px 24px 0px rgba(106,123,209,0.5), 0 0 0 0 transparent",
                        }}
                        whileFocus={{
                            boxShadow: "0 0 0 2px rgba(106,123,209,0.5), 0 4px 24px 0px rgba(106,123,209,0.7), 0 0 0 0 transparent",
                        }}
                    />
                    <motion.span
                        className="bg-white rounded-full p-1 text-black absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center shadow-md"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ArrowDownRight className="w-4 h-4" />
                    </motion.span>
                </motion.div>
            </div>
            {
                filteredTemplates.length < 1 ? <div className="min-h-[30vh] max-sm:min-h-[50vh]"><p className="text-center">No templates found</p></div> : <MainContainer templates={Object.fromEntries(filteredTemplates)} />
            }
        </motion.div>
    );
} 