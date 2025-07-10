'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Upload, Plus, Image as ImageIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

type CustomTemplateUploadProps = {
    onTemplateCreate: (template: Template) => void;
    buttonText?: string;
    buttonIcon?: React.ReactNode;
    buttonClassName?: string;
    title?: string;
    description?: string;
};

export default function CustomTemplateUpload({
    onTemplateCreate,
    buttonText = "Upload Custom Template",
    buttonIcon = <Plus className="h-4 w-4" />,
    buttonClassName = "flex items-center space-x-2 px-6 py-3 bg-[#6a7bd1] hover:bg-[#6975b3] text-white rounded-lg transition-colors font-medium",
    title = "Upload Custom Template",
    description = "Choose an image to use as your meme template. We'll automatically add text boxes at the top and bottom."
}: CustomTemplateUploadProps) {
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadMethod, setUploadMethod] = useState<'file' | 'paste'>('file');
    const [pastedImageData, setPastedImageData] = useState<string | null>(null);

    const isMobileDevice = () => {
        if (typeof window !== 'undefined') {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        return false;
    };

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

    const createDefaultTemplate = async (source: File | string, isDataUrl: boolean = false): Promise<Template> => {
        return new Promise((resolve, reject) => {
            if (isDataUrl) {
                const img = new window.Image();
                img.onload = () => {
                    const defaultTemplate: Template = {
                        image: source as string,
                        textBoxes: [
                            {
                                x: Math.max(20, img.width * 0.05),
                                y: Math.max(50, img.height * 0.1),
                                width: Math.min(img.width * 0.9, img.width - 40),
                                height: Math.min(img.height * 0.2, 150),
                                fontSize: Math.max(30, Math.min(img.width, img.height) * 0.08),
                                minFont: 20,
                                align: 'center' as const
                            },
                            {
                                x: Math.max(20, img.width * 0.05),
                                y: Math.max(img.height * 0.7, img.height - 200),
                                width: Math.min(img.width * 0.9, img.width - 40),
                                height: Math.min(img.height * 0.2, 150),
                                fontSize: Math.max(30, Math.min(img.width, img.height) * 0.08),
                                minFont: 20,
                                align: 'center' as const
                            }
                        ]
                    };
                    resolve(defaultTemplate);
                };
                img.onerror = reject;
                img.src = source as string;
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new window.Image();
                    img.onload = () => {
                        const defaultTemplate: Template = {
                            image: e.target?.result as string,
                            textBoxes: [
                                {
                                    x: Math.max(20, img.width * 0.05),
                                    y: Math.max(50, img.height * 0.1),
                                    width: Math.min(img.width * 0.9, img.width - 40),
                                    height: Math.min(img.height * 0.2, 150),
                                    fontSize: Math.max(30, Math.min(img.width, img.height) * 0.08),
                                    minFont: 20,
                                    align: 'center' as const
                                },
                                {
                                    x: Math.max(20, img.width * 0.05),
                                    y: Math.max(img.height * 0.7, img.height - 200),
                                    width: Math.min(img.width * 0.9, img.width - 40),
                                    height: Math.min(img.height * 0.2, 150),
                                    fontSize: Math.max(30, Math.min(img.width, img.height) * 0.08),
                                    minFont: 20,
                                    align: 'center' as const
                                }
                            ]
                        };
                        resolve(defaultTemplate);
                    };
                    img.onerror = reject;
                    img.src = e.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(source as File);
            }
        });
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

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                setSelectedFile(file);
            } else {
                toast.error('Please select an image file');
            }
        }
    };

    const handleUploadConfirm = async () => {
        try {
            if (uploadMethod === 'file' && selectedFile) {
                const customTemplate = await createDefaultTemplate(selectedFile, false);
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }

                onTemplateCreate(customTemplate);
            } else if (uploadMethod === 'paste' && pastedImageData) {
                const customTemplate = await createDefaultTemplate(pastedImageData, true);
                setIsUploadDialogOpen(false);
                setPastedImageData(null);

                onTemplateCreate(customTemplate);
            } else {
                toast.error('Please select a file or paste an image');
                return;
            }

            setUploadMethod('file');
        } catch (error) {
            console.error('Error creating custom template:', error);
            toast.error('Failed to process image');
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

    return (
        <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) {
                resetDialogState();
            }
        }}>
            <DialogTrigger asChild>
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    className={buttonClassName}
                    onClick={() => setIsUploadDialogOpen(true)}
                >
                    {buttonIcon}
                    <span>{buttonText}</span>
                </motion.button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-[#0f0f0f] border-white/20">
                <DialogHeader>
                    <DialogTitle className="text-white">{title}</DialogTitle>
                    <DialogDescription className="text-white/60">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            className={`p-3 rounded-md border-2 transition-colors ${uploadMethod === 'file'
                                ? 'border-[#6a7bd1] bg-[#6a7bd1]/20 text-white'
                                : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                            onClick={() => {
                                setUploadMethod('file');
                                setPastedImageData(null);
                            }}
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
                            onClick={() => {
                                setUploadMethod('paste');
                                setSelectedFile(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                        >
                            <ImageIcon className="h-6 w-6 mx-auto mb-2" />
                            <div className="text-xs font-medium">Paste Image</div>
                        </motion.button>
                    </div>

                    {uploadMethod === 'file' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-2"
                        >
                            <label className="block text-sm text-white/80">Select an image file:</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="w-full p-2 text-sm border rounded-md bg-white/5 border-white/20 text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#6a7bd1] file:text-white hover:file:bg-[#6975b3] file:cursor-pointer"
                            />
                            {selectedFile && (
                                <div className="text-xs text-green-400 mt-1">
                                    ✓ Selected: {selectedFile.name}
                                </div>
                            )}
                        </motion.div>
                    )}

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
                                tabIndex={0}
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
                        <Upload className="h-4 w-4 mr-2 inline" />
                        Create Template
                    </motion.button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 