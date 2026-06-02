/** Resolve overlay source from upload file, data URL, or remote/local URL. */
export async function resolveImageSrc(
    input: File | string,
    isDataUrl = false
): Promise<string> {
    if (typeof input === 'string') {
        if (
            isDataUrl ||
            input.startsWith('data:') ||
            input.startsWith('http://') ||
            input.startsWith('https://') ||
            input.startsWith('/')
        ) {
            return input;
        }
        throw new Error('Invalid image source string');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') resolve(result);
            else reject(new Error('Failed to read file'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(input);
    });
}
