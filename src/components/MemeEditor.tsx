/* eslint-disable react-hooks/exhaustive-deps */
"use client"
// @ts-nocheck

import { Template } from '@/types/template';
import { MoveLeft, Settings, Upload, Image as ImageIcon, Trash2, Plus, X, Pencil, Undo2, Trash, Shapes, ChevronDown, ChevronUp, Layers, Download, Video, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, ChangeEvent, useCallback, useMemo } from 'react';
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
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
import { MemeEditorProps, TextSettings, ImageOverlay, EraseStroke } from '@/types/editor';
import Image from 'next/image';
import {
    useFontLoader,
    FONT_CONFIGS,
    INDIAN_SCRIPT_FONT_NAMES,
    getCanonicalFontFamily,
} from '@/hooks/useFontLoader';
import { useCanvasShapes } from '@/hooks/useCanvasShapes';
import ElementsPanel from '@/components/ElementsPanel';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import type { GiphyMediaItem } from '@/types/giphy';
import {
    GIF_MAX_BYTES,
    GIPHY_GIF_DECODE_LIMITS,
    GIPHY_GIF_FETCH_TIMEOUT_MS,
    GifDecodeLimitError,
    decodeGifFromArrayBuffer,
    fetchGifArrayBuffer,
    getAnimatedExportDurationMs,
    getAnimatedOverlayIdsToRehydrate,
    getGifDecodeLimitsForPolicy,
    getGifFrameCanvas,
    isGifSource,
    type DecodedGif,
    type GifDecodePolicy,
    type GifDecodeLimits,
} from '@/lib/gifAnimation';
import { getMediaPerfNow, logMediaDebug } from '@/lib/mediaDebug';
import {
    getAnimatedExportCapability,
    getStillExportMimeType,
} from '@/lib/exportCapabilities';
import {
    downloadBlob,
    encodeSceneToGifBlob,
    recordSceneToVideoBlob,
    renderSceneToImageBlob,
    renderSceneToPngBlob,
    type SceneRenderOptions,
} from '@/lib/canvasExport';
import {
    buildCloudinaryMp4Url,
    downloadRemoteUrl,
    uploadVideoCaptureToCloudinary,
    waitForCloudinaryMp4,
} from '@/lib/cloudinaryVideoExport';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import {
    assertMemeEditorDraftLocalMediaCapacity,
    type CanvasTemplate,
    type DrawingStroke,
    type MemeEditorDraftState,
} from '@/lib/editorDraft';
import {
    DEFAULT_CREATOR_BRANDING,
    fitWatermarkFontSize,
    getWatermarkCoordinates,
    type CreatorBranding,
} from '@/lib/creatorBranding';
import { getSafeLetterSpacing } from '@/lib/textShaping';
import {
    canMoveTextLayerWithinGroup,
    constrainLayerPosition,
    duplicateImageLayer,
    duplicateShapeLayer,
    duplicateTextLayer,
    fitImageLayerToCanvas,
    moveLayer,
    moveTextLayer,
    toggleLayerVisibility,
} from '@/lib/layerOperations';
import CreatorWorkspace, {
    type CreatorWorkspaceTab,
} from '@/components/CreatorWorkspace';
import CreatorLayersPanel from '@/components/CreatorLayersPanel';
import TextStylePanel from '@/components/TextStylePanel';
import {
    applyTextStylePreset,
    type TextStylePresetId,
} from '@/lib/textStylePresets';
import CreatorAssetShelf from '@/components/CreatorAssetShelf';
import CreatorExportPanel, {
    type CreatorStillExportRequest,
} from '@/components/CreatorExportPanel';
import type { CreatorAsset } from '@/lib/creatorAssets';
import {
    buildCreatorExportFilename,
    resolveCreatorExportDimensions,
    STILL_IMAGE_FORMATS,
} from '@/lib/creatorExport';
import ImageLayerTools from '@/components/ImageLayerTools';
import CreatorBrandPanel from '@/components/CreatorBrandPanel';
import CreatorDiscoveryPanel from '@/components/CreatorDiscoveryPanel';
import type { ReusableImageAsset } from '@/types/creatorDiscovery';
import { settleSceneImageLoads } from '@/lib/sceneImageLoading';
import { materializeReusableImage } from '@/lib/reusableImagePersistence';

const STATIC_IMAGE_LOAD_TIMEOUT_MS = 12_000;
const IMAGE_CACHE_MAX_ENTRIES = 32;
const EDITOR_IMAGE_LAYER_LIMIT = 24;
let textLayerIdSequence = 0;

function createTextLayerId(): string {
    textLayerIdSequence += 1;
    return `text-layer-${Date.now().toString(36)}-${textLayerIdSequence.toString(36)}`;
}

