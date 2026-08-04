"use client";

import {
  ChangeEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  Maximize,
  Minimize,
  Pause,
  Play,
  Plus,
  RotateCw,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { VideoProjectV1, VideoTextLayer } from "@/types/videoProject";
import {
  VIDEO_FILTER_PRESETS,
  VIDEO_TEXT_FONT_OPTIONS,
  VIDEO_TEXT_STYLE_PRESETS,
  applyVideoTextStylePreset,
  createVideoProject,
  createVideoTextLayer,
} from "@/lib/video/project";
import {
  renderVideoProjectFrame,
  recordVideoProject,
  VIDEO_EXPORT_MAX_UPLOAD_BYTES,
} from "@/lib/video/export";
import {
  buildCloudinaryMp4Url,
  downloadRemoteUrl,
  uploadVideoCaptureToCloudinary,
  waitForCloudinaryMp4,
} from "@/lib/cloudinaryVideoExport";
import { downloadBlob } from "@/lib/canvasExport";
import {
  validateVideoFile,
  validateVideoMetadata,
} from "@/lib/video/validation";

type TransformState =
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      kind: "resize";
      id: string;
      startX: number;
      startY: number;
      originWidth: number;
      originHeight: number;
      originX: number;
      originY: number;
    }
  | { kind: "rotate"; id: string; centerX: number; centerY: number };
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const [project, setProject] = useState<VideoProjectV1 | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [transforming, setTransforming] = useState<TransformState | null>(null);
  const selectedLayer =
    project?.layers.find((layer) => layer.id === selectedLayerId) ?? null;

  const render = useCallback(() => {
    const video = videoRef.current;
    if (
      video &&
      canvasRef.current &&
      project &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    )
      renderVideoProjectFrame(
        canvasRef.current,
        video,
        project,
        video.currentTime * 1000,
      );
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
      if (typeof video.requestVideoFrameCallback === "function") {
        frameId = video.requestVideoFrameCallback(() => {
          draw();
          if (!video.paused && !video.ended) scheduleDraw();
        });
      } else {
        const tick = () => {
          draw();
          if (!video.paused && !video.ended)
            animationFrameId = requestAnimationFrame(tick);
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
  useEffect(
    () => () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    },
    [],
  );
  const updateProject = (change: (current: VideoProjectV1) => VideoProjectV1) =>
    setProject((current) => (current ? change(current) : current));
  const updateLayer = (
    id: string,
    change: (layer: VideoTextLayer) => VideoTextLayer,
  ) =>
    updateProject((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === id ? change(layer) : layer,
      ),
    }));
  const updateSelected = (
    change: (layer: VideoTextLayer) => VideoTextLayer,
  ) => {
    if (selectedLayer) updateLayer(selectedLayer.id, change);
  };

  const loadFile = async (file: File) => {
    const validation = validateVideoFile(file);
    if (!validation.ok) return toast.error(validation.message);
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve();
        probe.onerror = () =>
          reject(new Error("This video could not be read by your browser."));
      });
      const metadata = validateVideoMetadata({
        duration: probe.duration,
        width: probe.videoWidth,
        height: probe.videoHeight,
      });
      if (!metadata.ok) throw new Error(metadata.message);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = url;
      const next = createVideoProject({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        mimeType: file.type,
        durationMs: Math.round(probe.duration * 1000),
        width: probe.videoWidth,
        height: probe.videoHeight,
        rotation: 0,
      });
      setProject(next);
      setSelectedLayerId(next.layers[0].id);
      setCurrentTime(0);
    } catch (error) {
      URL.revokeObjectURL(url);
      toast.error(
        error instanceof Error ? error.message : "Could not load this video.",
      );
    } finally {
      probe.remove();
    }
  };
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
    event.target.value = "";
  };
  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        toast.error("Playback needs a click in this browser.");
      }
    } else {
      video.pause();
      setIsPlaying(false);
      render();
    }
  };
  const moveText = (event: PointerEvent<HTMLDivElement>) => {
    if (!transforming || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (transforming.kind === "move")
      updateLayer(transforming.id, (layer) => ({
        ...layer,
        transform: {
          ...layer.transform,
          x: Math.max(
            0,
            Math.min(
              1 - layer.transform.width,
              transforming.originX +
                (event.clientX - transforming.startX) / rect.width,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              1 - layer.transform.height,
              transforming.originY +
                (event.clientY - transforming.startY) / rect.height,
            ),
          ),
        },
      }));
    if (transforming.kind === "resize")
      updateLayer(transforming.id, (layer) => ({
        ...layer,
        transform: {
          ...layer.transform,
          width: Math.max(
            0.08,
            Math.min(
              1 - transforming.originX,
              transforming.originWidth +
                (event.clientX - transforming.startX) / rect.width,
            ),
          ),
          height: Math.max(
            0.06,
            Math.min(
              1 - transforming.originY,
              transforming.originHeight +
                (event.clientY - transforming.startY) / rect.height,
            ),
          ),
        },
      }));
    if (transforming.kind === "rotate")
      updateLayer(transforming.id, (layer) => ({
        ...layer,
        transform: {
          ...layer.transform,
          rotation: Math.round(
            (Math.atan2(
              event.clientY - transforming.centerY,
              event.clientX - transforming.centerX,
            ) *
              180) /
              Math.PI +
              90,
          ),
        },
      }));
  };
  const addText = () => {
    if (!project) return;
    const layer = createVideoTextLayer(project.layers.length);
    updateProject((current) => ({
      ...current,
      layers: [...current.layers, layer],
    }));
    setSelectedLayerId(layer.id);
  };
  const deleteSelected = () => {
    if (!project || !selectedLayer) return;
    const index = project.layers.findIndex(
      (layer) => layer.id === selectedLayer.id,
    );
    const layers = project.layers.filter(
      (layer) => layer.id !== selectedLayer.id,
    );
    updateProject((current) => ({ ...current, layers }));
    setSelectedLayerId(layers[Math.min(index, layers.length - 1)]?.id ?? null);
  };
  const exportVideo = async () => {
    if (!videoRef.current || !project || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const blob = await recordVideoProject(videoRef.current, project, {
        onProgress: setExportProgress,
      });
      if (blob.size > VIDEO_EXPORT_MAX_UPLOAD_BYTES)
        throw new Error("The rendered video is too large. Try a shorter clip.");
      if (blob.type.startsWith("video/mp4")) {
        downloadBlob(blob, "memehub-video.mp4");
      } else {
        const upload = await uploadVideoCaptureToCloudinary(blob);
        const url = buildCloudinaryMp4Url(upload);
        await waitForCloudinaryMp4(url);
        downloadRemoteUrl(
          buildCloudinaryMp4Url(upload, {
            attachment: true,
            filename: "memehub-video",
          }),
          "memehub-video.mp4",
        );
      }
      toast.success("Your MP4 is ready.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Video export failed.",
      );
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };
  useEffect(() => {
    const removeWithDelete = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !project ||
        !selectedLayerId ||
        (target instanceof Element &&
          target.matches('input, textarea, select, [contenteditable="true"]'))
      )
        return;
      if (event.key === "Delete") {
        event.preventDefault();
        const index = project.layers.findIndex(
          (layer) => layer.id === selectedLayerId,
        );
        const layers = project.layers.filter(
          (layer) => layer.id !== selectedLayerId,
        );
        setProject((current) => (current ? { ...current, layers } : current));
        setSelectedLayerId(
          layers[Math.min(index, layers.length - 1)]?.id ?? null,
        );
      }
    };
    window.addEventListener("keydown", removeWithDelete);
    return () => window.removeEventListener("keydown", removeWithDelete);
  }, [project, selectedLayerId]);
  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (isFullscreen || document.fullscreenElement === stageRef.current) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await stageRef.current?.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      toast.error("Fullscreen preview is not available in this browser.");
    }
  };
  const filterId = project?.effects[0]?.preset ?? "original";

  return (
    <section className="video-editor-shell">
      <div className="video-editor-body">
        <aside className="video-editor-left-panel">
          <h2>Filters</h2>
          <div className="video-editor-filter-grid">
            {VIDEO_FILTER_PRESETS.map((filter) => (
              <button
                key={filter.id}
                disabled={!project}
                onClick={() =>
                  updateProject((current) => ({
                    ...current,
                    effects: [{ kind: "filter", preset: filter.id }],
                  }))
                }
                className={filterId === filter.id ? "selected" : ""}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="video-editor-section-title">
            <h3>Text boxes</h3>
            <button disabled={!project} onClick={addText}>
              <Plus /> Add
            </button>
          </div>
          <div className="video-editor-text-list">
            {project?.layers.map((layer, index) => (
              <button
                key={layer.id}
                onClick={() => setSelectedLayerId(layer.id)}
                className={selectedLayerId === layer.id ? "selected" : ""}
              >
                <Type />
                <span>{layer.text || "Your text"}</span>
                <em>{index + 1}</em>
              </button>
            )) ?? (
              <div>
                <Type />
                <span>Your text</span>
                <em>1</em>
              </div>
            )}
          </div>
          <div className="video-editor-presets">
            <div className="video-editor-section-title">
              <h3>Presets</h3>
            </div>
            <div className="video-editor-preset-grid">
              {VIDEO_TEXT_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  aria-label={preset.label}
                  title={preset.description}
                  disabled={!selectedLayer}
                  onClick={() =>
                    updateSelected((layer) =>
                      applyVideoTextStylePreset(layer, preset.id),
                    )
                  }
                >
                  <strong className={preset.id}>
                    {preset.id === "black-bar"
                      ? "Say less."
                      : preset.id === "meme-outline"
                        ? "NO WAY"
                        : "SERIOUSLY?"}
                  </strong>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <main className="video-editor-stage-area">
          <div className="video-editor-preview-wrap">
            <div
              ref={stageRef}
              className={`video-editor-preview ${project ? "has-video" : ""}`}
              style={
                project
                  ? {
                      aspectRatio: `${project.source.width} / ${project.source.height}`,
                    }
                  : undefined
              }
              onPointerDown={(event) => {
                if (isFullscreen && event.target === event.currentTarget)
                  void toggleFullscreen();
              }}
              onPointerMove={moveText}
              onPointerUp={() => setTransforming(null)}
              onPointerLeave={() => setTransforming(null)}
            >
              {project ? (
                <>
                  <video
                    ref={videoRef}
                    src={sourceUrlRef.current ?? undefined}
                    playsInline
                    className="hidden"
                    onLoadedMetadata={(event) => {
                      event.currentTarget.currentTime = Math.min(
                        0.001,
                        event.currentTarget.duration,
                      );
                    }}
                    onLoadedData={render}
                    onSeeked={render}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                  />
                  <canvas
                    ref={canvasRef}
                    className="video-editor-canvas"
                    aria-label="Video preview"
                    onPointerDown={() => setSelectedLayerId(null)}
                  />
                  {isFullscreen && (
                    <button
                      className="video-editor-fullscreen-exit"
                      aria-label="Exit fullscreen preview"
                      onClick={() => void toggleFullscreen()}
                    >
                      <Minimize /> Exit fullscreen
                    </button>
                  )}
                  {project.layers.map((layer) => (
                    <div
                      key={layer.id}
                      style={{
                        left: `${layer.transform.x * 100}%`,
                        top: `${layer.transform.y * 100}%`,
                        width: `${layer.transform.width * 100}%`,
                        height: `${layer.transform.height * 100}%`,
                        transform: `rotate(${layer.transform.rotation}deg)`,
                      }}
                      className={`video-editor-text-box ${selectedLayerId === layer.id ? "selected" : ""}`}
                    >
                      <button
                        aria-label="Move text box"
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                          setSelectedLayerId(layer.id);
                          setTransforming({
                            kind: "move",
                            id: layer.id,
                            startX: event.clientX,
                            startY: event.clientY,
                            originX: layer.transform.x,
                            originY: layer.transform.y,
                          });
                        }}
                      />
                      {selectedLayerId === layer.id && (
                        <>
                          <button
                            aria-label="Resize text box"
                            className="video-editor-resize-handle"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setTransforming({
                                kind: "resize",
                                id: layer.id,
                                startX: event.clientX,
                                startY: event.clientY,
                                originX: layer.transform.x,
                                originY: layer.transform.y,
                                originWidth: layer.transform.width,
                                originHeight: layer.transform.height,
                              });
                            }}
                          />
                          <button
                            aria-label="Rotate text box"
                            className="video-editor-rotate-handle"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              const rect =
                                stageRef.current?.getBoundingClientRect();
                              if (rect)
                                setTransforming({
                                  kind: "rotate",
                                  id: layer.id,
                                  centerX:
                                    rect.left +
                                    (layer.transform.x +
                                      layer.transform.width / 2) *
                                      rect.width,
                                  centerY:
                                    rect.top +
                                    (layer.transform.y +
                                      layer.transform.height / 2) *
                                      rect.height,
                                });
                            }}
                          >
                            <RotateCw />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <label role="button" className="video-editor-upload-empty">
                  <Upload />
                  <strong>Upload video</strong>
                  <span>MP4, WebM, or MOV · up to 30 seconds</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={onUpload}
                  />
                </label>
              )}
            </div>
            <div className="video-editor-player">
              <button
                disabled={!project}
                onClick={() => void togglePlayback()}
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? <Pause /> : <Play />}
              </button>
              <input
                aria-label="Video progress"
                disabled={!project}
                type="range"
                min="0"
                max={project ? project.source.durationMs / 1000 : 1}
                value={currentTime}
                onChange={(event) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Number(event.target.value);
                    setCurrentTime(Number(event.target.value));
                    render();
                  }
                }}
              />
              <span>
                {formatTime(currentTime)} /{" "}
                {formatTime(project ? project.source.durationMs / 1000 : 12)}
              </span>
              <button
                disabled={!project}
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize /> : <Maximize />}
              </button>
            </div>
          </div>
        </main>
        <aside className="video-editor-right-panel">
          <div className="flex items-center justify-between">
            <h2>Edit text</h2>
            <button
              aria-label="Close edit text"
              onClick={() => setSelectedLayerId(null)}
            >
              <X />
            </button>
          </div>
          <label>
            Content
            <textarea
              aria-label="Text content"
              disabled={!selectedLayer}
              value={selectedLayer?.text ?? ""}
              onChange={(event) =>
                updateSelected((layer) => ({
                  ...layer,
                  text: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-5">
            <label>
              Font
              <select
                disabled={!selectedLayer}
                value={selectedLayer?.style.fontFamily ?? "Impact"}
                onChange={(event) =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: { ...layer.style, fontFamily: event.target.value },
                  }))
                }
              >
                {VIDEO_TEXT_FONT_OPTIONS.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
            <label>
              Weight
              <select
                disabled={!selectedLayer}
                value={selectedLayer?.style.fontWeight ?? "700"}
                onChange={(event) =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: { ...layer.style, fontWeight: event.target.value },
                  }))
                }
              >
                {["400", "500", "600", "700", "800", "900"].map((weight) => (
                  <option key={weight}>{weight}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="video-editor-slider video-editor-font-size">
            <span>Aa</span>
            <input
              aria-label="Font size"
              disabled={!selectedLayer}
              type="range"
              min="0.02"
              max="0.2"
              step="0.005"
              value={selectedLayer?.style.fontSize ?? 0.075}
              onChange={(event) =>
                updateSelected((layer) => ({
                  ...layer,
                  style: { ...layer.style, fontSize: Number(event.target.value) },
                }))
              }
            />
            <output>{Math.round((selectedLayer?.style.fontSize ?? 0.075) * 100)}%</output>
          </div>
          <div className="video-editor-toolbar">
            <input
              aria-label="Text color"
              disabled={!selectedLayer}
              type="color"
              value={selectedLayer?.style.color ?? "#ffffff"}
              onChange={(event) =>
                updateSelected((layer) => ({
                  ...layer,
                  style: { ...layer.style, color: event.target.value },
                }))
              }
            />
            {(
              [
                ["left", AlignLeft, "Align left"],
                ["center", AlignCenter, "Align center"],
                ["right", AlignRight, "Align right"],
              ] as const
            ).map(([alignment, Icon, label]) => (
              <button
                key={alignment}
                aria-label={label}
                aria-pressed={selectedLayer?.style.textAlign === alignment}
                disabled={!selectedLayer}
                className={
                  selectedLayer?.style.textAlign === alignment ? "active" : ""
                }
                onClick={() =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: { ...layer.style, textAlign: alignment },
                  }))
                }
              >
                <Icon />
              </button>
            ))}
            {(
              [
                ["uppercase", "AA", "Uppercase text"],
                ["lowercase", "aa", "Lowercase text"],
                ["normal", "Aa", "Normal case text"],
              ] as const
            ).map(([textCase, text, label]) => (
              <button
                key={textCase}
                aria-label={label}
                aria-pressed={selectedLayer?.style.textCase === textCase}
                disabled={!selectedLayer}
                className={
                  selectedLayer?.style.textCase === textCase ? "active" : ""
                }
                onClick={() =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: { ...layer.style, textCase },
                  }))
                }
              >
                {text}
              </button>
            ))}
          </div>
          <div className="video-editor-slider">
            <span>↹</span>
            <input
              aria-label="Letter spacing"
              disabled={!selectedLayer}
              type="range"
              min="-0.04"
              max="0.16"
              step="0.01"
              value={selectedLayer?.style.letterSpacing ?? 0}
              onChange={(event) =>
                updateSelected((layer) => ({
                  ...layer,
                  style: {
                    ...layer.style,
                    letterSpacing: Number(event.target.value),
                  },
                }))
              }
            />
            <output>
              {Math.round((selectedLayer?.style.letterSpacing ?? 0) * 100)}%
            </output>
          </div>
          <div className="video-editor-style">
            <h3>Style</h3>
            <div>
              <span>Outline</span>
              <button
                aria-label="Toggle outline"
                aria-pressed={(selectedLayer?.style.outlineWidth ?? 0) > 0}
                disabled={!selectedLayer}
                className={`video-editor-toggle ${(selectedLayer?.style.outlineWidth ?? 0) > 0 ? "on" : ""}`}
                onClick={() =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      outlineWidth: layer.style.outlineWidth > 0 ? 0 : 0.008,
                    },
                  }))
                }
              />
              <input
                aria-label="Outline width"
                type="range"
                min="0"
                max="20"
                disabled={
                  !selectedLayer ||
                  (selectedLayer?.style.outlineWidth ?? 0) === 0
                }
                value={(selectedLayer?.style.outlineWidth ?? 0) * 1000}
                onChange={(event) =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      outlineWidth: Number(event.target.value) / 1000,
                    },
                  }))
                }
              />
              <output>
                {Math.round((selectedLayer?.style.outlineWidth ?? 0) * 1000)}px
              </output>
            </div>
            <div>
              <span>Shadow</span>
              <button
                aria-label="Toggle shadow"
                aria-pressed={(selectedLayer?.style.shadow.blur ?? 0) > 0}
                disabled={!selectedLayer}
                className={`video-editor-toggle ${(selectedLayer?.style.shadow.blur ?? 0) > 0 ? "on" : ""}`}
                onClick={() =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      shadow: {
                        ...layer.style.shadow,
                        blur: layer.style.shadow.blur > 0 ? 0 : 0.012,
                      },
                    },
                  }))
                }
              />
              <input
                aria-label="Shadow blur"
                type="range"
                min="0"
                max="30"
                disabled={
                  !selectedLayer ||
                  (selectedLayer?.style.shadow.blur ?? 0) === 0
                }
                value={(selectedLayer?.style.shadow.blur ?? 0) * 1000}
                onChange={(event) =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      shadow: {
                        ...layer.style.shadow,
                        blur: Number(event.target.value) / 1000,
                      },
                    },
                  }))
                }
              />
              <output>
                {Math.round((selectedLayer?.style.shadow.blur ?? 0) * 1000)}px
              </output>
            </div>
            <div>
              <span>Background</span>
              <button
                aria-label="Toggle background"
                aria-pressed={
                  selectedLayer?.style.backgroundColor !== "transparent"
                }
                disabled={!selectedLayer}
                className={`video-editor-toggle ${selectedLayer?.style.backgroundColor !== "transparent" ? "on" : ""}`}
                onClick={() =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      backgroundColor:
                        layer.style.backgroundColor === "transparent"
                          ? "rgba(0, 0, 0, 0.4)"
                          : "transparent",
                    },
                  }))
                }
              />
              <input
                aria-label="Background opacity"
                type="range"
                min="0"
                max="100"
                disabled={
                  !selectedLayer ||
                  selectedLayer?.style.backgroundColor === "transparent"
                }
                value={
                  selectedLayer?.style.backgroundColor === "transparent"
                    ? 0
                    : 40
                }
                onChange={(event) =>
                  updateSelected((layer) => ({
                    ...layer,
                    style: {
                      ...layer.style,
                      backgroundColor: `rgba(0, 0, 0, ${Number(event.target.value) / 100})`,
                    },
                  }))
                }
              />
              <output>
                {selectedLayer?.style.backgroundColor === "transparent"
                  ? 0
                  : 40}
                %
              </output>
            </div>
          </div>
          <button
            className="video-editor-delete"
            disabled={!selectedLayer}
            onClick={deleteSelected}
          >
            <X /> Delete text
          </button>
          <button
            aria-label="Export video"
            className="video-editor-export-action"
            disabled={!project || isExporting}
            onClick={() => void exportVideo()}
          >
            <Download />
            {isExporting
              ? `Exporting ${Math.round(exportProgress * 100)}%`
              : "Export video"}
          </button>
        </aside>
      </div>
    </section>
  );
}
