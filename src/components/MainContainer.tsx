"use client"

import React from 'react';
import TemplateSelector from './TemplateSelector';
import DynamicMemeEditor from './DynamicMemeEditor';
import type { Template } from '@/types/template';
import { motion, AnimatePresence } from 'framer-motion';
import useSelected from '@/hooks/useSelected';

type TemplateKey = string;

type MainContainerProps = {
    templates: Record<string, Template>;
};

export default function MainContainer({ templates }: MainContainerProps) {
    // const [selected, setSelected] = useState<TemplateKey | null>(null);
    const { selected, setSelected } = useSelected()

    const handleSelect = (key: string) => {
        if (key in templates) {
            setSelected(key as TemplateKey);
        }
    };

    return (
        <div className="max-w-5xl max-sm:w-full mx-auto p-4 max-sm:p-1">
            <AnimatePresence mode="wait">
                {!selected ? (
                    <motion.div
                        key="selector"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                    >
                        <TemplateSelector
                            templates={templates}
                            onSelect={handleSelect}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                    >
                        {selected && templates[selected] ? (
                            <DynamicMemeEditor
                                template={templates[selected]}
                                onReset={() => setSelected('')}
                            />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-lg"
                            >
                                Template not found. Please try again.
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}