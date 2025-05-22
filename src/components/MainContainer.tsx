"use client"

// import React, { useState } from 'react';
// import TemplateSelector from './components/TemplateSelector';
// import MemeEditor from './components/MemeEditor';
// import { templates } from './template';

export default function MainContainer() {
    // const [selected, setSelected] = useState(null);
    return (
        <div className="max-w-4xl mx-auto p-4">
            <h1 className="text-3xl font-bold text-center mb-6">Meme Generator</h1>
            {/* {!selected ? (
                <TemplateSelector templates={templates} onSelect={setSelected} />
            ) : (
                <MemeEditor template={templates[selected]} onReset={() => setSelected(null)} />
            )} */}
        </div>
    );
}