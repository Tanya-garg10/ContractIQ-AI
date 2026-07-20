# ContractIQ-AI

> **An AI-powered Multi-Agent Contract Intelligence Platform** that transforms complex legal and business contracts into structured insights using autonomous AI agents, Retrieval-Augmented Generation (RAG), and intelligent risk analysis.

## 🚀 Overview

ContractIQ-AI simplifies contract review by automating the extraction, validation, analysis, and summarization of legal documents. Instead of manually reading lengthy agreements, users can upload contracts and receive actionable insights, highlighted risks, executive summaries, and AI-powered answers within seconds.

Designed for the **3SVK Convergence Season 2 – AI Agent Track**, the platform demonstrates how multiple AI agents can collaborate to process documents while maintaining accuracy and consistency.

## ✨ Key Features

* 🤖 Multi-Agent AI Workflow
* 📄 Upload PDF, DOCX, and scanned contract documents
* 🔍 Intelligent clause and entity extraction
* ⚠️ AI-powered contract risk detection
* 📊 Executive summaries and business insights
* 💬 RAG-based contract Q&A with source references
* 📈 Confidence scoring for extracted information
* 📥 Export reports in structured formats

## 🧠 Multi-Agent Pipeline

The platform is built around specialized AI agents that work together throughout the document lifecycle.

### 📥 Ingestion Agent

* Accepts uploaded contracts
* Detects document type
* Routes files for processing

### 📖 Parser & OCR Agent

* Extracts text from digital and scanned documents
* Preserves document structure where possible

### 🔎 Extractor Agent

Extracts:

* Parties
* Effective dates
* Payment terms
* Confidentiality clauses
* Termination conditions
* Renewal clauses
* Obligations
* Penalties

### ✅ Validator Agent

* Verifies extracted information
* Detects missing fields
* Generates confidence scores

### ⚠️ Risk Analysis Agent

Identifies:

* High-risk clauses
* Auto-renewal terms
* One-sided agreements
* Liability concerns
* Compliance issues

### 📝 Synthesis Agent

Generates:

* Executive summary
* Key business insights
* Recommended actions
* Contract overview

### 💬 Q&A Agent

Allows users to ask natural language questions such as:

* Who are the contracting parties?
* What is the notice period?
* When does the agreement expire?
* What are the payment terms?

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Vite
* TanStack Start (SSR framework)
* TanStack Router
* TanStack Query

### Backend & Infrastructure

* Firebase (Authentication, Firestore Database, Storage)
* Firebase Functions (serverless)

### AI & Agents

* OpenAI GPT-4o-mini
* Custom multi-agent pipeline
* Retrieval-Augmented Generation (RAG)

### Document Processing

* Firebase Storage
* PDF & DOCX parsing
* Image OCR support

### Database

* Firebase Firestore (NoSQL)
* Firebase Storage (file storage)

### Deployment

* Vercel
* Firebase Hosting

## 📂 Workflow

```text
User Upload
      │
      ▼
Firebase Storage
      │
      ▼
Ingestion Agent
      │
      ▼
Parser & OCR
      │
      ▼
Extractor Agent
      │
      ▼
Validator Agent
      │
      ▼
Firestore Database
      │
      ▼
Risk Analysis Agent
      │
      ▼
Synthesis Agent
      │
      ▼
AI Report + Contract Chat
```

## 🎯 Use Cases

* Contract Review
* Vendor Agreements
* Employment Contracts
* NDAs
* Service Agreements
* Procurement Documents
* Legal Compliance

## 🚀 Getting Started

### Prerequisites

* Node.js 18+ 
* Bun (recommended) or npm/yarn
* Firebase account and project

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

3. Set up Firebase:
   - Create a new Firebase project at [firebase.google.com](https://firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create Firestore Database
   - Create Storage bucket
   - Get your Firebase configuration from Project Settings

4. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

5. Run the development server:
```bash
bun run dev
```

The application will be available at `http://localhost:5173`

### Firebase Setup Details

**Authentication:**
- Enable Email/Password sign-in method
- Configure any additional providers as needed

**Firestore Database:**
- Create database in production mode
- Set up security rules for user data isolation
- Collections will be auto-created: `contracts`, `profiles`, etc.

**Storage:**
- Create storage bucket for contract files
- Configure security rules for user file access
- Set up CORS rules if needed

**OpenAI API:**
- Add your OpenAI API key as environment variable for AI features
- Required for contract analysis and chat functionality

## 🌟 Future Enhancements

* Multi-language contract support
* Contract comparison
* Negotiation assistant
* Deadline reminders
* Compliance monitoring
* AI-powered clause recommendations

## 👨‍💻 Team

Developed as part of **3SVK Convergence Season 2 – AI Agent Track**.

## 📄 License

MIT License.
