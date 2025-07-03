"use client"

import { Template } from '@/types/template';
import { MoveLeft, Settings } from 'lucide-react';
import { useEffect, useRef, useState, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from 'sonner';

type MemeEditorProps = {
    template: Template;
    onReset: () => void;
};

type TextSettings = {
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    letterSpacing: number;
    textCase: 'uppercase' | 'lowercase' | 'normal';
    outline: {
        width: number;
        color: string;
    };
    shadow: {
        blur: number;
        offsetX: number;
        offsetY: number;
        color: string;
    };
};

export default function MemeEditor({ template, onReset }: MemeEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [texts, setTexts] = useState<string[]>(Array(template.textBoxes.length).fill(''));

    const [textBoxes, setTextBoxes] = useState<Template['textBoxes']>(template.textBoxes);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragIndex, setDragIndex] = useState<number>(-1);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [textSettings, setTextSettings] = useState<TextSettings[]>(
        template.textBoxes.map(box => ({
            fontSize: box.fontSize,
            color: '#ffffff',
            fontFamily: 'Impact',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'uppercase' as const,
            outline: {
                width: 1,
                color: '#000000'
            },
            shadow: {
                blur: 5,
                offsetX: 1,
                offsetY: 1,
                color: '#000000'
            }
        }))
    );
    const [openDropdown, setOpenDropdown] = useState<number>(-1);

    const handleChange = (idx: number, value: string) => {
        const arr = [...texts];
        arr[idx] = value;
        setTexts(arr);
    };

    const handleSettingsChange = (idx: number, setting: keyof TextSettings, value: string | number) => {
        setTextSettings(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                [setting]: value
            };
            return updated;
        });
    };

    const handleShadowChange = (idx: number, shadowProperty: keyof TextSettings['shadow'], value: string | number) => {
        setTextSettings(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                shadow: {
                    ...updated[idx].shadow,
                    [shadowProperty]: value
                }
            };
            return updated;
        });
    };

    const handleOutlineChange = (idx: number, outlineProperty: keyof TextSettings['outline'], value: string | number) => {
        setTextSettings(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                outline: {
                    ...updated[idx].outline,
                    [outlineProperty]: value
                }
            };
            return updated;
        });
    };

    const toggleDropdown = (idx: number) => {
        setOpenDropdown(openDropdown === idx ? -1 : idx);
    };

    const transformText = (text: string, textCase: TextSettings['textCase']): string => {
        switch (textCase) {
            case 'uppercase':
                return text.toUpperCase();
            case 'lowercase':
                return text.toLowerCase();
            case 'normal':
            default:
                return text;
        }
    };

    const MIN_FONT_SIZE = template.textBoxes[0].minFont; // min font size when makeing it smaller

    // Add hit detection function
    const getTextAtPosition = (x: number, y: number): number => {
        for (let i = textBoxes.length - 1; i >= 0; i--) {
            const box = textBoxes[i];
            if (texts[i] && x >= box.x && x <= box.x + box.width && y >= box.y - box.fontSize && y <= box.y + box.height) {
                return i;
            }
        }
        return -1;
    };

    // Add mouse event handlers
    const handleMouseDown = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const textIndex = getTextAtPosition(x, y);
        if (textIndex !== -1) {
            setIsDragging(true);
            setDragIndex(textIndex);
            setDragOffset({
                x: x - textBoxes[textIndex].x,
                y: y - textBoxes[textIndex].y
            });
            canvas.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (isDragging && dragIndex !== -1) {
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;

            // Constrain to canvas bounds
            const constrainedX = Math.max(0, Math.min(canvas.width - textBoxes[dragIndex].width, newX));
            const constrainedY = Math.max(textBoxes[dragIndex].fontSize, Math.min(canvas.height, newY));

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[dragIndex] = {
                    ...updated[dragIndex],
                    x: constrainedX,
                    y: constrainedY
                };
                return updated;
            });
        } else {
            // Change cursor when hovering over text
            const textIndex = getTextAtPosition(x, y);
            canvas.style.cursor = textIndex !== -1 ? 'grab' : 'default';
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragIndex(-1);
        setDragOffset({ x: 0, y: 0 });
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    };

    // Add touch event handlers for mobile support
    const handleTouchStart = (e: any) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || e.touches.length !== 1) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        const textIndex = getTextAtPosition(x, y);
        if (textIndex !== -1) {
            setIsDragging(true);
            setDragIndex(textIndex);
            setDragOffset({
                x: x - textBoxes[textIndex].x,
                y: y - textBoxes[textIndex].y
            });
        }
    };

    const handleTouchMove = (e: any) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !isDragging || dragIndex === -1 || e.touches.length !== 1) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;

        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(canvas.width - textBoxes[dragIndex].width, newX));
        const constrainedY = Math.max(textBoxes[dragIndex].fontSize, Math.min(canvas.height, newY));

        setTextBoxes((prev: Template['textBoxes']) => {
            const updated = [...prev];
            updated[dragIndex] = {
                ...updated[dragIndex],
                x: constrainedX,
                y: constrainedY
            };
            return updated;
        });
    };

    const handleTouchEnd = (e: any) => {
        e.preventDefault();
        setIsDragging(false);
        setDragIndex(-1);
        setDragOffset({ x: 0, y: 0 });
    };

    const calculateFontSize = (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number],
        maxFontSize: number,
        fontFamily: string,
        fontWeight: string,
        letterSpacing: number,
        textCase: TextSettings['textCase']
    ): { fontSize: number; lines: string[] } => {
        let fontSize = maxFontSize;
        let lines: string[] = [];

        // Transform text based on case setting
        const transformedText = transformText(text, textCase);

        // Function to calculate text width with letter spacing
        const getTextWidth = (text: string): number => {
            if (letterSpacing === 0) {
                return ctx.measureText(text).width;
            }
            return text.split('').reduce((width, char, index) => {
                return width + ctx.measureText(char).width + (index > 0 ? letterSpacing : 0);
            }, 0);
        };

        while (fontSize > MIN_FONT_SIZE) {
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            lines = [];
            let currentLine = '';
            const words = transformedText.split(' ');

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const textWidth = getTextWidth(testLine);

                if (textWidth > box.width) {
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
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            lines = [];
            let currentLine = '';
            const words = transformedText.split(' ');

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const textWidth = getTextWidth(testLine);

                if (textWidth > box.width) {
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
            await document.fonts.load(`20px ${font}`);
            await document.fonts.ready;
        }
    };

    const drawText = useCallback(() => (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number],
        settings: TextSettings
    ) => {
        if (!text) return;

        const { fontSize, lines } = calculateFontSize(ctx, text, box, settings.fontSize, settings.fontFamily, settings.fontWeight, settings.letterSpacing, settings.textCase);

        ctx.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}, Arial, sans-serif`;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            ctx.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`;
            ctx.shadowBlur = settings.shadow.blur;
            ctx.shadowOffsetX = settings.shadow.offsetX;
            ctx.shadowOffsetY = settings.shadow.offsetY;
            ctx.shadowColor = settings.shadow.color;
            ctx.strokeStyle = settings.outline.color;
            ctx.lineWidth = settings.outline.width;
            ctx.fillStyle = settings.color;
            ctx.textAlign = box.align || 'center';

            const lineHeight = fontSize * 1.2;
            let currentY = box.y;

            // Function to draw text with letter spacing (mobile version)
            const drawTextWithSpacingMobile = (text: string, x: number, y: number) => {
                const transformedText = transformText(text, settings.textCase);

                if (settings.letterSpacing === 0) {
                    // No letter spacing, use regular fillText and strokeText
                    if (settings.outline.width > 0) {
                        ctx.strokeText(transformedText, x, y);
                    }
                    ctx.fillText(transformedText, x, y);
                    return;
                }

                // Draw each character individually with spacing
                let currentX = x;
                const originalTextAlign = ctx.textAlign;
                ctx.textAlign = 'left';

                // Adjust starting position based on alignment
                if (originalTextAlign === 'center') {
                    const totalWidth = transformedText.split('').reduce((width, char, index) => {
                        return width + ctx.measureText(char).width + (index > 0 ? settings.letterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth / 2;
                } else if (originalTextAlign === 'right') {
                    const totalWidth = transformedText.split('').reduce((width, char, index) => {
                        return width + ctx.measureText(char).width + (index > 0 ? settings.letterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth;
                }

                for (let i = 0; i < transformedText.length; i++) {
                    const char = transformedText[i];
                    if (settings.outline.width > 0) {
                        ctx.strokeText(char, currentX, y);
                    }
                    ctx.fillText(char, currentX, y);
                    currentX += ctx.measureText(char).width + settings.letterSpacing;
                }

                ctx.textAlign = originalTextAlign;
            };

            lines.forEach(line => {
                const x = box.align === 'center' ? box.x + box.width / 2 : box.x;
                drawTextWithSpacingMobile(line, x, currentY);
                currentY += lineHeight;
            });
        } else {
            ctx.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`;
            ctx.lineWidth = settings.outline.width;
            ctx.shadowBlur = settings.shadow.blur;
            ctx.shadowOffsetX = settings.shadow.offsetX;
            ctx.shadowOffsetY = settings.shadow.offsetY;
            ctx.strokeStyle = settings.outline.color;
        }

        ctx.shadowColor = settings.shadow.color;
        ctx.fillStyle = settings.color;
        ctx.textAlign = box.align || 'center';

        const lineHeight = fontSize * 1.2;
        let currentY = box.y;

        // Function to draw text with letter spacing
        const drawTextWithSpacing = (text: string, x: number, y: number) => {
            const transformedText = transformText(text, settings.textCase);

            if (settings.letterSpacing === 0) {
                // No letter spacing, use regular fillText
                if (settings.outline.width > 0) {
                    ctx.strokeText(transformedText, x, y);
                }
                ctx.fillText(transformedText, x, y);
                return;
            }

            // Draw each character individually with spacing
            let currentX = x;
            const originalTextAlign = ctx.textAlign;
            ctx.textAlign = 'left';

            // Adjust starting position based on alignment
            if (originalTextAlign === 'center') {
                const totalWidth = transformedText.split('').reduce((width, char, index) => {
                    return width + ctx.measureText(char).width + (index > 0 ? settings.letterSpacing : 0);
                }, 0);
                currentX = x - totalWidth / 2;
            } else if (originalTextAlign === 'right') {
                const totalWidth = transformedText.split('').reduce((width, char, index) => {
                    return width + ctx.measureText(char).width + (index > 0 ? settings.letterSpacing : 0);
                }, 0);
                currentX = x - totalWidth;
            }

            for (let i = 0; i < transformedText.length; i++) {
                const char = transformedText[i];
                if (settings.outline.width > 0) {
                    ctx.strokeText(char, currentX, y);
                }
                ctx.fillText(char, currentX, y);
                currentX += ctx.measureText(char).width + settings.letterSpacing;
            }

            ctx.textAlign = originalTextAlign;
        };

        lines.forEach(line => {
            const x = box.align === 'center' ? box.x + box.width / 2 : box.x;
            drawTextWithSpacing(line, x, currentY);
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

                textBoxes.forEach((box, i) => {
                    drawText()(ctx, texts[i], box, textSettings[i]);
                });
            };
        };

        draw();
    }, [texts, textBoxes, textSettings, drawText]);

    // Add click outside handler to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.dropdown-container')) {
                setOpenDropdown(-1);
            }
        };

        if (openDropdown !== -1) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [openDropdown]);

    const downloadMeme = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'meme.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    const copyMeme = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            // Convert canvas to blob
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                }, 'image/png');
            });

            const data = new ClipboardItem({
                'image/png': blob
            });

            await navigator.clipboard.write([data]);
            toast.success("meme copied to clipboard :)")
        } catch (err) {
            console.error('Failed to copy meme:', err);
        }
    }

    return (
        <motion.section
            className="space-y-4 min-h-[65vh] max-sm:min-h-[75vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <motion.button
                className="bg-transparent cursor-pointer flex items-center"
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
                    <canvas
                        ref={canvasRef}
                        className="border border-gray-300 dark:border-gray-700 w-[400px] max-sm:w-full h-fit bg-white select-none"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{ touchAction: 'none' }}
                    />
                </motion.div>
                <motion.div
                    className="space-y-2 w-full"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    {texts.map((txt, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 + (i * 0.1) }}
                            className="relative"
                        >
                            <div className="flex items-center space-x-2">
                                <div className="relative dropdown-container">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className="p-2 border rounded-md bg-[#0f0f0f] border-white/20 text-white hover:bg-white/5 transition-colors"
                                            >
                                                <Settings className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        {/* <AnimatePresence> */}
                                        <DropdownMenuContent className='max-w-md z-50'>
                                            <DropdownMenuLabel>Settings</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Font Size</label>
                                                    <input
                                                        type="range"
                                                        min="10"
                                                        max="200"
                                                        value={textSettings[i].fontSize}
                                                        onChange={(e) => handleSettingsChange(i, 'fontSize', parseInt(e.target.value))}
                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].fontSize - 20) / 180) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].fontSize - 20) / 180) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                        }}
                                                    />
                                                    <span className="text-xs text-white/60">{textSettings[i].fontSize}px</span>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>

                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Font Family</label>

                                                    <Select value={textSettings[i].fontFamily}
                                                        onValueChange={(value) => handleSettingsChange(i, 'fontFamily', value)}>
                                                        <SelectTrigger className="w-full text-xs !h-8">
                                                            <SelectValue placeholder="Font Family" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Impact">Impact</SelectItem>
                                                            <SelectItem value="Anton">Anton</SelectItem>
                                                            <SelectItem value="Oswald">Oswald</SelectItem>
                                                            <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                                                            <SelectItem value="Arial Black">Arial Black</SelectItem>
                                                            <SelectItem value="Helvetica Neue">Helvetica Neue</SelectItem>
                                                            <SelectItem value="Roboto Condensed">Roboto Condensed</SelectItem>
                                                            <SelectItem value="Montserrat">Montserrat</SelectItem>
                                                            <SelectItem value="Open Sans">Open Sans</SelectItem>
                                                            <SelectItem value="Lato">Lato</SelectItem>
                                                            <SelectItem value="Poppins">Poppins</SelectItem>
                                                            <SelectItem value="Source Sans Pro">Source Sans Pro</SelectItem>
                                                            <SelectItem value="Nunito">Nunito</SelectItem>
                                                            <SelectItem value="Inter">Inter</SelectItem>
                                                            <SelectItem value="Work Sans">Work Sans</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Font Weight</label>
                                                    <Select value={textSettings[i].fontWeight}
                                                        onValueChange={(value) => handleSettingsChange(i, 'fontWeight', value)}>
                                                        <SelectTrigger className="w-full text-xs !h-8">
                                                            <SelectValue placeholder="Font Weight" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="100">Thin (100)</SelectItem>
                                                            <SelectItem value="200">Extra Light (200)</SelectItem>
                                                            <SelectItem value="300">Light (300)</SelectItem>
                                                            <SelectItem value="400">Normal (400)</SelectItem>
                                                            <SelectItem value="500">Medium (500)</SelectItem>
                                                            <SelectItem value="600">Semi Bold (600)</SelectItem>
                                                            <SelectItem value="700">Bold (700)</SelectItem>
                                                            <SelectItem value="800">Extra Bold (800)</SelectItem>
                                                            <SelectItem value="900">Black (900)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Text Color</label>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="color"
                                                            value={textSettings[i].color}
                                                            onChange={(e) => handleSettingsChange(i, 'color', e.target.value)}
                                                            className="w-8 h-8 rounded border border-white/20 cursor-pointer"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={textSettings[i].color}
                                                            onChange={(e) => handleSettingsChange(i, 'color', e.target.value)}
                                                            className="flex-1 p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                        />
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Letter Spacing</label>
                                                    <input
                                                        type="range"
                                                        min="-5"
                                                        max="20"
                                                        value={textSettings[i].letterSpacing}
                                                        onChange={(e) => handleSettingsChange(i, 'letterSpacing', parseInt(e.target.value))}
                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].letterSpacing + 5) / 25) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].letterSpacing + 5) / 25) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                        }}
                                                    />
                                                    <span className="text-xs text-white/60">{textSettings[i].letterSpacing}px</span>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-1">Text Case</label>
                                                    <Select value={textSettings[i].textCase}
                                                        onValueChange={(value) => handleSettingsChange(i, 'textCase', value as TextSettings['textCase'])}>
                                                        <SelectTrigger className="w-full text-xs !h-8">
                                                            <SelectValue placeholder="Text Case" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="uppercase">UPPERCASE</SelectItem>
                                                            <SelectItem value="lowercase">lowercase</SelectItem>
                                                            <SelectItem value="normal">Normal (As Written)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='flex flex-col space-y-2'>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-2">Text Outline</label>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label className="block text-xs text-white/40 mb-1">Outline Width: {textSettings[i].outline.width}px</label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="15"
                                                                value={textSettings[i].outline.width}
                                                                onChange={(e) => handleOutlineChange(i, 'width', parseInt(e.target.value))}
                                                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${(textSettings[i].outline.width / 15) * 100}%, rgba(255,255,255,0.2) ${(textSettings[i].outline.width / 15) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-white/40 mb-1">Outline Color</label>
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="color"
                                                                    value={textSettings[i].outline.color}
                                                                    onChange={(e) => handleOutlineChange(i, 'color', e.target.value)}
                                                                    className="w-6 h-6 rounded border border-white/20 cursor-pointer"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={textSettings[i].outline.color}
                                                                    onChange={(e) => handleOutlineChange(i, 'color', e.target.value)}
                                                                    className="flex-1 p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='flex flex-col space-y-2'>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs text-white/60 mb-2">Text Shadow</label>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label className="block text-xs text-white/40 mb-1">Blur: {textSettings[i].shadow.blur}px</label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="50"
                                                                value={textSettings[i].shadow.blur}
                                                                onChange={(e) => handleShadowChange(i, 'blur', parseInt(e.target.value))}
                                                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${(textSettings[i].shadow.blur / 50) * 100}%, rgba(255,255,255,0.2) ${(textSettings[i].shadow.blur / 50) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-xs text-white/40 mb-1">X: {textSettings[i].shadow.offsetX}px</label>
                                                                <input
                                                                    type="range"
                                                                    min="-20"
                                                                    max="20"
                                                                    value={textSettings[i].shadow.offsetX}
                                                                    onChange={(e) => handleShadowChange(i, 'offsetX', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                    style={{
                                                                        background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].shadow.offsetX + 20) / 40) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].shadow.offsetX + 20) / 40) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-white/40 mb-1">Y: {textSettings[i].shadow.offsetY}px</label>
                                                                <input
                                                                    type="range"
                                                                    min="-20"
                                                                    max="20"
                                                                    value={textSettings[i].shadow.offsetY}
                                                                    onChange={(e) => handleShadowChange(i, 'offsetY', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                    style={{
                                                                        background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].shadow.offsetY + 20) / 40) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].shadow.offsetY + 20) / 40) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-white/40 mb-1">Shadow Color</label>
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="color"
                                                                    value={textSettings[i].shadow.color}
                                                                    onChange={(e) => handleShadowChange(i, 'color', e.target.value)}
                                                                    className="w-6 h-6 rounded border border-white/20 cursor-pointer"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={textSettings[i].shadow.color}
                                                                    onChange={(e) => handleShadowChange(i, 'color', e.target.value)}
                                                                    className="flex-1 p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                        {/* </AnimatePresence> */}
                                    </DropdownMenu>
                                    {/* <button
                                        onClick={() => toggleDropdown(i)}
                                        className="p-2 border rounded-md bg-[#0f0f0f] border-white/20 text-white hover:bg-white/5 transition-colors"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </button>
                                    <AnimatePresence>
                                        {openDropdown === i && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute top-full left-0 mt-2 p-4 bg-[#0f0f0f] border border-white/20 rounded-md shadow-lg z-10 min-w-[280px] dropdown-container"
                                            >
                                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                                    <div>
                                                        <label className="block text-xs text-white/60 mb-1">Font Size</label>
                                                        <input
                                                            type="range"
                                                            min="20"
                                                            max="80"
                                                            value={textSettings[i].fontSize}
                                                            onChange={(e) => handleSettingsChange(i, 'fontSize', parseInt(e.target.value))}
                                                            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                            style={{
                                                                background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].fontSize - 20) / 60) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].fontSize - 20) / 60) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                            }}
                                                        />
                                                        <span className="text-xs text-white/60">{textSettings[i].fontSize}px</span>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-white/60 mb-1">Font Family</label>
                                                        <select
                                                            value={textSettings[i].fontFamily}
                                                            onChange={(e) => handleSettingsChange(i, 'fontFamily', e.target.value)}
                                                            className="w-full p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                        >
                                                            <option value="Impact">Impact</option>
                                                            <option value="Anton">Anton</option>
                                                            <option value="Oswald">Oswald</option>
                                                            <option value="Bebas Neue">Bebas Neue</option>
                                                            <option value="Arial Black">Arial Black</option>
                                                            <option value="Helvetica Neue">Helvetica Neue</option>
                                                            <option value="Roboto Condensed">Roboto Condensed</option>
                                                            <option value="Montserrat">Montserrat</option>
                                                            <option value="Open Sans">Open Sans</option>
                                                            <option value="Lato">Lato</option>
                                                            <option value="Poppins">Poppins</option>
                                                            <option value="Source Sans Pro">Source Sans Pro</option>
                                                            <option value="Nunito">Nunito</option>
                                                            <option value="Inter">Inter</option>
                                                            <option value="Work Sans">Work Sans</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-white/60 mb-1">Font Weight</label>
                                                        <select
                                                            value={textSettings[i].fontWeight}
                                                            onChange={(e) => handleSettingsChange(i, 'fontWeight', e.target.value)}
                                                            className="w-full p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                        >
                                                            <option value="100">Thin (100)</option>
                                                            <option value="200">Extra Light (200)</option>
                                                            <option value="300">Light (300)</option>
                                                            <option value="400">Normal (400)</option>
                                                            <option value="500">Medium (500)</option>
                                                            <option value="600">Semi Bold (600)</option>
                                                            <option value="700">Bold (700)</option>
                                                            <option value="800">Extra Bold (800)</option>
                                                            <option value="900">Black (900)</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-white/60 mb-1">Text Color</label>
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="color"
                                                                value={textSettings[i].color}
                                                                onChange={(e) => handleSettingsChange(i, 'color', e.target.value)}
                                                                className="w-8 h-8 rounded border border-white/20 cursor-pointer"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={textSettings[i].color}
                                                                onChange={(e) => handleSettingsChange(i, 'color', e.target.value)}
                                                                className="flex-1 p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-white/60 mb-2">Text Shadow</label>
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label className="block text-xs text-white/40 mb-1">Blur: {textSettings[i].shadow.blur}px</label>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="50"
                                                                    value={textSettings[i].shadow.blur}
                                                                    onChange={(e) => handleShadowChange(i, 'blur', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                    style={{
                                                                        background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${(textSettings[i].shadow.blur / 50) * 100}%, rgba(255,255,255,0.2) ${(textSettings[i].shadow.blur / 50) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="block text-xs text-white/40 mb-1">X: {textSettings[i].shadow.offsetX}px</label>
                                                                    <input
                                                                        type="range"
                                                                        min="-20"
                                                                        max="20"
                                                                        value={textSettings[i].shadow.offsetX}
                                                                        onChange={(e) => handleShadowChange(i, 'offsetX', parseInt(e.target.value))}
                                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                        style={{
                                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].shadow.offsetX + 20) / 40) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].shadow.offsetX + 20) / 40) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-white/40 mb-1">Y: {textSettings[i].shadow.offsetY}px</label>
                                                                    <input
                                                                        type="range"
                                                                        min="-20"
                                                                        max="20"
                                                                        value={textSettings[i].shadow.offsetY}
                                                                        onChange={(e) => handleShadowChange(i, 'offsetY', parseInt(e.target.value))}
                                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                                        style={{
                                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].shadow.offsetY + 20) / 40) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].shadow.offsetY + 20) / 40) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-white/40 mb-1">Shadow Color</label>
                                                                <div className="flex items-center space-x-2">
                                                                    <input
                                                                        type="color"
                                                                        value={textSettings[i].shadow.color}
                                                                        onChange={(e) => handleShadowChange(i, 'color', e.target.value)}
                                                                        className="w-6 h-6 rounded border border-white/20 cursor-pointer"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={textSettings[i].shadow.color}
                                                                        onChange={(e) => handleShadowChange(i, 'color', e.target.value)}
                                                                        className="flex-1 p-1 text-xs border rounded bg-[#0f0f0f] border-white/20 text-white"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence> */}
                                </div>
                                <input
                                    className="w-full p-2 text-sm border rounded-md bg-[#0f0f0f] border-white/20 text-white placeholder:text-white/60"
                                    placeholder={`Text position ${i + 1}`}
                                    value={txt}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
                                />
                            </div>
                        </motion.div>
                    ))}
                    <div className="flex w-full space-x-2 mt-2">
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.5 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-4 py-2 w-full bg-[#6a7bd1] hover:bg-[#6975b3] font-medium border border-white/20 text-sm text-white rounded-md transition-colors"
                            onClick={downloadMeme}
                        >
                            Download
                        </motion.button>
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.5 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-4 py-2 w-full bg-transparent text-black hover:bg-gray-100/50 dark:hover:bg-white/5 font-medium  border border-[#6a7bd1] text-sm dark:text-white rounded-md transition-colors"
                            onClick={copyMeme}
                        >
                            Copy
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </motion.section>
    );
}