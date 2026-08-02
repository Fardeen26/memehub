'use client';

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, CircleHelp, Edit3, Grid2X2, Pause, Play, Plus, Redo2, Sparkles, Type, Undo2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoProjectV1, VideoTextLayer } from '@/types/videoProject';
import { VIDEO_FILTER_PRESETS, VIDEO_TEXT_FONT_OPTIONS, VIDEO_TEXT_STYLE_PRESETS, applyVideoTextStylePreset, createVideoProject, createVideoTextLayer } from '@/lib/video/project';
import { renderVideoProjectFrame, recordVideoProject, VIDEO_EXPORT_MAX_UPLOAD_BYTES } from '@/lib/video/export';
import { validateVideoFile, validateVideoMetadata } from '@/lib/video/validation';
import { buildCloudinaryMp4Url, downloadRemoteUrl, uploadVideoCaptureToCloudinary, waitForCloudinaryMp4 } from '@/lib/cloudinaryVideoExport';
import { downloadBlob } from '@/lib/canvasExport';

type DragState = { id: string; startX: number; startY: number; originX: number; originY: number };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function VideoEditor() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const sourceUrlRef = useRef<string | null>(null);
    const [project, setProject] = useState<VideoProjectV1 | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [drag, setDrag] = useState<DragState | null>(null);
    const selectedLayer = project?.layers.find((layer) => layer.id === selectedLayerId) ?? null;

    const render = useCallback(() => {
        const video = videoRef.current;
        if (video && canvasRef.current && project && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) renderVideoProjectFrame(canvasRef.current, video, project, video.currentTime * 1000);
    }, [project]);
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !project) return;
        let frameId: number | null = null;
        let animationFrameId: number | null = null;
        const draw = () => {
            render();
            setCurrentTime(video.currentTime);
        };
        const scheduleDraw = () => {
            if (typeof video.requestVideoFrameCallback === 'function') {
                frameId = video.requestVideoFrameCallback(() => {
                    draw();
                    if (!video.paused && !video.ended) scheduleDraw();
                });
            } else {
                const tick = () => {
                    draw();
                    if (!video.paused && !video.ended) animationFrameId = requestAnimationFrame(tick);
                };
                animationFrameId = requestAnimationFrame(tick);
            }
        };
        draw();
        if (!video.paused) scheduleDraw();
        return () => {
            if (frameId !== null) video.cancelVideoFrameCallback?.(frameId);
            if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, project, render]);
    useEffect(() => () => { if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current); }, []);
    const updateProject = (change: (current: VideoProjectV1) => VideoProjectV1) => setProject((current) => current ? change(current) : current);
    const updateLayer = (id: string, change: (layer: VideoTextLayer) => VideoTextLayer) => updateProject((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === id ? change(layer) : layer) }));
    const updateSelected = (change: (layer: VideoTextLayer) => VideoTextLayer) => { if (selectedLayer) updateLayer(selectedLayer.id, change); };

    const loadFile = async (file: File) => {
        const validation = validateVideoFile(file); if (!validation.ok) return toast.error(validation.message);
        const url = URL.createObjectURL(file); const probe = document.createElement('video'); probe.preload = 'metadata'; probe.src = url;
        try {
            await new Promise<void>((resolve, reject) => { probe.onloadedmetadata = () => resolve(); probe.onerror = () => reject(new Error('This video could not be read by your browser.')); });
            const metadata = validateVideoMetadata({ duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight }); if (!metadata.ok) throw new Error(metadata.message);
            if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current); sourceUrlRef.current = url;
            const next = createVideoProject({ name: file.name, size: file.size, lastModified: file.lastModified, mimeType: file.type, durationMs: Math.round(probe.duration * 1000), width: probe.videoWidth, height: probe.videoHeight, rotation: 0 });
            setProject(next); setSelectedLayerId(next.layers[0].id); setCurrentTime(0);
        } catch (error) { URL.revokeObjectURL(url); toast.error(error instanceof Error ? error.message : 'Could not load this video.'); } finally { probe.remove(); }
    };
    const onUpload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; };
    const togglePlayback = async () => { const video = videoRef.current; if (!video) return; if (video.paused) { try { await video.play(); setIsPlaying(true); } catch { toast.error('Playback needs a click in this browser.'); } } else { video.pause(); setIsPlaying(false); render(); } };
    const moveText = (event: PointerEvent<HTMLDivElement>) => { if (!drag || !stageRef.current) return; const rect = stageRef.current.getBoundingClientRect(); updateLayer(drag.id, (layer) => ({ ...layer, transform: { ...layer.transform, x: Math.max(0, Math.min(1 - layer.transform.width, drag.originX + (event.clientX - drag.startX) / rect.width)), y: Math.max(0, Math.min(1 - layer.transform.height, drag.originY + (event.clientY - drag.startY) / rect.height)) } })); };
    const exportVideo = async () => { if (!videoRef.current || !project || isExporting) return; setIsExporting(true); setExportProgress(0); try { const blob = await recordVideoProject(videoRef.current, project, { onProgress: setExportProgress }); if (blob.size > VIDEO_EXPORT_MAX_UPLOAD_BYTES) throw new Error('The rendered video is too large. Try a shorter clip.'); if (blob.type.startsWith('video/mp4')) downloadBlob(blob, 'memehub-video.mp4'); else { const upload = await uploadVideoCaptureToCloudinary(blob); const url = buildCloudinaryMp4Url(upload); await waitForCloudinaryMp4(url); downloadRemoteUrl(buildCloudinaryMp4Url(upload, { attachment: true, filename: 'memehub-video' }), 'memehub-video.mp4'); } toast.success('Your MP4 is ready.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Video export failed.'); } finally { setIsExporting(false); setExportProgress(0); } };
    const addText = () => { if (!project) return; const layer = createVideoTextLayer(project.layers.length); updateProject((current) => ({ ...current, layers: [...current.layers, layer] })); setSelectedLayerId(layer.id); };
    const filterId = project?.effects[0]?.preset ?? 'original';

    return <section className="video-editor-shell">
        <header className="video-editor-topbar"><div className="flex items-center gap-11"><div className="video-editor-mark">N</div><button className="flex items-center gap-3 text-[17px] font-semibold text-white">{project?.source.name ?? 'Untitled video'}<Edit3 className="h-4 w-4 text-[#abb0bd]" /></button></div><div className="video-editor-center-controls"><span><Undo2 /> <Redo2 /></span><button>100%⌄</button></div><div className="flex items-center gap-6"><button className="text-sm text-white">Save draft</button><button disabled={!project || isExporting} onClick={() => void exportVideo()} className="video-editor-export"><Upload />{isExporting ? `${Math.round(exportProgress * 100)}%` : 'Export'}</button></div></header>
        <div className="video-editor-body"><nav aria-label="Editor tools" className="video-editor-rail"><button><Grid2X2 /><span>Filters</span></button><button className="active"><Type /><span>Text</span></button><button><Grid2X2 /><span>Presets</span></button><div className="mt-auto"><button><CircleHelp /><span>Help</span></button><i>N</i></div></nav>
            <aside className="video-editor-left-panel"><h2>Filters</h2><div className="video-editor-filter-grid">{VIDEO_FILTER_PRESETS.map((filter) => <button key={filter.id} disabled={!project} onClick={() => updateProject((current) => ({ ...current, effects: [{ kind: 'filter', preset: filter.id }] }))} className={filterId === filter.id ? 'selected' : ''}>{filter.label}</button>)}</div><div className="video-editor-section-title"><h3>Text boxes</h3><button disabled={!project} onClick={addText}><Plus /> Add</button></div><div className="video-editor-text-list">{project?.layers.map((layer, index) => <button key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={selectedLayerId === layer.id ? 'selected' : ''}><Type /><span>{layer.text || 'Your text'}</span><em>{index + 1}</em></button>) ?? <div><Type /><span>Your text</span><em>1</em></div>}</div><div className="video-editor-presets"><div className="video-editor-section-title"><h3>Presets</h3><button>View all</button></div><div className="video-editor-preset-grid">{VIDEO_TEXT_STYLE_PRESETS.map((preset) => <button key={preset.id} disabled={!selectedLayer} onClick={() => updateSelected((layer) => applyVideoTextStylePreset(layer, preset.id))}><strong className={preset.id}>{preset.id === 'cinema-caption' ? 'CINEMA CAPTION' : preset.id === 'meme-classic' ? 'MEME CLASSIC' : preset.id === 'pop-caption' ? 'Pop caption' : 'NEON'}</strong><span>{preset.label}</span></button>)}</div></div></aside>
            <main className="video-editor-stage-area"><div className="video-editor-preview-wrap"><div ref={stageRef} className={`video-editor-preview ${project ? 'has-video' : ''}`} onPointerMove={moveText} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>{project ? <><video ref={videoRef} src={sourceUrlRef.current ?? undefined} playsInline className="hidden" onLoadedData={render} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} /><canvas ref={canvasRef} className="video-editor-canvas" aria-label="Video preview" />{project.layers.map((layer) => <button key={layer.id} aria-label="Move text box" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayerId(layer.id); setDrag({ id: layer.id, startX: event.clientX, startY: event.clientY, originX: layer.transform.x, originY: layer.transform.y }); }} style={{ left: `${layer.transform.x * 100}%`, top: `${layer.transform.y * 100}%`, width: `${layer.transform.width * 100}%`, height: `${layer.transform.height * 100}%` }} className={`video-editor-text-box ${selectedLayerId === layer.id ? 'selected' : ''}`} />)}</> : <label role="button" className="video-editor-upload-empty"><Upload /><strong>Upload video</strong><span>MP4, WebM, or MOV · up to 30 seconds</span><input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onUpload} /></label>}</div><div className="video-editor-player"><button disabled={!project} onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause video' : 'Play video'}>{isPlaying ? <Pause /> : <Play />}</button><input aria-label="Video progress" disabled={!project} type="range" min="0" max={project ? project.source.durationMs / 1000 : 1} value={currentTime} onChange={(event) => { if (videoRef.current) { videoRef.current.currentTime = Number(event.target.value); setCurrentTime(Number(event.target.value)); render(); } }} /><span>{formatTime(currentTime)} / {formatTime(project ? project.source.durationMs / 1000 : 12)}</span></div></div><div className="video-editor-tip"><span><CircleHelp /> Tip: Use presets for quick styles</span><button>Explore presets</button></div></main>
            <aside className="video-editor-right-panel"><div className="flex items-center justify-between"><h2>Edit text</h2><button aria-label="Close edit text"><X /></button></div><label>Content<textarea aria-label="Text content" disabled={!selectedLayer} value={selectedLayer?.text ?? 'YOUR TEXT'} onChange={(event) => updateSelected((layer) => ({ ...layer, text: event.target.value }))} /></label><div className="grid grid-cols-2 gap-5"><label>Font<select disabled={!selectedLayer} value={selectedLayer?.style.fontFamily ?? 'Impact'} onChange={(event) => updateSelected((layer) => ({ ...layer, style: { ...layer.style, fontFamily: event.target.value } }))}>{VIDEO_TEXT_FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select></label><label>Weight<select disabled={!selectedLayer} value={selectedLayer?.style.fontWeight ?? '700'} onChange={(event) => updateSelected((layer) => ({ ...layer, style: { ...layer.style, fontWeight: event.target.value } }))}>{['400', '500', '600', '700', '800', '900'].map((weight) => <option key={weight}>{weight}</option>)}</select></label></div><div className="video-editor-toolbar"><input aria-label="Text color" disabled={!selectedLayer} type="color" value={selectedLayer?.style.color ?? '#ffffff'} onChange={(event) => updateSelected((layer) => ({ ...layer, style: { ...layer.style, color: event.target.value } }))} /><button><AlignLeft /></button><button className="active"><AlignCenter /></button><button><AlignRight /></button><button>AA</button><button>aa</button><button>Aa</button></div><div className="video-editor-slider"><span>↹</span><input disabled={!selectedLayer} type="range" min="-0.04" max="0.16" step="0.01" value={selectedLayer?.style.letterSpacing ?? 0} onChange={(event) => updateSelected((layer) => ({ ...layer, style: { ...layer.style, letterSpacing: Number(event.target.value) } }))} /><output>{Math.round((selectedLayer?.style.fontSize ?? .085) * 100)}%</output></div><div className="video-editor-style"><h3>Style</h3>{[['Outline', '8px'], ['Shadow', '12px'], ['Background', '40%']].map(([label, value], index) => <div key={label}><span>{label}</span><i className={index < 2 ? 'on' : ''} /><input type="range" disabled={!selectedLayer || index === 2} value={index === 0 ? (selectedLayer?.style.outlineWidth ?? .008) * 1000 : index === 1 ? (selectedLayer?.style.shadow.blur ?? .012) * 1000 : 40} onChange={(event) => index === 0 ? updateSelected((layer) => ({ ...layer, style: { ...layer.style, outlineWidth: Number(event.target.value) / 1000 } })) : updateSelected((layer) => ({ ...layer, style: { ...layer.style, shadow: { ...layer.style.shadow, blur: Number(event.target.value) / 1000 } } }))} /><output>{value}</output></div>)}</div><div className="video-editor-position"><h3>Position</h3><div><section>{Array.from({ length: 9 }).map((_, index) => <i key={index} className={index === 4 ? 'selected' : ''} />)}</section><span>X <b>{Math.round((selectedLayer?.transform.x ?? .5) * 100)}%</b><br />Y <b>{Math.round((selectedLayer?.transform.y ?? .1) * 100)}%</b></span></div></div><button className="video-editor-duplicate" disabled={!selectedLayer}><Sparkles /> Duplicate text</button><button className="video-editor-delete" disabled={!selectedLayer}><X /> Delete text</button></aside>
        </div>
    </section>;
}
