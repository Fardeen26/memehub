"use client";

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
    const {
        selected,
        setSelected,
        customTemplate,
        setCustomTemplate,
        isCustomTemplate,
        setIsCustomTemplate,
        handleCustomTemplateSelect
    } = useSelected();

    const handleSelect = (key: string) => {
        if (key in templates) {
            setSelected(key as TemplateKey);
            setIsCustomTemplate(false);
            setCustomTemplate(null);
        }
    };

    const handleReset = () => {
        setSelected('');
        setIsCustomTemplate(false);
        setCustomTemplate(null);
    };

    return (
        <div className="w-full max-sm:w-full mx-auto p-4 max-sm:p-1 flex flex-col flex-wrap items-center">
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
                        className="w-full max-w-6xl"
                    >
                        <TemplateSelector
                            templates={templates}
                            onSelect={handleSelect}
                            onCustomTemplateSelect={handleCustomTemplateSelect}
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
                        className="w-5xl"
                    >
                        {isCustomTemplate && customTemplate ? (
                            <DynamicMemeEditor
                                template={customTemplate}
                                onReset={handleReset}
                            />
                        ) : selected && templates[selected] ? (
                            <DynamicMemeEditor
                                template={templates[selected]}
                                onReset={handleReset}
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