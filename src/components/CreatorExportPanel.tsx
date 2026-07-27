'use client';

import { useMemo, useState } from 'react';
import { Copy, Download, Loader2, Maximize, Minimize } from 'lucide-react';
import {
    CREATOR_EXPORT_PROFILES,
    STILL_IMAGE_FORMATS,
    type CreatorExportProfileId,
    type ImagePlacementMode,
    type StillImageFormatId,
} from '@/lib/creatorExport';

export type CreatorStillExportRequest = {
    profileId: CreatorExportProfileId;
    format: StillImageFormatId;
    placement: ImagePlacementMode;
    quality: number;
    backgroundColor: string;
};

type CreatorExportPanelProps = {
    isExporting: boolean;
    onExport: (request: CreatorStillExportRequest) => void | Promise<void>;
    onCopy: () => void | Promise<void>;
    hasAnimatedMedia?: boolean;
    animatedLabel?: string;
    onExportAnimated?: () => void | Promise<void>;
};

export default function CreatorExportPanel({
    isExporting,
    onExport,
    onCopy,
    hasAnimatedMedia = false,
    animatedLabel = 'Animated meme',
    onExportAnimated,
}: CreatorExportPanelProps) {
    const [profileId, setProfileId] =
        useState<CreatorExportProfileId>('original');
    const [format, setFormat] = useState<StillImageFormatId>('png');
    const [placement, setPlacement] =
        useState<ImagePlacementMode>('fit');
    const [qualityPercent, setQualityPercent] = useState(90);
    const [backgroundColor, setBackgroundColor] = useState('#111111');

    const selectedFormat = STILL_IMAGE_FORMATS[format];
    const exportButtonLabel = useMemo(
        () =>
            `Export ${profileId.replaceAll('-', ' ')} ${selectedFormat.label}`,
        [profileId, selectedFormat.label]
    );

    const selectProfile = (nextProfileId: CreatorExportProfileId) => {
        const profile = CREATOR_EXPORT_PROFILES[nextProfileId];
        setProfileId(nextProfileId);
        setFormat(profile.defaultFormat);
        setPlacement(profile.defaultPlacement);
        const profileQuality =
            'defaultQuality' in profile
                ? profile.defaultQuality
                : undefined;
        const selectedDefaultFormat =
            STILL_IMAGE_FORMATS[profile.defaultFormat];
        const formatQuality =
            'defaultQuality' in selectedDefaultFormat
                ? selectedDefaultFormat.defaultQuality
                : undefined;
        setQualityPercent(
            Math.round(
                (profileQuality ?? formatQuality ?? 0.9) * 100
            )
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs font-semibold text-white">
                    Publish-ready size
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">
                    Fit is the safe default, so a platform preset never crops
                    your joke without permission.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {Object.values(CREATOR_EXPORT_PROFILES).map((profile) => (
                    <label
                        key={profile.id}
                        className={`cursor-pointer rounded-lg border px-2.5 py-2 transition-colors ${
                            profileId === profile.id
                                ? 'border-[#7f8ff0] bg-[#6a7bd1]/15'
                                : 'border-white/10 bg-black/25 hover:border-white/20'
                        }`}
                    >
                        <input
                            type="radio"
                            name="creator-export-profile"
                            aria-label={profile.label}
                            checked={profileId === profile.id}
                            onChange={() =>
                                selectProfile(
                                    profile.id as CreatorExportProfileId
                                )
                            }
                            className="sr-only"
                        />
                        <span className="block text-[11px] font-medium text-white/85">
                            {profile.label}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-snug text-white/35">
                            {profile.description}
                        </span>
                    </label>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[10px] text-white/55">
                    <span>Format</span>
                    <select
                        aria-label="Image format"
                        value={format}
                        onChange={(event) =>
                            setFormat(
                                event.target.value as StillImageFormatId
                            )
                        }
                        className="h-9 w-full rounded-md border border-white/15 bg-[#0b0c12] px-2 text-xs text-white"
                    >
                        {Object.values(STILL_IMAGE_FORMATS).map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-1 text-[10px] text-white/55">
                    <span>Padding color</span>
                    <span className="flex h-9 items-center gap-2 rounded-md border border-white/15 bg-[#0b0c12] px-2">
                        <input
                            type="color"
                            aria-label="Padding color"
                            value={backgroundColor}
                            onChange={(event) =>
                                setBackgroundColor(event.target.value)
                            }
                            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                        />
                        <span className="font-mono text-[10px] text-white/65">
                            {backgroundColor}
                        </span>
                    </span>
                </label>
            </div>

            <fieldset>
                <legend className="mb-1.5 text-[10px] text-white/55">
                    Place original meme
                </legend>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border border-white/15">
                    <label
                        className={`flex cursor-pointer items-center justify-center gap-1.5 px-2 py-2 text-[10px] ${
                            placement === 'fit'
                                ? 'bg-[#6a7bd1] text-white'
                                : 'bg-black/25 text-white/55'
                        }`}
                    >
                        <input
                            type="radio"
                            name="creator-export-placement"
                            aria-label="Fit entire meme"
                            checked={placement === 'fit'}
                            onChange={() => setPlacement('fit')}
                            className="sr-only"
                        />
                        <Minimize className="h-3.5 w-3.5" />
                        Fit · no crop
                    </label>
                    <label
                        className={`flex cursor-pointer items-center justify-center gap-1.5 border-l border-white/15 px-2 py-2 text-[10px] ${
                            placement === 'cover'
                                ? 'bg-[#6a7bd1] text-white'
                                : 'bg-black/25 text-white/55'
                        }`}
                    >
                        <input
                            type="radio"
                            name="creator-export-placement"
                            aria-label="Fill and crop edges"
                            checked={placement === 'cover'}
                            onChange={() => setPlacement('cover')}
                            className="sr-only"
                        />
                        <Maximize className="h-3.5 w-3.5" />
                        Fill · crop
                    </label>
                </div>
            </fieldset>

            {selectedFormat.supportsQuality && (
                <label className="block space-y-1 text-[10px] text-white/55">
                    <span>Quality: {qualityPercent}%</span>
                    <input
                        type="range"
                        aria-label="Image quality"
                        min="45"
                        max="100"
                        value={qualityPercent}
                        onChange={(event) =>
                            setQualityPercent(Number(event.target.value))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#6a7bd1]"
                    />
                </label>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                    type="button"
                    aria-label={exportButtonLabel}
                    disabled={isExporting}
                    onClick={() =>
                        onExport({
                            profileId,
                            format,
                            placement,
                            quality: qualityPercent / 100,
                            backgroundColor,
                        })
                    }
                    className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#6a7bd1] px-3 text-xs font-semibold text-white hover:bg-[#7889e8] disabled:opacity-50"
                >
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    {isExporting ? 'Exporting…' : 'Export image'}
                </button>
                <button
                    type="button"
                    aria-label="Copy meme as PNG"
                    disabled={isExporting}
                    onClick={onCopy}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#6a7bd1] px-3 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
                >
                    <Copy className="h-4 w-4" />
                    Copy
                </button>
            </div>

            {hasAnimatedMedia && onExportAnimated && (
                <button
                    type="button"
                    disabled={isExporting}
                    onClick={onExportAnimated}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10 disabled:opacity-50"
                >
                    Export {animatedLabel}
                </button>
            )}
        </div>
    );
}
