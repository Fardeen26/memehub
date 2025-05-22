import React from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';

type TemplateSelectorProps = {
    templates: Record<string, Template>;
    onSelect: (key: string) => void;
};

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
    return (
        <div className="grid grid-cols-2 gap-4">
            {Object.entries(templates).map(([key, tpl]) => (
                <div key={key} className="cursor-pointer" onClick={() => onSelect(key)}>
                    <Image src={tpl.image} alt={key} width={500} height={500} className="w-full h-auto rounded shadow" />
                    <p className="text-center mt-2 capitalize">{key.replace(/-/g, ' ')}</p>
                </div>
            ))}
        </div>
    );
}