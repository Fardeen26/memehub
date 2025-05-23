"use client"

import { SelectedContext } from "@/context/SelectedContext";
import { useContext } from "react";

export default function useSelected() {
    const context = useContext(SelectedContext);
    if (!context) {
        throw new Error('useSelected must be used within a SelectedProvider');
    }
    return context;
}