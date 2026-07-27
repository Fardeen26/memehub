'use client';

import { BadgeCheck } from 'lucide-react';
import type { CreatorBranding } from '@/lib/creatorBranding';

type CreatorBrandPanelProps = {
    branding: CreatorBranding;
    onChange: (branding: CreatorBranding) => void;
};

export default function CreatorBrandPanel({
    branding,
    onChange,
}: CreatorBrandPanelProps) {
    return (
        <section className="space-y-3 border-t border-white/10 pt-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <BadgeCheck className="h-3.5 w-3.5 text-[#9eabff]" />
                        Page identity
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/45">
                        Keep your own handle consistent on every export.
                    </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[10px] text-white/70">
                    <input
                        type="checkbox"
                        aria-label="Add creator watermark"
                        checked={branding.enabled}
                        onChange={(event) =>
                            onChange({
                                ...branding,
                                enabled: event.target.checked,
                            })
                        }
                        className="h-4 w-4 accent-[#6a7bd1]"
                    />
                    {branding.enabled ? 'On' : 'Off'}
                </label>
            </div>

            {branding.enabled && (
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                    <label className="space-y-1 text-[10px] text-white/55">
                        <span>Creator name or handle</span>
                        <input
                            aria-label="Creator watermark text"
                            type="text"
                            maxLength={60}
                            value={branding.text}
                            onChange={(event) =>
                                onChange({
                                    ...branding,
                                    text: event.target.value,
                                })
                            }
                            placeholder="@yourpage"
                            className="h-9 w-full rounded-md border border-white/15 bg-[#0b0c12] px-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#6a7bd1]"
                        />
                    </label>
                    <label className="space-y-1 text-[10px] text-white/55">
                        <span>Position</span>
                        <select
                            aria-label="Creator watermark position"
                            value={branding.position}
                            onChange={(event) =>
                                onChange({
                                    ...branding,
                                    position: event.target
                                        .value as CreatorBranding['position'],
                                })
                            }
                            className="h-9 w-full rounded-md border border-white/15 bg-[#0b0c12] px-2 text-xs text-white outline-none focus:border-[#6a7bd1]"
                        >
                            <option value="top-left">Top left</option>
                            <option value="top-right">Top right</option>
                            <option value="bottom-left">Bottom left</option>
                            <option value="bottom-right">Bottom right</option>
                        </select>
                    </label>
                </div>
            )}
        </section>
    );
}
