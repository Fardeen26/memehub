import React from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';

type TemplateSelectorProps = {
    templates: Record<string, Template>;
    onSelect: (key: string) => void;
};

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
    return (
        <section className="grid grid-cols-3 max-sm:grid-cols-1 gap-6 grid-flow-dense">
            {Object.entries(templates).map(([key, tpl]) => (
                <div key={key} className="!cursor-none" onClick={() => onSelect(key)}>
                    <div className="relative aspect-square">
                        <Image
                            src={tpl.image}
                            alt={key}
                            fill
                            className="object-cover rounded-2xl shadow"
                        />
                    </div>
                    <p className="text-center text-lg font-medium mt-2 capitalize">{key.replace(/-/g, ' ')}</p>
                </div>
            ))}
        </section>
    );
}