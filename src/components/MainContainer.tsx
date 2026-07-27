"use client";

import React from 'react';
import TemplateSelector from './TemplateSelector';
import DynamicMemeEditor from './DynamicMemeEditor';
import type { Template } from '@/types/template';
import { motion, AnimatePresence } from 'framer-motion';
import useSelected from '@/hooks/useSelected';
import {
    deleteActiveMemeDraftIfCurrent,
    inspectActiveMemeDraft,
    type MemeDraftRevision,
    type MemeDraftV1,
} from '@/lib/memeDraft';
import {
    isMemeEditorDraftState,
    type MemeEditorDraftState,
} from '@/lib/editorDraft';
import { toast } from 'sonner';

type TemplateKey = string;

type MainContainerProps = {
    templates: Record<string, Template>;
};

type DraftAvailability =
    | { status: 'checking' }
    | { status: 'empty' }
    | {
          status: 'ready';
          draft: MemeDraftV1<MemeEditorDraftState>;
          revision: MemeDraftRevision;
      }
    | {
          status: 'unavailable';
          reason: 'newer-version' | 'invalid';
          revision: MemeDraftRevision;
      };

async function readDraftAvailability(): Promise<DraftAvailability> {
    const inspection =
        await inspectActiveMemeDraft<MemeEditorDraftState>();

    if (inspection.status === 'empty') return { status: 'empty' };
    if (inspection.status === 'unsupported') {
        return {
            status: 'unavailable',
            reason: 'newer-version',
            revision: inspection.revision,
        };
    }
    if (!isMemeEditorDraftState(inspection.draft.state)) {
        return {
            status: 'unavailable',
            reason: 'invalid',
            revision: inspection.revision,
        };
    }

    return {
        status: 'ready',
        draft: inspection.draft,
        revision: inspection.revision,
    };
}

