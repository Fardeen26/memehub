import React from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';

type TemplateSelectorProps = {
    templates: Record<string, Template>;
    onSelect: (key: string) => void;
};

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
    return (
        <div className="grid grid-cols-2 gap-4 grid-flow-dense">
            {Object.entries(templates).map(([key, tpl]) => (
                <div key={key} className="!cursor-none" onClick={() => onSelect(key)}>
                    <div className="relative aspect-square">
                        <Image
                            src={tpl.image}
                            alt={key}
                            fill
                            className="object-cover rounded shadow"
                        />
                    </div>
                    <p className="text-center mt-2 capitalize">{key.replace(/-/g, ' ')}</p>
                </div>
            ))}
        </div>
    );
}