# Memehun dot mom

A modern, web-based meme generator built with Next.js and TypeScript. Create hilarious memes using pre-built templates or upload your own images with an intuitive drag-and-drop editor.

## Features

- **Template Library**: Extensive collection of popular meme templates
- **Custom Uploads**: Upload your own images to create unique memes
- **Interactive Editor**: Drag-and-drop text positioning with real-time preview
- **Template Search**: Quickly find templates with built-in search functionality
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface built with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui
- **State Management**: React Context API

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, pnpm, or bun package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/<your-username>/meme-generator.git
cd meme-generator
```

2. Install dependencies:
```bash
bun install
# or
npm install
# or
yarn install
# or
pnpm install

```

3. Run the development server:
```bash
bun dev
# or
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Select a Template**: Browse through the template gallery or use the search function to find a specific meme template
2. **Add Text**: Click on the text areas to add your custom text to the meme
3. **Position Text**: Drag text elements to position them exactly where you want
4. **Custom Upload**: Upload your own image using the custom template upload feature
5. **Download**: Save your completed meme to your device

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

- **MemeEditor**: Core editing interface with text overlay functionality
- **TemplateSelector**: Gallery view for browsing meme templates
- **CustomTemplateUpload**: Component for uploading custom images
- **TemplateSearch**: Search functionality for finding specific templates
- **DynamicMemeEditor**: Dynamic loading wrapper for the editor

## Development

### Available Scripts

- `bun dev` - Start development server
- `bun build` - Build for production
- `bun start` - Start production server
- `bun lint` - Run ESLint

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
