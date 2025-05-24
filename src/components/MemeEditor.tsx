"use client"

import { Template } from '@/types/template';
import { MoveLeft } from 'lucide-react';
import { useEffect, useRef, useState, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';

type MemeEditorProps = {
    template: Template;
    onReset: () => void;
};

export default function MemeEditor({ template, onReset }: MemeEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [texts, setTexts] = useState<string[]>(Array(template.textBoxes.length).fill(''));

    const handleChange = (idx: number, value: string) => {
        const arr = [...texts];
        arr[idx] = value;
        setTexts(arr);
    };

    const MIN_FONT_SIZE = template.textBoxes[0].minFont; // min font size when makeing it smaller

    const calculateFontSize = (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number],
        maxFontSize: number
    ): { fontSize: number; lines: string[] } => {
        let fontSize = maxFontSize;
        let lines: string[] = [];

        while (fontSize > MIN_FONT_SIZE) {
            ctx.font = `${fontSize}px Impact`;
            lines = [];
            let currentLine = '';
            const words = text.split(' ');

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > box.width) {
                    if (currentLine === '') {
                        // wrapping the lines
                        lines.push(word);
                        currentLine = '';
                    } else {
                        lines.push(currentLine);
                        currentLine = word + ' ';
                    }
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }

            const totalHeight = lines.length * (fontSize * 1.2);
            if (totalHeight <= box.height) {
                break;
            }
            fontSize -= 2;
        }

        if (fontSize < MIN_FONT_SIZE) {
            fontSize = MIN_FONT_SIZE;
            ctx.font = `${fontSize}px Impact`;
            lines = [];
            let currentLine = '';
            const words = text.split(' ');

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > box.width) {
                    if (currentLine === '') {
                        lines.push(word);
                        currentLine = '';
                    } else {
                        lines.push(currentLine);
                        currentLine = word + ' ';
                    }
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }
        }

        return { fontSize, lines };
    };

    const waitForFont = async (font: string) => {
        if (document.fonts && document.fonts.load) {
            await document.fonts.load(`bold 20px ${font}`);
            await document.fonts.ready;
        }
    };

    const drawText = useCallback(() => (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number]
    ) => {
        if (!text) return;

        const { fontSize, lines } = calculateFontSize(ctx, text, box, box.fontSize);

        ctx.font = `bold ${fontSize}px Impact, Arial, sans-serif`;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            ctx.font = `900 ${fontSize}px Impact`;
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'white';
            ctx.textAlign = box.align || 'center';

            const lineHeight = fontSize * 1.2;
            let currentY = box.y;
            lines.forEach(line => {
                const x = box.align === 'center' ? box.x + box.width / 2 : box.x;
                ctx.strokeText(line, x, currentY);
                ctx.fillText(line, x, currentY);
                currentY += lineHeight;
            });
        } else {
            ctx.font = `${fontSize}px Impact`;
            ctx.lineWidth = 5;
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'black';
        }

        ctx.shadowColor = 'black';
        ctx.fillStyle = 'white';
        ctx.textAlign = box.align || 'center';

        const lineHeight = fontSize * 1.2;
        let currentY = box.y;

        lines.forEach(line => {
            const x = box.align === 'center' ? box.x + box.width / 2 : box.x;
            ctx.fillText(line, x, currentY);
            currentY += lineHeight;
        });
    }, []);

    useEffect(() => {
        const draw = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            await waitForFont('Impact');

            const img = new window.Image();
            img.src = template.image;

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                template.textBoxes.forEach((box, i) => {
                    drawText()(ctx, texts[i], box);
                });
            };
        };

        draw();
    }, [texts, template, drawText]);

    const downloadMeme = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'meme.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <motion.section
            className="space-y-4 min-h-[65vh] max-sm:min-h-[75vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <motion.button
                className="bg-transparent flex items-center cursor-none"
                onClick={onReset}
                whileHover={{ x: -5 }}
                transition={{ duration: 0.2 }}
            >
                <MoveLeft className='h-4 w-4' /> &nbsp; Back
            </motion.button>
            <div className="flex max-sm:flex-col max-sm:space-y-10 items-start space-x-16">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className='max-sm:mx-auto'
                >
                    <canvas ref={canvasRef} className="border border-gray-300 dark:border-gray-700 w-[400px] max-sm:w-full h-fit bg-white" />
                </motion.div>
                <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    {texts.map((txt, i) => (
                        <motion.input
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 + (i * 0.1) }}
                            className="w-full p-2 text-sm border rounded-md bg-[#0f0f0f] border-white/20 text-white placeholder:text-white/60 cursor-none"
                            placeholder={`Text position ${i + 1}`}
                            value={txt}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
                        />
                    ))}
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-4 py-2 w-full bg-[#6a7bd1] hover:bg-[#6975b3] font-medium cursor-none border border-white/20 text-sm text-white rounded-md transition-colors"
                        onClick={downloadMeme}
                    >
                        Download Meme
                    </motion.button>
                </motion.div>
            </div>
        </motion.section>
    );
}