export default function MainContainer({ templates }: MainContainerProps) {
    const {
        selected,
        setSelected,
        customTemplate,
        setCustomTemplate,
        isCustomTemplate,
        setIsCustomTemplate,
        handleCustomTemplateSelect,
    } = useSelected();
    const [draftAvailability, setDraftAvailability] =
        React.useState<DraftAvailability>({ status: 'checking' });

    const refreshDraftAvailability = React.useCallback(async () => {
        try {
            const availability = await readDraftAvailability();
            setDraftAvailability(availability);
        } catch {
            setDraftAvailability({ status: 'empty' });
            toast.warning(
                'Local draft storage is unavailable. Recovery may not work in this browser.'
            );
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        void readDraftAvailability()
            .then((availability) => {
                if (!cancelled) setDraftAvailability(availability);
            })
            .catch(() => {
                if (!cancelled) {
                    setDraftAvailability({ status: 'empty' });
                    toast.warning(
                        'Local draft storage is unavailable. Recovery may not work in this browser.'
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const prepareNewDraft = async () => {
        let latestAvailability = draftAvailability;
        try {
            latestAvailability = await readDraftAvailability();
            setDraftAvailability(latestAvailability);
        } catch {
            toast.warning(
                'Local draft storage is unavailable. You can keep editing, but recovery may not work.'
            );
        }

        const storedDraft =
            latestAvailability.status === 'ready' ||
            latestAvailability.status === 'unavailable'
                ? latestAvailability
                : null;

        if (
            storedDraft &&
            !window.confirm(
                'Starting a new meme will replace your saved draft. Continue?'
            )
        ) {
            return false;
        }

        if (storedDraft) {
            try {
                const result = await deleteActiveMemeDraftIfCurrent(
                    storedDraft.revision
                );
                if (result === 'conflict') {
                    toast.error(
                        'This draft changed in another tab. Review the latest version before replacing it.'
                    );
                    await refreshDraftAvailability();
                    return false;
                }
            } catch {
                toast.warning(
                    'Local draft storage is unavailable. You can keep editing, but recovery may not work.'
                );
            }
        }

        setDraftAvailability({ status: 'empty' });
        return true;
    };

    const handleSelect = async (key: string) => {
        if (key in templates) {
            if (!(await prepareNewDraft())) return;
            setSelected(key as TemplateKey);
            setIsCustomTemplate(false);
            setCustomTemplate(null);
        }
    };

    const handleCustomSelect = async (template: Template) => {
        if (!(await prepareNewDraft())) return;
        handleCustomTemplateSelect(template);
    };

    const handleReset = async () => {
        setSelected('');
        setIsCustomTemplate(false);
        setCustomTemplate(null);
        setDraftAvailability({ status: 'checking' });
        await refreshDraftAvailability();
    };

    const handleResumeDraft = async () => {
        try {
            const latestAvailability = await readDraftAvailability();
            setDraftAvailability(latestAvailability);

            if (latestAvailability.status !== 'ready') {
                toast.error(
                    'This draft changed and can no longer be resumed here.'
                );
                return;
            }

            setCustomTemplate(latestAvailability.draft.state.template);
            setIsCustomTemplate(true);
            setSelected('draft');
        } catch {
            toast.error('The saved draft could not be opened. Please retry.');
        }
    };

    const handleDiscardDraft = async () => {
        if (
            draftAvailability.status !== 'ready' &&
            draftAvailability.status !== 'unavailable'
        ) {
            return;
        }

        try {
            const result = await deleteActiveMemeDraftIfCurrent(
                draftAvailability.revision
            );
            if (result === 'conflict') {
                toast.error(
                    'This draft changed in another tab, so it was not discarded.'
                );
                await refreshDraftAvailability();
                return;
            }
            setDraftAvailability({ status: 'empty' });
        } catch {
            toast.error('The saved draft could not be discarded. Please retry.');
        }
    };

    if (draftAvailability.status === 'checking') {
        return (
            <div
                role="status"
                aria-live="polite"
                className="flex min-h-[40vh] w-full items-center justify-center text-sm text-black/60 dark:text-white/60"
            >
                Checking for a saved draft…
            </div>
        );
    }

    return (
        <div className="w-full max-sm:w-full mx-auto p-4 max-sm:p-1 flex flex-col flex-wrap items-center">
            <AnimatePresence mode="wait">
                {!selected ? (
                    <div
                        key="selector"
                        className="w-full max-w-6xl"
                    >
                        {(draftAvailability.status === 'ready' ||
                            draftAvailability.status === 'unavailable') && (
                            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#6a7bd1]/40 bg-[#6a7bd1]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-semibold">
                                        {draftAvailability.status === 'ready'
                                            ? 'Continue a saved draft?'
                                            : 'Saved draft needs attention'}
                                    </p>
                                    <p className="text-sm text-black/60 dark:text-white/60">
                                        {draftAvailability.status === 'ready'
                                            ? 'A private local draft is available on this browser. Resume to open it.'
                                            : draftAvailability.reason === 'newer-version'
                                              ? 'This draft was created by a newer Memehub version and has been kept untouched.'
                                              : 'This local draft could not be opened and has been kept untouched.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {draftAvailability.status === 'ready' && (
                                        <button
                                            type="button"
                                            onClick={handleResumeDraft}
                                            className="rounded-md bg-[#6a7bd1] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#596bc0]"
                                        >
                                            Resume saved draft
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDiscardDraft}
                                        className="rounded-md border border-black/20 px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                                    >
                                        Discard saved draft
                                    </button>
                                </div>
                            </div>
                        )}
                        <TemplateSelector
                            templates={templates}
                            onSelect={handleSelect}
                            onCustomTemplateSelect={handleCustomSelect}
                        />
                    </div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                        className="w-full max-w-[1680px]"
                    >
                        {isCustomTemplate && customTemplate ? (
                            <DynamicMemeEditor
                                template={customTemplate}
                                onReset={handleReset}
                                restoreSavedDraft={selected === 'draft'}
                                expectedDraftUpdatedAt={
                                    selected === 'draft' &&
                                    draftAvailability.status === 'ready'
                                        ? draftAvailability.draft.updatedAt
                                        : undefined
                                }
                            />
                        ) : selected && templates[selected] ? (
                            <DynamicMemeEditor
                                template={templates[selected]}
                                onReset={handleReset}
                            />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-lg"
                            >
                                Template not found. Please try again.
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
