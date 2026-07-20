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

### Backend

* FastAPI

### AI & Agents

* LangGraph / LangChain
* GPT-5.5 or Gemini
* Retrieval-Augmented Generation (RAG)

### Document Processing

* PaddleOCR / Tesseract OCR
* PDF & DOCX parsing

### Database

* PostgreSQL
* ChromaDB (Vector Database)

### Deployment

* Vercel
* Render

## 📂 Workflow

```text
User Upload
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
Vector Database (RAG)
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
