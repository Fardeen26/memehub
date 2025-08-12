/* eslint-disable react-hooks/exhaustive-deps */
"use client"
// @ts-nocheck

import { Template } from '@/types/template';
import { MoveLeft, Settings, Upload, Image as ImageIcon, Trash2, Plus, X, Pencil, Undo2, Trash } from 'lucide-react';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from 'sonner';
import { MemeEditorProps, TextSettings, ImageOverlay } from '@/types/editor';
import Image from 'next/image';
import { useFontLoader, FONT_CONFIGS } from '@/hooks/useFontLoader';

export default function MemeEditor({ template, onReset }: MemeEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [texts, setTexts] = useState<string[]>(Array(template.textBoxes.length).fill(''));

    const [textBoxes, setTextBoxes] = useState<Template['textBoxes']>(template.textBoxes);
    const [originalTextBoxCount] = useState<number>(template.textBoxes.length);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragIndex, setDragIndex] = useState<number>(-1);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectedTextIndex, setSelectedTextIndex] = useState<number>(-1);
    const [isResizingTextWidth, setIsResizingTextWidth] = useState<boolean>(false);
    const [resizeTextIndex, setResizeTextIndex] = useState<number>(-1);
    const [isResizingFromLeft, setIsResizingFromLeft] = useState<boolean>(false);

    const { loadFont, preloadFont } = useFontLoader();

    const isMobileDevice = useCallback(() => {
        if (typeof window !== 'undefined') {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        return false;
    }, []);

    const getDefaultFont = useCallback(() => {
        return isMobileDevice() ? 'Oswald' : 'Impact';
    }, [isMobileDevice]);

    const [textSettings, setTextSettings] = useState<TextSettings[]>(
        template.textBoxes.map(box => ({
            fontSize: box.fontSize,
            color: '#ffffff',
            fontFamily: getDefaultFont(),
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

    const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
    const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
    const [dragImageIndex, setDragImageIndex] = useState<number>(-1);
    const [dragImageOffset, setDragImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isResizingImage, setIsResizingImage] = useState<boolean>(false);
    const [resizeImageIndex, setResizeImageIndex] = useState<number>(-1);
    const [resizeHandle, setResizeHandle] = useState<string>('');
    const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [resizeStartSize, setResizeStartSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [resizeStartImagePos, setResizeStartImagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isRotatingImage, setIsRotatingImage] = useState<boolean>(false);
    const [rotateImageIndex, setRotateImageIndex] = useState<number>(-1);
    const [rotateStartAngle, setRotateStartAngle] = useState<number>(0);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);
    const [uploadMethod, setUploadMethod] = useState<'file' | 'paste'>('file');
    const [pastedImageData, setPastedImageData] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    const lastDrawTime = useRef<number>(0);
    const isOptimizedDrawing = useRef<boolean>(false);

    type Point = { x: number; y: number };
    type Stroke = { points: Point[]; color: string; size: number; eraser: boolean };
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isEraser, setIsEraser] = useState(false);
    const [drawColor, setDrawColor] = useState('#ff0000');
    const [drawSize, setDrawSize] = useState(6);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const loadAndCacheImage = useCallback(async (src: string): Promise<HTMLImageElement> => {
        if (imageCache.current.has(src)) {
            return imageCache.current.get(src)!;
        }

        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                imageCache.current.set(src, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    useEffect(() => {
        const commonFonts = ['Impact', 'Oswald', 'Anton', 'Bebas Neue'];
        commonFonts.forEach(fontName => {
            if (FONT_CONFIGS[fontName]) {
                preloadFont(FONT_CONFIGS[fontName]);
            }
        });
    }, [preloadFont]);

    useEffect(() => {
        const defaultFont = getDefaultFont();
        setTextSettings(prev =>
            prev.map(setting => ({
                ...setting,
                fontFamily: setting.fontFamily === 'Impact' || setting.fontFamily === 'Oswald'
                    ? defaultFont
                    : setting.fontFamily
            }))
        );
    }, [getDefaultFont]);

    const handleChange = useCallback((idx: number, value: string) => {
        setTexts(prev => {
            const arr = [...prev];
            arr[idx] = value;
            return arr;
        });
    }, []);

    const handleSettingsChange = useCallback((idx: number, setting: keyof TextSettings, value: string | number) => {
        setTextSettings(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                [setting]: value
            };
            return updated;
        });

        if (setting === 'fontFamily' && typeof value === 'string' && FONT_CONFIGS[value]) {
            loadFont(FONT_CONFIGS[value]);
        }
    }, [loadFont]);

    const handleShadowChange = useCallback((idx: number, shadowProperty: keyof TextSettings['shadow'], value: string | number) => {
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
    }, []);

    const handleOutlineChange = useCallback((idx: number, outlineProperty: keyof TextSettings['outline'], value: string | number) => {
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
    }, []);

    const handleTextBoxChange = useCallback((idx: number, property: keyof Template['textBoxes'][number], value: number) => {
        setTextBoxes(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                [property]: value
            };
            return updated;
        });
    }, []);

    const transformText = useCallback((text: string, textCase: TextSettings['textCase']): string => {
        switch (textCase) {
            case 'uppercase':
                return text.toUpperCase();
            case 'lowercase':
                return text.toLowerCase();
            case 'normal':
            default:
                return text;
        }
    }, []);

    const MIN_FONT_SIZE = template.textBoxes[0].minFont;

    const getTextAtPosition = useCallback((x: number, y: number): number => {
        for (let i = textBoxes.length - 1; i >= 0; i--) {
            const box = textBoxes[i];
            if (texts[i] && x >= box.x && x <= box.x + box.width && y >= box.y - box.fontSize && y <= box.y + box.height) {
                return i;
            }
        }
        return -1;
    }, [textBoxes, texts]);

    const getTextResizeHandleAtPosition = useCallback((x: number, y: number): { index: number; handle: string } => {
        if (selectedTextIndex === -1 || !texts[selectedTextIndex]) return { index: -1, handle: '' };

        const box = textBoxes[selectedTextIndex];
        const isMobile = isMobileDevice();
        const canvas = canvasRef.current;
        if (!canvas) return { index: -1, handle: '' };
        const baseHandleSize = Math.max(30, Math.min(canvas.width, canvas.height) * 0.04);
        const handleSize = isMobile ? Math.max(baseHandleSize, 45) : Math.max(baseHandleSize, 35);

        const textBoxCenterY = box.y + box.height / 2;

        const leftHandleX = box.x - handleSize / 2;
        const leftHandleY = textBoxCenterY - handleSize / 2;
        if (x >= leftHandleX && x <= leftHandleX + handleSize &&
            y >= leftHandleY && y <= leftHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'width-left' };
        }

        const rightHandleX = box.x + box.width - handleSize / 2;
        const rightHandleY = textBoxCenterY - handleSize / 2;
        if (x >= rightHandleX && x <= rightHandleX + handleSize &&
            y >= rightHandleY && y <= rightHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'width-right' };
        }

        return { index: -1, handle: '' };
    }, [selectedTextIndex, textBoxes, texts, isMobileDevice]);

    const generateImageId = (): string => {
        return `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const getImageAtPosition = useCallback((x: number, y: number): { index: number; handle: string } => {
        for (let i = imageOverlays.length - 1; i >= 0; i--) {
            const img = imageOverlays[i];

            const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const rotationHandleSize = isMobile ? 60 : 50;
            const rotationHandleX = img.x + img.width / 2;
            const rotationHandleY = img.y - 35;
            const distToRotationHandle = Math.sqrt(
                Math.pow(x - rotationHandleX, 2) + Math.pow(y - rotationHandleY, 2)
            );
            if (distToRotationHandle <= rotationHandleSize / 2) {
                return { index: i, handle: 'rotate' };
            }

            const handleSize = isMobile ? 60 : 60;
            const handles = [
                { name: 'nw', x: img.x - handleSize / 2, y: img.y - handleSize / 2 },
                { name: 'ne', x: img.x + img.width - handleSize / 2, y: img.y - handleSize / 2 },
                { name: 'sw', x: img.x - handleSize / 2, y: img.y + img.height - handleSize / 2 },
                { name: 'se', x: img.x + img.width - handleSize / 2, y: img.y + img.height - handleSize / 2 },
                { name: 'n', x: img.x + img.width / 2 - handleSize / 2, y: img.y - handleSize / 2 },
                { name: 's', x: img.x + img.width / 2 - handleSize / 2, y: img.y + img.height - handleSize / 2 },
                { name: 'w', x: img.x - handleSize / 2, y: img.y + img.height / 2 - handleSize / 2 },
                { name: 'e', x: img.x + img.width - handleSize / 2, y: img.y + img.height / 2 - handleSize / 2 }
            ];

            for (const handle of handles) {
                if (x >= handle.x && x <= handle.x + handleSize &&
                    y >= handle.y && y <= handle.y + handleSize) {
                    return { index: i, handle: handle.name };
                }
            }

            if (x >= img.x && x <= img.x + img.width &&
                y >= img.y && y <= img.y + img.height) {
                return { index: i, handle: 'move' };
            }
        }
        return { index: -1, handle: '' };
    }, [imageOverlays]);

    const addImageOverlay = useCallback(async (file: File | string, isDataUrl: boolean = false) => {
        try {
            let imageSrc: string;

            if (isDataUrl) {
                imageSrc = file as string;
            } else {
                const reader = new FileReader();
                imageSrc = await new Promise<string>((resolve) => {
                    reader.onload = (e) => {
                        resolve(e.target?.result as string);
                    };
                    reader.readAsDataURL(file as File);
                });
            }

            const img = await loadAndCacheImage(imageSrc);

            const canvas = canvasRef.current;
            if (!canvas) return;

            const maxSize = 300;
            let width = img.width;
            let height = img.height;

            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = width * ratio;
                height = height * ratio;
            }

            const newOverlay: ImageOverlay = {
                id: generateImageId(),
                src: imageSrc,
                x: (canvas.width - width) / 2,
                y: (canvas.height - height) / 2,
                width,
                height,
                originalWidth: img.width,
                originalHeight: img.height,
                opacity: 1,
                rotation: 0
            };

            setImageOverlays(prev => [...prev, newOverlay]);

        } catch (error) {
            console.error('Error adding image overlay:', error);
            toast.error('Failed to add image');
        }
    }, [loadAndCacheImage]);

    const handleDialogFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                setSelectedFile(file);
                setUploadMethod('file');
            } else {
                toast.error('Please select an image file');
            }
        }
    };

    const handleDialogPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        setPastedImageData(result);
                        setUploadMethod('paste');
                    };
                    reader.readAsDataURL(file);
                    event.preventDefault();
                    return;
                }
            }
        }
    };

    const handleUploadConfirm = async () => {
        try {
            if (uploadMethod === 'file' && selectedFile) {
                await addImageOverlay(selectedFile);
            } else if (uploadMethod === 'paste' && pastedImageData) {
                await addImageOverlay(pastedImageData, true);
            } else {
                toast.error('Please select a file or paste an image');
                return;
            }

            setIsUploadDialogOpen(false);
            setSelectedFile(null);
            setPastedImageData(null);
            setUploadMethod('file');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Failed to upload image');
        }
    };

    const resetDialogState = () => {
        setSelectedFile(null);
        setPastedImageData(null);
        setUploadMethod('file');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleMobilePaste = async () => {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                toast.error('Clipboard access not supported on this device');
                return;
            }

            const clipboardItems = await navigator.clipboard.read();

            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const result = e.target?.result as string;
                            setPastedImageData(result);
                            setUploadMethod('paste');
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            toast.error('No image found in clipboard');
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            toast.error('Failed to access clipboard. Try copying the image again.');
        }
    };

    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        if (isUploadDialogOpen) return;

        const items = event.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    addImageOverlay(file);
                    event.preventDefault();
                    return;
                }
            }
        }
    }, [isUploadDialogOpen, addImageOverlay]);

    const removeImageOverlay = (index: number) => {
        setImageOverlays(prev => {
            const overlay = prev[index];
            if (overlay) {
                imageCache.current.delete(overlay.src);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const imageResult = getImageAtPosition(x, y);
        if (imageResult.index !== -1) {
            setSelectedImageIndex(imageResult.index);

            if (imageResult.handle === 'move') {
                setIsDraggingImage(true);
                setDragImageIndex(imageResult.index);
                setDragImageOffset({
                    x: x - imageOverlays[imageResult.index].x,
                    y: y - imageOverlays[imageResult.index].y
                });
                canvas.style.cursor = 'grabbing';
            } else if (imageResult.handle === 'rotate') {
                setIsRotatingImage(true);
                setRotateImageIndex(imageResult.index);
                const img = imageOverlays[imageResult.index];
                const centerX = img.x + img.width / 2;
                const centerY = img.y + img.height / 2;
                const angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
                setRotateStartAngle(angle - img.rotation);
                canvas.style.cursor = 'grab';
            } else {
                setIsResizingImage(true);
                setResizeImageIndex(imageResult.index);
                setResizeHandle(imageResult.handle);
                setResizeStartPos({ x, y });
                setResizeStartSize({
                    width: imageOverlays[imageResult.index].width,
                    height: imageOverlays[imageResult.index].height
                });
                setResizeStartImagePos({
                    x: imageOverlays[imageResult.index].x,
                    y: imageOverlays[imageResult.index].y
                });
                canvas.style.cursor = `${imageResult.handle}-resize`;
            }
            return;
        } else {
            setSelectedImageIndex(-1);
        }

        const resizeHandleResult = getTextResizeHandleAtPosition(x, y);
        if (resizeHandleResult.index !== -1) {
            setIsResizingTextWidth(true);
            setIsResizingFromLeft(resizeHandleResult.handle === 'width-left');
            setResizeTextIndex(resizeHandleResult.index);
            canvas.style.cursor = 'ew-resize';
            return;
        }

        const textIndex = getTextAtPosition(x, y);
        if (textIndex !== -1) {
            setSelectedTextIndex(textIndex);
            setIsDragging(true);
            setDragIndex(textIndex);
            setDragOffset({
                x: x - textBoxes[textIndex].x,
                y: y - textBoxes[textIndex].y
            });
            canvas.style.cursor = 'grabbing';
        } else {
            setSelectedTextIndex(-1);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Mouse move handler logic
        if (isDraggingImage && dragImageIndex !== -1) {
            const newX = x - dragImageOffset.x;
            const newY = y - dragImageOffset.y;

            const constrainedX = Math.max(0, Math.min(canvas.width - imageOverlays[dragImageIndex].width, newX));
            const constrainedY = Math.max(0, Math.min(canvas.height - imageOverlays[dragImageIndex].height, newY));

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[dragImageIndex] = {
                    ...updated[dragImageIndex],
                    x: constrainedX,
                    y: constrainedY
                };
                return updated;
            });
        } else if (isRotatingImage && rotateImageIndex !== -1) {
            const img = imageOverlays[rotateImageIndex];
            const centerX = img.x + img.width / 2;
            const centerY = img.y + img.height / 2;
            const angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
            const newRotation = angle - rotateStartAngle;

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[rotateImageIndex] = {
                    ...updated[rotateImageIndex],
                    rotation: newRotation
                };
                return updated;
            });
        } else if (isResizingImage && resizeImageIndex !== -1) {
            const deltaX = x - resizeStartPos.x;
            const deltaY = y - resizeStartPos.y;

            let newWidth = resizeStartSize.width;
            let newHeight = resizeStartSize.height;
            let newX = resizeStartImagePos.x;
            let newY = resizeStartImagePos.y;

            switch (resizeHandle) {
                case 'se':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    break;
                case 'sw':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    newX = resizeStartImagePos.x + deltaX;
                    break;
                case 'ne':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 'nw':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newX = resizeStartImagePos.x + deltaX;
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 'n':
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 's':
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    break;
                case 'w':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newX = resizeStartImagePos.x + deltaX;
                    break;
                case 'e':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    break;
            }

            if (newX < 0) {
                newWidth = Math.max(20, newWidth + newX);
                newX = 0;
            }
            if (newY < 0) {
                newHeight = Math.max(20, newHeight + newY);
                newY = 0;
            }
            if (newX + newWidth > canvas.width) {
                newWidth = Math.max(20, canvas.width - newX);
            }
            if (newY + newHeight > canvas.height) {
                newHeight = Math.max(20, canvas.height - newY);
            }

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[resizeImageIndex] = {
                    ...updated[resizeImageIndex],
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight
                };
                return updated;
            });
        } else if (isResizingTextWidth && resizeTextIndex !== -1) {
            const box = textBoxes[resizeTextIndex];
            let newWidth = box.width;
            let newX = box.x;

            if (isResizingFromLeft) {
                const deltaX = x - box.x;
                newWidth = Math.max(50, box.width - deltaX);
                newX = box.x + (box.width - newWidth);
            } else {
                newWidth = Math.max(50, x - box.x);
            }

            newWidth = Math.min(newWidth, canvas.width - newX);

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[resizeTextIndex] = {
                    ...updated[resizeTextIndex],
                    width: newWidth,
                    x: newX
                };
                return updated;
            });
        } else if (isDragging && dragIndex !== -1) {
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;

            const constrainedX = Math.max(-textBoxes[dragIndex].width * 0.8, Math.min(canvas.width - textBoxes[dragIndex].width * 0.2, newX));
            const constrainedY = Math.max(0, Math.min(canvas.height, newY));

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
            // Check for text resize handles first
            const resizeHandleResult = getTextResizeHandleAtPosition(x, y);
            if (resizeHandleResult.index !== -1) {
                canvas.style.cursor = 'ew-resize';
            } else {
                const imageResult = getImageAtPosition(x, y);
                if (imageResult.index !== -1) {
                    if (imageResult.handle === 'move') {
                        canvas.style.cursor = 'grab';
                    } else if (imageResult.handle === 'rotate') {
                        canvas.style.cursor = 'grab';
                    } else {
                        canvas.style.cursor = `${imageResult.handle}-resize`;
                    }
                } else {
                    const textIndex = getTextAtPosition(x, y);
                    canvas.style.cursor = textIndex !== -1 ? 'grab' : 'default';
                }
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragIndex(-1);
        setDragOffset({ x: 0, y: 0 });
        setIsDraggingImage(false);
        setDragImageIndex(-1);
        setDragImageOffset({ x: 0, y: 0 });
        setIsResizingImage(false);
        setResizeImageIndex(-1);
        setResizeHandle('');
        setResizeStartPos({ x: 0, y: 0 });
        setResizeStartSize({ width: 0, height: 0 });
        setResizeStartImagePos({ x: 0, y: 0 });
        setIsRotatingImage(false);
        setRotateImageIndex(-1);
        setRotateStartAngle(0);
        setIsResizingTextWidth(false);
        setResizeTextIndex(-1);
        setIsResizingFromLeft(false);
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || e.touches.length !== 1) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        const imageResult = getImageAtPosition(x, y);
        if (imageResult.index !== -1) {
            setSelectedImageIndex(imageResult.index);

            if (imageResult.handle === 'move') {
                setIsDraggingImage(true);
                setDragImageIndex(imageResult.index);
                setDragImageOffset({
                    x: x - imageOverlays[imageResult.index].x,
                    y: y - imageOverlays[imageResult.index].y
                });
            } else if (imageResult.handle === 'rotate') {
                setIsRotatingImage(true);
                setRotateImageIndex(imageResult.index);
                const img = imageOverlays[imageResult.index];
                const centerX = img.x + img.width / 2;
                const centerY = img.y + img.height / 2;
                const angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
                setRotateStartAngle(angle - img.rotation);
            } else {
                setIsResizingImage(true);
                setResizeImageIndex(imageResult.index);
                setResizeHandle(imageResult.handle);
                setResizeStartPos({ x, y });
                setResizeStartSize({
                    width: imageOverlays[imageResult.index].width,
                    height: imageOverlays[imageResult.index].height
                });
                setResizeStartImagePos({
                    x: imageOverlays[imageResult.index].x,
                    y: imageOverlays[imageResult.index].y
                });
            }
            return;
        } else {
            setSelectedImageIndex(-1);
        }

        const resizeHandleResult = getTextResizeHandleAtPosition(x, y);
        if (resizeHandleResult.index !== -1) {
            setIsResizingTextWidth(true);
            setIsResizingFromLeft(resizeHandleResult.handle === 'width-left');
            setResizeTextIndex(resizeHandleResult.index);
            return;
        }

        const textIndex = getTextAtPosition(x, y);
        if (textIndex !== -1) {
            setSelectedTextIndex(textIndex);
            setIsDragging(true);
            setDragIndex(textIndex);
            setDragOffset({
                x: x - textBoxes[textIndex].x,
                y: y - textBoxes[textIndex].y
            });
        } else {
            setSelectedTextIndex(-1);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || e.touches.length !== 1) return;

        if (!isDragging && !isDraggingImage && !isRotatingImage && !isResizingImage && !isResizingTextWidth) return;
        if (isDragging && dragIndex === -1) return;
        if (isDraggingImage && dragImageIndex === -1) return;
        if (isRotatingImage && rotateImageIndex === -1) return;
        if (isResizingImage && resizeImageIndex === -1) return;
        if (isResizingTextWidth && resizeTextIndex === -1) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        if (isDraggingImage && dragImageIndex !== -1) {
            const newX = x - dragImageOffset.x;
            const newY = y - dragImageOffset.y;

            const constrainedX = Math.max(0, Math.min(canvas.width - imageOverlays[dragImageIndex].width, newX));
            const constrainedY = Math.max(0, Math.min(canvas.height - imageOverlays[dragImageIndex].height, newY));

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[dragImageIndex] = {
                    ...updated[dragImageIndex],
                    x: constrainedX,
                    y: constrainedY
                };
                return updated;
            });
        } else if (isRotatingImage && rotateImageIndex !== -1) {
            const img = imageOverlays[rotateImageIndex];
            const centerX = img.x + img.width / 2;
            const centerY = img.y + img.height / 2;
            const angle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
            const newRotation = angle - rotateStartAngle;

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[rotateImageIndex] = {
                    ...updated[rotateImageIndex],
                    rotation: newRotation
                };
                return updated;
            });
        } else if (isResizingImage && resizeImageIndex !== -1) {
            const deltaX = x - resizeStartPos.x;
            const deltaY = y - resizeStartPos.y;

            let newWidth = resizeStartSize.width;
            let newHeight = resizeStartSize.height;
            let newX = resizeStartImagePos.x;
            let newY = resizeStartImagePos.y;

            switch (resizeHandle) {
                case 'se':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    break;
                case 'sw':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    newX = resizeStartImagePos.x + deltaX;
                    break;
                case 'ne':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 'nw':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newX = resizeStartImagePos.x + deltaX;
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 'n':
                    newHeight = Math.max(20, resizeStartSize.height - deltaY);
                    newY = resizeStartImagePos.y + deltaY;
                    break;
                case 's':
                    newHeight = Math.max(20, resizeStartSize.height + deltaY);
                    break;
                case 'w':
                    newWidth = Math.max(20, resizeStartSize.width - deltaX);
                    newX = resizeStartImagePos.x + deltaX;
                    break;
                case 'e':
                    newWidth = Math.max(20, resizeStartSize.width + deltaX);
                    break;
            }

            if (newX < 0) {
                newWidth = Math.max(20, newWidth + newX);
                newX = 0;
            }
            if (newY < 0) {
                newHeight = Math.max(20, newHeight + newY);
                newY = 0;
            }
            if (newX + newWidth > canvas.width) {
                newWidth = Math.max(20, canvas.width - newX);
            }
            if (newY + newHeight > canvas.height) {
                newHeight = Math.max(20, canvas.height - newY);
            }

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[resizeImageIndex] = {
                    ...updated[resizeImageIndex],
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight
                };
                return updated;
            });
        } else if (isResizingTextWidth && resizeTextIndex !== -1) {
            const box = textBoxes[resizeTextIndex];
            let newWidth = box.width;
            let newX = box.x;

            if (isResizingFromLeft) {
                const deltaX = x - box.x;
                newWidth = Math.max(50, box.width - deltaX);
                newX = box.x + (box.width - newWidth);
            } else {
                newWidth = Math.max(50, x - box.x);
            }

            newWidth = Math.min(newWidth, canvas.width - newX);

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[resizeTextIndex] = {
                    ...updated[resizeTextIndex],
                    width: newWidth,
                    x: newX
                };
                return updated;
            });
        } else if (isDragging && dragIndex !== -1) {
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;

            const constrainedX = Math.max(-textBoxes[dragIndex].width * 0.8, Math.min(canvas.width - textBoxes[dragIndex].width * 0.2, newX));
            const constrainedY = Math.max(0, Math.min(canvas.height, newY));

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[dragIndex] = {
                    ...updated[dragIndex],
                    x: constrainedX,
                    y: constrainedY
                };
                return updated;
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        setIsDragging(false);
        setDragIndex(-1);
        setDragOffset({ x: 0, y: 0 });
        setIsDraggingImage(false);
        setDragImageIndex(-1);
        setDragImageOffset({ x: 0, y: 0 });
        setIsResizingImage(false);
        setResizeImageIndex(-1);
        setResizeHandle('');
        setResizeStartPos({ x: 0, y: 0 });
        setResizeStartSize({ width: 0, height: 0 });
        setResizeStartImagePos({ x: 0, y: 0 });
        setIsRotatingImage(false);
        setRotateImageIndex(-1);
        setRotateStartAngle(0);
        setIsResizingTextWidth(false);
        setResizeTextIndex(-1);
        setIsResizingFromLeft(false);
    };

    const calculateFontSize = useCallback((
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

        const transformedText = transformText(text, textCase);

        const getTextWidth = (text: string): number => {
            if (letterSpacing === 0) {
                return ctx.measureText(text).width;
            }
            return text.split('').reduce((width, char, index) => {
                return width + ctx.measureText(char).width + (index > 0 ? letterSpacing : 0);
            }, 0);
        };

        const fontFallbacks = [
            fontFamily,
            fontFamily === 'Impact' ? 'Arial Black' : 'Impact',
            'Arial Black',
            'Helvetica Neue',
            'Arial',
            'sans-serif'
        ].join(', ');

        const processTextWithLineBreaks = (text: string): string[] => {
            const manualLines = text.split('\n');
            const processedLines: string[] = [];

            for (const manualLine of manualLines) {
                if (manualLine.trim() === '') {
                    processedLines.push('');
                    continue;
                }

                let currentLine = '';
                const words = manualLine.split(' ');

                for (const word of words) {
                    const testLine = currentLine + word + ' ';
                    const textWidth = getTextWidth(testLine);

                    if (textWidth > box.width) {
                        if (currentLine === '') {
                            processedLines.push(word);
                            currentLine = '';
                        } else {
                            processedLines.push(currentLine.trim());
                            currentLine = word + ' ';
                        }
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine.trim()) {
                    processedLines.push(currentLine.trim());
                }
            }

            return processedLines;
        };

        while (fontSize > MIN_FONT_SIZE) {
            ctx.font = `${fontWeight} ${fontSize}px ${fontFallbacks}`;
            lines = processTextWithLineBreaks(transformedText);

            const totalHeight = lines.length * (fontSize * 1.2);
            if (totalHeight <= box.height) {
                break;
            }
            fontSize -= 2;
        }

        if (fontSize < MIN_FONT_SIZE) {
            fontSize = MIN_FONT_SIZE;
            ctx.font = `${fontWeight} ${fontSize}px ${fontFallbacks}`;
            lines = processTextWithLineBreaks(transformedText);
        }

        return { fontSize, lines };
    }, [transformText, MIN_FONT_SIZE]);

    const waitForFont = useCallback(async (font: string) => {
        try {
            if (document.fonts && document.fonts.load) {
                const fontVariations = [
                    `bold 20px "${font}"`,
                    `normal 20px "${font}"`,
                    `900 20px "${font}"`,
                    `800 20px "${font}"`,
                    `700 20px "${font}"`,
                ];

                await Promise.all(fontVariations.map(async (fontStyle) => {
                    try {
                        await document.fonts.load(fontStyle);
                    } catch (error) {
                        console.warn(`Failed to load font style: ${fontStyle}`, error);
                    }
                }));

                await document.fonts.ready;

                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.warn(`Font loading error for ${font}:`, error);
        }
    }, []);

    const drawText = useCallback(() => (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number],
        settings: TextSettings
    ) => {
        if (!text) return;

        const { fontSize, lines } = calculateFontSize(ctx, text, box, settings.fontSize, settings.fontFamily, settings.fontWeight, settings.letterSpacing, settings.textCase);

        const fontFallbacks = [
            settings.fontFamily,
            settings.fontFamily === 'Impact' ? 'Arial Black' : 'Impact',
            'Arial Black',
            'Helvetica Neue',
            'Arial',
            'sans-serif'
        ].join(', ');

        ctx.font = `${settings.fontWeight} ${fontSize}px ${fontFallbacks}`;

        const isMobile = isMobileDevice();

        if (isMobile) {
            ctx.font = `${settings.fontWeight} ${fontSize}px ${fontFallbacks}`;
            ctx.shadowBlur = settings.shadow.blur;
            ctx.shadowOffsetX = settings.shadow.offsetX;
            ctx.shadowOffsetY = settings.shadow.offsetY;
            ctx.shadowColor = settings.shadow.color;
            ctx.strokeStyle = settings.outline.color;
            ctx.lineWidth = settings.outline.width;
            ctx.fillStyle = settings.color;
            ctx.textAlign = box.align || 'center';

            const lineHeight = fontSize * 1.2;
            let currentY = box.y + fontSize;

            const drawTextWithSpacingMobile = (text: string, x: number, y: number) => {
                const transformedText = transformText(text, settings.textCase);

                if (settings.letterSpacing === 0) {
                    if (settings.outline.width > 0) {
                        ctx.strokeText(transformedText, x, y);
                    }
                    ctx.fillText(transformedText, x, y);
                    return;
                }

                let currentX = x;
                const originalTextAlign = ctx.textAlign;
                ctx.textAlign = 'left';

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
                const adjustedY = Math.max(currentY, box.y + fontSize);
                const maxY = box.y + box.height - 5;
                if (adjustedY <= maxY) {
                    drawTextWithSpacingMobile(line, x, adjustedY);
                }
                currentY += lineHeight;
            });
        } else {
            ctx.font = `${settings.fontWeight} ${fontSize}px ${fontFallbacks}`;
            ctx.lineWidth = settings.outline.width;
            ctx.shadowBlur = settings.shadow.blur;
            ctx.shadowOffsetX = settings.shadow.offsetX;
            ctx.shadowOffsetY = settings.shadow.offsetY;
            ctx.strokeStyle = settings.outline.color;

            ctx.shadowColor = settings.shadow.color;
            ctx.fillStyle = settings.color;
            ctx.textAlign = box.align || 'center';

            const lineHeight = fontSize * 1.2;
            let currentY = box.y + fontSize;

            const drawTextWithSpacing = (text: string, x: number, y: number) => {
                const transformedText = transformText(text, settings.textCase);

                if (settings.letterSpacing === 0) {
                    if (settings.outline.width > 0) {
                        ctx.strokeText(transformedText, x, y);
                    }
                    ctx.fillText(transformedText, x, y);
                    return;
                }

                let currentX = x;
                const originalTextAlign = ctx.textAlign;
                ctx.textAlign = 'left';

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
                const adjustedY = Math.max(currentY, box.y + fontSize);
                const maxY = box.y + box.height - 5;
                if (adjustedY <= maxY) {
                    drawTextWithSpacing(line, x, adjustedY);
                }
                currentY += lineHeight;
            });
        }
    }, [isMobileDevice, calculateFontSize, transformText]);

    const draw = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const now = Date.now();
        const isActivelyDragging = isDraggingImage || isResizingImage || isRotatingImage || isDragging;

        if (isActivelyDragging && isOptimizedDrawing.current && (now - lastDrawTime.current) < 16) {
            return;
        }

        lastDrawTime.current = now;
        isOptimizedDrawing.current = isActivelyDragging;

        const fontsToLoad = [...new Set(textSettings.map(setting => setting.fontFamily))];
        await Promise.all(fontsToLoad.map(font => waitForFont(font)));

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = template.image;

        img.onload = async () => {
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            const watermarkText = "memehub.mom";
            const watermarkFontSize = Math.max(12, Math.min(canvas.width, canvas.height) * 0.02);
            ctx.save();
            ctx.font = `${watermarkFontSize}px Arial, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 5;

            const padding = 10;
            const watermarkX = padding;
            const watermarkY = canvas.height - padding;

            ctx.strokeText(watermarkText, watermarkX, watermarkY);
            ctx.fillText(watermarkText, watermarkX, watermarkY);
            ctx.restore();

            if (strokes.length > 0 || currentStroke) {
                drawStrokes(ctx);
            }

            const imagePromises = imageOverlays.map(overlay => loadAndCacheImage(overlay.src));

            try {
                await Promise.all(imagePromises);
            } catch (error) {
                console.warn('Some images failed to load:', error);
            }

            for (const overlay of imageOverlays) {
                try {
                    const overlayImg = imageCache.current.get(overlay.src);
                    if (!overlayImg) continue;

                    ctx.save();
                    ctx.globalAlpha = overlay.opacity;

                    if (overlay.rotation !== 0) {
                        const centerX = overlay.x + overlay.width / 2;
                        const centerY = overlay.y + overlay.height / 2;
                        ctx.translate(centerX, centerY);
                        ctx.rotate((overlay.rotation * Math.PI) / 180);
                        ctx.drawImage(overlayImg, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
                    } else {
                        ctx.drawImage(overlayImg, overlay.x, overlay.y, overlay.width, overlay.height);
                    }

                    ctx.restore();
                } catch (error) {
                    console.error('Error drawing overlay image:', error);
                }
            }

            if (selectedImageIndex !== -1 && selectedImageIndex < imageOverlays.length) {
                const selectedImg = imageOverlays[selectedImageIndex];

                const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const handleSize = isMobile ? 60 : 60;
                const rotationHandleSize = isMobile ? 60 : 50;

                const handles = [
                    { x: selectedImg.x - handleSize / 2, y: selectedImg.y - handleSize / 2 },
                    { x: selectedImg.x + selectedImg.width - handleSize / 2, y: selectedImg.y - handleSize / 2 },
                    { x: selectedImg.x - handleSize / 2, y: selectedImg.y + selectedImg.height - handleSize / 2 },
                    { x: selectedImg.x + selectedImg.width - handleSize / 2, y: selectedImg.y + selectedImg.height - handleSize / 2 },
                    { x: selectedImg.x + selectedImg.width / 2 - handleSize / 2, y: selectedImg.y - handleSize / 2 },
                    { x: selectedImg.x + selectedImg.width / 2 - handleSize / 2, y: selectedImg.y + selectedImg.height - handleSize / 2 },
                    { x: selectedImg.x - handleSize / 2, y: selectedImg.y + selectedImg.height / 2 - handleSize / 2 },
                    { x: selectedImg.x + selectedImg.width - handleSize / 2, y: selectedImg.y + selectedImg.height / 2 - handleSize / 2 }
                ];

                ctx.save();
                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = isMobile ? 4 : 3;
                ctx.setLineDash([8, 4]);
                ctx.strokeRect(selectedImg.x, selectedImg.y, selectedImg.width, selectedImg.height);
                ctx.restore();

                handles.forEach(handle => {
                    ctx.save();
                    ctx.fillStyle = '#6a7bd1';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = isMobile ? 4 : 3;

                    ctx.shadowColor = 'rgba(0,0,0,0.3)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 1;
                    ctx.shadowOffsetY = 1;

                    ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
                    ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
                    ctx.restore();
                });

                const rotationHandleX = selectedImg.x + selectedImg.width / 2;
                const rotationHandleY = selectedImg.y - 35;

                ctx.save();
                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = isMobile ? 5 : 4;
                ctx.beginPath();
                ctx.moveTo(selectedImg.x + selectedImg.width / 2, selectedImg.y);
                ctx.lineTo(rotationHandleX, rotationHandleY);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.fillStyle = '#6a7bd1';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isMobile ? 4 : 3;

                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.beginPath();
                ctx.arc(rotationHandleX, rotationHandleY, rotationHandleSize / 2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.restore();
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = `${isMobile ? 24 : 20}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('↻', rotationHandleX, rotationHandleY);
                ctx.restore();
            }

            textBoxes.forEach((box, i) => {
                drawText()(ctx, texts[i], box, textSettings[i]);
            });

            if (selectedTextIndex !== -1 && selectedTextIndex < textBoxes.length && texts[selectedTextIndex]) {
                const selectedBox = textBoxes[selectedTextIndex];
                const isMobile = isMobileDevice();
                const baseHandleSize = Math.max(30, Math.min(canvas.width, canvas.height) * 0.04);
                const handleSize = isMobile ? Math.max(baseHandleSize, 45) : Math.max(baseHandleSize, 35);

                ctx.save();

                const textBoxCenterY = selectedBox.y + selectedBox.height / 2;

                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = Math.max(2, Math.min(canvas.width, canvas.height) * 0.004);
                ctx.setLineDash([8, 4]);
                ctx.strokeRect(selectedBox.x, selectedBox.y, selectedBox.width, selectedBox.height);

                ctx.fillStyle = 'rgba(106, 123, 209, 0.15)';
                ctx.fillRect(selectedBox.x, selectedBox.y, selectedBox.width, selectedBox.height);

                const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + width - radius, y);
                    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                    ctx.lineTo(x + width, y + height - radius);
                    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                    ctx.lineTo(x + radius, y + height);
                    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.closePath();
                };

                const leftHandleX = selectedBox.x - handleSize / 2;
                const leftHandleY = textBoxCenterY - handleSize / 2;
                const rightHandleX = selectedBox.x + selectedBox.width - handleSize / 2;
                const rightHandleY = textBoxCenterY - handleSize / 2;

                ctx.setLineDash([]);
                ctx.fillStyle = '#6a7bd1';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isMobile ? 4 : 3;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                drawRoundedRect(leftHandleX, leftHandleY, handleSize, handleSize, 8);
                ctx.fill();
                ctx.stroke();

                drawRoundedRect(rightHandleX, rightHandleY, handleSize, handleSize, 8);
                ctx.fill();
                ctx.stroke();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.fillStyle = '#ffffff';
                const arrowSize = Math.max(14, handleSize * 0.45);
                ctx.font = `bold ${arrowSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillText('◀', leftHandleX + handleSize / 2, leftHandleY + handleSize / 2);
                ctx.fillText('▶', rightHandleX + handleSize / 2, rightHandleY + handleSize / 2);

                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = Math.max(1.5, Math.min(canvas.width, canvas.height) * 0.003);
                ctx.setLineDash([4, 4]);

                ctx.beginPath();
                ctx.moveTo(selectedBox.x, textBoxCenterY);
                ctx.lineTo(leftHandleX + handleSize, textBoxCenterY);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(selectedBox.x + selectedBox.width, textBoxCenterY);
                ctx.lineTo(rightHandleX, textBoxCenterY);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = '#6a7bd1';
                const indicatorFontSize = Math.max(10, Math.min(canvas.width, canvas.height) * 0.015);
                ctx.font = `bold ${indicatorFontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                const textOffset = Math.max(15, indicatorFontSize * 1.5);
                ctx.fillText(`${Math.round(selectedBox.width)}px`, selectedBox.x + selectedBox.width / 2, selectedBox.y - textOffset);

                ctx.restore();
            }
        };
    }, [template, textSettings, drawText, waitForFont, isDraggingImage, isResizingImage, isRotatingImage, isDragging, imageOverlays, selectedImageIndex, selectedTextIndex, textBoxes, texts, loadAndCacheImage, strokes, currentStroke]);



    useEffect(() => {
        draw();
    }, [draw, texts, textBoxes, textSettings, imageOverlays, selectedImageIndex, selectedTextIndex, strokes, currentStroke]);

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

    useEffect(() => {
        const pasteHandler = (event: ClipboardEvent) => handlePaste(event);
        document.addEventListener('paste', pasteHandler);
        return () => {
            document.removeEventListener('paste', pasteHandler);
        };
    }, [isUploadDialogOpen, handlePaste]);

    useEffect(() => {
        const keyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Delete' && selectedImageIndex !== -1) {
                removeImageOverlay(selectedImageIndex);
                setSelectedImageIndex(-1);
                event.preventDefault();
            }
        };
        document.addEventListener('keydown', keyHandler);
        return () => document.removeEventListener('keydown', keyHandler);
    }, [selectedImageIndex]);

    useEffect(() => {
        if (isUploadDialogOpen && uploadMethod === 'paste') {
            const pasteHandler = async (event: ClipboardEvent) => {
                const items = event.clipboardData?.items;
                if (!items) return;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const result = e.target?.result as string;
                                setPastedImageData(result);
                                setUploadMethod('paste');
                            };
                            reader.readAsDataURL(file);
                            event.preventDefault();
                            return;
                        }
                    }
                }
            };
            document.addEventListener('paste', pasteHandler);
            return () => document.removeEventListener('paste', pasteHandler);
        }
    }, [isUploadDialogOpen, uploadMethod]);

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
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                }, 'image/png');
            });

            const data = new ClipboardItem({
                'image/png': blob
            });

            await navigator.clipboard.write([data]);
            toast.success("meme copied to clipboard")
        } catch (err) {
            console.error('Failed to copy meme:', err);
            toast.error("Failed to copy meme :(")
        }
    }

    const addTextBox = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const textBoxWidth = Math.min(canvas.width * 0.8, 600);
        const textBoxHeight = Math.min(canvas.height * 0.3, 200);

        const newTextBox = {
            x: canvas.width / 2 - textBoxWidth / 2,
            y: canvas.height / 2 - textBoxHeight / 2,
            width: textBoxWidth,
            height: textBoxHeight,
            fontSize: 40,
            align: 'center' as const,
            minFont: MIN_FONT_SIZE
        };

        setTexts(prev => [...prev, 'memehub']);
        setTextBoxes(prev => [...prev, newTextBox]);
        setTextSettings(prev => [...prev, {
            fontSize: Math.max(60, Math.min(canvas.width, canvas.height) * 0.08),
            color: '#ffffff',
            fontFamily: getDefaultFont(),
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
        }]);

        toast.success('Text box added! Drag it to position.');
    }, [getDefaultFont, MIN_FONT_SIZE]);

    const removeTextBox = useCallback((index: number) => {
        if (index < originalTextBoxCount) {
            toast.error('Cannot remove template text boxes');
            return;
        }

        setTexts(prev => prev.filter((_, i) => i !== index));
        setTextBoxes(prev => prev.filter((_, i) => i !== index));
        setTextSettings(prev => prev.filter((_, i) => i !== index));

        toast.success('Text box removed');
    }, [originalTextBoxCount]);

    const getPointerPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): Point => {
        const rect = canvas.getBoundingClientRect();
        let x: number, y: number;
        if ('touches' in e && e.touches.length > 0) {
            x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
            y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
        } else if ('clientX' in e) {
            x = (e.clientX - rect.left) * (canvas.width / rect.width);
            y = (e.clientY - rect.top) * (canvas.height / rect.height);
        } else {
            x = 0; y = 0;
        }
        return { x, y };
    };

    // Drawing event handlers
    const handleDrawStart = (e: MouseEvent | TouchEvent) => {
        if (!isDrawingMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pos = getPointerPos(e, canvas);
        setIsDrawing(true);
        setCurrentStroke({
            points: [pos],
            color: drawColor,
            size: drawSize,
            eraser: isEraser
        });
        if (e.cancelable) e.preventDefault();
    };
    const handleDrawMove = (e: MouseEvent | TouchEvent) => {
        if (!isDrawingMode || !isDrawing || !currentStroke) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pos = getPointerPos(e, canvas);
        setCurrentStroke((prev) => prev ? { ...prev, points: [...prev.points, pos] } : null);
        if (e.cancelable) e.preventDefault();
    };
    const handleDrawEnd = (e?: MouseEvent | TouchEvent) => {
        if (!isDrawingMode || !isDrawing || !currentStroke) return;
        setStrokes((prev) => {
            const updated = [...prev, currentStroke];
            setTimeout(() => draw(), 0);
            return updated;
        });
        setCurrentStroke(null);
        setIsDrawing(false);
        if (e && 'preventDefault' in e && e.cancelable) e.preventDefault();
    };
    const handleUndo = () => {
        setStrokes((prev) => prev.slice(0, -1));
    };
    const handleEraseAll = () => {
        setStrokes([]);
    };
    const drawStrokes = (ctx: CanvasRenderingContext2D) => {
        for (const stroke of strokes.concat(currentStroke ? [currentStroke] : [])) {
            if (!stroke || !stroke.points.length) continue;
            ctx.save();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }
    };
    useEffect(() => {
        if (!isDrawingMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const mouseDown = (e: MouseEvent) => handleDrawStart(e);
        const mouseMove = (e: MouseEvent) => handleDrawMove(e);
        const mouseUp = (e: MouseEvent) => handleDrawEnd(e);
        const touchStart = (e: TouchEvent) => handleDrawStart(e);
        const touchMove = (e: TouchEvent) => handleDrawMove(e);
        const touchEnd = (e: TouchEvent) => handleDrawEnd(e);
        canvas.addEventListener('mousedown', mouseDown);
        canvas.addEventListener('mousemove', mouseMove);
        window.addEventListener('mouseup', mouseUp);
        canvas.addEventListener('touchstart', touchStart, { passive: false });
        canvas.addEventListener('touchmove', touchMove, { passive: false });
        window.addEventListener('touchend', touchEnd, { passive: false });
        return () => {
            canvas.removeEventListener('mousedown', mouseDown);
            canvas.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('mouseup', mouseUp);
            canvas.removeEventListener('touchstart', touchStart);
            canvas.removeEventListener('touchmove', touchMove);
            window.removeEventListener('touchend', touchEnd);
        };
    }, [isDrawingMode, isEraser, drawColor, drawSize, currentStroke, isDrawing]);

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
                        onMouseDown={isDrawingMode ? (e) => handleDrawStart(e.nativeEvent) : handleMouseDown}
                        onMouseMove={isDrawingMode ? (e) => handleDrawMove(e.nativeEvent) : handleMouseMove}
                        onMouseUp={isDrawingMode ? (e) => handleDrawEnd(e.nativeEvent) : handleMouseUp}
                        onMouseLeave={isDrawingMode ? (e) => handleDrawEnd(e.nativeEvent) : handleMouseUp}
                        onTouchStart={isDrawingMode ? (e) => handleDrawStart(e.nativeEvent) : handleTouchStart}
                        onTouchMove={isDrawingMode ? (e) => handleDrawMove(e.nativeEvent) : handleTouchMove}
                        onTouchEnd={isDrawingMode ? (e) => handleDrawEnd(e.nativeEvent) : handleTouchEnd}
                        style={{ touchAction: 'none' }}
                    />

                    <div className={`flex items-center space-x-2 mt-3 ${isDrawingMode ? '' : 'hidden'}`}>
                        <input
                            type="color"
                            value={drawColor}
                            onChange={e => setDrawColor(e.target.value)}
                            disabled={!isDrawingMode || isEraser}
                            className="w-8 h-8 rounded border border-white/20 cursor-pointer"
                            title="Stroke Color"
                        />
                        <input
                            type="range"
                            min="2"
                            max="80"
                            value={drawSize}
                            onChange={e => setDrawSize(Number(e.target.value))}
                            disabled={!isDrawingMode}
                            className="w-24 mx-2"
                            title="Stroke Size"
                        />
                        <span className="text-xs dark:text-white/60">{drawSize}px</span>
                        {/* <motion.button
                            whileTap={{ scale: 0.98 }}
                            className={`p-2 rounded-md border text-xs flex items-center space-x-1 ${isEraser && isDrawingMode ? 'bg-[#6a7bd1] text-white border-[#6a7bd1]' : 'bg-[#0f0f0f] text-white/70 border-white/20'}`}
                            onClick={() => { if (isDrawingMode) setIsEraser(v => !v); }}
                            disabled={!isDrawingMode}
                            title="Eraser"
                        >
                            <Eraser className="h-4 w-4" /> <span>Eraser</span>
                        </motion.button> */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            className="p-2 rounded-md border text-xs flex items-center space-x-1 bg-[#0f0f0f] text-white/70 border-white/20"
                            onClick={handleUndo}
                            disabled={!isDrawingMode || strokes.length === 0}
                            title="Undo"
                        >
                            <Undo2 className="h-4 w-4" /> <span>Undo</span>
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            className="p-2 rounded-md border text-xs flex items-center space-x-1 bg-[#0f0f0f] text-white/70 border-white/20"
                            onClick={handleEraseAll}
                            disabled={!isDrawingMode || strokes.length === 0}
                            title="Erase All"
                        >
                            <Trash className="h-4 w-4" /> <span>Erase All</span>
                        </motion.button>
                    </div>
                </motion.div>

                <motion.div
                    className="space-y-2 max-sm:-mt-4 w-full"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    {/* Action Buttons Row */}
                    <div className="flex space-x-2">
                        <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
                            setIsUploadDialogOpen(open);
                            if (!open) {
                                resetDialogState();
                            }
                        }}>
                            <DialogTrigger asChild>
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    className="flex items-center justify-center h-9 space-x-2 px-3 py-2 bg-black/70 dark:bg-white/15 border border-white/20 text-white text-xs rounded-md transition-colors w-full text-center"
                                    onClick={() => setIsUploadDialogOpen(true)}
                                >
                                    <Upload className="h-3 w-3" />
                                    <span>Upload Image</span>
                                </motion.button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-[#0f0f0f] border-white/20">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Upload Image</DialogTitle>
                                    <DialogDescription className="text-white/60">
                                        Choose how you want to add an image to your meme.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    {/* Upload Method Selection */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            className={`p-3 rounded-md border-2 transition-colors ${uploadMethod === 'file'
                                                ? 'border-[#6a7bd1] bg-[#6a7bd1]/20 text-white'
                                                : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            onClick={() => setUploadMethod('file')}
                                        >
                                            <Upload className="h-6 w-6 mx-auto mb-2" />
                                            <div className="text-xs font-medium">Upload File</div>
                                        </motion.button>
                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            className={`p-3 rounded-md border-2 transition-colors ${uploadMethod === 'paste'
                                                ? 'border-[#6a7bd1] bg-[#6a7bd1]/20 text-white'
                                                : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            onClick={() => setUploadMethod('paste')}
                                        >
                                            <ImageIcon className="h-6 w-6 mx-auto mb-2" />
                                            <div className="text-xs font-medium">Paste Image</div>
                                        </motion.button>
                                    </div>

                                    {/* File Upload Option */}
                                    {uploadMethod === 'file' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-2"
                                        >
                                            <label className="block text-sm dark:text-white/80">Select an image file:</label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleDialogFileUpload}
                                                className="w-full p-2 text-sm border rounded-md bg-white/5 border-white/20 text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#6a7bd1] file:text-white hover:file:bg-[#6975b3] file:cursor-pointer"
                                            />
                                            {selectedFile && (
                                                <div className="text-xs text-green-400 mt-1">
                                                    ✓ Selected: {selectedFile.name}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Paste Option */}
                                    {uploadMethod === 'paste' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-2"
                                        >
                                            <label className="block text-sm text-white/80">Paste your image here:</label>
                                            <div
                                                className="w-full h-32 border-2 border-dashed border-white/20 rounded-md flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                                onPaste={handleDialogPaste}
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            >
                                                {pastedImageData ? (
                                                    <div className="text-center">
                                                        <Image
                                                            src={pastedImageData}
                                                            alt="Pasted preview"
                                                            className="max-w-full max-h-24 mx-auto mb-2 rounded"
                                                            width={100}
                                                            height={100}
                                                        />
                                                        <div className="text-xs text-green-400">✓ Image pasted successfully</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-white/60">
                                                        <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                                                        {isMobileDevice() ? (
                                                            <>
                                                                <div className="text-sm mb-3">Copy an image and tap below</div>
                                                                <motion.button
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={handleMobilePaste}
                                                                    className="px-4 text-xs py-2 bg-white/20 text-white rounded-md transition-colors"
                                                                >
                                                                    Paste from Clipboard
                                                                </motion.button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-sm">Press Ctrl+V to paste an image</div>
                                                                <div className="text-xs">or click here and paste</div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        className="px-4 py-2 bg-transparent border border-white/20 text-white text-sm rounded-md hover:bg-white/5 transition-colors max-sm:mt-1"
                                        onClick={() => setIsUploadDialogOpen(false)}
                                    >
                                        Cancel
                                    </motion.button>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        className="px-4 py-2 bg-[#6a7bd1] hover:bg-[#6975b3] text-white text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={handleUploadConfirm}
                                        disabled={!selectedFile && !pastedImageData}
                                    >
                                        Upload Image
                                    </motion.button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Add Text Button */}
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center justify-center h-9 space-x-2 px-3 py-2 bg-black/70 dark:bg-white/15 border border-white/20 text-white text-xs rounded-md transition-colors w-full"
                            onClick={addTextBox}
                        >
                            <Plus className="h-3 w-3" />
                            <span>Add Text</span>
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            className={`p-2 rounded-md border text-xs flex items-center space-x-1 ${isDrawingMode ? 'bg-[#6a7bd1] text-white border-[#6a7bd1]' : ' bg-black/70 dark:bg-white/15 border border-white/20 text-white'}`}
                            onClick={() => setIsDrawingMode((v) => !v)}
                            title="Draw Mode"
                        >
                            <Pencil className="h-4 w-4" /> <span>Draw</span>
                        </motion.button>
                    </div>

                    {texts.map((txt, i) => (
                        <motion.div
                            key={i}
                            className="relative"
                        >
                            <div className="flex items-center space-x-2">
                                <div className="relative dropdown-container">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className="p-2 border rounded-md bg-[#0f0f0f] border-white/20 text-white dark:hover:bg-white/5 hover:bg-black/80 transition-colors"
                                            >
                                                <Settings className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className='max-w-md z-50'>
                                            <DropdownMenuLabel>Settings</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs dark:text-white/60 mb-1">Font Size</label>
                                                    <input
                                                        type="range"
                                                        min="10"
                                                        max="300"
                                                        value={textSettings[i].fontSize}
                                                        onChange={(e) => handleSettingsChange(i, 'fontSize', parseInt(e.target.value))}
                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textSettings[i].fontSize - 10) / 190) * 100}%, rgba(255,255,255,0.2) ${((textSettings[i].fontSize - 10) / 190) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                        }}
                                                    />
                                                    <span className="text-xs text-white/60">{textSettings[i].fontSize}px</span>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>

                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs dark:text-white/60 mb-1">Font Family</label>

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
                                                    <label className="block text-xs dark:text-white/60 mb-1">Font Weight</label>
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
                                                    <label className="block text-xs dark:text-white/60 mb-1">Text Color</label>
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
                                                    <label className="block text-xs dark:text-white/60 mb-1">Letter Spacing</label>
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
                                                    <span className="text-xs dark:text-white/60">{textSettings[i].letterSpacing}px</span>
                                                </div>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs dark:text-white/60 mb-1">Text Case</label>
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
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs dark:text-white/60 mb-1">Text Box Width</label>
                                                    <input
                                                        type="range"
                                                        min="50"
                                                        max="800"
                                                        value={textBoxes[i].width}
                                                        onChange={(e) => handleTextBoxChange(i, 'width', parseInt(e.target.value))}
                                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((textBoxes[i].width - 50) / 750) * 100}%, rgba(255,255,255,0.2) ${((textBoxes[i].width - 50) / 750) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                        }}
                                                    />
                                                    <span className="text-xs text-white/60">{textBoxes[i].width}px</span>
                                                </div>
                                            </DropdownMenuItem>

                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='flex flex-col space-y-2'>
                                                <div className='w-full' onClick={(e) => e.stopPropagation()}>
                                                    <label className="block text-xs dark:text-white/60 mb-2">Text Outline</label>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label className="block text-xs dark:text-white/40 mb-1">Outline Width: {textSettings[i].outline.width}px</label>
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
                                                            <label className="block text-xs dark:text-white/40 mb-1">Outline Color</label>
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
                                                    <label className="block text-xs dark:text-white/60 mb-2">Text Shadow</label>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label className="block text-xs dark:text-white/40 mb-1">Blur: {textSettings[i].shadow.blur}px</label>
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
                                                                <label className="block text-xs dark:text-white/40 mb-1">X: {textSettings[i].shadow.offsetX}px</label>
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
                                    </DropdownMenu>
                                </div>
                                <textarea
                                    className="w-full p-2 pl-3 text-sm border rounded-md bg-[#0f0f0f] border-white/20 text-white placeholder:text-white/70 resize-none min-h-[40px] max-h-[120px]"
                                    placeholder={i < originalTextBoxCount ? `text position ${i + 1}` : `Custom text ${i - originalTextBoxCount + 1}`}
                                    value={txt}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange(i, e.target.value)}
                                    rows={txt.split('\n').length || 1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                        }
                                    }}
                                />
                                {/* Add remove button for custom text boxes */}
                                {i >= originalTextBoxCount && (
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        className="p-2 border rounded-md bg-[#0f0f0f] border-white/20 text-white transition-colors"
                                        onClick={() => removeTextBox(i)}
                                        title="Remove text box"
                                    >
                                        <X className="h-4 w-4" />
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Images List */}
                    {imageOverlays.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.7 }}
                            className="mt-4 space-y-2"
                        >
                            <div className="space-y-1">
                                {imageOverlays.map((overlay, index) => (
                                    <motion.div
                                        key={overlay.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        className={`flex items-center justify-between p-2 rounded-md border transition-colors ${selectedImageIndex === index
                                            ? 'dark:bg-black dark:border-white/15 bg-[#0f0f0f] border-white/20'
                                            : 'dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 bg-black/80 border-white/20'
                                            }`}
                                        onClick={() => setSelectedImageIndex(index)}
                                    >
                                        <div className="flex items-center space-x-2 cursor-pointer flex-1">
                                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                                                <ImageIcon className="h-4 w-4 text-white/60 dark:text-white/60" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-white/80 dark:text-white/80 truncate">
                                                    image.png
                                                </div>
                                                <div className="text-xs text-white/40 dark:text-white/40">
                                                    {Math.round(overlay.width)}×{Math.round(overlay.height)}px
                                                </div>
                                            </div>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImageOverlay(index);
                                                if (selectedImageIndex === index) {
                                                    setSelectedImageIndex(-1);
                                                } else if (selectedImageIndex > index) {
                                                    setSelectedImageIndex(selectedImageIndex - 1);
                                                }
                                            }}
                                            className="p-1 rounded-full hover:scale-110 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4 text-white" />
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    <div className="flex w-full space-x-2 mt-4">
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