export default function MemeEditor({
    template,
    onReset,
    restoreSavedDraft = false,
    expectedDraftUpdatedAt,
}: MemeEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const primaryCaptionRef = useRef<HTMLTextAreaElement | null>(null);
    const [canvasTemplate, setCanvasTemplate] =
        useState<CanvasTemplate | undefined>();
    const canvasTemplateRef = useRef<CanvasTemplate | undefined>(
        canvasTemplate
    );
    canvasTemplateRef.current = canvasTemplate;
    const effectiveTemplate = canvasTemplate ?? template;
    const [texts, setTexts] = useState<string[]>(Array(template.textBoxes.length).fill(''));
    const [textLayerIds, setTextLayerIds] = useState<string[]>(() =>
        template.textBoxes.map(() => createTextLayerId())
    );
    const [isLeaving, setIsLeaving] = useState(false);
    const isLeavingRef = useRef(false);
    const pendingImageAddCount = useRef(0);
    const pendingImageAddWaiters = useRef<Set<() => void>>(new Set());
    const waitForPendingImageAdds = useCallback((): Promise<void> => {
        if (pendingImageAddCount.current === 0) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            pendingImageAddWaiters.current.add(resolve);
        });
    }, []);
    const beginPendingImageAdd = useCallback(() => {
        pendingImageAddCount.current += 1;
        let finished = false;
        return () => {
            if (finished) return;
            finished = true;
            pendingImageAddCount.current = Math.max(
                0,
                pendingImageAddCount.current - 1
            );
            if (pendingImageAddCount.current === 0) {
                pendingImageAddWaiters.current.forEach((resolve) => resolve());
                pendingImageAddWaiters.current.clear();
            }
        };
    }, []);

    const [textBoxes, setTextBoxes] = useState<Template['textBoxes']>(template.textBoxes);
    const [textBoxRotations, setTextBoxRotations] = useState<number[]>(Array(template.textBoxes.length).fill(0));
    const [originalTextBoxCount, setOriginalTextBoxCount] =
        useState<number>(template.textBoxes.length);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragIndex, setDragIndex] = useState<number>(-1);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectedTextIndex, setSelectedTextIndex] = useState<number>(-1);
    const [isRotatingText, setIsRotatingText] = useState<boolean>(false);
    const [rotateTextIndex, setRotateTextIndex] = useState<number>(-1);
    const [rotateTextStartAngle, setRotateTextStartAngle] = useState<number>(0);
    const [isResizingTextWidth, setIsResizingTextWidth] = useState<boolean>(false);
    const [resizeTextIndex, setResizeTextIndex] = useState<number>(-1);
    const [isResizingFromLeft, setIsResizingFromLeft] = useState<boolean>(false);
    // New: height-resize flags
    const [isResizingTextHeight, setIsResizingTextHeight] = useState<boolean>(false);
    const [isResizingFromTop, setIsResizingFromTop] = useState<boolean>(false);
    // Corner resize flags
    const [isResizingTextCorner, setIsResizingTextCorner] = useState<boolean>(false);
    const [resizeTextCornerHandle, setResizeTextCornerHandle] = useState<string>('');
    const [resizeTextStartSize, setResizeTextStartSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [resizeTextStartBoxPos, setResizeTextStartBoxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [resizeTextStartFontSize, setResizeTextStartFontSize] = useState<number>(0);

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
    const textsRef = useRef(texts);
    const textLayerIdsRef = useRef(textLayerIds);
    const textSettingsRef = useRef(textSettings);
    textsRef.current = texts;
    textLayerIdsRef.current = textLayerIds;
    textSettingsRef.current = textSettings;
    const [openDropdown, setOpenDropdown] = useState<number>(-1);

    const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
    const imageOverlaysRef = useRef<ImageOverlay[]>(imageOverlays);
    imageOverlaysRef.current = imageOverlays;
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
    const decodedGifCache = useRef<Map<string, DecodedGif>>(new Map());
    const backgroundGifDecodeQueue = useRef<Promise<void>>(Promise.resolve());
    const pendingGifDecodeIds = useRef<Set<string>>(new Set());
    const fontLoadCache = useRef<Map<string, Promise<void>>>(new Map());
    const currentAnimationTimeRef = useRef<number>(0);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [, setPendingGifDecodeCount] = useState(0);

    const {
        shapeOverlays,
        replaceShapes,
        selectedShapeIndex,
        setSelectedShapeIndex,
        addShape,
        removeShape,
        updateShape,
        tryShapeMouseDown,
        handleShapeMouseMove,
        endShapeInteraction,
        drawShapesLayer,
        isShapeInteracting,
        getShapeAtPosition,
    } = useCanvasShapes(canvasRef);

    const lastDrawTime = useRef<number>(0);
    const isOptimizedDrawing = useRef<boolean>(false);
    const previewRenderRevision = useRef(0);
    const pendingDiscoveryImageAdds = useRef(0);
    const workspaceTabPreservingImageId = useRef<string | null>(null);

    type Point = { x: number; y: number };
    type Stroke = DrawingStroke;
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [showElementsPanel, setShowElementsPanel] = useState(false);
    const [branding, setBranding] = useState<CreatorBranding>(() => ({
        ...DEFAULT_CREATOR_BRANDING,
    }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isEraser, setIsEraser] = useState(false);
    const [drawColor, setDrawColor] = useState('#ff0000');
    const [drawSize, setDrawSize] = useState(6);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Image erase mode state
    const [isImageEraseMode, setIsImageEraseMode] = useState(false);
    const [imageEraseTargetIndex, setImageEraseTargetIndex] = useState<number>(-1);
    const [eraseBrushSize, setEraseBrushSize] = useState(20);
    const [eraseBrushOpacity, setEraseBrushOpacity] = useState(1);
    const [currentEraseStroke, setCurrentEraseStroke] = useState<EraseStroke | null>(null);
    const [isErasing, setIsErasing] = useState(false);
    const [showLayerPanel, setShowLayerPanel] = useState(true);
    const [showMediaLayers, setShowMediaLayers] = useState(true);
    const [showShapeLayers, setShowShapeLayers] = useState(true);
    const [creatorWorkspaceTab, setCreatorWorkspaceTab] =
        useState<CreatorWorkspaceTab>('discover');
    const [creatorWorkspaceCollapsed, setCreatorWorkspaceCollapsed] =
        useState(true);

    const restoreDraftState = useCallback((draft: MemeEditorDraftState) => {
        setCanvasTemplate(draft.canvasTemplate);
        canvasTemplateRef.current = draft.canvasTemplate;
        setTexts(draft.texts);
        setTextLayerIds(draft.texts.map(() => createTextLayerId()));
        setTextBoxes(draft.textBoxes);
        setTextBoxRotations(draft.textBoxRotations);
        setOriginalTextBoxCount(
            draft.canvasTemplate?.textBoxes.length ??
                draft.template.textBoxes.length
        );
        setTextSettings(
            draft.textSettings.map((settings) => ({
                ...settings,
                fontFamily: getCanonicalFontFamily(settings.fontFamily),
            }))
        );
        imageOverlaysRef.current = draft.imageOverlays;
        setImageOverlays(draft.imageOverlays);
        replaceShapes(draft.shapeOverlays);
        setStrokes(draft.strokes);
        setBranding(draft.branding ?? { ...DEFAULT_CREATOR_BRANDING });
        setSelectedTextIndex(-1);
        setSelectedImageIndex(-1);
        setSelectedShapeIndex(-1);
    }, [replaceShapes, setSelectedShapeIndex]);

    const draftState = useMemo<MemeEditorDraftState>(() => ({
        template,
        canvasTemplate,
        texts,
        textBoxes,
        textBoxRotations,
        textSettings,
        imageOverlays,
        shapeOverlays,
        strokes,
        branding,
    }), [
        branding,
        canvasTemplate,
        imageOverlays,
        shapeOverlays,
        strokes,
        template,
        textBoxes,
        textBoxRotations,
        textSettings,
        texts,
    ]);
    const draftStateRef = useRef(draftState);
    draftStateRef.current = draftState;
    const prepareDraftSave = useCallback(async () => {
        await waitForPendingImageAdds();
        return {
            ...draftStateRef.current,
            imageOverlays: imageOverlaysRef.current,
        };
    }, [waitForPendingImageAdds]);

    const {
        canEdit: canEditDraft,
        isReady: isDraftReady,
        restoreError: draftRestoreError,
        saveNow,
        status: draftStatus,
    } = useEditorDraft({
        state: draftState,
        onRestore: restoreDraftState,
        beforeSave: prepareDraftSave,
        restoreSavedDraft,
        expectedDraftUpdatedAt,
    });
    const editorCanEdit = canEditDraft && !isLeaving;

    useEffect(() => {
        const warnAboutPendingImage = (event: BeforeUnloadEvent) => {
            if (pendingImageAddCount.current === 0) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnAboutPendingImage);
        return () =>
            window.removeEventListener('beforeunload', warnAboutPendingImage);
    }, []);

    const handleBack = useCallback(async () => {
        if (isLeavingRef.current) return;
        isLeavingRef.current = true;
        setIsLeaving(true);

        try {
            await waitForPendingImageAdds();
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
            await saveNow();
            onReset();
        } catch {
            toast.error('Your draft could not be saved. Please retry before leaving.');
            if (
                window.confirm(
                    'Your draft could not be saved. Leave without saving these latest changes?'
                )
            ) {
                onReset();
                return;
            }
            isLeavingRef.current = false;
            setIsLeaving(false);
        }
    }, [onReset, saveNow, waitForPendingImageAdds]);

    const loadAndCacheImage = useCallback(async (src: string): Promise<HTMLImageElement> => {
        if (imageCache.current.has(src)) {
            const cachedImage = imageCache.current.get(src)!;
            imageCache.current.delete(src);
            imageCache.current.set(src, cachedImage);
            return cachedImage;
        }

        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            const timeoutId = window.setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                reject(
                    new Error(
                        'Image loading timed out. Try a smaller file or a different source.'
                    )
                );
            }, STATIC_IMAGE_LOAD_TIMEOUT_MS);
            img.onload = () => {
                window.clearTimeout(timeoutId);
                imageCache.current.set(src, img);
                while (
                    imageCache.current.size >
                    IMAGE_CACHE_MAX_ENTRIES
                ) {
                    const oldestSource =
                        imageCache.current.keys().next().value;
                    if (typeof oldestSource !== 'string') break;
                    imageCache.current.delete(oldestSource);
                }
                resolve(img);
            };
            img.onerror = () => {
                window.clearTimeout(timeoutId);
                reject(new Error('Image could not be loaded.'));
            };
            img.src = src;
        });
    }, []);

    const getAnimationNow = useCallback(() => {
        if (typeof performance !== 'undefined') {
            return performance.now();
        }
        return Date.now();
    }, []);

    const decodeGifForOverlay = useCallback(async (
        overlayId: string,
        src: string,
        file?: File,
        options: { limits?: GifDecodeLimits; signal?: AbortSignal } = {}
    ) => {
        const buffer = file
            ? await file.arrayBuffer()
            : await fetchGifArrayBuffer(src, options.limits, { signal: options.signal });
        const decodedGif = decodeGifFromArrayBuffer(buffer, options.limits);
        decodedGifCache.current.set(overlayId, decodedGif);
        return decodedGif;
    }, []);

    const queueBackgroundGifDecode = useCallback((task: () => Promise<void>) => {
        backgroundGifDecodeQueue.current = backgroundGifDecodeQueue.current
            .catch(() => undefined)
            .then(task)
            .catch((error) => {
                console.warn('Background GIF decode failed:', error);
            });

        return backgroundGifDecodeQueue.current;
    }, []);

    const setGifDecodePending = useCallback((overlayId: string, isPending: boolean) => {
        const pendingIds = pendingGifDecodeIds.current;
        const wasPending = pendingIds.has(overlayId);
        if (wasPending === isPending) return;

        if (isPending) {
            pendingIds.add(overlayId);
        } else {
            pendingIds.delete(overlayId);
        }

        setPendingGifDecodeCount(pendingIds.size);
    }, []);

    const clearOverlayGifDecodePending = useCallback((overlayId: string) => {
        if (isLeavingRef.current) return;
        setGifDecodePending(overlayId, false);
        setImageOverlays((prev) => prev.map((overlay) => (
            overlay.id === overlayId
                ? { ...overlay, animationDecodePending: false }
                : overlay
        )));
    }, [setGifDecodePending]);

    const startBackgroundGifDecode = useCallback((options: {
        label?: string;
        limits?: GifDecodeLimits;
        overlayId: string;
        src: string;
        startedAt: number;
        timeoutMs?: number;
    }) => {
        queueBackgroundGifDecode(async () => {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller
                ? window.setTimeout(() => controller.abort(), options.timeoutMs ?? GIPHY_GIF_FETCH_TIMEOUT_MS)
                : null;

            try {
                const decodedGif = await decodeGifForOverlay(options.overlayId, options.src, undefined, {
                    limits: options.limits,
                    signal: controller?.signal,
                });
                if (isLeavingRef.current) return;

                if (decodedGif.frameCount <= 1) {
                    decodedGifCache.current.delete(options.overlayId);
                    setImageOverlays((prev) =>
                        prev.map((overlay) =>
                            overlay.id === options.overlayId
                                ? {
                                      ...overlay,
                                      animated: false,
                                      animatedSrc: undefined,
                                      animationDecodePolicy: undefined,
                                      animationDecodePending: false,
                                  }
                                : overlay
                        )
                    );
                    logMediaDebug('gif-decode-skipped-static', {
                        label: options.label,
                        overlayId: options.overlayId,
                        totalMs: Math.round(getMediaPerfNow() - options.startedAt),
                    });
                    return;
                }

                setImageOverlays((prev) => {
                    const overlayExists = prev.some((overlay) => overlay.id === options.overlayId);
                    if (!overlayExists) {
                        decodedGifCache.current.delete(options.overlayId);
                        return prev;
                    }

                    return prev.map((overlay) => (
                        overlay.id === options.overlayId
                            ? {
                                ...overlay,
                                animated: true,
                                animatedSrc: undefined,
                                animationDecodePending: false,
                                animationStartMs: getAnimationNow(),
                                mimeType: 'image/gif',
                                originalHeight: decodedGif.height,
                                originalWidth: decodedGif.width,
                                src: options.src,
                            }
                            : overlay
                    ));
                });

                logMediaDebug('gif-decode-upgraded-overlay', {
                    byteLength: decodedGif.byteLength,
                    durationMs: decodedGif.durationMs,
                    frameCount: decodedGif.frameCount,
                    label: options.label,
                    overlayId: options.overlayId,
                    totalMs: Math.round(getMediaPerfNow() - options.startedAt),
                });
            } catch (error) {
                decodedGifCache.current.delete(options.overlayId);
                if (!isLeavingRef.current) {
                    setImageOverlays((prev) =>
                        prev.map((overlay) =>
                            overlay.id === options.overlayId
                                ? {
                                    ...overlay,
                                    animated: false,
                                    animatedSrc: undefined,
                                    animationDecodePolicy: undefined,
                                    animationDecodePending: false,
                                }
                                : overlay
                        )
                    );
                }
                logMediaDebug('gif-decode-kept-static', {
                    error: error instanceof Error ? error.message : 'GIF decode failed',
                    label: options.label,
                    overlayId: options.overlayId,
                    totalMs: Math.round(getMediaPerfNow() - options.startedAt),
                });
            } finally {
                if (timeoutId !== null) {
                    window.clearTimeout(timeoutId);
                }
                clearOverlayGifDecodePending(options.overlayId);
            }
        });
    }, [clearOverlayGifDecodePending, decodeGifForOverlay, getAnimationNow, queueBackgroundGifDecode]);

    useEffect(() => {
        const overlayIds = getAnimatedOverlayIdsToRehydrate(
            imageOverlays,
            new Set(decodedGifCache.current.keys()),
            pendingGifDecodeIds.current
        );

        overlayIds.forEach((overlayId) => {
            const overlay = imageOverlays.find((item) => item.id === overlayId);
            if (!overlay) return;

            setGifDecodePending(overlayId, true);
            setImageOverlays((prev) =>
                prev.map((item) =>
                    item.id === overlayId
                        ? { ...item, animationDecodePending: true }
                        : item
                )
            );
            startBackgroundGifDecode({
                label: overlay.label,
                limits: getGifDecodeLimitsForPolicy(
                    overlay.animationDecodePolicy
                ),
                overlayId,
                src: overlay.animatedSrc || overlay.src,
                startedAt: getMediaPerfNow(),
                timeoutMs:
                    overlay.animationDecodePolicy === 'giphy'
                        ? GIPHY_GIF_FETCH_TIMEOUT_MS
                        : undefined,
            });
        });
    }, [imageOverlays, setGifDecodePending, startBackgroundGifDecode]);

    const isUnsupportedAnimatedUploadCandidate = useCallback((file: File) => {
        const lowerName = file.name.toLowerCase();
        return file.type === 'image/webp' || lowerName.endsWith('.webp') || lowerName.endsWith('.apng');
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

    const MIN_FONT_SIZE = effectiveTemplate.textBoxes[0]?.minFont ?? 10;
    const CUSTOM_TEXT_MIN_FONT_SIZE = 10;
    const MAX_TEXT_FONT_SIZE = 300;
    const MIN_TEXT_BOX_SIZE = 24;

    const clampValue = useCallback((value: number, min: number, max: number) => {
        return Math.max(min, Math.min(max, value));
    }, []);

    const getFontFallbacks = useCallback((fontFamily: string): string => {
        const canonicalFontFamily = getCanonicalFontFamily(fontFamily);
        return [
            canonicalFontFamily,
            canonicalFontFamily === 'Impact' ? 'Arial Black' : 'Impact',
            'Arial Black',
            'Helvetica Neue',
            'Arial',
            'sans-serif'
        ].join(', ');
    }, []);

    const getTextWidthWithSpacing = useCallback((
        ctx: CanvasRenderingContext2D,
        text: string,
        letterSpacing: number
    ): number => {
        const safeLetterSpacing = getSafeLetterSpacing(text, letterSpacing);
        if (safeLetterSpacing === 0) {
            return ctx.measureText(text).width;
        }

        return text.split('').reduce((width, char, index) => {
            return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
        }, 0);
    }, []);

    const getMeasuredTextBoxSize = useCallback((
        ctx: CanvasRenderingContext2D,
        text: string,
        settings: TextSettings,
        maxWidth?: number
    ): { width: number; height: number; lines: string[] } => {
        const fontSize = Math.max(1, settings.fontSize || 1);
        const fontFallbacks = getFontFallbacks(settings.fontFamily);

        ctx.save();
        ctx.font = `${settings.fontWeight} ${fontSize}px ${fontFallbacks}`;

        const transformedText = transformText(text || '', settings.textCase);
        const shadowPadding = Math.max(
            Math.abs(settings.shadow?.offsetX || 0),
            Math.abs(settings.shadow?.offsetY || 0)
        ) + (settings.shadow?.blur || 0);
        const padding = Math.ceil(
            Math.max(8, fontSize * 0.14) +
            (settings.outline?.width || 0) * 2 +
            shadowPadding
        );
        const maxContentWidth = maxWidth
            ? Math.max(MIN_TEXT_BOX_SIZE, maxWidth - padding * 2)
            : Number.POSITIVE_INFINITY;

        const lines: string[] = [];
        const manualLines = transformedText.length ? transformedText.split('\n') : [''];

        manualLines.forEach((manualLine) => {
            if (!manualLine) {
                lines.push('');
                return;
            }

            if (!Number.isFinite(maxContentWidth)) {
                lines.push(manualLine);
                return;
            }

            const words = manualLine.split(' ');
            let currentLine = '';

            words.forEach((word) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const textWidth = getTextWidthWithSpacing(ctx, testLine, settings.letterSpacing);

                if (textWidth > maxContentWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });

            lines.push(currentLine);
        });

        const longestLineWidth = lines.reduce((width, line) => {
            return Math.max(width, getTextWidthWithSpacing(ctx, line, settings.letterSpacing));
        }, 0);
        const lineHeight = fontSize * 1.2;

        ctx.restore();

        return {
            width: Math.max(MIN_TEXT_BOX_SIZE, Math.ceil(longestLineWidth + padding * 2)),
            height: Math.max(MIN_TEXT_BOX_SIZE, Math.ceil(lines.length * lineHeight + padding * 2)),
            lines
        };
    }, [getFontFallbacks, getTextWidthWithSpacing, transformText]);

    const constrainTextBoxToCanvas = useCallback((
        box: Template['textBoxes'][number],
        canvas: HTMLCanvasElement
    ): Template['textBoxes'][number] => {
        let nextX = box.x;
        let nextY = box.y;

        if (box.width <= canvas.width) {
            nextX = clampValue(nextX, 0, Math.max(0, canvas.width - box.width));
        } else {
            nextX = clampValue(nextX, canvas.width - box.width, 0);
        }

        if (box.height <= canvas.height) {
            nextY = clampValue(nextY, 0, Math.max(0, canvas.height - box.height));
        } else {
            nextY = clampValue(nextY, canvas.height - box.height, 0);
        }

        return {
            ...box,
            x: nextX,
            y: nextY
        };
    }, [clampValue]);

    const fitTextBoxToContent = useCallback((
        box: Template['textBoxes'][number],
        text: string,
        settings: TextSettings,
        options?: { mode?: 'center' | 'draw-origin'; maxWidth?: number }
    ): Template['textBoxes'][number] => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return box;

        const mode = options?.mode || 'draw-origin';
        const maxWidth = Math.max(
            MIN_TEXT_BOX_SIZE,
            Math.min(options?.maxWidth ?? canvas.width * 0.9, canvas.width * 0.95)
        );
        const measured = getMeasuredTextBoxSize(ctx, text, settings, maxWidth);
        let nextX = box.x;
        let nextY = box.y;

        if (mode === 'center') {
            nextX = box.x + box.width / 2 - measured.width / 2;
            nextY = box.y + box.height / 2 - measured.height / 2;
        } else if (box.align === 'right') {
            nextX = box.x + box.width - measured.width;
        } else if (box.align === 'center') {
            nextX = box.x + box.width / 2 - measured.width / 2;
        }

        return constrainTextBoxToCanvas({
            ...box,
            x: nextX,
            y: nextY,
            width: measured.width,
            height: measured.height,
            fontSize: settings.fontSize,
            minFont: box.minFont ?? CUSTOM_TEXT_MIN_FONT_SIZE,
            align: box.align || 'center'
        }, canvas);
    }, [CUSTOM_TEXT_MIN_FONT_SIZE, getMeasuredTextBoxSize, constrainTextBoxToCanvas]);

    const updateTextBoxToContent = useCallback((
        idx: number,
        text: string,
        settings: TextSettings
    ) => {
        setTextBoxes(prev => {
            const box = prev[idx];
            if (!box) return prev;

            const canvas = canvasRef.current;
            const templateMaxWidth = idx < originalTextBoxCount
                ? effectiveTemplate.textBoxes[idx]?.width
                : undefined;
            const maxWidth = templateMaxWidth && canvas
                ? Math.min(templateMaxWidth, canvas.width * 0.95)
                : undefined;
            const updated = [...prev];
            updated[idx] = fitTextBoxToContent(box, text, settings, {
                mode: 'draw-origin',
                maxWidth
            });
            return updated;
        });
    }, [
        effectiveTemplate.textBoxes,
        fitTextBoxToContent,
        originalTextBoxCount,
    ]);

    const handleChange = useCallback((idx: number, value: string) => {
        setTexts(prev => {
            const arr = [...prev];
            arr[idx] = value;
            return arr;
        });

        const settings = textSettings[idx];
        if (settings) {
            updateTextBoxToContent(idx, value, settings);
        }
    }, [textSettings, updateTextBoxToContent]);

    const handleSettingsChange = useCallback((idx: number, setting: keyof TextSettings, value: string | number) => {
        const currentSettings = textSettings[idx];
        const textLayerId = textLayerIds[idx];
        if (!currentSettings || !textLayerId) return;

        const nextSettings = {
            ...currentSettings,
            [setting]: value
        };

        setTextSettings(prev => {
            const updated = [...prev];
            updated[idx] = nextSettings;
            return updated;
        });

        updateTextBoxToContent(idx, texts[idx] || '', nextSettings);

        if (setting === 'fontFamily' && typeof value === 'string' && FONT_CONFIGS[value]) {
            loadFont(FONT_CONFIGS[value])
                .then(() => {
                    if (isLeavingRef.current) return;
                    const currentIndex =
                        textLayerIdsRef.current.indexOf(textLayerId);
                    const currentSettings =
                        textSettingsRef.current[currentIndex];
                    if (
                        currentIndex === -1 ||
                        currentSettings?.fontFamily !== value
                    ) return;
                    updateTextBoxToContent(
                        currentIndex,
                        textsRef.current[currentIndex] || '',
                        currentSettings
                    );
                })
                .catch(() => undefined);
        }
    }, [loadFont, textSettings, texts, updateTextBoxToContent]);

    const handleApplyTextStyle = useCallback((
        presetId: TextStylePresetId,
        index: number
    ) => {
        const currentSettings = textSettings[index];
        const textLayerId = textLayerIds[index];
        if (!currentSettings || !textLayerId) return;

        const nextSettings = applyTextStylePreset(
            currentSettings,
            presetId
        );
        setTextSettings((current) => {
            const updated = [...current];
            updated[index] = nextSettings;
            return updated;
        });
        setSelectedTextIndex(index);
        setSelectedImageIndex(-1);
        setSelectedShapeIndex(-1);
        updateTextBoxToContent(index, texts[index] || '', nextSettings);

        if (FONT_CONFIGS[nextSettings.fontFamily]) {
            loadFont(FONT_CONFIGS[nextSettings.fontFamily])
                .then(() => {
                    if (isLeavingRef.current) return;
                    const currentIndex =
                        textLayerIdsRef.current.indexOf(textLayerId);
                    const currentSettings =
                        textSettingsRef.current[currentIndex];
                    if (
                        currentIndex === -1 ||
                        currentSettings?.fontFamily !==
                            nextSettings.fontFamily
                    ) return;
                    updateTextBoxToContent(
                        currentIndex,
                        textsRef.current[currentIndex] || '',
                        currentSettings
                    );
                })
                .catch(() => undefined);
        }
    }, [
        loadFont,
        setSelectedShapeIndex,
        textSettings,
        texts,
        updateTextBoxToContent,
    ]);

    const handleShadowChange = useCallback((idx: number, shadowProperty: keyof TextSettings['shadow'], value: string | number) => {
        const currentSettings = textSettings[idx];
        if (!currentSettings) return;

        const nextSettings = {
            ...currentSettings,
            shadow: {
                ...currentSettings.shadow,
                [shadowProperty]: value
            }
        };

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

        updateTextBoxToContent(idx, texts[idx] || '', nextSettings);
    }, [textSettings, texts, updateTextBoxToContent]);

    const handleOutlineChange = useCallback((idx: number, outlineProperty: keyof TextSettings['outline'], value: string | number) => {
        const currentSettings = textSettings[idx];
        if (!currentSettings) return;

        const nextSettings = {
            ...currentSettings,
            outline: {
                ...currentSettings.outline,
                [outlineProperty]: value
            }
        };

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

        updateTextBoxToContent(idx, texts[idx] || '', nextSettings);
    }, [textSettings, texts, updateTextBoxToContent]);

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

    const resizeTextFromCorner = useCallback((
        pointerX: number,
        pointerY: number,
        canvas: HTMLCanvasElement
    ) => {
        const index = resizeTextIndex;
        const handle = resizeTextCornerHandle;
        const settings = textSettings[index];
        const box = textBoxes[index];
        const ctx = canvas.getContext('2d');

        if (index === -1 || !handle || !settings || !box || !ctx) return;

        const startWidth = Math.max(1, resizeTextStartSize.width);
        const startHeight = Math.max(1, resizeTextStartSize.height);
        const startX = resizeTextStartBoxPos.x;
        const startY = resizeTextStartBoxPos.y;

        const anchorX = handle.includes('e') ? startX : startX + startWidth;
        const anchorY = handle.includes('s') ? startY : startY + startHeight;
        const startCornerX = handle.includes('e') ? startX + startWidth : startX;
        const startCornerY = handle.includes('s') ? startY + startHeight : startY;

        const startDistance = Math.max(1, Math.hypot(startCornerX - anchorX, startCornerY - anchorY));
        const currentDistance = Math.max(1, Math.hypot(pointerX - anchorX, pointerY - anchorY));
        const scale = clampValue(currentDistance / startDistance, 0.1, 8);
        const minFont = Math.max(CUSTOM_TEXT_MIN_FONT_SIZE, box.minFont ?? CUSTOM_TEXT_MIN_FONT_SIZE);
        const startFontSize = resizeTextStartFontSize || settings.fontSize;
        const nextFontSize = Math.round(clampValue(startFontSize * scale, minFont, MAX_TEXT_FONT_SIZE));
        const nextSettings = {
            ...settings,
            fontSize: nextFontSize
        };
        const measured = getMeasuredTextBoxSize(
            ctx,
            texts[index] || '',
            nextSettings,
            Math.max(MIN_TEXT_BOX_SIZE, canvas.width * 0.95)
        );

        const nextX = handle.includes('w') ? anchorX - measured.width : anchorX;
        const nextY = handle.includes('n') ? anchorY - measured.height : anchorY;
        const nextBox = constrainTextBoxToCanvas({
            ...box,
            x: nextX,
            y: nextY,
            width: measured.width,
            height: measured.height,
            fontSize: nextFontSize,
            minFont: box.minFont ?? CUSTOM_TEXT_MIN_FONT_SIZE,
            align: box.align || 'center'
        }, canvas);

        setTextSettings(prev => {
            const updated = [...prev];
            if (updated[index]) {
                updated[index] = {
                    ...updated[index],
                    fontSize: nextFontSize
                };
            }
            return updated;
        });

        setTextBoxes((prev: Template['textBoxes']) => {
            const updated = [...prev];
            if (updated[index]) {
                updated[index] = {
                    ...updated[index],
                    ...nextBox
                };
            }
            return updated;
        });
    }, [
        CUSTOM_TEXT_MIN_FONT_SIZE,
        MAX_TEXT_FONT_SIZE,
        MIN_TEXT_BOX_SIZE,
        clampValue,
        constrainTextBoxToCanvas,
        getMeasuredTextBoxSize,
        resizeTextCornerHandle,
        resizeTextIndex,
        resizeTextStartBoxPos,
        resizeTextStartFontSize,
        resizeTextStartSize,
        textBoxes,
        textSettings,
        texts
    ]);

    const getTextAtPosition = useCallback((x: number, y: number): number => {
        for (let i = textBoxes.length - 1; i >= 0; i--) {
            const box = textBoxes[i];
            if (
                textSettings[i]?.visible !== false &&
                texts[i] &&
                x >= box.x &&
                x <= box.x + box.width &&
                y >= box.y - box.fontSize &&
                y <= box.y + box.height
            ) {
                return i;
            }
        }
        return -1;
    }, [textBoxes, textSettings, texts]);

    const getTextResizeHandleAtPosition = useCallback((x: number, y: number): { index: number; handle: string } => {
        if (
            selectedTextIndex === -1 ||
            !texts[selectedTextIndex] ||
            textSettings[selectedTextIndex]?.visible === false
        ) {
            return { index: -1, handle: '' };
        }

        const box = textBoxes[selectedTextIndex];
        const rotation = textBoxRotations[selectedTextIndex] || 0;
        const isMobile = isMobileDevice();
        const canvas = canvasRef.current;
        if (!canvas) return { index: -1, handle: '' };
        const baseHandleSize = Math.max(30, Math.min(canvas.width, canvas.height) * 0.04);
        const handleSize = isMobile ? Math.max(baseHandleSize, 45) : Math.max(baseHandleSize, 35);

        const boxCenterX = box.x + box.width / 2;
        const boxCenterY = box.y + box.height / 2;

        // Check rotation handle first (above the box)
        const rotationHandleSize = isMobile ? 60 : 50;
        const rotationHandleX = boxCenterX;
        const rotationHandleY = box.y - 35;
        const distToRotationHandle = Math.sqrt(
            Math.pow(x - rotationHandleX, 2) + Math.pow(y - rotationHandleY, 2)
        );
        if (distToRotationHandle <= rotationHandleSize / 2) {
            return { index: selectedTextIndex, handle: 'rotate' };
        }

        // Transform coordinates to box-local space if rotated
        let localX = x - boxCenterX;
        let localY = y - boxCenterY;
        if (rotation !== 0) {
            const rad = (-rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const tempX = localX * cos - localY * sin;
            localY = localX * sin + localY * cos;
            localX = tempX;
        }
        localX += boxCenterX;
        localY += boxCenterY;

        // Corner handles (nw, ne, sw, se)
        const cornerHandles = [
            { name: 'nw', x: box.x - handleSize / 2, y: box.y - handleSize / 2 },
            { name: 'ne', x: box.x + box.width - handleSize / 2, y: box.y - handleSize / 2 },
            { name: 'sw', x: box.x - handleSize / 2, y: box.y + box.height - handleSize / 2 },
            { name: 'se', x: box.x + box.width - handleSize / 2, y: box.y + box.height - handleSize / 2 }
        ];

        for (const handle of cornerHandles) {
            if (localX >= handle.x && localX <= handle.x + handleSize && localY >= handle.y && localY <= handle.y + handleSize) {
                return { index: selectedTextIndex, handle: handle.name };
            }
        }

        const textBoxCenterY = box.y + box.height / 2;

        // left
        const leftHandleX = box.x - handleSize / 2;
        const leftHandleY = textBoxCenterY - handleSize / 2;
        if (localX >= leftHandleX && localX <= leftHandleX + handleSize && localY >= leftHandleY && localY <= leftHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'width-left' };
        }

        // right
        const rightHandleX = box.x + box.width - handleSize / 2;
        const rightHandleY = textBoxCenterY - handleSize / 2;
        if (localX >= rightHandleX && localX <= rightHandleX + handleSize && localY >= rightHandleY && localY <= rightHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'width-right' };
        }

        // top / bottom
        const textBoxCenterX = box.x + box.width / 2;
        const topHandleX = textBoxCenterX - handleSize / 2;
        const topHandleY = box.y - handleSize / 2;
        if (localX >= topHandleX && localX <= topHandleX + handleSize && localY >= topHandleY && localY <= topHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'height-top' };
        }

        const bottomHandleX = textBoxCenterX - handleSize / 2;
        const bottomHandleY = box.y + box.height - handleSize / 2;
        if (localX >= bottomHandleX && localX <= bottomHandleX + handleSize && localY >= bottomHandleY && localY <= bottomHandleY + handleSize) {
            return { index: selectedTextIndex, handle: 'height-bottom' };
        }

        return { index: -1, handle: '' };
    }, [selectedTextIndex, textBoxes, textSettings, texts, textBoxRotations, isMobileDevice, canvasRef]);

    const generateImageId = (): string => {
        return `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const getImageAtPosition = useCallback((x: number, y: number): { index: number; handle: string } => {
        for (let i = imageOverlays.length - 1; i >= 0; i--) {
            const img = imageOverlays[i];
            if (img.visible === false) continue;

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

    const addImageOverlay = useCallback(async (
        input: File | string,
        options?: {
            animated?: boolean;
            animatedSrc?: string;
            decodeLimits?: GifDecodeLimits;
            decodeTimeoutMs?: number;
            decodePolicy?: GifDecodePolicy;
            deferAnimationDecode?: boolean;
            isDataUrl?: boolean;
            label?: string;
            mimeType?: string;
            preserveWorkspaceTab?: boolean;
            continueWhileLeaving?: boolean;
            source?: ImageOverlay['source'];
            stillUrl?: string;
        }
    ): Promise<boolean> => {
        if (
            (isLeavingRef.current && !options?.continueWhileLeaving) ||
            !canEditDraft
        ) {
            return false;
        }
        const finishPendingImageAdd = beginPendingImageAdd();
        const addStartedAt = getMediaPerfNow();

        try {
            const fileInput = input instanceof File ? input : undefined;
            const imageSrc = await resolveImageSrc(input, options?.isDataUrl);
            const mimeType = options?.mimeType || fileInput?.type || (isGifSource(imageSrc) ? 'image/gif' : undefined);
            const isGif = isGifSource(imageSrc, mimeType);
            const requestedAnimated =
                options?.animated ??
                (isGif || /giphy\.com/i.test(imageSrc));

            if (fileInput && isUnsupportedAnimatedUploadCandidate(fileInput) && !isGif) {
                toast.info('Animated WebP/APNG uploads are treated as static in v1. Only animated GIF uploads animate.');
            }

            if (fileInput && isGif && fileInput.size > GIF_MAX_BYTES) {
                throw new GifDecodeLimitError('Animated GIF is too large for browser export. Max size is 10MB.');
            }

            const canvas = canvasRef.current;
            if (!canvas) return false;

            const overlayId = generateImageId();
            let decodedGif: DecodedGif | null = null;
            let staticSrc = imageSrc;
            let naturalWidth = 0;
            let naturalHeight = 0;
            const animatedSrc = options?.animatedSrc || imageSrc;
            const deferredStaticSrc = options?.stillUrl || imageSrc;
            const shouldDeferAnimationDecode = Boolean(
                options?.deferAnimationDecode &&
                requestedAnimated &&
                isGif &&
                animatedSrc &&
                animatedSrc !== deferredStaticSrc
            );

            if (shouldDeferAnimationDecode) {
                staticSrc = deferredStaticSrc;
            }

            if (requestedAnimated && isGif && !shouldDeferAnimationDecode) {
                try {
                    decodedGif = await decodeGifForOverlay(overlayId, imageSrc, fileInput, {
                        limits: options?.decodeLimits,
                    });
                    if (decodedGif.frameCount <= 1) {
                        decodedGifCache.current.delete(overlayId);
                        decodedGif = null;
                    }
                } catch (error) {
                    decodedGifCache.current.delete(overlayId);
                    const message =
                        error instanceof GifDecodeLimitError
                            ? error.message
                            : 'Animated GIF decoding failed. Adding as a static image instead.';
                    if (error instanceof GifDecodeLimitError) {
                        throw error;
                    }
                    toast.error(message);
                    if (options?.stillUrl) {
                        staticSrc = options.stillUrl;
                    }
                }
            }

            if (decodedGif) {
                naturalWidth = decodedGif.width;
                naturalHeight = decodedGif.height;
            } else {
                const img = await loadAndCacheImage(staticSrc);
                naturalWidth = img.width;
                naturalHeight = img.height;
            }

            const maxSize = 300;
            let width = naturalWidth;
            let height = naturalHeight;

            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = width * ratio;
                height = height * ratio;
            }

            const newOverlay: ImageOverlay = {
                id: overlayId,
                src: staticSrc,
                label: options?.label || 'Image',
                animated: Boolean(decodedGif) || shouldDeferAnimationDecode,
                animatedSrc: shouldDeferAnimationDecode ? animatedSrc : undefined,
                animationDecodePolicy: options?.decodePolicy,
                animationDecodePending: shouldDeferAnimationDecode,
                mimeType,
                source: options?.source,
                animationStartMs: decodedGif ? getAnimationNow() : undefined,
                x: (canvas.width - width) / 2,
                y: (canvas.height - height) / 2,
                width,
                height,
                originalWidth: naturalWidth,
                originalHeight: naturalHeight,
                opacity: 1,
                rotation: 0,
                eraseStrokes: []
            };
            const nextImageOverlays = [
                ...imageOverlaysRef.current,
                newOverlay,
            ];
            if (
                nextImageOverlays.length >
                EDITOR_IMAGE_LAYER_LIMIT
            ) {
                throw new Error(
                    `A meme can contain up to ${EDITOR_IMAGE_LAYER_LIMIT} image layers. Remove one before adding another.`
                );
            }
            assertMemeEditorDraftLocalMediaCapacity({
                ...draftStateRef.current,
                canvasTemplate: canvasTemplateRef.current,
                imageOverlays: nextImageOverlays,
            });

            if (options?.preserveWorkspaceTab) {
                workspaceTabPreservingImageId.current = overlayId;
            }
            if (shouldDeferAnimationDecode) {
                setGifDecodePending(overlayId, true);
            }

            setShowLayerPanel(true);
            setShowMediaLayers(true);
            setSelectedTextIndex(-1);
            setSelectedShapeIndex(-1);
            imageOverlaysRef.current = nextImageOverlays;
            setSelectedImageIndex(nextImageOverlays.length - 1);
            setImageOverlays(nextImageOverlays);

            const visibleMs = Math.round(getMediaPerfNow() - addStartedAt);
            logMediaDebug('overlay-added', {
                animated: Boolean(decodedGif),
                deferredAnimation: shouldDeferAnimationDecode,
                label: options?.label,
                overlayId,
                totalMs: visibleMs,
            });

            if (shouldDeferAnimationDecode) {
                startBackgroundGifDecode({
                    label: options?.label,
                    limits: options?.decodeLimits,
                    overlayId,
                    src: animatedSrc,
                    startedAt: addStartedAt,
                    timeoutMs: options?.decodeTimeoutMs,
                });
            }

            return true;
        } catch (error) {
            console.error('Error adding image overlay:', error);
            const message = error instanceof Error ? error.message : 'Failed to add image';
            toast.error(message);
            return false;
        } finally {
            finishPendingImageAdd();
        }
    }, [beginPendingImageAdd, canEditDraft, decodeGifForOverlay, getAnimationNow, isUnsupportedAnimatedUploadCandidate, loadAndCacheImage, setGifDecodePending, setSelectedShapeIndex, startBackgroundGifDecode]);

    const addMediaFromLibrary = useCallback(
        async (item: GiphyMediaItem) => {
            const stillSrc = item.stillUrl || item.previewUrl || item.url;
            const initialSrc = item.animated ? stillSrc : item.url;

            await addImageOverlay(initialSrc, {
                label: item.title,
                animated: item.animated,
                animatedSrc: item.animated ? item.url : undefined,
                decodePolicy: item.animated ? 'giphy' : undefined,
                decodeLimits: item.animated ? GIPHY_GIF_DECODE_LIMITS : undefined,
                decodeTimeoutMs: item.animated ? GIPHY_GIF_FETCH_TIMEOUT_MS : undefined,
                deferAnimationDecode: item.animated,
                mimeType: item.mimeHint,
                stillUrl: stillSrc,
            });
        },
        [addImageOverlay]
    );

    const addCreatorAssetToCanvas = useCallback(
        async (asset: CreatorAsset) => {
            const file = new File([asset.blob], asset.name, {
                type: asset.mimeType,
            });
            const added = await addImageOverlay(file, {
                label: asset.name,
                mimeType: asset.mimeType,
            });
            if (!added) {
                throw new Error('Could not add this saved asset to the canvas.');
            }
        },
        [addImageOverlay]
    );

    const addDiscoveredImageToCanvas = useCallback(
        async (asset: ReusableImageAsset) => {
            if (isLeavingRef.current || !canEditDraft) {
                throw new Error('The editor is leaving. This image was not added.');
            }
            const finishPendingImageAdd = beginPendingImageAdd();
            pendingDiscoveryImageAdds.current += 1;
            try {
                const localFile = await materializeReusableImage(asset);
                const added = await addImageOverlay(localFile, {
                    label: asset.title,
                    mimeType: asset.mimeType,
                    preserveWorkspaceTab: true,
                    continueWhileLeaving: true,
                    source: {
                        provider: asset.provider,
                        url: asset.sourceUrl,
                        creator: asset.creator,
                        creditLine: asset.creditLine,
                        licenseName: asset.licenseName,
                        licenseUrl: asset.licenseUrl,
                        rights: asset.rights,
                        attributionRequired: asset.attributionRequired,
                        usageTerms: asset.usageTerms,
                        restrictions: asset.restrictions,
                    },
                });
                if (!added) {
                    throw new Error(
                        'Could not add this licensed image to the canvas.'
                    );
                }
            } finally {
                pendingDiscoveryImageAdds.current = Math.max(
                    0,
                    pendingDiscoveryImageAdds.current - 1
                );
                finishPendingImageAdd();
            }
        },
        [addImageOverlay, beginPendingImageAdd, canEditDraft]
    );

    const startFromDiscoveredImage = useCallback(
        async (asset: ReusableImageAsset) => {
            if (isLeavingRef.current || !canEditDraft) {
                throw new Error(
                    'The editor is leaving. This image was not used.'
                );
            }
            if (pendingImageAddCount.current > 0) {
                throw new Error(
                    'Wait for the current image to finish, then try again.'
                );
            }

            const hasMeaningfulScene =
                textsRef.current.some((text) => text.trim().length > 0) ||
                imageOverlaysRef.current.length > 0 ||
                shapeOverlays.length > 0 ||
                strokes.length > 0;
            if (
                hasMeaningfulScene &&
                !window.confirm(
                    'Start with this image? Your current canvas layers will be cleared.'
                )
            ) {
                return false;
            }
            const sceneBeforeImageLoad = draftStateRef.current;
            let candidateLocalImage: string | null = null;
            let candidateCommitted = false;

            const finishPendingImageAdd = beginPendingImageAdd();
            try {
                const localFile = await materializeReusableImage(asset);
                const localImage = await resolveImageSrc(localFile);
                candidateLocalImage = localImage;
                const decodedImage = await loadAndCacheImage(localImage);
                const imageWidth =
                    decodedImage.naturalWidth ||
                    decodedImage.width ||
                    asset.width;
                const imageHeight =
                    decodedImage.naturalHeight ||
                    decodedImage.height ||
                    asset.height;
                if (!imageWidth || !imageHeight) {
                    throw new Error(
                        'This image has no usable dimensions. Try another image.'
                    );
                }
                if (draftStateRef.current !== sceneBeforeImageLoad) {
                    throw new Error(
                        'Your meme changed while the image was loading, so nothing was replaced. Try again when you are ready.'
                    );
                }

                const horizontalMargin = Math.max(
                    12,
                    Math.round(imageWidth * 0.04)
                );
                const verticalMargin = Math.max(
                    10,
                    Math.round(imageHeight * 0.035)
                );
                const fontSize = Math.max(
                    24,
                    Math.min(
                        72,
                        Math.round(Math.min(imageWidth, imageHeight) * 0.09)
                    )
                );
                const boxHeight = Math.min(
                    Math.round(imageHeight * 0.3),
                    Math.max(
                        Math.round(fontSize * 1.75),
                        Math.round(imageHeight * 0.16)
                    )
                );
                const boxWidth = Math.max(
                    80,
                    imageWidth - horizontalMargin * 2
                );
                const nextTextBoxes: Template['textBoxes'] = [
                    {
                        x: horizontalMargin,
                        y: verticalMargin,
                        width: boxWidth,
                        height: boxHeight,
                        fontSize,
                        minFont: 10,
                        align: 'center',
                    },
                    {
                        x: horizontalMargin,
                        y: Math.max(
                            verticalMargin,
                            imageHeight - boxHeight - verticalMargin
                        ),
                        width: boxWidth,
                        height: boxHeight,
                        fontSize,
                        minFont: 10,
                        align: 'center',
                    },
                ];
                const nextTexts = ['', ''];
                const nextTextLayerIds = nextTextBoxes.map(() =>
                    createTextLayerId()
                );
                const nextTextSettings: TextSettings[] =
                    nextTextBoxes.map((box) => ({
                        fontSize: box.fontSize,
                        color: '#ffffff',
                        fontFamily: getDefaultFont(),
                        fontWeight: '900',
                        letterSpacing: 0,
                        textCase: 'uppercase',
                        outline: {
                            width: 1,
                            color: '#000000',
                        },
                        shadow: {
                            blur: 5,
                            offsetX: 1,
                            offsetY: 1,
                            color: '#000000',
                        },
                    }));
                const nextCanvasTemplate: CanvasTemplate = {
                    image: localImage,
                    displayName: asset.title,
                    textBoxes: nextTextBoxes,
                    mimeType: asset.mimeType,
                    source: {
                        provider: asset.provider,
                        url: asset.sourceUrl,
                        creator: asset.creator,
                        creditLine: asset.creditLine,
                        licenseName: asset.licenseName,
                        licenseUrl: asset.licenseUrl,
                        rights: asset.rights,
                        attributionRequired: asset.attributionRequired,
                        usageTerms: asset.usageTerms,
                        restrictions: asset.restrictions,
                    },
                };
                const nextDraftState: MemeEditorDraftState = {
                    ...draftStateRef.current,
                    canvasTemplate: nextCanvasTemplate,
                    texts: nextTexts,
                    textBoxes: nextTextBoxes,
                    textBoxRotations: [0, 0],
                    textSettings: nextTextSettings,
                    imageOverlays: [],
                    shapeOverlays: [],
                    strokes: [],
                };
                assertMemeEditorDraftLocalMediaCapacity(nextDraftState);
                const replacedCachedSources = [
                    canvasTemplateRef.current?.image ?? template.image,
                    ...imageOverlaysRef.current.map(
                        (overlay) => overlay.src
                    ),
                ];

                previewRenderRevision.current += 1;
                canvasTemplateRef.current = nextCanvasTemplate;
                textsRef.current = nextTexts;
                textLayerIdsRef.current = nextTextLayerIds;
                textSettingsRef.current = nextTextSettings;
                imageOverlaysRef.current = [];
                draftStateRef.current = nextDraftState;

                setCanvasTemplate(nextCanvasTemplate);
                setTexts(nextTexts);
                setTextLayerIds(nextTextLayerIds);
                setTextBoxes(nextTextBoxes);
                setTextBoxRotations([0, 0]);
                setOriginalTextBoxCount(nextTextBoxes.length);
                setTextSettings(nextTextSettings);
                setImageOverlays([]);
                replaceShapes([]);
                setStrokes([]);
                setCurrentStroke(null);
                decodedGifCache.current.clear();
                pendingGifDecodeIds.current.clear();
                setPendingGifDecodeCount(0);
                setSelectedTextIndex(-1);
                setSelectedImageIndex(-1);
                setSelectedShapeIndex(-1);
                setIsDrawing(false);
                setIsDrawingMode(false);
                setIsImageEraseMode(false);
                setImageEraseTargetIndex(-1);
                setShowElementsPanel(false);
                setCreatorWorkspaceTab('styles');
                setCreatorWorkspaceCollapsed(true);
                candidateCommitted = true;
                replacedCachedSources.forEach((source) => {
                    if (source !== nextCanvasTemplate.image) {
                        imageCache.current.delete(source);
                    }
                });
                toast.success('Image ready. Add your caption.');
                window.requestAnimationFrame(() => {
                    primaryCaptionRef.current?.focus();
                });
                return true;
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Could not start from this image.';
                toast.error(message);
                throw error;
            } finally {
                if (candidateLocalImage && !candidateCommitted) {
                    const candidateIsActive =
                        candidateLocalImage === template.image ||
                        candidateLocalImage ===
                            canvasTemplateRef.current?.image ||
                        imageOverlaysRef.current.some(
                            (overlay) =>
                                overlay.src === candidateLocalImage
                        );
                    if (!candidateIsActive) {
                        imageCache.current.delete(candidateLocalImage);
                    }
                }
                finishPendingImageAdd();
            }
        },
        [
            beginPendingImageAdd,
            canEditDraft,
            getDefaultFont,
            loadAndCacheImage,
            replaceShapes,
            setSelectedShapeIndex,
            shapeOverlays.length,
            strokes.length,
            template.image,
        ]
    );

    const handleDialogFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                if (isGifSource(file.name, file.type) && file.size > GIF_MAX_BYTES) {
                    toast.error('Animated GIF is too large for browser export. Max size is 10MB.');
                    event.target.value = '';
                    return;
                }
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
            let added = false;
            if (uploadMethod === 'file' && selectedFile) {
                added = await addImageOverlay(selectedFile);
            } else if (uploadMethod === 'paste' && pastedImageData) {
                added = await addImageOverlay(pastedImageData, { isDataUrl: true });
            } else {
                toast.error('Please select a file or paste an image');
                return;
            }

            if (!added) {
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
        if (!editorCanEdit || isUploadDialogOpen) return;

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
    }, [editorCanEdit, isUploadDialogOpen, addImageOverlay]);

    const removeImageOverlay = (index: number) => {
        const overlay = imageOverlays[index];
        if (overlay) {
            imageCache.current.delete(overlay.src);
            decodedGifCache.current.delete(overlay.id);
            setGifDecodePending(overlay.id, false);
        }
        setImageOverlays(prev => prev.filter((_, i) => i !== index));
        if (imageEraseTargetIndex === index) {
            setIsImageEraseMode(false);
            setImageEraseTargetIndex(-1);
        } else if (imageEraseTargetIndex > index) {
            setImageEraseTargetIndex(imageEraseTargetIndex - 1);
        }
    };

    const addEraseStrokeToImage = useCallback((imageIndex: number, stroke: EraseStroke) => {
        setImageOverlays(prev => {
            const updated = [...prev];
            updated[imageIndex] = {
                ...updated[imageIndex],
                eraseStrokes: [...updated[imageIndex].eraseStrokes, stroke]
            };
            return updated;
        });
    }, []);

    const undoImageErase = useCallback((imageIndex: number) => {
        setImageOverlays(prev => {
            const updated = [...prev];
            if (updated[imageIndex] && updated[imageIndex].eraseStrokes.length > 0) {
                updated[imageIndex] = {
                    ...updated[imageIndex],
                    eraseStrokes: updated[imageIndex].eraseStrokes.slice(0, -1)
                };
            }
            return updated;
        });
    }, []);

    const clearImageErase = useCallback((imageIndex: number) => {
        setImageOverlays(prev => {
            const updated = [...prev];
            updated[imageIndex] = {
                ...updated[imageIndex],
                eraseStrokes: []
            };
            return updated;
        });
    }, []);

    const handleImageOpacityChange = useCallback((index: number, opacity: number) => {
        setImageOverlays(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                opacity: Math.max(0, Math.min(1, opacity))
            };
            return updated;
        });
    }, []);

    const fitSelectedImageToCanvas = useCallback((mode: 'fit' | 'fill') => {
        const canvas = canvasRef.current;
        if (!canvas || selectedImageIndex < 0) return;

        setImageOverlays((current) => {
            const selected = current[selectedImageIndex];
            if (!selected) return current;
            const updated = [...current];
            updated[selectedImageIndex] = fitImageLayerToCanvas(
                selected,
                canvas.width,
                canvas.height,
                mode
            );
            return updated;
        });
    }, [selectedImageIndex]);

    const rotateSelectedImage90 = useCallback(() => {
        if (selectedImageIndex < 0) return;
        setImageOverlays((current) => {
            const selected = current[selectedImageIndex];
            if (!selected) return current;
            const updated = [...current];
            updated[selectedImageIndex] = {
                ...selected,
                rotation: (selected.rotation + 90) % 360,
            };
            return updated;
        });
    }, [selectedImageIndex]);

    const toggleSelectedImageErase = useCallback(() => {
        if (selectedImageIndex < 0) return;
        const selectedImage = imageOverlays[selectedImageIndex];
        if (!selectedImage || selectedImage.visible === false) {
            toast.info('Show this image layer before erasing it.');
            return;
        }

        setIsImageEraseMode((current) => {
            const next = !(current && imageEraseTargetIndex === selectedImageIndex);
            setImageEraseTargetIndex(next ? selectedImageIndex : -1);
            if (next) {
                setIsDrawingMode(false);
                setSelectedShapeIndex(-1);
                setSelectedTextIndex(-1);
            }
            return next;
        });
    }, [
        imageEraseTargetIndex,
        imageOverlays,
        selectedImageIndex,
        setSelectedShapeIndex,
    ]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Don't handle normal interactions when in erase or drawing mode
        if (isImageEraseMode || isDrawingMode) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Text renders above shapes and images, so it must win overlapping hits.
        const topTextHandle = getTextResizeHandleAtPosition(x, y);
        if (topTextHandle.index !== -1) {
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            setSelectedTextIndex(topTextHandle.index);
            if (topTextHandle.handle === 'rotate') {
                setIsRotatingText(true);
                setRotateTextIndex(topTextHandle.index);
                const box = textBoxes[topTextHandle.index];
                const boxCenterX = box.x + box.width / 2;
                const boxCenterY = box.y + box.height / 2;
                const angle =
                    (Math.atan2(y - boxCenterY, x - boxCenterX) * 180) /
                    Math.PI;
                setRotateTextStartAngle(
                    angle - (textBoxRotations[topTextHandle.index] || 0)
                );
                canvas.style.cursor = 'grab';
            } else if (topTextHandle.handle.startsWith('width-')) {
                setIsResizingTextWidth(true);
                setIsResizingFromLeft(
                    topTextHandle.handle === 'width-left'
                );
                canvas.style.cursor = 'ew-resize';
            } else if (topTextHandle.handle.startsWith('height-')) {
                setIsResizingTextHeight(true);
                setIsResizingFromTop(
                    topTextHandle.handle === 'height-top'
                );
                canvas.style.cursor = 'ns-resize';
            } else if (
                ['nw', 'ne', 'sw', 'se'].includes(topTextHandle.handle)
            ) {
                setIsResizingTextCorner(true);
                setResizeTextCornerHandle(topTextHandle.handle);
                setResizeTextStartSize({
                    width: textBoxes[topTextHandle.index].width,
                    height: textBoxes[topTextHandle.index].height,
                });
                setResizeTextStartBoxPos({
                    x: textBoxes[topTextHandle.index].x,
                    y: textBoxes[topTextHandle.index].y,
                });
                setResizeTextStartFontSize(
                    textSettings[topTextHandle.index]?.fontSize ||
                        textBoxes[topTextHandle.index].fontSize
                );
                canvas.style.cursor = `${topTextHandle.handle}-resize`;
            }
            setResizeTextIndex(topTextHandle.index);
            return;
        }

        const topTextIndex = getTextAtPosition(x, y);
        if (topTextIndex !== -1) {
            setSelectedTextIndex(topTextIndex);
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            setIsDragging(true);
            setDragIndex(topTextIndex);
            setDragOffset({
                x: x - textBoxes[topTextIndex].x,
                y: y - textBoxes[topTextIndex].y,
            });
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (tryShapeMouseDown(x, y, canvas)) {
            setSelectedImageIndex(-1);
            setSelectedTextIndex(-1);
            return;
        }
        setSelectedShapeIndex(-1);

        const imageResult = getImageAtPosition(x, y);
        if (imageResult.index !== -1) {
            setSelectedImageIndex(imageResult.index);
            setSelectedTextIndex(-1);

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
            if (resizeHandleResult.handle === 'rotate') {
                setIsRotatingText(true);
                setRotateTextIndex(resizeHandleResult.index);
                const box = textBoxes[resizeHandleResult.index];
                const boxCenterX = box.x + box.width / 2;
                const boxCenterY = box.y + box.height / 2;
                const angle = Math.atan2(y - boxCenterY, x - boxCenterX) * 180 / Math.PI;
                setRotateTextStartAngle(angle - (textBoxRotations[resizeHandleResult.index] || 0));
                canvas.style.cursor = 'grab';
            } else if (resizeHandleResult.handle.startsWith('width-')) {
                setIsResizingTextWidth(true);
                setIsResizingFromLeft(resizeHandleResult.handle === 'width-left');
                canvas.style.cursor = 'ew-resize';
            } else if (resizeHandleResult.handle.startsWith('height-')) {
                setIsResizingTextHeight(true);
                setIsResizingFromTop(resizeHandleResult.handle === 'height-top');
                canvas.style.cursor = 'ns-resize';
            } else if (['nw', 'ne', 'sw', 'se'].includes(resizeHandleResult.handle)) {
                setIsResizingTextCorner(true);
                setResizeTextCornerHandle(resizeHandleResult.handle);
                setResizeTextStartSize({
                    width: textBoxes[resizeHandleResult.index].width,
                    height: textBoxes[resizeHandleResult.index].height
                });
                setResizeTextStartBoxPos({
                    x: textBoxes[resizeHandleResult.index].x,
                    y: textBoxes[resizeHandleResult.index].y
                });
                setResizeTextStartFontSize(textSettings[resizeHandleResult.index]?.fontSize || textBoxes[resizeHandleResult.index].fontSize);
                canvas.style.cursor = `${resizeHandleResult.handle}-resize`;
            }
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
            canvas.style.cursor = 'grabbing';
        } else {
            setSelectedTextIndex(-1);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Don't handle normal interactions when in erase or drawing mode
        if (isImageEraseMode || isDrawingMode) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (isShapeInteracting) {
            handleShapeMouseMove(x, y, canvas);
            return;
        }

        // Mouse move handler logic
        if (isDraggingImage && dragImageIndex !== -1) {
            const newX = x - dragImageOffset.x;
            const newY = y - dragImageOffset.y;
            const constrained = constrainLayerPosition(
                imageOverlays[dragImageIndex],
                canvas,
                { x: newX, y: newY }
            );

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[dragImageIndex] = {
                    ...updated[dragImageIndex],
                    x: constrained.x,
                    y: constrained.y
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
        } else if (isRotatingText && rotateTextIndex !== -1) {
            const box = textBoxes[rotateTextIndex];
            const boxCenterX = box.x + box.width / 2;
            const boxCenterY = box.y + box.height / 2;
            const angle = Math.atan2(y - boxCenterY, x - boxCenterX) * 180 / Math.PI;
            const newRotation = angle - rotateTextStartAngle;

            setTextBoxRotations(prev => {
                const updated = [...prev];
                updated[rotateTextIndex] = newRotation;
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
        } else if (isResizingTextHeight && resizeTextIndex !== -1) {
            const box = textBoxes[resizeTextIndex];
            let newHeight = box.height;
            let newY = box.y;

            if (isResizingFromTop) {
                const deltaY = y - box.y;
                newHeight = Math.max(50, box.height - deltaY);
                newY = box.y + (box.height - newHeight);
            } else {
                newHeight = Math.max(50, y - box.y);
            }

            newHeight = Math.min(newHeight, canvas.height - newY);

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[resizeTextIndex] = { ...updated[resizeTextIndex], height: newHeight, y: newY };
                return updated;
            });
        } else if (isResizingTextCorner && resizeTextIndex !== -1) {
            resizeTextFromCorner(x, y, canvas);
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
                if (resizeHandleResult.handle === 'rotate') {
                    canvas.style.cursor = 'grab';
                } else if (resizeHandleResult.handle.startsWith('width-')) {
                    canvas.style.cursor = 'ew-resize';
                } else if (resizeHandleResult.handle.startsWith('height-')) {
                    canvas.style.cursor = 'ns-resize';
                } else if (['nw', 'ne', 'sw', 'se'].includes(resizeHandleResult.handle)) {
                    canvas.style.cursor = `${resizeHandleResult.handle}-resize`;
                }
            } else {
                const textIndex = getTextAtPosition(x, y);
                if (textIndex !== -1) {
                    canvas.style.cursor = 'grab';
                } else {
                    const shapeHit = getShapeAtPosition(x, y);
                    if (shapeHit && shapeHit.index !== -1) {
                        canvas.style.cursor =
                            shapeHit.handle === 'move' ||
                            shapeHit.handle === 'rotate'
                                ? 'grab'
                                : `${shapeHit.handle}-resize`;
                    } else {
                        const imageResult = getImageAtPosition(x, y);
                        if (imageResult.index !== -1) {
                            if (
                                imageResult.handle === 'move' ||
                                imageResult.handle === 'rotate'
                            ) {
                                canvas.style.cursor = 'grab';
                            } else {
                                canvas.style.cursor = `${imageResult.handle}-resize`;
                            }
                        } else {
                            canvas.style.cursor = 'default';
                        }
                    }
                }
            }
        }
    };

    const handleMouseUp = () => {
        endShapeInteraction();
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
        // NEW: reset height-resize
        setIsResizingTextHeight(false);
        setIsResizingFromTop(false);
        // Corner resize reset
        setIsResizingTextCorner(false);
        setResizeTextCornerHandle('');
        setResizeTextStartSize({ width: 0, height: 0 });
        setResizeTextStartBoxPos({ x: 0, y: 0 });
        setResizeTextStartFontSize(0);
        // Text rotation reset
        setIsRotatingText(false);
        setRotateTextIndex(-1);
        setRotateTextStartAngle(0);
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || e.touches.length !== 1) return;

        // Don't handle normal interactions when in erase or drawing mode
        if (isImageEraseMode || isDrawingMode) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        // Match visual stacking on touch: text is above shapes and images.
        const topTextHandle = getTextResizeHandleAtPosition(x, y);
        if (topTextHandle.index !== -1) {
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            setSelectedTextIndex(topTextHandle.index);
            if (topTextHandle.handle === 'rotate') {
                setIsRotatingText(true);
                setRotateTextIndex(topTextHandle.index);
                const box = textBoxes[topTextHandle.index];
                const boxCenterX = box.x + box.width / 2;
                const boxCenterY = box.y + box.height / 2;
                const angle =
                    (Math.atan2(y - boxCenterY, x - boxCenterX) * 180) /
                    Math.PI;
                setRotateTextStartAngle(
                    angle - (textBoxRotations[topTextHandle.index] || 0)
                );
            } else if (topTextHandle.handle.startsWith('width-')) {
                setIsResizingTextWidth(true);
                setIsResizingFromLeft(
                    topTextHandle.handle === 'width-left'
                );
            } else if (topTextHandle.handle.startsWith('height-')) {
                setIsResizingTextHeight(true);
                setIsResizingFromTop(
                    topTextHandle.handle === 'height-top'
                );
            } else if (
                ['nw', 'ne', 'sw', 'se'].includes(topTextHandle.handle)
            ) {
                setIsResizingTextCorner(true);
                setResizeTextCornerHandle(topTextHandle.handle);
                setResizeTextStartSize({
                    width: textBoxes[topTextHandle.index].width,
                    height: textBoxes[topTextHandle.index].height,
                });
                setResizeTextStartBoxPos({
                    x: textBoxes[topTextHandle.index].x,
                    y: textBoxes[topTextHandle.index].y,
                });
                setResizeTextStartFontSize(
                    textSettings[topTextHandle.index]?.fontSize ||
                        textBoxes[topTextHandle.index].fontSize
                );
            }
            setResizeTextIndex(topTextHandle.index);
            return;
        }

        const topTextIndex = getTextAtPosition(x, y);
        if (topTextIndex !== -1) {
            setSelectedTextIndex(topTextIndex);
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            setIsDragging(true);
            setDragIndex(topTextIndex);
            setDragOffset({
                x: x - textBoxes[topTextIndex].x,
                y: y - textBoxes[topTextIndex].y,
            });
            return;
        }

        if (tryShapeMouseDown(x, y, canvas)) {
            setSelectedImageIndex(-1);
            setSelectedTextIndex(-1);
            return;
        }
        setSelectedShapeIndex(-1);

        const imageResult = getImageAtPosition(x, y);
        if (imageResult.index !== -1) {
            setSelectedImageIndex(imageResult.index);
            setSelectedTextIndex(-1);

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
            if (resizeHandleResult.handle === 'rotate') {
                setIsRotatingText(true);
                setRotateTextIndex(resizeHandleResult.index);
                const box = textBoxes[resizeHandleResult.index];
                const boxCenterX = box.x + box.width / 2;
                const boxCenterY = box.y + box.height / 2;
                const angle = Math.atan2(y - boxCenterY, x - boxCenterX) * 180 / Math.PI;
                setRotateTextStartAngle(angle - (textBoxRotations[resizeHandleResult.index] || 0));
            } else if (resizeHandleResult.handle.startsWith('width-')) {
                setIsResizingTextWidth(true);
                setIsResizingFromLeft(resizeHandleResult.handle === 'width-left');
            } else if (resizeHandleResult.handle.startsWith('height-')) {
                setIsResizingTextHeight(true);
                setIsResizingFromTop(resizeHandleResult.handle === 'height-top');
            } else if (['nw', 'ne', 'sw', 'se'].includes(resizeHandleResult.handle)) {
                setIsResizingTextCorner(true);
                setResizeTextCornerHandle(resizeHandleResult.handle);
                setResizeTextStartSize({
                    width: textBoxes[resizeHandleResult.index].width,
                    height: textBoxes[resizeHandleResult.index].height
                });
                setResizeTextStartBoxPos({
                    x: textBoxes[resizeHandleResult.index].x,
                    y: textBoxes[resizeHandleResult.index].y
                });
                setResizeTextStartFontSize(textSettings[resizeHandleResult.index]?.fontSize || textBoxes[resizeHandleResult.index].fontSize);
            }
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

        if (!isDragging && !isDraggingImage && !isRotatingImage && !isResizingImage && !isResizingTextWidth && !isResizingTextHeight && !isResizingTextCorner && !isRotatingText && !isShapeInteracting) return;
        if (isDragging && dragIndex === -1) return;
        if (isDraggingImage && dragImageIndex === -1) return;
        if (isRotatingImage && rotateImageIndex === -1) return;
        if (isResizingImage && resizeImageIndex === -1) return;
        if (isResizingTextWidth && resizeTextIndex === -1) return;
        if (isResizingTextHeight && resizeTextIndex === -1) return;
        if (isResizingTextCorner && resizeTextIndex === -1) return;
        if (isRotatingText && rotateTextIndex === -1) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        if (isShapeInteracting) {
            handleShapeMouseMove(x, y, canvas);
            return;
        }

        if (isDraggingImage && dragImageIndex !== -1) {
            const newX = x - dragImageOffset.x;
            const newY = y - dragImageOffset.y;
            const constrained = constrainLayerPosition(
                imageOverlays[dragImageIndex],
                canvas,
                { x: newX, y: newY }
            );

            setImageOverlays(prev => {
                const updated = [...prev];
                updated[dragImageIndex] = {
                    ...updated[dragImageIndex],
                    x: constrained.x,
                    y: constrained.y
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
        } else if (isRotatingText && rotateTextIndex !== -1) {
            const box = textBoxes[rotateTextIndex];
            const boxCenterX = box.x + box.width / 2;
            const boxCenterY = box.y + box.height / 2;
            const angle = Math.atan2(y - boxCenterY, x - boxCenterX) * 180 / Math.PI;
            const newRotation = angle - rotateTextStartAngle;

            setTextBoxRotations(prev => {
                const updated = [...prev];
                updated[rotateTextIndex] = newRotation;
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
                updated[resizeTextIndex] = { ...updated[resizeTextIndex], width: newWidth, x: newX };
                return updated;
            });
        } else if (isResizingTextHeight && resizeTextIndex !== -1) {
            const box = textBoxes[resizeTextIndex];
            let newHeight = box.height;
            let newY = box.y;

            if (isResizingFromTop) {
                const deltaY = y - box.y;
                newHeight = Math.max(50, box.height - deltaY);
                newY = box.y + (box.height - newHeight);
            } else {
                newHeight = Math.max(50, y - box.y);
            }

            newHeight = Math.min(newHeight, canvas.height - newY);

            setTextBoxes((prev: Template['textBoxes']) => {
                const updated = [...prev];
                updated[resizeTextIndex] = { ...updated[resizeTextIndex], height: newHeight, y: newY };
                return updated;
            });
        } else if (isResizingTextCorner && resizeTextIndex !== -1) {
            resizeTextFromCorner(x, y, canvas);
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
        endShapeInteraction();
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
        // NEW: reset height-resize
        setIsResizingTextHeight(false);
        setIsResizingFromTop(false);
        // Corner resize reset
        setIsResizingTextCorner(false);
        setResizeTextCornerHandle('');
        setResizeTextStartSize({ width: 0, height: 0 });
        setResizeTextStartBoxPos({ x: 0, y: 0 });
        setResizeTextStartFontSize(0);
        // Text rotation reset
        setIsRotatingText(false);
        setRotateTextIndex(-1);
        setRotateTextStartAngle(0);
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
        const minFontSize = box.minFont ?? MIN_FONT_SIZE;

        const transformedText = transformText(text, textCase);

        const getTextWidth = (text: string): number => {
            const safeLetterSpacing = getSafeLetterSpacing(text, letterSpacing);
            if (safeLetterSpacing === 0) {
                return ctx.measureText(text).width;
            }
            return text.split('').reduce((width, char, index) => {
                return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
            }, 0);
        };

        const fontFallbacks = getFontFallbacks(fontFamily);

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

        while (fontSize > minFontSize) {
            ctx.font = `${fontWeight} ${fontSize}px ${fontFallbacks}`;
            lines = processTextWithLineBreaks(transformedText);

            const totalHeight = lines.length * (fontSize * 1.2);
            if (totalHeight <= box.height) {
                break;
            }
            fontSize -= 2;
        }

        if (fontSize < minFontSize) {
            fontSize = minFontSize;
            ctx.font = `${fontWeight} ${fontSize}px ${fontFallbacks}`;
            lines = processTextWithLineBreaks(transformedText);
        }

        return { fontSize, lines };
    }, [getFontFallbacks, transformText, MIN_FONT_SIZE]);

    const waitForFont = useCallback(async (font: string) => {
        const canonicalFont = getCanonicalFontFamily(font);
        const cached = fontLoadCache.current.get(canonicalFont);
        if (cached) {
            await cached;
            return;
        }

        const loadPromise = (async () => {
            if (FONT_CONFIGS[canonicalFont]) {
                await loadFont(FONT_CONFIGS[canonicalFont]);
                return;
            }

            if (document.fonts?.load) {
                await document.fonts.load(`normal 20px "${canonicalFont}"`);
                await document.fonts.ready;
            }
        })();

        fontLoadCache.current.set(canonicalFont, loadPromise);
        try {
            await loadPromise;
        } catch (error) {
            fontLoadCache.current.delete(canonicalFont);
            throw new Error(`Could not load the selected font "${canonicalFont}".`, {
                cause: error,
            });
        }
    }, [loadFont]);

    const drawText = useCallback((rotation: number = 0) => (
        ctx: CanvasRenderingContext2D,
        text: string,
        box: Template['textBoxes'][number],
        settings: TextSettings
    ) => {
        if (!text) return;

        const boxCenterX = box.x + box.width / 2;
        const boxCenterY = box.y + box.height / 2;

        ctx.save();
        if (rotation !== 0) {
            ctx.translate(boxCenterX, boxCenterY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-boxCenterX, -boxCenterY);
        }

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
                const safeLetterSpacing = getSafeLetterSpacing(
                    transformedText,
                    settings.letterSpacing
                );

                if (safeLetterSpacing === 0) {
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
                        return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth / 2;
                } else if (originalTextAlign === 'right') {
                    const totalWidth = transformedText.split('').reduce((width, char, index) => {
                        return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth;
                }

                for (let i = 0; i < transformedText.length; i++) {
                    const char = transformedText[i];
                    if (settings.outline.width > 0) {
                        ctx.strokeText(char, currentX, y);
                    }
                    ctx.fillText(char, currentX, y);
                    currentX += ctx.measureText(char).width + safeLetterSpacing;
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
                const safeLetterSpacing = getSafeLetterSpacing(
                    transformedText,
                    settings.letterSpacing
                );

                if (safeLetterSpacing === 0) {
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
                        return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth / 2;
                } else if (originalTextAlign === 'right') {
                    const totalWidth = transformedText.split('').reduce((width, char, index) => {
                        return width + ctx.measureText(char).width + (index > 0 ? safeLetterSpacing : 0);
                    }, 0);
                    currentX = x - totalWidth;
                }

                for (let i = 0; i < transformedText.length; i++) {
                    const char = transformedText[i];
                    if (settings.outline.width > 0) {
                        ctx.strokeText(char, currentX, y);
                    }
                    ctx.fillText(char, currentX, y);
                    currentX += ctx.measureText(char).width + safeLetterSpacing;
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

        ctx.restore();
    }, [isMobileDevice, calculateFontSize, transformText]);

    const isTextInteracting =
        isDragging || isRotatingText || isResizingTextWidth || isResizingTextHeight || isResizingTextCorner;
    const isImageInteracting = isDraggingImage || isResizingImage || isRotatingImage;
    const isElementInteracting = isTextInteracting || isImageInteracting || isShapeInteracting;

    const drawCreatorBranding = useCallback((
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement
    ) => {
        const watermarkText = branding.text.trim();
        if (!branding.enabled || !watermarkText) return;

        const padding = Math.max(10, Math.min(canvas.width, canvas.height) * 0.015);
        const initialFontSize = Math.max(
            12,
            Math.min(canvas.width, canvas.height) * 0.02
        );

        ctx.save();
        ctx.font = `${initialFontSize}px Arial, sans-serif`;
        const watermarkFontSize = fitWatermarkFontSize({
            initialFontSize,
            maxWidth: canvas.width - padding * 2,
            measureWidth: () => ctx.measureText(watermarkText).width,
            minFontSize: 8,
        });
        ctx.font = `${watermarkFontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = Math.max(1, watermarkFontSize * 0.08);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = Math.max(3, watermarkFontSize * 0.25);

        const {
            x: watermarkX,
            y: watermarkY,
            textAlign,
            textBaseline,
        } = getWatermarkCoordinates(
            branding.position,
            canvas.width,
            canvas.height,
            padding
        );
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.strokeText(watermarkText, watermarkX, watermarkY);
        ctx.fillText(watermarkText, watermarkX, watermarkY);
        ctx.restore();
    }, [branding]);

    const renderScene = useCallback(async (
        canvas: HTMLCanvasElement,
        options: SceneRenderOptions & { shouldCommit?: () => boolean }
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const fontsToLoad = [
            ...new Set(
                textSettings
                    .filter((setting) => setting.visible !== false)
                    .map((setting) => setting.fontFamily)
            ),
        ];
        try {
            await Promise.all(fontsToLoad.map(font => waitForFont(font)));
        } catch (error) {
            if (!options.includeEditorControls) throw error;
            console.warn('Preview is using a fallback font:', error);
        }

        const img = await loadAndCacheImage(effectiveTemplate.image);
        const staticImageOverlays = imageOverlays
            .filter((overlay) => overlay.visible !== false)
            .filter(
                (overlay) =>
                    !overlay.animated ||
                    !decodedGifCache.current.has(overlay.id)
            );
        const imagePromises = staticImageOverlays.map((overlay) =>
            loadAndCacheImage(overlay.src)
        );
        const imageResults = await settleSceneImageLoads(imagePromises, {
            strict: !options.includeEditorControls,
        });
        if (imageResults.some((result) => result.status === 'rejected')) {
            console.warn('Some images failed to load.');
        }
        const loadedOverlayImages = new Map<
            string,
            HTMLImageElement
        >();
        imageResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                loadedOverlayImages.set(
                    staticImageOverlays[index].id,
                    result.value
                );
            }
        });

        if (options.shouldCommit && !options.shouldCommit()) {
            return;
        }

        if (canvas.width !== img.width) {
            canvas.width = img.width;
        }
        if (canvas.height !== img.height) {
            canvas.height = img.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

            if (strokes.length > 0 || currentStroke) {
                drawStrokes(ctx);
            }

            for (const overlay of imageOverlays) {
                if (overlay.visible === false) continue;
                try {
                    const decodedGif = overlay.animated ? decodedGifCache.current.get(overlay.id) : null;
                    const animationTime = options.resetAnimations
                        ? options.timeMs
                        : options.timeMs - (overlay.animationStartMs ?? 0);
                    const overlayImg = decodedGif
                        ? getGifFrameCanvas(decodedGif, animationTime)
                        : loadedOverlayImages.get(overlay.id) ??
                          imageCache.current.get(overlay.src);
                    if (!overlayImg) continue;

                    // Check if this image has erase strokes
                    const overlayIndex = imageOverlays.indexOf(overlay);
                    const hasEraseStrokes = overlay.eraseStrokes.length > 0 || 
                        (currentEraseStroke && imageEraseTargetIndex === overlayIndex && imageEraseTargetIndex !== -1);

                    if (hasEraseStrokes) {
                        // Create a temporary canvas for the image with erase mask applied
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = overlay.width;
                        tempCanvas.height = overlay.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        if (tempCtx) {
                            // Draw the image to the temp canvas
                            tempCtx.drawImage(overlayImg, 0, 0, overlay.width, overlay.height);
                            
                            // Apply erase strokes using destination-out to actually remove pixels
                            tempCtx.globalCompositeOperation = 'destination-out';
                            tempCtx.lineCap = 'round';
                            tempCtx.lineJoin = 'round';
                            
                            // Draw all erase strokes
                            const allStrokes = [...overlay.eraseStrokes];
                            if (currentEraseStroke && imageEraseTargetIndex === overlayIndex && imageEraseTargetIndex !== -1) {
                                allStrokes.push(currentEraseStroke);
                            }
                            
                            for (const stroke of allStrokes) {
                                if (!stroke.points.length) continue;
                                tempCtx.save();
                                tempCtx.globalAlpha = stroke.opacity;
                                tempCtx.lineWidth = stroke.size;
                                tempCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
                                tempCtx.beginPath();
                                tempCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                                for (let i = 1; i < stroke.points.length; i++) {
                                    tempCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
                                }
                                tempCtx.stroke();
                                tempCtx.restore();
                            }
                            
                            // Reset composite operation
                            tempCtx.globalCompositeOperation = 'source-over';
                            tempCtx.globalAlpha = 1;
                            
                            // Now draw the masked image to the main canvas
                            ctx.save();
                            ctx.globalAlpha = overlay.opacity;
                            
                            if (overlay.rotation !== 0) {
                                const centerX = overlay.x + overlay.width / 2;
                                const centerY = overlay.y + overlay.height / 2;
                                ctx.translate(centerX, centerY);
                                ctx.rotate((overlay.rotation * Math.PI) / 180);
                                ctx.drawImage(tempCanvas, -overlay.width / 2, -overlay.height / 2);
                            } else {
                                ctx.drawImage(tempCanvas, overlay.x, overlay.y);
                            }
                            
                            ctx.restore();
                        }
                    } else {
                        // No erase strokes, draw normally
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
                    }
                } catch (error) {
                    console.error('Error drawing overlay image:', error);
                }
            }

            drawShapesLayer(ctx, options.includeEditorControls);

            // Only show selection handles if not in erase mode
            if (
                options.includeEditorControls &&
                selectedImageIndex !== -1 &&
                selectedImageIndex < imageOverlays.length &&
                imageOverlays[selectedImageIndex].visible !== false &&
                !isImageEraseMode &&
                !isImageInteracting
            ) {
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
                if (textSettings[i]?.visible === false) return;
                const rotation = textBoxRotations[i] || 0;
                drawText(rotation)(ctx, texts[i], box, textSettings[i]);
            });

            // Creator identity is the top-most exported content layer.
            drawCreatorBranding(ctx, canvas);

            if (
                options.includeEditorControls &&
                selectedTextIndex !== -1 &&
                selectedTextIndex < textBoxes.length &&
                textSettings[selectedTextIndex]?.visible !== false &&
                texts[selectedTextIndex] &&
                !isTextInteracting
            ) {
                const selectedBox = textBoxes[selectedTextIndex];
                const rotation = textBoxRotations[selectedTextIndex] || 0;
                const isMobile = isMobileDevice();
                const baseHandleSize = Math.max(30, Math.min(canvas.width, canvas.height) * 0.04);
                const handleSize = isMobile ? Math.max(baseHandleSize, 45) : Math.max(baseHandleSize, 35);

                const boxCenterX = selectedBox.x + selectedBox.width / 2;
                const boxCenterY = selectedBox.y + selectedBox.height / 2;

                ctx.save();
                if (rotation !== 0) {
                    ctx.translate(boxCenterX, boxCenterY);
                    ctx.rotate((rotation * Math.PI) / 180);
                    ctx.translate(-boxCenterX, -boxCenterY);
                }

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

                // Draw top/bottom handles and connectors
                const textBoxCenterX = selectedBox.x + selectedBox.width / 2;
                const topHandleX = textBoxCenterX - handleSize / 2;
                const topHandleY = selectedBox.y - handleSize / 2;
                const bottomHandleX = textBoxCenterX - handleSize / 2;
                const bottomHandleY = selectedBox.y + selectedBox.height - handleSize / 2;

                ctx.setLineDash([]);
                ctx.fillStyle = '#6a7bd1';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isMobile ? 4 : 3;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                drawRoundedRect(topHandleX, topHandleY, handleSize, handleSize, 8);
                ctx.fill();
                ctx.stroke();

                drawRoundedRect(bottomHandleX, bottomHandleY, handleSize, handleSize, 8);
                ctx.fill();
                ctx.stroke();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = '#ffffff';
                const vArrowSize = Math.max(14, handleSize * 0.45);
                ctx.font = `bold ${vArrowSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('▲', topHandleX + handleSize / 2, topHandleY + handleSize / 2);
                ctx.fillText('▼', bottomHandleX + handleSize / 2, bottomHandleY + handleSize / 2);

                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = Math.max(1.5, Math.min(canvas.width, canvas.height) * 0.003);
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(textBoxCenterX, selectedBox.y);
                ctx.lineTo(textBoxCenterX, topHandleY + handleSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(textBoxCenterX, selectedBox.y + selectedBox.height);
                ctx.lineTo(textBoxCenterX, bottomHandleY);
                ctx.stroke();

                // Height indicator label next to box
                ctx.setLineDash([]);
                ctx.fillStyle = '#6a7bd1';
                const heightIndicatorFont = Math.max(10, Math.min(canvas.width, canvas.height) * 0.015);
                ctx.font = `bold ${heightIndicatorFont}px Arial`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const labelX = selectedBox.x + selectedBox.width + 10;
                const labelY = selectedBox.y + selectedBox.height / 2;
                ctx.fillText(`${Math.round(selectedBox.height)}px`, labelX, labelY);

                ctx.restore();

                // Draw rotation handle (outside rotated context)
                const rotationHandleSize = isMobile ? 60 : 50;
                const rotationHandleX = boxCenterX;
                const rotationHandleY = selectedBox.y - 35;

                ctx.setLineDash([]);
                ctx.strokeStyle = '#6a7bd1';
                ctx.lineWidth = isMobile ? 5 : 4;
                ctx.beginPath();
                ctx.moveTo(boxCenterX, selectedBox.y);
                ctx.lineTo(rotationHandleX, rotationHandleY);
                ctx.stroke();

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

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = '#ffffff';
                ctx.font = `${isMobile ? 24 : 20}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('↻', rotationHandleX, rotationHandleY);

                // Draw corner handles (nw, ne, sw, se) - need to restore context first
                ctx.save();
                if (rotation !== 0) {
                    ctx.translate(boxCenterX, boxCenterY);
                    ctx.rotate((rotation * Math.PI) / 180);
                    ctx.translate(-boxCenterX, -boxCenterY);
                }
                const cornerHandles = [
                    { name: 'nw', x: selectedBox.x - handleSize / 2, y: selectedBox.y - handleSize / 2 },
                    { name: 'ne', x: selectedBox.x + selectedBox.width - handleSize / 2, y: selectedBox.y - handleSize / 2 },
                    { name: 'sw', x: selectedBox.x - handleSize / 2, y: selectedBox.y + selectedBox.height - handleSize / 2 },
                    { name: 'se', x: selectedBox.x + selectedBox.width - handleSize / 2, y: selectedBox.y + selectedBox.height - handleSize / 2 }
                ];

                ctx.setLineDash([]);
                ctx.fillStyle = '#6a7bd1';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = isMobile ? 4 : 3;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                cornerHandles.forEach(handle => {
                    drawRoundedRect(handle.x, handle.y, handleSize, handleSize, 8);
                    ctx.fill();
                    ctx.stroke();
                });

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.restore();
            }
    }, [effectiveTemplate, textSettings, drawText, drawCreatorBranding, waitForFont, isImageInteracting, isTextInteracting, imageOverlays, selectedImageIndex, selectedTextIndex, textBoxes, texts, textBoxRotations, loadAndCacheImage, strokes, currentStroke, isImageEraseMode, imageEraseTargetIndex, currentEraseStroke, drawShapesLayer, isMobileDevice]);

    const draw = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const now = Date.now();
        const isActivelyDragging = isElementInteracting;

        if (isActivelyDragging && isOptimizedDrawing.current && (now - lastDrawTime.current) < 16) {
            return;
        }

        lastDrawTime.current = now;
        isOptimizedDrawing.current = isActivelyDragging;

        const timeMs = getAnimationNow();
        currentAnimationTimeRef.current = timeMs;
        const renderRevision = previewRenderRevision.current + 1;
        previewRenderRevision.current = renderRevision;
        await renderScene(canvas, {
            timeMs,
            includeEditorControls: true,
            resetAnimations: false,
            shouldCommit: () =>
                previewRenderRevision.current === renderRevision,
        });
    }, [getAnimationNow, isElementInteracting, renderScene]);



    useEffect(() => {
        draw();
    }, [draw, texts, textBoxes, textSettings, textBoxRotations, imageOverlays, shapeOverlays, selectedImageIndex, selectedShapeIndex, selectedTextIndex, strokes, currentStroke]);

    const hasAnimatedOverlays = imageOverlays.some(
        (overlay) => overlay.visible !== false && overlay.animated
    );
    const hasPendingAnimatedOverlays =
        imageOverlays.some(
            (overlay) =>
                overlay.visible !== false && overlay.animationDecodePending
        );
    const hasAnimatedExportOverlays = hasAnimatedOverlays || hasPendingAnimatedOverlays;
    useEffect(() => {
        if (!hasAnimatedOverlays) return;
        let raf = 0;
        let last = 0;
        const tick = (now: number) => {
            if (now - last >= 33) {
                last = now;
                draw();
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [hasAnimatedOverlays, draw]);

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
        if (selectedImageIndex === -1) return;
        setShowLayerPanel(true);
        setShowMediaLayers(true);
        const selectedImageId = imageOverlays[selectedImageIndex]?.id;
        if (
            selectedImageId &&
            workspaceTabPreservingImageId.current === selectedImageId
        ) {
            workspaceTabPreservingImageId.current = null;
            return;
        }
        if (pendingDiscoveryImageAdds.current > 0) {
            return;
        }
        setCreatorWorkspaceTab('layers');
    }, [imageOverlays, selectedImageIndex]);

    useEffect(() => {
        if (selectedShapeIndex === -1) return;
        setShowLayerPanel(true);
        setShowShapeLayers(true);
        if (pendingDiscoveryImageAdds.current > 0) {
            return;
        }
        setCreatorWorkspaceTab('layers');
    }, [selectedShapeIndex]);

    useEffect(() => {
        const isInteractiveTarget = (target: EventTarget | null) => {
            if (!(target instanceof Element)) return false;
            if (
                target.closest(
                    'input, textarea, select, button, a, [role="button"], [role="tab"], [role="slider"], [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="listbox"], [role="option"], [role="dialog"], [role="combobox"], [role="switch"], [role="spinbutton"], [role="radio"], [role="checkbox"], [contenteditable="true"]'
                )
            ) {
                return true;
            }
            return (
                target instanceof HTMLElement && target.isContentEditable
            );
        };

        const getArrowDelta = (key: string, step: number): { dx: number; dy: number } | null => {
            switch (key) {
                case 'ArrowLeft':
                    return { dx: -step, dy: 0 };
                case 'ArrowRight':
                    return { dx: step, dy: 0 };
                case 'ArrowUp':
                    return { dx: 0, dy: -step };
                case 'ArrowDown':
                    return { dx: 0, dy: step };
                default:
                    return null;
            }
        };

        const keyHandler = (event: KeyboardEvent) => {
            if (!editorCanEdit) return;
            if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
            if (isDrawingMode || isImageEraseMode) return;

            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (selectedShapeIndex !== -1) {
                    removeShape(selectedShapeIndex);
                    event.preventDefault();
                    return;
                }
                if (selectedImageIndex !== -1) {
                    removeImageOverlay(selectedImageIndex);
                    setSelectedImageIndex(-1);
                    event.preventDefault();
                    return;
                }
            }

            const step = event.shiftKey ? 10 : 1;
            const delta = getArrowDelta(event.key, step);
            if (!delta) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            if (selectedShapeIndex !== -1 && selectedShapeIndex < shapeOverlays.length) {
                const shape = shapeOverlays[selectedShapeIndex];
                const newX = Math.max(0, Math.min(canvas.width - shape.width, shape.x + delta.dx));
                const newY = Math.max(0, Math.min(canvas.height - shape.height, shape.y + delta.dy));
                updateShape(selectedShapeIndex, { x: newX, y: newY });
                event.preventDefault();
                return;
            }

            if (selectedImageIndex !== -1 && selectedImageIndex < imageOverlays.length) {
                const img = imageOverlays[selectedImageIndex];
                const constrained = constrainLayerPosition(
                    img,
                    canvas,
                    {
                        x: img.x + delta.dx,
                        y: img.y + delta.dy,
                    }
                );

                setImageOverlays((prev) => {
                    const updated = [...prev];
                    updated[selectedImageIndex] = {
                        ...updated[selectedImageIndex],
                        x: constrained.x,
                        y: constrained.y,
                    };
                    return updated;
                });
                event.preventDefault();
                return;
            }

            if (selectedTextIndex !== -1 && selectedTextIndex < textBoxes.length) {
                const box = textBoxes[selectedTextIndex];
                const newX = Math.max(
                    -box.width * 0.8,
                    Math.min(canvas.width - box.width * 0.2, box.x + delta.dx)
                );
                const newY = Math.max(0, Math.min(canvas.height, box.y + delta.dy));

                setTextBoxes((prev: Template['textBoxes']) => {
                    const updated = [...prev];
                    updated[selectedTextIndex] = {
                        ...updated[selectedTextIndex],
                        x: newX,
                        y: newY,
                    };
                    return updated;
                });
                event.preventDefault();
            }
        };

        document.addEventListener('keydown', keyHandler);
        return () => document.removeEventListener('keydown', keyHandler);
    }, [
        selectedImageIndex,
        selectedShapeIndex,
        selectedTextIndex,
        imageOverlays,
        shapeOverlays,
        textBoxes,
        editorCanEdit,
        isDrawingMode,
        isImageEraseMode,
        removeShape,
        updateShape,
    ]);

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

    const getExportTimeMs = useCallback(() => {
        return currentAnimationTimeRef.current || getAnimationNow();
    }, [getAnimationNow]);

    const getAnimatedSceneExportDurationMs = useCallback(() => {
        const overlayDurations = imageOverlays.map((overlay) => {
            if (overlay.visible === false || !overlay.animated) return 0;
            return decodedGifCache.current.get(overlay.id)?.durationMs ?? 0;
        });

        return getAnimatedExportDurationMs(overlayDurations);
    }, [imageOverlays]);

    const showExportError = useCallback((error: unknown, fallback = 'Export failed') => {
        console.error(fallback, error);
        const message = error instanceof Error ? error.message : fallback;
        const corsMessage = /taint|cors|security/i.test(message)
            ? 'Export blocked by image CORS. Try uploading the image directly or choose another source.'
            : message;
        toast.error(corsMessage);
    }, []);

    const blockExportWhileAddingImage = useCallback(() => {
        if (pendingImageAddCount.current === 0) return false;
        toast.info(
            'An image is still being added. Export again when it appears on the canvas.'
        );
        return true;
    }, []);

    const downloadMeme = async () => {
        if (blockExportWhileAddingImage()) return;
        if (hasPendingAnimatedOverlays) {
            toast.info('GIF is still preparing. Try exporting again in a moment.');
            return;
        }

        setIsExporting(true);
        setExportStatus('Preparing PNG...');
        try {
            const blob = await renderSceneToPngBlob(renderScene, getExportTimeMs());
            downloadBlob(blob, 'meme.png');
        } catch (error) {
            showExportError(error, 'PNG export failed');
        } finally {
            setIsExporting(false);
            setExportStatus(null);
        }
    };

    const downloadCreatorStill = async (
        request: CreatorStillExportRequest
    ) => {
        if (blockExportWhileAddingImage()) return;
        if (hasPendingAnimatedOverlays) {
            toast.info('GIF is still preparing. Try exporting again in a moment.');
            return;
        }

        const currentCanvas = canvasRef.current;
        if (!currentCanvas?.width || !currentCanvas.height) {
            toast.error('The canvas is still preparing. Try again in a moment.');
            return;
        }

        const format = STILL_IMAGE_FORMATS[request.format];
        const dimensions = resolveCreatorExportDimensions(
            request.profileId,
            {
                width: currentCanvas.width,
                height: currentCanvas.height,
            }
        );
        setIsExporting(true);
        setExportStatus(
            `Preparing ${format.label} ${dimensions.width}×${dimensions.height}…`
        );

        try {
            const blob = await renderSceneToImageBlob(
                renderScene,
                getExportTimeMs(),
                {
                    mimeType: format.mimeType,
                    quality: format.supportsQuality
                        ? request.quality
                        : undefined,
                    ...(request.profileId === 'original'
                        ? {}
                        : {
                              width: dimensions.width,
                              height: dimensions.height,
                              mode: request.placement,
                              backgroundColor: request.backgroundColor,
                          }),
                }
            );
            downloadBlob(
                blob,
                buildCreatorExportFilename({
                    baseName: effectiveTemplate.displayName || 'meme',
                    profileId: request.profileId,
                    format: request.format,
                })
            );
            toast.success(
                `${format.label} ready at ${dimensions.width}×${dimensions.height}`
            );
        } catch (error) {
            showExportError(error, `${format.label} export failed`);
        } finally {
            setIsExporting(false);
            setExportStatus(null);
        }
    };

    const copyMeme = async () => {
        if (blockExportWhileAddingImage()) return;
        if (hasPendingAnimatedOverlays) {
            toast.info('GIF is still preparing. Try copying again in a moment.');
            return;
        }

        setIsExporting(true);
        setExportStatus('Copying...');
        try {
            const blob = await renderSceneToPngBlob(renderScene, getExportTimeMs());

            const data = new ClipboardItem({
                [getStillExportMimeType()]: blob
            });

            await navigator.clipboard.write([data]);
            toast.success("meme copied to clipboard")
        } catch (err) {
            showExportError(err, 'Failed to copy meme');
        } finally {
            setIsExporting(false);
            setExportStatus(null);
        }
    }

    const downloadAnimatedMeme = async () => {
        if (blockExportWhileAddingImage()) return;
        if (hasPendingAnimatedOverlays) {
            toast.info('GIF is still preparing. Try exporting again in a moment.');
            return;
        }

        setIsExporting(true);
        const exportDurationMs = getAnimatedSceneExportDurationMs();
        const exportDurationSeconds = Math.ceil(exportDurationMs / 1000);
        setExportStatus(`Exporting ${exportDurationSeconds}s MP4...`);
        try {
            const capability = getAnimatedExportCapability();

            if (capability.format === 'mp4') {
                try {
                    const captureBlob = await recordSceneToVideoBlob(
                        renderScene,
                        capability,
                        {
                            durationMs: exportDurationMs,
                            fps: 30,
                            onProgress: ({ completedFrames, totalFrames }) => {
                                const percent = Math.round((completedFrames / totalFrames) * 100);
                                setExportStatus(`Rendering MP4 ${percent}%...`);
                            },
                        }
                    );
                    setExportStatus('Uploading MP4...');
                    const upload = await uploadVideoCaptureToCloudinary(captureBlob);
                    const playbackUrl = buildCloudinaryMp4Url(upload);
                    const downloadUrl = buildCloudinaryMp4Url(upload, {
                        attachment: true,
                        filename: 'meme',
                    });

                    setExportStatus('Converting MP4...');
                    await waitForCloudinaryMp4(playbackUrl);
                    setExportStatus('Downloading MP4...');
                    downloadRemoteUrl(downloadUrl, 'meme.mp4');
                } catch (error) {
                    console.warn('MP4 export failed; falling back to animated GIF.', error);
                    toast.error('MP4 export failed. Creating animated GIF instead.');
                    setExportStatus(`Exporting ${exportDurationSeconds}s GIF...`);
                    const blob = await encodeSceneToGifBlob(renderScene, { durationMs: exportDurationMs, fps: 15 });
                    downloadBlob(blob, 'meme.gif');
                }
            } else {
                setExportStatus(`Exporting ${exportDurationSeconds}s GIF...`);
                const blob = await encodeSceneToGifBlob(renderScene, { durationMs: exportDurationMs, fps: 15 });
                downloadBlob(blob, 'meme.gif');
            }
        } catch (error) {
            showExportError(error, 'Animated export failed');
        } finally {
            setIsExporting(false);
            setExportStatus(null);
        }
    }

    const addTextBox = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const defaultText = 'memehub';
        const defaultSettings = {
            fontSize: Math.round(clampValue(
                Math.max(60, Math.min(canvas.width, canvas.height) * 0.08),
                CUSTOM_TEXT_MIN_FONT_SIZE,
                MAX_TEXT_FONT_SIZE
            )),
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
        };

        const baseTextBox = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            width: 0,
            height: 0,
            fontSize: defaultSettings.fontSize,
            align: 'center' as const,
            minFont: CUSTOM_TEXT_MIN_FONT_SIZE
        };
        const newTextBox = fitTextBoxToContent(baseTextBox, defaultText, defaultSettings, {
            mode: 'center'
        });

        setTexts(prev => [...prev, defaultText]);
        setTextLayerIds((current) => [
            ...current,
            createTextLayerId(),
        ]);
        setTextBoxes(prev => {
            setSelectedTextIndex(prev.length);
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            return [...prev, newTextBox];
        });
        setTextBoxRotations(prev => [...prev, 0]);
        setTextSettings(prev => [...prev, defaultSettings]);

        toast.success('Text box added! Drag it to position.');
    }, [
        CUSTOM_TEXT_MIN_FONT_SIZE,
        MAX_TEXT_FONT_SIZE,
        clampValue,
        fitTextBoxToContent,
        getDefaultFont,
        setSelectedShapeIndex
    ]);

    const removeTextBox = useCallback((index: number) => {
        if (index < originalTextBoxCount) {
            toast.error('Cannot remove template text boxes');
            return;
        }

        setTexts(prev => prev.filter((_, i) => i !== index));
        setTextLayerIds(prev => prev.filter((_, i) => i !== index));
        setTextBoxes(prev => prev.filter((_, i) => i !== index));
        setTextSettings(prev => prev.filter((_, i) => i !== index));
        setTextBoxRotations(prev => prev.filter((_, i) => i !== index));

        toast.success('Text box removed');
    }, [originalTextBoxCount]);

    const toggleTextLayer = useCallback((index: number) => {
        setTextSettings((current) =>
            toggleLayerVisibility(current, index)
        );
    }, []);

    const duplicateTextLayerAt = useCallback((index: number) => {
        try {
            const duplicated = duplicateTextLayer(
                {
                    texts,
                    textBoxes,
                    rotations: textBoxRotations,
                    settings: textSettings,
                },
                index
            );
            setTexts(duplicated.texts);
            setTextBoxes(duplicated.textBoxes);
            setTextBoxRotations(duplicated.rotations);
            setTextSettings(duplicated.settings);
            setTextLayerIds((current) => [
                ...current,
                createTextLayerId(),
            ]);
            setSelectedTextIndex(duplicated.selectedIndex);
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
            toast.success('Text layer duplicated');
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Could not duplicate text layer'
            );
        }
    }, [
        setSelectedShapeIndex,
        textBoxes,
        textBoxRotations,
        textSettings,
        texts,
    ]);

    const toggleImageLayer = useCallback((index: number) => {
        if (
            imageEraseTargetIndex === index &&
            imageOverlays[index]?.visible !== false
        ) {
            setIsImageEraseMode(false);
            setImageEraseTargetIndex(-1);
            setCurrentEraseStroke(null);
            setIsErasing(false);
        }
        setImageOverlays((current) =>
            toggleLayerVisibility(current, index)
        );
    }, [imageEraseTargetIndex, imageOverlays]);

    const moveTextLayerAt = useCallback((
        index: number,
        direction: 'forward' | 'backward'
    ) => {
        if (
            !canMoveTextLayerWithinGroup(
                index,
                direction,
                texts.length,
                originalTextBoxCount
            )
        ) {
            return;
        }

        try {
            const moved = moveTextLayer(
                {
                    texts,
                    textBoxes,
                    rotations: textBoxRotations,
                    settings: textSettings,
                },
                index,
                direction
            );
            setTexts(moved.texts);
            setTextBoxes(moved.textBoxes);
            setTextBoxRotations(moved.rotations);
            setTextSettings(moved.settings);
            setTextLayerIds(
                moveLayer(textLayerIds, index, direction).items
            );
            setSelectedTextIndex(moved.selectedIndex);
            setSelectedImageIndex(-1);
            setSelectedShapeIndex(-1);
        } catch {
            toast.error('Could not reorder text layers.');
        }
    }, [
        originalTextBoxCount,
        setSelectedShapeIndex,
        textBoxes,
        textBoxRotations,
        textLayerIds,
        textSettings,
        texts,
    ]);

    const duplicateImageLayerAt = useCallback((index: number) => {
        const layer = imageOverlays[index];
        if (!layer) return;

        try {
            const copy = duplicateImageLayer(layer, generateImageId());
            const nextImageOverlays = [...imageOverlays, copy];
            if (
                nextImageOverlays.length >
                EDITOR_IMAGE_LAYER_LIMIT
            ) {
                throw new Error(
                    `A meme can contain up to ${EDITOR_IMAGE_LAYER_LIMIT} image layers. Remove one before duplicating another.`
                );
            }
            assertMemeEditorDraftLocalMediaCapacity({
                ...draftStateRef.current,
                canvasTemplate: canvasTemplateRef.current,
                imageOverlays: nextImageOverlays,
            });
            imageOverlaysRef.current = nextImageOverlays;
            setImageOverlays(nextImageOverlays);
            setSelectedImageIndex(nextImageOverlays.length - 1);
            setSelectedTextIndex(-1);
            setSelectedShapeIndex(-1);
            toast.success('Image layer duplicated');
        } catch (error) {
            toast.info(
                error instanceof Error
                    ? error.message
                    : 'Could not duplicate image layer'
            );
        }
    }, [imageOverlays, setSelectedShapeIndex]);

    const moveImageLayer = useCallback((
        index: number,
        direction: 'forward' | 'backward'
    ) => {
        setImageOverlays((current) => {
            const moved = moveLayer(current, index, direction);
            setSelectedImageIndex(moved.selectedIndex);
            return moved.items;
        });
        setIsImageEraseMode(false);
        setImageEraseTargetIndex(-1);
    }, []);

    const toggleShapeLayer = useCallback((index: number) => {
        replaceShapes(toggleLayerVisibility(shapeOverlays, index));
        setSelectedShapeIndex(index);
    }, [replaceShapes, setSelectedShapeIndex, shapeOverlays]);

    const duplicateShapeLayerAt = useCallback((index: number) => {
        const layer = shapeOverlays[index];
        if (!layer) return;

        const copy = duplicateShapeLayer(
            layer,
            `shape_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        );
        const next = [...shapeOverlays, copy];
        replaceShapes(next);
        setSelectedShapeIndex(next.length - 1);
        setSelectedImageIndex(-1);
        setSelectedTextIndex(-1);
        toast.success('Shape layer duplicated');
    }, [replaceShapes, setSelectedShapeIndex, shapeOverlays]);

    const moveShapeLayer = useCallback((
        index: number,
        direction: 'forward' | 'backward'
    ) => {
        const moved = moveLayer(shapeOverlays, index, direction);
        replaceShapes(moved.items);
        setSelectedShapeIndex(moved.selectedIndex);
    }, [replaceShapes, setSelectedShapeIndex, shapeOverlays]);

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

    const getImageLocalPos = (canvasPos: Point, imageOverlay: ImageOverlay): Point | null => {
        // Check if point is within image bounds (considering rotation)
        if (imageOverlay.rotation !== 0) {
            // For rotated images, we need to transform the point
            const centerX = imageOverlay.x + imageOverlay.width / 2;
            const centerY = imageOverlay.y + imageOverlay.height / 2;
            const rad = (-imageOverlay.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            // Transform to local coordinates
            const localX = canvasPos.x - centerX;
            const localY = canvasPos.y - centerY;
            const rotatedX = localX * cos - localY * sin;
            const rotatedY = localX * sin + localY * cos;
            
            const localPos = { x: rotatedX + imageOverlay.width / 2, y: rotatedY + imageOverlay.height / 2 };
            
            if (localPos.x >= 0 && localPos.x <= imageOverlay.width && localPos.y >= 0 && localPos.y <= imageOverlay.height) {
                return localPos;
            }
        } else {
            if (canvasPos.x >= imageOverlay.x && canvasPos.x <= imageOverlay.x + imageOverlay.width &&
                canvasPos.y >= imageOverlay.y && canvasPos.y <= imageOverlay.y + imageOverlay.height) {
                return {
                    x: canvasPos.x - imageOverlay.x,
                    y: canvasPos.y - imageOverlay.y
                };
            }
        }
        return null;
    };

    // Image erase event handlers
    const handleImageEraseStart = (e: MouseEvent | TouchEvent) => {
        if (!isImageEraseMode || imageEraseTargetIndex === -1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasPos = getPointerPos(e, canvas);
        const overlay = imageOverlays[imageEraseTargetIndex];
        if (!overlay || overlay.visible === false) return;
        
        // Always start erasing, even if click is outside the image
        // This allows user to click outside and drag onto the image
        setIsErasing(true);
        setCurrentEraseStroke({
            points: [],
            size: eraseBrushSize,
            opacity: eraseBrushOpacity
        });
        
        // If the click is within the image, add the first point
        const localPos = getImageLocalPos(canvasPos, overlay);
        if (localPos) {
            setCurrentEraseStroke({
                points: [localPos],
                size: eraseBrushSize,
                opacity: eraseBrushOpacity
            });
        }
        if (e.cancelable) e.preventDefault();
    };

    const handleImageEraseMove = (e: MouseEvent | TouchEvent) => {
        if (!isImageEraseMode || !isErasing || !currentEraseStroke || imageEraseTargetIndex === -1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasPos = getPointerPos(e, canvas);
        const overlay = imageOverlays[imageEraseTargetIndex];
        if (!overlay || overlay.visible === false) return;
        
        // Only add points that are within the image bounds
        const localPos = getImageLocalPos(canvasPos, overlay);
        if (localPos) {
            setCurrentEraseStroke(prev => {
                if (!prev) return null;
                // Avoid adding duplicate points if mouse hasn't moved much
                const lastPoint = prev.points[prev.points.length - 1];
                if (lastPoint) {
                    const dist = Math.sqrt(
                        Math.pow(localPos.x - lastPoint.x, 2) + 
                        Math.pow(localPos.y - lastPoint.y, 2)
                    );
                    // Only add point if it's moved at least 1 pixel
                    if (dist < 1) return prev;
                }
                return { ...prev, points: [...prev.points, localPos] };
            });
        }
        if (e.cancelable) e.preventDefault();
    };

    const handleImageEraseEnd = (e?: MouseEvent | TouchEvent) => {
        if (!isImageEraseMode || !isErasing || !currentEraseStroke || imageEraseTargetIndex === -1) return;
        if (imageOverlays[imageEraseTargetIndex]?.visible === false) {
            setCurrentEraseStroke(null);
            setIsErasing(false);
            return;
        }
        
        // Only save the stroke if it has at least one point (user actually drew on the image)
        if (currentEraseStroke.points.length > 0) {
            addEraseStrokeToImage(imageEraseTargetIndex, currentEraseStroke);
        }
        
        setCurrentEraseStroke(null);
        setIsErasing(false);
        if (e && 'preventDefault' in e && e.cancelable) e.preventDefault();
    };

    // Drawing event handlers
    const handleDrawStart = (e: MouseEvent | TouchEvent) => {
        if (isImageEraseMode) {
            handleImageEraseStart(e);
            return;
        }
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
        if (isImageEraseMode) {
            handleImageEraseMove(e);
            return;
        }
        if (!isDrawingMode || !isDrawing || !currentStroke) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pos = getPointerPos(e, canvas);
        setCurrentStroke((prev) => prev ? { ...prev, points: [...prev.points, pos] } : null);
        if (e.cancelable) e.preventDefault();
    };
    const handleDrawEnd = (e?: MouseEvent | TouchEvent) => {
        if (isImageEraseMode) {
            handleImageEraseEnd(e);
            return;
        }
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
        if (!isDrawingMode && !isImageEraseMode) return;
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
    }, [isDrawingMode, isImageEraseMode, isEraser, drawColor, drawSize, currentStroke, isDrawing, imageEraseTargetIndex, eraseBrushSize, eraseBrushOpacity, currentEraseStroke, isErasing, imageOverlays]);

    const animatedExportCapability = getAnimatedExportCapability();
    const animatedExportLabel =
        animatedExportCapability.format === 'mp4' ? 'Video MP4' : 'Animated GIF';
    const exportButtonLabel = exportStatus ?? (hasPendingAnimatedOverlays ? 'Preparing GIF...' : 'Download');
    const draftStatusLabel = {
        restoring: 'Restoring draft…',
        saving: 'Saving…',
        saved: 'Draft saved',
        error: 'Draft not saved',
    }[draftStatus];

    return (
        <>
            {!isDraftReady && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-3 rounded-xl border border-[#6a7bd1]/30 bg-[#6a7bd1]/10 px-4 py-3 text-sm"
                >
                    Restoring your saved draft before editing…
                </div>
            )}
            {draftRestoreError && (
                <div
                    role="alert"
                    className="mb-3 flex flex-col gap-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                    <span>{draftRestoreError}</span>
                    <button
                        type="button"
                        onClick={onReset}
                        className="rounded-md border border-red-400/40 px-3 py-2 font-semibold"
                    >
                        Return to templates
                    </button>
                </div>
            )}
            <motion.section
                aria-busy={!isDraftReady}
                inert={!editorCanEdit}
                className={`space-y-4 min-h-[65vh] max-sm:min-h-[75vh] ${
                    editorCanEdit ? '' : 'pointer-events-none opacity-60'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: isDraftReady ? 1 : 0.6 }}
                transition={{ duration: 0.3 }}
            >
            <div className="flex items-center justify-between">
                <motion.button
                    type="button"
                    className="bg-transparent cursor-pointer flex items-center"
                    onClick={handleBack}
                    disabled={!editorCanEdit}
                    whileHover={{ x: -5 }}
                    transition={{ duration: 0.2 }}
                >
                    <MoveLeft className='h-4 w-4' /> &nbsp; Back
                </motion.button>
                <span
                    aria-live="polite"
                    className={`text-xs ${
                        draftStatus === 'error'
                            ? 'text-red-400'
                            : 'text-black/50 dark:text-white/50'
                    }`}
                >
                    {draftStatusLabel}
                </span>
            </div>
            <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)] lg:gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex w-full flex-col items-center lg:sticky lg:top-4"
                >
                    <canvas
                        ref={canvasRef}
                        className="h-auto w-full max-w-[760px] select-none border border-gray-300 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.2)] dark:border-gray-700"
                        onMouseDown={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawStart(e.nativeEvent) : handleMouseDown}
                        onMouseMove={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawMove(e.nativeEvent) : handleMouseMove}
                        onMouseUp={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawEnd(e.nativeEvent) : handleMouseUp}
                        onMouseLeave={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawEnd(e.nativeEvent) : handleMouseUp}
                        onTouchStart={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawStart(e.nativeEvent) : handleTouchStart}
                        onTouchMove={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawMove(e.nativeEvent) : handleTouchMove}
                        onTouchEnd={(isDrawingMode || isImageEraseMode) ? (e) => handleDrawEnd(e.nativeEvent) : handleTouchEnd}
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
                    className="w-full min-w-0 space-y-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    <CreatorWorkspace
                        activeTab={creatorWorkspaceTab}
                        onTabChange={setCreatorWorkspaceTab}
                        collapsed={creatorWorkspaceCollapsed}
                        onCollapsedChange={setCreatorWorkspaceCollapsed}
                        discover={
                            <CreatorDiscoveryPanel
                                onAddImage={addDiscoveredImageToCanvas}
                                onUseAsTemplate={startFromDiscoveredImage}
                                disabled={
                                    isDrawingMode || isImageEraseMode
                                }
                            />
                        }
                        styles={
                            <div className="space-y-3">
                            <TextStylePanel
                                activeTextIndex={
                                    selectedTextIndex >= 0
                                        ? selectedTextIndex
                                        : 0
                                }
                                textCount={texts.length}
                                onSelectText={(index) => {
                                    setSelectedTextIndex(index);
                                    setSelectedImageIndex(-1);
                                    setSelectedShapeIndex(-1);
                                }}
                                onApplyPreset={handleApplyTextStyle}
                            />
                            <CreatorBrandPanel
                                branding={branding}
                                onChange={setBranding}
                            />
                            </div>
                        }
                        assets={
                            <div className="space-y-4">
                                <CreatorAssetShelf
                                    onAddAsset={addCreatorAssetToCanvas}
                                />
                                <div className="border-t border-white/10 pt-3">
                                    <div className="mb-2">
                                        <p className="text-xs font-semibold text-white">
                                            Stickers, GIFs &amp; shapes
                                        </p>
                                        <p className="text-[10px] text-white/45">
                                            Search reactions or add visual callouts.
                                        </p>
                                    </div>
                                    <ElementsPanel
                                        onAddMedia={addMediaFromLibrary}
                                        onAddShape={(type) => {
                                            addShape(type);
                                            setSelectedTextIndex(-1);
                                            setSelectedImageIndex(-1);
                                            setCreatorWorkspaceTab('layers');
                                        }}
                                        disabled={
                                            isDrawingMode ||
                                            isImageEraseMode
                                        }
                                    />
                                </div>
                            </div>
                        }
                        layers={
                            <div className="space-y-3">
                            <CreatorLayersPanel
                                texts={texts.map((text, index) => ({
                                    id:
                                        textLayerIds[index] ??
                                        `text-layer-fallback-${index}`,
                                    text,
                                    settings: textSettings[index],
                                }))}
                                images={imageOverlays}
                                shapes={shapeOverlays}
                                selectedTextIndex={selectedTextIndex}
                                selectedImageIndex={selectedImageIndex}
                                selectedShapeIndex={selectedShapeIndex}
                                originalTextCount={originalTextBoxCount}
                                backgroundLabel={
                                    canvasTemplate?.displayName
                                }
                                backgroundSource={canvasTemplate?.source}
                                onSelectText={(index) => {
                                    setSelectedTextIndex(index);
                                    setSelectedImageIndex(-1);
                                    setSelectedShapeIndex(-1);
                                }}
                                onSelectImage={(index) => {
                                    setSelectedImageIndex(index);
                                    setSelectedTextIndex(-1);
                                    setSelectedShapeIndex(-1);
                                    setIsImageEraseMode(false);
                                    setImageEraseTargetIndex(-1);
                                }}
                                onSelectShape={(index) => {
                                    setSelectedShapeIndex(index);
                                    setSelectedTextIndex(-1);
                                    setSelectedImageIndex(-1);
                                    setIsImageEraseMode(false);
                                    setImageEraseTargetIndex(-1);
                                }}
                                onToggleText={toggleTextLayer}
                                onToggleImage={toggleImageLayer}
                                onToggleShape={toggleShapeLayer}
                                onDuplicateText={duplicateTextLayerAt}
                                onDuplicateImage={duplicateImageLayerAt}
                                onDuplicateShape={duplicateShapeLayerAt}
                                onMoveText={moveTextLayerAt}
                                onMoveImage={moveImageLayer}
                                onMoveShape={moveShapeLayer}
                                onDeleteText={removeTextBox}
                                onDeleteImage={(index) => {
                                    removeImageOverlay(index);
                                    setSelectedImageIndex((current) => {
                                        if (current === index) return -1;
                                        return current > index
                                            ? current - 1
                                            : current;
                                    });
                                }}
                                onDeleteShape={removeShape}
                            />
                            {selectedImageIndex >= 0 &&
                                imageOverlays[selectedImageIndex] && (
                                    <ImageLayerTools
                                        image={
                                            imageOverlays[
                                                selectedImageIndex
                                            ]
                                        }
                                        eraseMode={
                                            isImageEraseMode &&
                                            imageEraseTargetIndex ===
                                                selectedImageIndex
                                        }
                                        eraseBrushSize={eraseBrushSize}
                                        eraseBrushOpacity={
                                            eraseBrushOpacity
                                        }
                                        onOpacityChange={(opacity) =>
                                            handleImageOpacityChange(
                                                selectedImageIndex,
                                                opacity
                                            )
                                        }
                                        onRotate90={rotateSelectedImage90}
                                        onFit={() =>
                                            fitSelectedImageToCanvas('fit')
                                        }
                                        onFill={() =>
                                            fitSelectedImageToCanvas('fill')
                                        }
                                        onToggleErase={
                                            toggleSelectedImageErase
                                        }
                                        onEraseBrushSizeChange={
                                            setEraseBrushSize
                                        }
                                        onEraseBrushOpacityChange={
                                            setEraseBrushOpacity
                                        }
                                        onUndoErase={() =>
                                            undoImageErase(
                                                selectedImageIndex
                                            )
                                        }
                                        onClearErase={() =>
                                            clearImageErase(
                                                selectedImageIndex
                                            )
                                        }
                                    />
                                )}
                            </div>
                        }
                        exportPanel={
                            <CreatorExportPanel
                                isExporting={
                                    isExporting ||
                                    hasPendingAnimatedOverlays
                                }
                                onExport={downloadCreatorStill}
                                onCopy={copyMeme}
                                hasAnimatedMedia={hasAnimatedExportOverlays}
                                animatedLabel={animatedExportLabel}
                                onExportAnimated={downloadAnimatedMeme}
                            />
                        }
                    />

                    {/* Text inputs — primary */}
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
                                                type="button"
                                                aria-label={`Text settings for ${
                                                    i < originalTextBoxCount
                                                        ? `text position ${i + 1}`
                                                        : `Custom text ${i - originalTextBoxCount + 1}`
                                                }`}
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
                                                            <SelectGroup>
                                                                <SelectLabel>Meme classics</SelectLabel>
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
                                                                <SelectItem value="Source Sans 3">Source Sans 3</SelectItem>
                                                                <SelectItem value="Nunito">Nunito</SelectItem>
                                                                <SelectItem value="Inter">Inter</SelectItem>
                                                                <SelectItem value="Work Sans">Work Sans</SelectItem>
                                                            </SelectGroup>
                                                            <SelectSeparator />
                                                            <SelectGroup>
                                                                <SelectLabel>Indian scripts</SelectLabel>
                                                                {INDIAN_SCRIPT_FONT_NAMES.map((fontName) => (
                                                                    <SelectItem key={fontName} value={fontName}>
                                                                        {fontName}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectGroup>
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
                                    ref={i === 0 ? primaryCaptionRef : undefined}
                                    aria-label={i < originalTextBoxCount ? `text position ${i + 1}` : `Custom text ${i - originalTextBoxCount + 1}`}
                                    dir="auto"
                                    className="w-full p-2 pl-3 text-sm border rounded-md bg-[#0f0f0f] border-white/20 text-white placeholder:text-white/70 resize-none min-h-[40px] max-h-[120px]"
                                    placeholder={i < originalTextBoxCount ? `text position ${i + 1}` : `Custom text ${i - originalTextBoxCount + 1}`}
                                    value={txt}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange(i, e.target.value)}
                                    onFocus={() => {
                                        setSelectedTextIndex(i);
                                        setSelectedImageIndex(-1);
                                        setSelectedShapeIndex(-1);
                                    }}
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
                                        type="button"
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

                    <div className="hidden rounded-md border border-white/15 bg-black/60 p-3" aria-hidden="true">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-white">
                            <input
                                type="checkbox"
                                aria-label="Add creator watermark"
                                checked={branding.enabled}
                                onChange={(event) =>
                                    setBranding((current) => ({
                                        ...current,
                                        enabled: event.target.checked,
                                    }))
                                }
                                className="h-4 w-4 accent-[#6a7bd1]"
                            />
                            Add creator watermark
                        </label>

                        {branding.enabled && (
                            <div className="mt-3 grid gap-3">
                                <label
                                    htmlFor="creator-watermark-text"
                                    className="grid gap-1 text-xs text-white/70"
                                >
                                    Creator name or handle
                                    <input
                                        id="creator-watermark-text"
                                        aria-label="Creator watermark text"
                                        type="text"
                                        maxLength={60}
                                        value={branding.text}
                                        onChange={(event) =>
                                            setBranding((current) => ({
                                                ...current,
                                                text: event.target.value,
                                            }))
                                        }
                                        placeholder="@yourpage"
                                        className="h-9 rounded-md border border-white/20 bg-black/70 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#6a7bd1]"
                                    />
                                </label>

                                <label className="grid gap-1 text-xs text-white/70">
                                    Position
                                    <select
                                        aria-label="Creator watermark position"
                                        value={branding.position}
                                        onChange={(event) =>
                                            setBranding((current) => ({
                                                ...current,
                                                position: event.target.value as CreatorBranding['position'],
                                            }))
                                        }
                                        className="h-9 rounded-md border border-white/20 bg-black/70 px-3 text-sm text-white outline-none transition-colors focus:border-[#6a7bd1]"
                                    >
                                        <option value="top-left">Top left</option>
                                        <option value="top-right">Top right</option>
                                        <option value="bottom-left">Bottom left</option>
                                        <option value="bottom-right">Bottom right</option>
                                    </select>
                                </label>
                            </div>
                        )}

                        <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                            Optional—Memehub never forces its own watermark on your export.
                        </p>
                    </div>

                    <div className="hidden" aria-hidden="true">
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowElementsPanel((v) => !v)}
                        aria-expanded={showElementsPanel}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs transition-colors ${
                            showElementsPanel
                                ? 'bg-[#6a7bd1]/20 border-[#6a7bd1]/50 text-white'
                                : 'bg-black/70 border-white/20 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 shrink-0" />
                            Stickers, GIFs & shapes
                        </span>
                        {showElementsPanel ? (
                            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )}
                    </motion.button>

                    {showElementsPanel && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ duration: 0.2 }}
                        >
                            <ElementsPanel
                                onAddMedia={addMediaFromLibrary}
                                onAddShape={(type) => {
                                    addShape(type);
                                    setSelectedImageIndex(-1);
                                }}
                                disabled={isDrawingMode || isImageEraseMode}
                            />
                        </motion.div>
                    )}

                    {/* Canvas Layers */}
                    {(imageOverlays.length > 0 || shapeOverlays.length > 0) && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.5 }}
                            className="mt-4 overflow-hidden rounded-md border border-white/15 bg-black/60"
                        >
                            <button
                                type="button"
                                onClick={() => setShowLayerPanel((value) => !value)}
                                aria-expanded={showLayerPanel}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/5"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <Layers className="h-3.5 w-3.5 shrink-0 text-white/70" />
                                    <span className="truncate">Canvas layers</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 text-white/50">
                                    <span>{imageOverlays.length + shapeOverlays.length} items</span>
                                    {showLayerPanel ? (
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                </span>
                            </button>

                            {showLayerPanel && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    transition={{ duration: 0.18 }}
                                    className="border-t border-white/10"
                                >
                                    {imageOverlays.length > 0 && (
                                        <div className="border-b border-white/10 last:border-b-0">
                                            <button
                                                type="button"
                                                onClick={() => setShowMediaLayers((value) => !value)}
                                                aria-expanded={showMediaLayers}
                                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">Media</span>
                                                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                                                        {imageOverlays.length}
                                                    </span>
                                                </span>
                                                {showMediaLayers ? (
                                                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                                                ) : (
                                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                            </button>

                                            {showMediaLayers && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    transition={{ duration: 0.18 }}
                                                    className="max-h-72 overflow-y-auto px-2 pb-2"
                                                >
                                                    {imageOverlays.map((overlay, index) => {
                                                        const isActiveImageLayer =
                                                            selectedImageIndex === index ||
                                                            (isImageEraseMode && imageEraseTargetIndex === index);
                                                        const selectImageLayer = () => {
                                                            if (isImageEraseMode && imageEraseTargetIndex !== index) {
                                                                setIsImageEraseMode(false);
                                                                setImageEraseTargetIndex(-1);
                                                            }
                                                            setSelectedImageIndex(index);
                                                            setSelectedShapeIndex(-1);
                                                        };

                                                        return (
                                                            <motion.div
                                                                key={overlay.id}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                exit={{ opacity: 0, x: -10 }}
                                                                transition={{ duration: 0.16 }}
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-pressed={isActiveImageLayer}
                                                                className={`border-t border-white/10 first:border-t-0 px-1.5 transition-colors ${
                                                                    isActiveImageLayer
                                                                        ? 'bg-[#0f0f0f]'
                                                                        : 'hover:bg-white/5'
                                                                }`}
                                                                onClick={selectImageLayer}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        selectImageLayer();
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2 py-2">
                                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10">
                                                                            <ImageIcon className="h-4 w-4 text-white/60" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-xs text-white/80">
                                                                                {overlay.label || 'Image'}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[11px] text-white/40">
                                                                                <span className="rounded bg-[#6a7bd1]/30 px-1 text-[9px] text-white/80">
                                                                                    {overlay.animated || overlay.animationDecodePending ? 'GIF' : 'IMG'}
                                                                                </span>
                                                                                <span>
                                                                                    {Math.round(overlay.width)}×{Math.round(overlay.height)}px
                                                                                </span>
                                                                                <span>{Math.round(overlay.opacity * 100)}%</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <motion.button
                                                                        type="button"
                                                                        whileTap={{ scale: 0.9 }}
                                                                        aria-label={`Delete ${overlay.label || 'media layer'}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeImageOverlay(index);
                                                                            if (selectedImageIndex === index) {
                                                                                setSelectedImageIndex(-1);
                                                                            } else if (selectedImageIndex > index) {
                                                                                setSelectedImageIndex(selectedImageIndex - 1);
                                                                            }
                                                                        }}
                                                                        className="shrink-0 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </motion.button>
                                                                </div>

                                                                {isActiveImageLayer && (
                                                                    <div
                                                                        className="border-t border-white/10 pb-2 pt-2"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <label className="mb-1 block text-xs text-white/60">
                                                                            Opacity: {Math.round(overlay.opacity * 100)}%
                                                                        </label>
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max="1"
                                                                            step="0.01"
                                                                            value={overlay.opacity}
                                                                            onChange={(e) => handleImageOpacityChange(index, parseFloat(e.target.value))}
                                                                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                                                                            style={{
                                                                                background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${overlay.opacity * 100}%, rgba(255,255,255,0.2) ${overlay.opacity * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                            }}
                                                                        />

                                                                        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <motion.button
                                                                                    type="button"
                                                                                    whileTap={{ scale: 0.98 }}
                                                                                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                                                                                        isImageEraseMode && imageEraseTargetIndex === index
                                                                                            ? 'border-[#6a7bd1] bg-[#6a7bd1] text-white'
                                                                                            : 'border-white/20 bg-black/70 text-white hover:bg-white/10 dark:bg-white/15'
                                                                                    }`}
                                                                                    onClick={() => {
                                                                                        if (isImageEraseMode && imageEraseTargetIndex === index) {
                                                                                            setIsImageEraseMode(false);
                                                                                            setImageEraseTargetIndex(-1);
                                                                                            setSelectedImageIndex(index);
                                                                                        } else {
                                                                                            setIsImageEraseMode(true);
                                                                                            setImageEraseTargetIndex(index);
                                                                                            setSelectedImageIndex(index);
                                                                                            setSelectedShapeIndex(-1);
                                                                                            setIsDrawingMode(false);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {isImageEraseMode && imageEraseTargetIndex === index ? 'Exit Erase' : 'Erase'}
                                                                                </motion.button>
                                                                                {isImageEraseMode && imageEraseTargetIndex === index && (
                                                                                    <>
                                                                                        <motion.button
                                                                                            type="button"
                                                                                            whileTap={{ scale: 0.98 }}
                                                                                            className="rounded-md border border-white/20 bg-black/70 px-2 py-1.5 text-xs text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/15"
                                                                                            onClick={() => undoImageErase(index)}
                                                                                            disabled={overlay.eraseStrokes.length === 0}
                                                                                            title="Undo Last Erase"
                                                                                            aria-label="Undo last erase"
                                                                                        >
                                                                                            <Undo2 className="h-3 w-3" />
                                                                                        </motion.button>
                                                                                        <motion.button
                                                                                            type="button"
                                                                                            whileTap={{ scale: 0.98 }}
                                                                                            className="rounded-md border border-white/20 bg-black/70 px-2 py-1.5 text-xs text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/15"
                                                                                            onClick={() => clearImageErase(index)}
                                                                                            disabled={overlay.eraseStrokes.length === 0}
                                                                                            title="Clear All Erase"
                                                                                            aria-label="Clear all erase"
                                                                                        >
                                                                                            <Trash className="h-3 w-3" />
                                                                                        </motion.button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            {isImageEraseMode && imageEraseTargetIndex === index && (
                                                                                <div className="space-y-2">
                                                                                    <div>
                                                                                        <label className="mb-1 block text-xs text-white/60">
                                                                                            Brush Size: {eraseBrushSize}px
                                                                                        </label>
                                                                                        <input
                                                                                            type="range"
                                                                                            min="5"
                                                                                            max="100"
                                                                                            value={eraseBrushSize}
                                                                                            onChange={(e) => setEraseBrushSize(Number(e.target.value))}
                                                                                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                                                                                            style={{
                                                                                                background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${((eraseBrushSize - 5) / 95) * 100}%, rgba(255,255,255,0.2) ${((eraseBrushSize - 5) / 95) * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="mb-1 block text-xs text-white/60">
                                                                                            Brush Opacity: {Math.round(eraseBrushOpacity * 100)}%
                                                                                        </label>
                                                                                        <input
                                                                                            type="range"
                                                                                            min="0.1"
                                                                                            max="1"
                                                                                            step="0.1"
                                                                                            value={eraseBrushOpacity}
                                                                                            onChange={(e) => setEraseBrushOpacity(Number(e.target.value))}
                                                                                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                                                                                            style={{
                                                                                                background: `linear-gradient(to right, #6a7bd1 0%, #6a7bd1 ${eraseBrushOpacity * 100}%, rgba(255,255,255,0.2) ${eraseBrushOpacity * 100}%, rgba(255,255,255,0.2) 100%)`
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </div>
                                    )}

                                    {shapeOverlays.length > 0 && (
                                        <div className="border-b border-white/10 last:border-b-0">
                                            <button
                                                type="button"
                                                onClick={() => setShowShapeLayers((value) => !value)}
                                                aria-expanded={showShapeLayers}
                                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/5"
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Shapes className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">Shapes</span>
                                                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                                                        {shapeOverlays.length}
                                                    </span>
                                                </span>
                                                {showShapeLayers ? (
                                                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                                                ) : (
                                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                            </button>

                                            {showShapeLayers && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    transition={{ duration: 0.18 }}
                                                    className="max-h-72 overflow-y-auto px-2 pb-2"
                                                >
                                                    {shapeOverlays.map((shape, index) => {
                                                        const isActiveShapeLayer = selectedShapeIndex === index;
                                                        const selectShapeLayer = () => {
                                                            setSelectedShapeIndex(index);
                                                            setSelectedImageIndex(-1);
                                                            setIsImageEraseMode(false);
                                                            setImageEraseTargetIndex(-1);
                                                        };

                                                        return (
                                                            <motion.div
                                                                key={shape.id}
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-pressed={isActiveShapeLayer}
                                                                className={`border-t border-white/10 first:border-t-0 px-1.5 transition-colors ${
                                                                    isActiveShapeLayer
                                                                        ? 'bg-[#0f0f0f]'
                                                                        : 'hover:bg-white/5'
                                                                }`}
                                                                onClick={selectShapeLayer}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        selectShapeLayer();
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2 py-2">
                                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10">
                                                                            <Shapes className="h-4 w-4 text-white/60" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-xs capitalize text-white/80">
                                                                                {shape.type.replace('-', ' ')}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-[11px] text-white/40">
                                                                                <span>
                                                                                    {Math.round(shape.width)}×{Math.round(shape.height)}px
                                                                                </span>
                                                                                <span>Stroke {shape.strokeWidth}px</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <motion.button
                                                                        type="button"
                                                                        whileTap={{ scale: 0.9 }}
                                                                        aria-label={`Delete ${shape.type.replace('-', ' ')}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeShape(index);
                                                                        }}
                                                                        className="shrink-0 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </motion.button>
                                                                </div>

                                                                {isActiveShapeLayer && (
                                                                    <div
                                                                        className="grid grid-cols-2 gap-2 border-t border-white/10 pb-2 pt-2"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div>
                                                                            <label className="mb-0.5 block text-[10px] text-white/50">Stroke</label>
                                                                            <input
                                                                                type="color"
                                                                                value={shape.strokeColor}
                                                                                onChange={(e) =>
                                                                                    updateShape(index, { strokeColor: e.target.value })
                                                                                }
                                                                                className="h-7 w-full cursor-pointer rounded border border-white/20"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="mb-0.5 block text-[10px] text-white/50">Fill</label>
                                                                            <input
                                                                                type="color"
                                                                                value={shape.fillColor}
                                                                                onChange={(e) =>
                                                                                    updateShape(index, { fillColor: e.target.value })
                                                                                }
                                                                                className="h-7 w-full cursor-pointer rounded border border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                                                disabled={shape.type === 'line'}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <label className="mb-0.5 block text-[10px] text-white/50">
                                                                                Stroke width: {shape.strokeWidth}px
                                                                            </label>
                                                                            <input
                                                                                type="range"
                                                                                min="1"
                                                                                max="24"
                                                                                value={shape.strokeWidth}
                                                                                onChange={(e) =>
                                                                                    updateShape(index, {
                                                                                        strokeWidth: Number(e.target.value),
                                                                                    })
                                                                                }
                                                                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                                                                            />
                                                                        </div>
                                                                        {shape.type !== 'line' && (
                                                                            <label className="col-span-2 flex cursor-pointer items-center gap-2 text-xs text-white/70">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={shape.filled}
                                                                                    onChange={(e) =>
                                                                                        updateShape(index, { filled: e.target.checked })
                                                                                    }
                                                                                    className="rounded"
                                                                                />
                                                                                Filled shape
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    <div className="flex w-full space-x-2 mt-4">
                        {hasAnimatedExportOverlays ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: 0.5 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={isExporting || hasPendingAnimatedOverlays}
                                        className="px-4 py-2 w-full bg-[#6a7bd1] hover:bg-[#6975b3] font-medium border border-white/20 text-sm text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                    >
                                        {isExporting || hasPendingAnimatedOverlays ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="h-4 w-4" />
                                        )}
                                        {exportButtonLabel}
                                        {!isExporting && !hasPendingAnimatedOverlays && <ChevronDown className="h-3.5 w-3.5" />}
                                    </motion.button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-black border-white/20 text-white min-w-44">
                                    <DropdownMenuLabel className="text-xs text-white/50">Export</DropdownMenuLabel>
                                    <DropdownMenuItem
                                        disabled={isExporting || hasPendingAnimatedOverlays}
                                        onSelect={(event) => {
                                            event.preventDefault();
                                            downloadMeme();
                                        }}
                                        className="cursor-pointer focus:bg-white/10 focus:text-white"
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        Image PNG
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem
                                        disabled={isExporting || hasPendingAnimatedOverlays}
                                        onSelect={(event) => {
                                            event.preventDefault();
                                            downloadAnimatedMeme();
                                        }}
                                        className="cursor-pointer focus:bg-white/10 focus:text-white"
                                    >
                                        <Video className="h-4 w-4" />
                                        {animatedExportLabel}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.5 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={isExporting}
                                className="px-4 py-2 w-full bg-[#6a7bd1] hover:bg-[#6975b3] font-medium border border-white/20 text-sm text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                onClick={downloadMeme}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    {isExporting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {exportButtonLabel}
                                </span>
                            </motion.button>
                        )}
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.5 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isExporting || hasPendingAnimatedOverlays}
                            className="px-4 py-2 w-full bg-transparent text-black hover:bg-gray-100/50 dark:hover:bg-white/5 font-medium  border border-[#6a7bd1] text-sm dark:text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={copyMeme}
                        >
                            <span className="flex items-center justify-center gap-1.5">
                                {isExporting && exportStatus === 'Copying...' && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {exportStatus === 'Copying...' ? exportStatus : 'Copy'}
                            </span>
                        </motion.button>
                    </div>
                    </div>
                </motion.div>
            </div>
            </motion.section>
        </>
    );
}
