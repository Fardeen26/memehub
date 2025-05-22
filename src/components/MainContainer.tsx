"use client"

import React, { useState } from 'react';
import TemplateSelector from './TemplateSelector';
import MemeEditor from './MemeEditor';
import { templates } from '@/data/templates';
import type { Template } from '@/types/template';

type TemplateKey = keyof typeof templates;

export default function MainContainer() {
    const [selected, setSelected] = useState<TemplateKey | null>(null);

    const handleSelect = (key: string) => {
        if (key in templates) {
            setSelected(key as TemplateKey);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <h1 className="text-3xl font-bold text-center mb-6">Meme Generator</h1>
            {!selected ? (
                <TemplateSelector
                    templates={templates as Record<string, Template>}
                    onSelect={handleSelect}
                />
            ) : (
                <MemeEditor
                    template={templates[selected] as Template}
                    onReset={() => setSelected(null)}
                />
            )}
        </div>
    );
}