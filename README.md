# ContractIQ-AI

Your contracts, understood. An AI-powered contract analysis platform that uses a multi-agent pipeline to extract, analyze, and understand legal documents.

## Features

- **Multi-Agent Pipeline**: Seven specialized AI agents work together to analyze contracts:
  - **Ingestion**: Detects file type and routes for parsing
  - **Parser/OCR**: Extracts text from PDFs, DOCX, and scanned documents
  - **Extractor**: Structures parties, dates, obligations, and penalties
  - **Validator**: Scores confidence and flags missing fields
  - **Risk**: Detects one-sided clauses, auto-renewal, and compliance issues
  - **Synthesis**: Generates executive summaries and recommendations
  - **Q&A**: Answers any question with cited sources

- **File Support**: Upload PDF, DOCX, DOC, PNG, JPG, JPEG, and WEBP files (up to 20MB)
- **Real-time Analysis**: Watch agents work with live status updates
- **Risk Assessment**: Color-coded risk flags (high, medium, low) for contract clauses
- **Interactive Chat**: Ask questions about your contract with source citations
- **Dashboard**: Manage and track all your contracts in one place
- **Authentication**: Secure Supabase-based authentication

## Tech Stack

- **Framework**: TanStack Start (React-based SSR framework)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.x
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Supabase (Authentication, Database, Storage)
- **State Management**: TanStack Query (React Query)
- **Routing**: TanStack Router
- **Forms**: React Hook Form + Zod validation
- **Build Tool**: Vite
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- Node.js 18+ 
- Bun (recommended) or npm/yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Tanya-garg10/ContractIQ-AI.git
cd ContractIQ-AI
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase:
- Create a new Supabase project
- Run the SQL migrations in `supabase/migrations/`
- Configure storage bucket named "contracts"
- Set up authentication providers

5. Run the development server:
```bash
bun run dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
ContractIQ-AI/
├── src/
│   ├── components/ui/       # shadcn/ui components
│   ├── hooks/               # Custom React hooks
│   ├── integrations/
│   │   └── supabase/        # Supabase client and auth
│   ├── lib/
│   │   ├── agents.functions.ts    # Agent pipeline functions
│   │   ├── chat.functions.ts      # Chat Q&A functions
│   │   ├── contracts.functions.ts # Contract CRUD operations
│   │   ├── insights.functions.ts  # Analytics functions
│   │   └── utils.ts               # Utility functions
│   ├── routes/
│   │   ├── _authenticated/       # Protected routes
│   │   │   ├── dashboard.tsx      # Main dashboard
│   │   │   ├── contracts.$id.tsx  # Contract detail view
│   │   │   └── insights.tsx       # Analytics view
│   │   ├── auth.tsx               # Authentication page
│   │   └── index.tsx              # Landing page
│   ├── server.ts                 # Server entry point
│   ├── start.ts                  # TanStack Start configuration
│   └── styles.css                # Global styles
├── supabase/
│   ├── migrations/               # Database migrations
│   └── config.toml               # Supabase configuration
├── public/                       # Static assets
└── package.json                  # Dependencies
```

## Development

### Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run build:dev` - Build for development
- `bun run preview` - Preview production build
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier

### Database Migrations

To apply Supabase migrations:
```bash
supabase db push
```

To generate new migrations:
```bash
supabase migration new your_migration_name
```

### Adding New UI Components

The project uses shadcn/ui. To add new components:
```bash
bunx shadcn@latest add [component-name]
```

## Key Features Explained

### Agent Pipeline

The contract analysis flows through seven specialized agents:

1. **Ingestion**: File type detection and routing
2. **Parser/OCR**: Text extraction from various formats
3. **Extractor**: Structured data extraction (parties, dates, clauses)
4. **Validator**: Confidence scoring and field validation
5. **Risk**: Risk detection and categorization
6. **Synthesis**: Summary generation and recommendations
7. **Q&A**: Interactive question answering

### Authentication

The app uses Supabase Auth with the following flow:
- Landing page → Sign in → Authenticated dashboard
- Protected routes use the `/_authenticated` layout
- Auth middleware attaches user context to requests

### Storage

Contracts are stored in Supabase Storage:
- Bucket: `contracts`
- Path pattern: `{user_id}/{uuid}.{extension}`
- Max file size: 20MB

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Node.js:
- Netlify
- Cloudflare Pages
- Railway
- Render

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue on GitHub or contact the maintainers.

---

Built with [TanStack Start](https://tanstack.com/start), [Supabase](https://supabase.com), and [shadcn/ui](https://ui.shadcn.com).
