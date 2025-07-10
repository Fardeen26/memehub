"use client"

import { createContext, useState } from "react";
import type { Template } from '@/types/template';

type SelectedContextType = {
    selected: string;
    setSelected: (result: string) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    customTemplate: Template | null;
    setCustomTemplate: (template: Template | null) => void;
    isCustomTemplate: boolean;
    setIsCustomTemplate: (isCustom: boolean) => void;
    handleCustomTemplateSelect: (template: Template) => void;
};

export const SelectedContext = createContext<SelectedContextType | null>(null);

export default function SelectedProvider({ children }: { children: React.ReactNode }) {
    const [selected, setSelected] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customTemplate, setCustomTemplate] = useState<Template | null>(null);
    const [isCustomTemplate, setIsCustomTemplate] = useState(false);

    const handleCustomTemplateSelect = (template: Template) => {
        setCustomTemplate(template);
        setIsCustomTemplate(true);
        setSelected('custom');
    };

    return (
        <SelectedContext.Provider
            value={{
                selected,
                setSelected,
                currentPage,
                setCurrentPage,
                customTemplate,
                setCustomTemplate,
                isCustomTemplate,
                setIsCustomTemplate,
                handleCustomTemplateSelect
            }}
        >
            {children}
        </SelectedContext.Provider>
    );
}