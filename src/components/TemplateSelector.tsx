'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Template } from '@/types/template';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

type TemplateSelectorProps = {
    templates: Record<string, Template>;
    onSelect: (key: string) => void;
};

const TEMPLATES_PER_PAGE = 12;
const PRELOAD_NEXT_PAGE = true;

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
    const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
    const imageRefs = useRef<Map<string, HTMLElement>>(new Map());

    const templateEntries = useMemo(() => Object.entries(templates), [templates]);
    const totalPages = Math.ceil(templateEntries.length / TEMPLATES_PER_PAGE);

    const paginatedTemplates = useMemo(() => {
        const startIndex = (currentPage - 1) * TEMPLATES_PER_PAGE;
        const endIndex = startIndex + TEMPLATES_PER_PAGE;
        return templateEntries.slice(startIndex, endIndex);
    }, [templateEntries, currentPage]);

    // Get next page templates for preloading
    const nextPageTemplates = useMemo(() => {
        if (!PRELOAD_NEXT_PAGE || currentPage >= totalPages) return [];
        const startIndex = currentPage * TEMPLATES_PER_PAGE;
        const endIndex = startIndex + TEMPLATES_PER_PAGE;
        return templateEntries.slice(startIndex, endIndex);
    }, [templateEntries, currentPage, totalPages]);

    // Preload next page images
    useEffect(() => {
        if (nextPageTemplates.length > 0) {
            nextPageTemplates.forEach(([, template]) => {
                // Create a hidden link element to preload the image
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = template.image;
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);

                // Clean up after 30 seconds to avoid memory issues
                setTimeout(() => {
                    if (document.head.contains(link)) {
                        document.head.removeChild(link);
                    }
                }, 30000);
            });
        }
    }, [nextPageTemplates]);

    // Intersection Observer for advanced lazy loading
    useEffect(() => {
        intersectionObserverRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target as HTMLElement;
                        const imageSrc = img.dataset.src;
                        if (imageSrc && !loadedImages.has(imageSrc)) {
                            setLoadedImages(prev => new Set([...prev, imageSrc]));
                        }
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before the image enters viewport
                threshold: 0.1,
            }
        );

        return () => {
            intersectionObserverRef.current?.disconnect();
        };
    }, [loadedImages]);

    // Observe image elements
    useEffect(() => {
        const observer = intersectionObserverRef.current;
        if (!observer) return;

        // Capture current ref value to use in cleanup
        const currentImageRefs = imageRefs.current;

        currentImageRefs.forEach((element) => {
            observer.observe(element);
        });

        return () => {
            currentImageRefs.forEach((element) => {
                observer.unobserve(element);
            });
        };
    }, [paginatedTemplates]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Smooth scroll to top of templates when page changes
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const setImageRef = (key: string) => (element: HTMLElement | null) => {
        if (element) {
            imageRefs.current.set(key, element);
            element.dataset.src = templates[key]?.image;
        } else {
            imageRefs.current.delete(key);
        }
    };

    const renderPaginationItems = () => {
        const items = [];

        // Always show first page
        if (currentPage > 3) {
            items.push(
                <PaginationItem key={1}>
                    <PaginationLink
                        onClick={() => handlePageChange(1)}
                        isActive={currentPage === 1}
                    >
                        1
                    </PaginationLink>
                </PaginationItem>
            );

            if (currentPage > 4) {
                items.push(
                    <PaginationItem key="ellipsis-start">
                        <PaginationEllipsis />
                    </PaginationItem>
                );
            }
        }

        // Show pages around current page
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let page = startPage; page <= endPage; page++) {
            items.push(
                <PaginationItem key={page}>
                    <PaginationLink
                        onClick={() => handlePageChange(page)}
                        isActive={currentPage === page}
                    >
                        {page}
                    </PaginationLink>
                </PaginationItem>
            );
        }

        // Always show last page
        if (currentPage < totalPages - 2) {
            if (currentPage < totalPages - 3) {
                items.push(
                    <PaginationItem key="ellipsis-end">
                        <PaginationEllipsis />
                    </PaginationItem>
                );
            }

            items.push(
                <PaginationItem key={totalPages}>
                    <PaginationLink
                        onClick={() => handlePageChange(totalPages)}
                        isActive={currentPage === totalPages}
                    >
                        {totalPages}
                    </PaginationLink>
                </PaginationItem>
            );
        }

        return items;
    };

    return (
        <div className="space-y-6">
            {/* Templates Grid */}
            <section className="grid grid-cols-3 max-sm:grid-cols-1 gap-6 grid-flow-dense">
                <AnimatePresence mode="popLayout">
                    {paginatedTemplates.map(([key, tpl], index) => {
                        // First 6 images get priority loading (above the fold)
                        const isPriority = index < 6 && currentPage === 1;

                        return (
                            <motion.div
                                key={key}
                                ref={setImageRef(key)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.05,
                                    ease: [0.22, 1, 0.36, 1]
                                }}
                                onClick={() => onSelect(key)}
                            >
                                <motion.div
                                    className="relative aspect-square cursor-pointer"
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Image
                                        src={tpl.image}
                                        alt={key}
                                        fill
                                        className="object-cover rounded-2xl shadow transition-opacity duration-300"
                                        loading={isPriority ? 'eager' : 'lazy'}
                                        priority={isPriority}
                                        quality={85} // Slightly reduce quality for faster loading
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        placeholder="blur"
                                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                                        onLoad={() => {
                                            setLoadedImages(prev => new Set([...prev, tpl.image]));
                                        }}
                                    />
                                </motion.div>
                                <motion.p
                                    className="text-center text-lg font-medium mt-2 capitalize"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    {key.replace(/-/g, ' ')}
                                </motion.p>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </section>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="flex flex-col items-center pt-6 space-y-4"
                >

                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                                    className={currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}
                                />
                            </PaginationItem>

                            {renderPaginationItems()}

                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                                    className={currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </motion.div>
            )}
        </div>
    );
}