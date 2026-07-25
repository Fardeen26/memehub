# Memehub

An image-first creator workspace for making publish-ready memes quickly. Memehub combines templates, custom uploads, layered editing, Indian-language typography, creator branding, and local draft recovery in one browser tool.

## Features

- **Template Library**: Extensive collection of popular meme templates
- **Custom Uploads**: Upload your own images to create unique memes
- **Layered Editor**: Position and style text, images, GIFs, drawings, and shapes
- **India Image Discovery**: Turn live India search topics into one-click reusable-image searches
- **Licensed Image Search**: Find raster images on Wikimedia Commons and use one as the meme template or add it as a layer
- **Creator Workspace**: Compact Images, Text, My assets, Layers, and Export workflow
- **Reusable Assets**: Private local shelf for cutouts, logos, and reaction images
- **Image Tools**: Opacity, fit, fill, rotation, and manual erase controls
- **Indian-language Type**: Verified fonts for nine major Indian writing systems
- **Creator Branding**: Optional custom handle watermark with corner placement
- **Draft Recovery**: Private, versioned local autosave with explicit resume/discard
- **Template Search**: Quickly find templates with built-in search functionality
- **Giphy Stickers & GIFs**: Search real sticker and GIF catalogs from Giphy (not custom assets)
- **Creator Exports**: Instagram and WhatsApp presets in PNG, JPEG, or WebP, plus clipboard copy and animated GIF/MP4 where supported
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui
- **State Management**: React Context API

## Getting Started

### Prerequisites

- Node.js 20.19+, 22.13+, or 24+
- npm 10

### Installation

1. Clone the repository:
```bash
git clone https://github.com/<your-username>/meme-generator.git
cd meme-generator
```

2. Install dependencies:
```bash
npm ci
```

3. Copy environment variables and add a [Giphy API key](https://developers.giphy.com/dashboard/) (powers stickers & GIFs in the editor):

```bash
cp .env.example .env.local
# Set GIPHY_API_KEY=your_key
```

Live India topics and Wikimedia image search work without API keys. Discovery
is intentionally image-first: trend topics are search shortcuts, while
separately licensed raster results can become the meme template or a canvas
layer. Memehub stores a local project copy while keeping its creator, license,
usage terms, and restrictions attached to the image.

For production discovery search and MP4 export, configure shared rate limiting.
Cloudinary is additionally required for MP4 export:

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_VIDEO_EXPORT_UPLOAD_PRESET=your_signed_video_preset
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
CLOUDINARY_CLEANUP_SECRET=your_cleanup_secret
```

The shared limiter protects public discovery-provider quota as well as video
export signatures. Local development uses an in-memory limiter; production
discovery search fails closed if Upstash is missing. The Cloudinary upload
preset should restrict video formats and file size. Production video export
also requires the shared limiter unless
`CLOUDINARY_VIDEO_EXPORT_ALLOW_MEMORY_RATE_LIMIT=true` is set intentionally.

Create `CLOUDINARY_VIDEO_EXPORT_UPLOAD_PRESET` in the same Cloudinary product environment as `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. The preset name is case-sensitive and must match the deployed environment variable exactly. Use a signed upload preset for the production MP4 export flow. If Cloudinary returns `Upload preset not found`, the deployed preset name is missing, misspelled, set on a different Cloudinary cloud, or still set to a placeholder value.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Start a project**: Pick a searchable template or upload your own background.
2. **Write the joke**: Caption fields stay beside the canvas while secondary tools remain collapsed.
3. **Find the moment**: Expand Images, choose a trending India search, or search a person, event, dialogue, or reaction.
4. **Choose the image’s role**: Start a clean meme from a result or add it as a layer to the current scene.
5. **Apply a recipe**: Use Text for a one-tap meme, headline, subtitle, reaction, or Hindi typography treatment.
6. **Build and refine**: Add saved assets, stickers, GIFs, shapes, or drawings; use Layers and image tools only when needed.
7. **Add page identity**: Optionally save your own handle into a corner of the export.
8. **Publish**: Export the original or an Instagram/WhatsApp variant as PNG, JPEG, or WebP.

Work is autosaved locally. The gallery offers explicit Resume and Discard actions when a draft is available.

## Project Structure

```
src/
├── app/                # Next.js App Router pages
├── components/         # React components
│   ├── ui/             # Reusable UI components
│   ├── MemeEditor.tsx  # Main meme editing interface
│   ├── TemplateSelector.tsx # Template selection component
│   └── ...
├── context/            # React Context providers
├── data/               # Static data and configuration
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and constants
└── types/              # TypeScript type definitions
```

## Key Components

- **MemeEditor**: Canvas-centered editor with immediate caption fields
- **CreatorWorkspace**: Collapsible Images, Text, reusable assets, layers, and publishing tools
- **CreatorDiscoveryPanel**: Image-first India trend shortcuts and reusable-media search
- **CreatorAssetShelf**: Private browser-local cutouts, logos, and reaction images
- **CreatorLayersPanel**: Visibility, duplication, deletion, and within-group ordering
- **CreatorExportPanel**: Platform sizing, fit/crop behavior, and still-image formats
- **TemplateSelector**: Gallery view for browsing meme templates
- **CustomTemplateUpload**: Component for uploading custom images
- **TemplateSearch**: Search functionality for finding specific templates
- **DynamicMemeEditor**: Dynamic loading wrapper for the editor

## Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Create a production build
- `npm start` - Run the production server
- `npm test` - Run the automated test suite
- `npm run lint` - Run ESLint

### Code Style

The project uses ESLint for code linting and follows TypeScript best practices. Make sure to run the linter before committing changes.


## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Added some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).
