"use client"

import { createContext, useState } from "react";

type SelectedContextType = {
    selected: string;
    setSelected: (result: string) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
};

export const SelectedContext = createContext<SelectedContextType | null>(null);

export default function SelectedProvider({ children }: { children: React.ReactNode }) {
    const [selected, setSelected] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <SelectedContext.Provider
            value={{
                selected,
                setSelected,
                currentPage,
                setCurrentPage
            }}
        >
            {children}
        </SelectedContext.Provider>
    );
}