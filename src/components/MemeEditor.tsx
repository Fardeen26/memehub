/* eslint-disable @typescript-eslint/no-unused-vars */
import { Template } from '@/types/template';

type MemeEditorProps = {
    template: Template;
    onReset: () => void;
};

export default function MemeEditor({ template, onReset }: MemeEditorProps) {
    return (
        <section>
            Meme Editor
        </section>
    );
}