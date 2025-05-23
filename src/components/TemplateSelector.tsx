'use client';

import React from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

type TemplateSelectorProps = {
    templates: Record<string, Template>;
    onSelect: (key: string) => void;
};

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
    return (
        <section className="grid grid-cols-3 max-sm:grid-cols-1 gap-6 grid-flow-dense">
            <AnimatePresence mode="popLayout">
                {Object.entries(templates).map(([key, tpl], index) => (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                        className="!cursor-none"
                        onClick={() => onSelect(key)}
                    >
                        <motion.div
                            className="relative aspect-square"
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Image
                                src={tpl.image}
                                alt={key}
                                fill
                                className="object-cover rounded-2xl shadow"
                                loading='lazy'
                            />
                        </motion.div>
                        <motion.p
                            className="text-center text-lg font-medium mt-2 capitalize"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            {key.replace(/-/g, ' ')}
                        </motion.p>
                    </motion.div>
                ))}
            </AnimatePresence>
        </section>
    );
}