import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface TextBox {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFont: number;
    align: 'center' | 'left' | 'right';
    id?: string;
}

interface Template {
    image: string;
    textBoxes: TextBox[];
}

interface Templates {
    [key: string]: Template;
}

async function uploadToCloudinary(imagePath: string, publicId: string): Promise<string> {
    try {
        console.log(`Uploading ${imagePath} to Cloudinary...`);

        const result = await cloudinary.uploader.upload(imagePath, {
            public_id: publicId,
            folder: 'meme-templates',
            resource_type: 'image',
            overwrite: true,
        });

        console.log(`✅ Successfully uploaded: ${publicId}`);
        return result.secure_url;
    } catch (error) {
        console.error(`❌ Failed to upload ${imagePath}:`, error);
        throw error;
    }
}

function readTemplatesFile(templatesPath: string): Templates {
    try {
        const fileContent = fs.readFileSync(templatesPath, 'utf-8');

        const cleanContent = fileContent
            .replace(/as const/g, '')
            .replace(/export const templates = /, '')
            .replace(/;$/, '');

        const parseTemplates = new Function('return ' + cleanContent);
        const templates = parseTemplates();

        if (typeof templates !== 'object' || templates === null) {
            throw new Error('Parsed content is not a valid object');
        }

        return templates;
    } catch (error) {
        console.error('Failed to read templates file:', error);
        throw error;
    }
}

function writeTemplatesFile(templatesPath: string, templates: Templates): void {
    try {
        const templateEntries = Object.entries(templates).map(([key, template]) => {
            const textBoxesString = template.textBoxes.map(box => {
                const idPart = box.id ? `id: "${box.id}", ` : '';
                return `            { ${idPart}x: ${box.x}, y: ${box.y}, width: ${box.width}, height: ${box.height}, fontSize: ${box.fontSize}, minFont: ${box.minFont}, align: "${box.align}" as const }`;
            }).join(',\n');

            return `    "${key}": {
        image: "${template.image}",
        textBoxes: [
${textBoxesString}
        ]
    }`;
        }).join(',\n');

        const fileContent = `// Auto-generated file - Updated with Cloudinary URLs
export const templates = {
${templateEntries}
};
`;

        fs.writeFileSync(templatesPath, fileContent, 'utf-8');
        console.log('✅ Templates file updated successfully!');
    } catch (error) {
        console.error('Failed to write templates file:', error);
        throw error;
    }
}

async function updateTemplatesWithCloudinary(): Promise<void> {
    const templatesPath = path.join(process.cwd(), 'src', 'data', 'templates.ts');
    const publicPath = path.join(process.cwd(), 'public');

    try {
        console.log('🚀 Starting Cloudinary migration...\n');

        console.log('📖 Reading templates file...');
        const templates = readTemplatesFile(templatesPath);

        const backupPath = templatesPath.replace('.ts', '.backup.ts');
        fs.copyFileSync(templatesPath, backupPath);
        console.log(`📋 Backup created: ${backupPath}\n`);

        const updatedTemplates: Templates = {};
        const uploadResults: { [key: string]: { success: boolean; url?: string; error?: string } } = {};

        for (const [templateKey, template] of Object.entries(templates)) {
            console.log(`\n🔄 Processing template: ${templateKey}`);

            try {
                const localImagePath = template.image.startsWith('/')
                    ? template.image.substring(1)
                    : template.image;

                const fullImagePath = path.join(publicPath, localImagePath);

                if (!fs.existsSync(fullImagePath)) {
                    console.log(`⚠️  Image not found: ${fullImagePath}`);
                    uploadResults[templateKey] = {
                        success: false,
                        error: `File not found: ${fullImagePath}`
                    };

                    updatedTemplates[templateKey] = template;
                    continue;
                }

                const cloudinaryUrl = await uploadToCloudinary(fullImagePath, templateKey);

                updatedTemplates[templateKey] = {
                    ...template,
                    image: cloudinaryUrl
                };

                uploadResults[templateKey] = { success: true, url: cloudinaryUrl };

            } catch (error) {
                console.error(`❌ Error processing ${templateKey}:`, error);
                uploadResults[templateKey] = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };

                updatedTemplates[templateKey] = template;
            }
        }

        console.log('\n📝 Writing updated templates...');
        writeTemplatesFile(templatesPath, updatedTemplates);

        console.log('\n📊 Migration Summary:');
        console.log('==========================================');

        const successful = Object.values(uploadResults).filter(r => r.success).length;
        const failed = Object.values(uploadResults).filter(r => !r.success).length;

        console.log(`✅ Successful uploads: ${successful}`);
        console.log(`❌ Failed uploads: ${failed}`);
        console.log(`📁 Total templates: ${Object.keys(templates).length}\n`);

        if (failed > 0) {
            console.log('❌ Failed uploads:');
            Object.entries(uploadResults)
                .filter(([, result]) => !result.success)
                .forEach(([key, result]) => {
                    console.log(`   • ${key}: ${result.error}`);
                });
        }

        console.log('\n🎉 Migration completed!');
        console.log(`📋 Original file backed up to: ${backupPath}`);

    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    updateTemplatesWithCloudinary().catch(console.error);
}

export { updateTemplatesWithCloudinary };