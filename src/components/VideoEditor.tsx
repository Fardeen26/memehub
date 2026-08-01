'use client';

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Pause, Play, Plus, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoProjectV1, VideoTextLayer } from '@/types/videoProject';
import { VIDEO_FILTER_PRESETS, createVideoProject, createVideoTextLayer } from '@/lib/video/project';
import { renderVideoProjectFrame, recordVideoProject, VIDEO_EXPORT_MAX_UPLOAD_BYTES } from '@/lib/video/export';
import { validateVideoFile, validateVideoMetadata } from '@/lib/video/validation';
import { buildCloudinaryMp4Url, downloadRemoteUrl, uploadVideoCaptureToCloudinary, waitForCloudinaryMp4 } from '@/lib/cloudinaryVideoExport';
import { downloadBlob } from '@/lib/canvasExport';

type DragState = { id: string; startX: number; startY: number; originX: number; originY: number };

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export default function VideoEditor() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const sourceUrlRef = useRef<string | null>(null);
    const [project, setProject] = useState<VideoProjectV1 | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [drag, setDrag] = useState<DragState | null>(null);

    const selectedLayer = project?.layers.find((layer) => layer.id === selectedLayerId) ?? null;

    const render = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && project && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            renderVideoProjectFrame(canvas, video, project, video.currentTime * 1000);
        }
    }, [project]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !project) return;
        let frameId: number | null = null;
        let rafId: number | null = null;
        const draw = () => {
            render();
            setCurrentTime(video.currentTime);
        };
        const schedule = () => {
            if (typeof video.requestVideoFrameCallback === 'function') {
                frameId = video.requestVideoFrameCallback(() => {
                    draw();
                    if (!video.paused && !video.ended) schedule();
                });
            } else {
                const tick = () => {
                    draw();
                    if (!video.paused && !video.ended) rafId = requestAnimationFrame(tick);
                };
                rafId = requestAnimationFrame(tick);
            }
        };
        render();
        if (!video.paused) schedule();
        return () => {
            if (frameId !== null) video.cancelVideoFrameCallback?.(frameId);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [project, render, isPlaying]);

    useEffect(() => () => {
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    }, []);

    const updateProject = (change: (current: VideoProjectV1) => VideoProjectV1) => {
        setProject((current) => current ? change(current) : current);
    };

    const loadFile = async (file: File) => {
        const fileValidation = validateVideoFile(file);
        if (!fileValidation.ok) {
            toast.error(fileValidation.message);
            return;
        }
        const url = URL.createObjectURL(file);
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.src = url;
        try {
            await new Promise<void>((resolve, reject) => {
                probe.onloadedmetadata = () => resolve();
                probe.onerror = () => reject(new Error('This video could not be read by your browser.'));
            });
            const metadataValidation = validateVideoMetadata({
                duration: probe.duration,
                width: probe.videoWidth,
                height: probe.videoHeight,
            });
            if (!metadataValidation.ok) throw new Error(metadataValidation.message);
            if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
            sourceUrlRef.current = url;
            const nextProject = createVideoProject({
                name: file.name,
                size: file.size,
                lastModified: file.lastModified,
                mimeType: file.type,
                durationMs: Math.round(probe.duration * 1000),
                width: probe.videoWidth,
                height: probe.videoHeight,
                rotation: 0,
            });
            setProject(nextProject);
            setSelectedLayerId(nextProject.layers[0].id);
            setCurrentTime(0);
        } catch (error) {
            URL.revokeObjectURL(url);
            toast.error(error instanceof Error ? error.message : 'Could not load this video.');
        } finally {
            probe.remove();
        }
    };

    const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) void loadFile(file);
        event.target.value = '';
    };

    const togglePlayback = async () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            try {
                await video.play();
                setIsPlaying(true);
            } catch {
                toast.error('Playback needs a tap or click in this browser.');
            }
        } else {
            video.pause();
            setIsPlaying(false);
            render();
        }
    };

    const updateLayer = (id: string, change: (layer: VideoTextLayer) => VideoTextLayer) => {
        updateProject((current) => ({
            ...current,
            layers: current.layers.map((layer) => layer.id === id ? change(layer) : layer),
        }));
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!drag || !stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const dx = (event.clientX - drag.startX) / rect.width;
        const dy = (event.clientY - drag.startY) / rect.height;
        updateLayer(drag.id, (layer) => ({
            ...layer,
            transform: {
                ...layer.transform,
                x: Math.max(0, Math.min(1 - layer.transform.width, drag.originX + dx)),
                y: Math.max(0, Math.min(1 - layer.transform.height, drag.originY + dy)),
            },
        }));
    };

    const exportVideo = async () => {
        const video = videoRef.current;
        if (!video || !project || isExporting) return;
        setIsExporting(true);
        setExportProgress(0);
        try {
            video.pause();
            setIsPlaying(false);
            const blob = await recordVideoProject(video, project, { onProgress: setExportProgress });
            if (blob.size > VIDEO_EXPORT_MAX_UPLOAD_BYTES) {
                throw new Error('The rendered video is too large. Try a shorter clip.');
            }
            if (blob.type.startsWith('video/mp4')) {
                downloadBlob(blob, 'memehub-video.mp4');
                toast.success('Your MP4 is ready.');
                return;
            }
            toast.info('Converting your rendered video to MP4…');
            const upload = await uploadVideoCaptureToCloudinary(blob);
            const playbackUrl = buildCloudinaryMp4Url(upload);
            await waitForCloudinaryMp4(playbackUrl);
            downloadRemoteUrl(buildCloudinaryMp4Url(upload, { attachment: true, filename: 'memehub-video' }), 'memehub-video.mp4');
            toast.success('Your MP4 is ready.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Video export failed.');
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    if (!project) {
        return (
            <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#15151c] p-8 text-center shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9eaaf8]">Memehub video editor</p>
                <h1 className="mt-3 text-3xl font-bold text-white">Make a video meme in a few clicks</h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/60">Upload one short clip, add text, choose a filter, and export a share-ready MP4. Your original video stays on this device.</p>
                <label className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#6a7bd1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#7889e8]">
                    <Upload className="h-4 w-4" /> Upload video
                    <input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onUpload} />
                </label>
                <p className="mt-4 text-xs text-white/40">MP4, WebM, or MOV · up to 30 seconds · 1080p · 100 MB</p>
            </section>
        );
    }

    return (
        <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-white/10 bg-[#15151c] p-3 shadow-2xl">
                <div ref={stageRef} className="relative mx-auto overflow-hidden rounded-xl bg-black" onPointerMove={handlePointerMove} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
                    <video ref={videoRef} src={sourceUrlRef.current ?? undefined} playsInline className="hidden" onLoadedData={render} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />
                    <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Video preview" />
                    {project.layers.map((layer) => (
                        <button key={layer.id} type="button" aria-label="Move text box" onClick={() => setSelectedLayerId(layer.id)} onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setSelectedLayerId(layer.id);
                            setDrag({ id: layer.id, startX: event.clientX, startY: event.clientY, originX: layer.transform.x, originY: layer.transform.y });
                        }} style={{ left: `${layer.transform.x * 100}%`, top: `${layer.transform.y * 100}%`, width: `${layer.transform.width * 100}%`, height: `${layer.transform.height * 100}%` }} className={`absolute cursor-move rounded border-2 ${selectedLayerId === layer.id ? 'border-[#9eaaf8]' : 'border-transparent'} bg-transparent focus:outline-none`} />
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <button type="button" onClick={() => void togglePlayback()} className="rounded-md border border-white/15 p-2 text-white hover:bg-white/10" aria-label={isPlaying ? 'Pause video' : 'Play video'}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                    <input aria-label="Video progress" type="range" min="0" max={project.source.durationMs / 1000} step="0.01" value={currentTime} onChange={(event) => { const video = videoRef.current; if (video) { video.currentTime = Number(event.target.value); setCurrentTime(video.currentTime); render(); } }} className="w-full accent-[#7f8ff0]" />
                    <span className="whitespace-nowrap text-xs text-white/65">{formatTime(currentTime)} / {formatTime(project.source.durationMs / 1000)}</span>
                </div>
            </div>

            <aside className="space-y-5 rounded-2xl border border-white/10 bg-[#15151c] p-4 shadow-2xl">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Video tools</p><label className="cursor-pointer text-xs text-[#aeb8ff] hover:text-white">Replace<input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onUpload} /></label></div>
                <div><p className="mb-2 text-xs font-medium text-white/60">Filter</p><div className="grid grid-cols-2 gap-2">{VIDEO_FILTER_PRESETS.map((filter) => { const selected = project.effects[0]?.preset === filter.id; return <button key={filter.id} type="button" onClick={() => updateProject((current) => ({ ...current, effects: [{ kind: 'filter', preset: filter.id }] }))} className={`rounded-md border px-2 py-2 text-xs ${selected ? 'border-[#7f8ff0] bg-[#6a7bd1]/20 text-white' : 'border-white/10 text-white/65 hover:bg-white/5'}`}>{filter.label}</button>; })}</div></div>
                <div className="border-t border-white/10 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium text-white/60">Text boxes</p><button type="button" onClick={() => { const layer = createVideoTextLayer(project.layers.length); updateProject((current) => ({ ...current, layers: [...current.layers, layer] })); setSelectedLayerId(layer.id); }} className="inline-flex items-center gap-1 text-xs text-[#aeb8ff]"><Plus className="h-3.5 w-3.5" /> Add</button></div>{project.layers.map((layer, index) => <button type="button" key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${selectedLayerId === layer.id ? 'bg-[#6a7bd1]/20 text-white' : 'text-white/65 hover:bg-white/5'}`}><span className="truncate">{layer.text || `Text ${index + 1}`}</span><span className="text-white/35">{index + 1}</span></button>)}</div>
                {selectedLayer && <div className="space-y-3 border-t border-white/10 pt-4"><div className="flex justify-between"><p className="text-xs font-medium text-white/60">Selected text</p><button type="button" onClick={() => { updateProject((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== selectedLayer.id) })); setSelectedLayerId(project.layers.find((layer) => layer.id !== selectedLayer.id)?.id ?? null); }} className="text-white/55 hover:text-red-300" aria-label="Delete text box"><X className="h-4 w-4" /></button></div><textarea value={selectedLayer.text} onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, text: event.target.value }))} className="min-h-20 w-full rounded-md border border-white/15 bg-black/25 p-2 text-sm text-white" aria-label="Text content" /><div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-white/55">Color<input type="color" value={selectedLayer.style.color} onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, style: { ...layer.style, color: event.target.value } }))} className="mt-1 block h-8 w-full" /></label><label className="text-[11px] text-white/55">Font<select value={selectedLayer.style.fontFamily} onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, style: { ...layer.style, fontFamily: event.target.value } }))} className="mt-1 h-8 w-full rounded border border-white/15 bg-black/25 px-1 text-xs text-white"><option>Impact</option><option>Arial</option><option>Anton</option><option>Inter</option></select></label></div><label className="block text-[11px] text-white/55">Text size<input type="range" min="0.035" max="0.16" step="0.005" value={selectedLayer.style.fontSize} onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({ ...layer, style: { ...layer.style, fontSize: Number(event.target.value) } }))} className="mt-1 w-full accent-[#7f8ff0]" /></label></div>}
                <label className="flex cursor-pointer items-center justify-between border-t border-white/10 pt-4 text-xs text-white/75"><span className="inline-flex items-center gap-2">{project.audio.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Keep original sound</span><input type="checkbox" checked={project.audio.enabled} onChange={(event) => updateProject((current) => ({ ...current, audio: { enabled: event.target.checked } }))} className="accent-[#7f8ff0]" /></label>
                <button type="button" disabled={isExporting} onClick={() => void exportVideo()} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#6a7bd1] text-sm font-semibold text-white hover:bg-[#7889e8] disabled:opacity-50">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isExporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export MP4'}</button>
                <p className="text-[10px] leading-relaxed text-white/40">Your original stays in this browser. If your browser records WebM, Memehub temporarily sends only the rendered export to Cloudinary for MP4 conversion.</p>
            </aside>
        </section>
    );
}
