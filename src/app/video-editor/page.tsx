import type { Metadata } from 'next';
import VideoEditor from '@/components/VideoEditor';

export const metadata: Metadata = {
    title: 'Video Editor',
    description: 'Add text and filters to a short video, then export an MP4.',
};

export default function VideoEditorPage() {
    return <VideoEditor />;
}
