"use client"

import { createContext, useState } from "react";

type SelectedContextType = {
    selected: string;
    setSelected: (result: string) => void;
};

export const SelectedContext = createContext<SelectedContextType | null>(null);

export default function SelectedProvider({ children }: { children: React.ReactNode }) {
    const [selected, setSelected] = useState('');
    return <SelectedContext.Provider value={{ selected, setSelected }}>{children}</SelectedContext.Provider>;
}