# MyPocket Reader

A comprehensive web application for importing and exploring your Pocket articles and highlights. Built as a tribute to Pocket's read-it-later service, this tool helps you organize, search, and rediscover your saved content.

![MyPocket Reader](https://via.placeholder.com/800x400/1f2937/ffffff?text=MyPocket+Reader)

## Features

- 📁 **Import Support**: Upload CSV files for articles and JSON files for highlights
- 💾 **Browser Caching**: Your data is automatically cached in your browser for instant access
- 📊 **Statistics Dashboard**: View comprehensive stats about your reading habits
- 🔍 **Advanced Search**: Search articles by title, URL, or content
- 🏷️ **Tag Management**: Filter articles by tags with an interactive tag cloud
- ⭐ **Favorites Filter**: Quickly find your starred articles
- 🎯 **Highlights Filter**: Show only articles that have highlights
- 📄 **Pagination**: Navigate through large collections with customizable page sizes
- 🔄 **Flexible Sorting**: Sort by date (newest/oldest), title (A-Z/Z-A), or keep default order
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🎨 **Modern UI**: Clean, intuitive interface built with shadcn/ui components

## Quick Start

### Option 1: Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/mypocket-reader)

### Option 2: Local Development

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/mypocket-reader.git
   cd mypocket-reader
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage Guide

### Exporting Your Pocket Data

Before using this tool, you'll need to export your data from Pocket:

1. **For Articles**:
   - Log in to your Pocket account at [getpocket.com](https://getpocket.com)
   - Go to **Settings** > **Export** > **HTML**
   - Download the exported file (it will be in CSV format despite the name)

2. **For Highlights**:
   - Unfortunately, Pocket doesn't provide a direct export for highlights
   - You can use third-party tools or browser extensions to extract highlights
   - Alternatively, manually create a JSON file following the format below

### File Format Requirements

#### Articles CSV Format

Your CSV file should contain the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `title` | Article title | "How to Build Better Software" |
| `url` | Article URL | "https://example.com/article" |
| `time_added` | Unix timestamp | 1625097600 |
| `tags` | Pipe-separated tags | "programming\|tech\|*" |
| `status` | Read status | "read" or "unread" |

**Example CSV:**
\`\`\`csv
title,url,time_added,tags,status
"How to Build Better Software","https://example.com/article1",1625097600,"programming|tech|*","read"
"The Future of AI","https://example.com/article2",1625184000,"ai|technology","unread"
\`\`\`

> **Note**: Tags containing `*` or `***` are automatically marked as favorites

#### Highlights JSON Format

Your JSON file should be an array of objects with this structure:

\`\`\`json
[
  {
    "url": "https://example.com/article",
    "title": "Article Title",
    "highlights": [
      {
        "quote": "This is the highlighted text from the article",
        "created_at": 1625097600
      },
      {
        "quote": "Another important highlight",
        "created_at": 1625184000
      }
    ]
  }
]
\`\`\`

### Using the Application

#### 1. Upload Your Data

- **Upload Articles**: Click the CSV upload area and select your exported Pocket articles file
- **Upload Highlights**: Click the JSON upload area and select your highlights file (optional)
- The application will automatically parse, cache, and display your data
- Upload sections will automatically hide once both files are uploaded

#### 2. Data Management

**Caching:**
- Your data is automatically saved to your browser's local storage
- Cache information (timestamp and size) is displayed in the top-right corner
- Use the trash icon to clear cached data when needed
- Use the "Upload" button to upload new data files

#### 3. Explore Your Articles

**Search & Filter:**
- Use the search bar to find articles by title or URL
- Click on tags in the tag cloud to filter by specific topics
- Use checkboxes to show only favorites or articles with highlights
- Combine multiple filters for precise results

**Sorting Options:**
- **Default Order**: Maintains the original import order
- **Newest First**: Sort by date added (most recent first)
- **Oldest First**: Sort by date added (oldest first)
- **Title A-Z**: Alphabetical sorting by title
- **Title Z-A**: Reverse alphabetical sorting by title

**Navigation:**
- Adjust items per page (10, 25, 50, or 100)
- Use pagination controls to browse through your collection
- Click the external link icon to open articles in a new tab

#### 4. View Statistics

The dashboard shows:
- **Total Articles**: Complete count of imported articles
- **Read/Unread**: Reading progress breakdown
- **Favorites**: Number of starred articles
- **With Highlights**: Articles that have associated highlights
- **Total Highlights**: Complete count of all highlights

#### 5. Inline Highlights

- Highlights are displayed directly within each article card
- Each highlight shows the original quote and creation timestamp
- Articles with highlights display a highlight count badge
- Use the "With Highlights Only" filter to focus on highlighted content

## Project Structure

\`\`\`
mypocket-reader/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── lib/
│   └── utils.ts
├── pocket-importer.tsx
├── README.md
├── package.json
└── tailwind.config.ts
\`\`\`

## Technologies Used

- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library with latest features
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Modern React component library
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library
- **[Papa Parse](https://www.papaparse.com/)** - Powerful CSV parsing library
- **[Vercel](https://vercel.com/)** - Deployment and hosting platform

## Browser Support

MyPocket Reader supports all modern browsers with localStorage:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Data Privacy & Security

- **Local Storage Only**: All data processing happens in your browser
- **No Server Storage**: Nothing is sent to external servers or stored remotely
- **Cache Control**: You have full control over your cached data
- **Offline Capable**: Works without internet connection once data is loaded

## Contributing

We welcome contributions! Here's how you can help:

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/mypocket-reader.git`
3. Create a branch: `git checkout -b feature/amazing-feature`
4. Install dependencies: `npm install`
5. Start development server: `npm run dev`

### Contribution Guidelines

- Follow the existing code style and conventions
- Write clear commit messages
- Add tests for new features
- Update documentation as needed
- Ensure your code passes all linting checks

### Reporting Issues

If you find a bug or have a feature request:

1. Check existing issues first
2. Create a new issue with a clear title and description
3. Include steps to reproduce (for bugs)
4. Add relevant labels

## Roadmap

- [ ] **Export Functionality**: Export filtered articles to CSV/JSON
- [ ] **Bulk Operations**: Mark multiple articles as read/unread
- [ ] **Reading Time Estimation**: Calculate estimated reading time
- [ ] **Data Visualization**: Charts for reading patterns and statistics
- [ ] **Dark Mode**: Theme switching support
- [ ] **Offline Support**: PWA capabilities for offline access
- [ ] **Advanced Search**: Full-text search within article content
- [ ] **Collections**: Custom grouping and organization
- [ ] **Highlight Search**: Search within highlights content
- [ ] **Data Compression**: Optimize cache storage size
- [ ] **Import/Export Cache**: Backup and restore cached data

## FAQ

**Q: Can I use this with other read-it-later services?**
A: Currently, the app is designed for Pocket exports, but you can adapt the CSV format for other services.

**Q: Is my data stored anywhere?**
A: No, all data processing happens in your browser. Nothing is sent to external servers.

**Q: What happens if I clear my browser data?**
A: Your cached articles and highlights will be lost. You'll need to re-upload your files.

**Q: Can I export my filtered results?**
A: Export functionality is planned for a future release.

**Q: Does this work on mobile devices?**
A: Yes, the application is fully responsive and works on all screen sizes.

**Q: How much data can I store?**
A: This depends on your browser's localStorage limits (typically 5-10MB). The app shows cache size in the header.

**Q: Can I use this offline?**
A: Yes, once your data is loaded and cached, the app works offline.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

\`\`\`
MIT License

Copyright (c) 2024 MyPocket Reader

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
\`\`\`

## Acknowledgments

- **Pocket** - For inspiring this project with their excellent read-it-later service
- **Vercel** - For providing an amazing deployment platform
- **shadcn** - For the beautiful UI component library
- **Papa Parse** - For robust CSV parsing capabilities
- **The React Team** - For building such a powerful framework

## Support

If you find this project helpful, consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs or requesting features
- 🔄 Sharing it with others who might find it useful
- 💝 Contributing to the codebase

---

**Made with AI by [@mfyameen](https://github.com/mfyameen)**

*Built with ❤️ using Next.js, React, and modern web technologies*
