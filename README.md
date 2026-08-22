# Workflow

A lightweight, client-side financial management and invoicing web application designed for independent workers, freelancers, and contractors.

---

## Overview

**Workflow** streamlines the core financial lifecycle of independent work into a unified, zero-backend workspace. It enables users to create professional invoices, generate client-side PDFs, track payment statuses, recover overdue receivables with automated reminder copy, and monitor collection performance.

### Core Workflow

```
Invoice Creation → PDF Generation → Payment Tracking → Overdue Recovery → Income Analytics
```

---

## Core Features

### 1. Interactive Invoice Editor
* **Live In-Browser Editing:** Real-time editable fields for business details, client information, invoice ID, dates, notes, and payment terms.
* **Dynamic Line Items:** Add or remove line items with automatic row subtotal calculation (`Quantity × Rate`).
* **Tax & Totals Calculation:** Automatic computation of subtotal, sales tax (parsed from label percentage), and final total.
* **Brand Customization:** Upload custom company logos via `FileReader` (base64) with an interactive slider to adjust image width (100px–250px).
* **Global Country Selector:** Searchable ISO country selection for both business and client address blocks.

### 2. Client-Side PDF Generation
* **In-Browser Compilation:** Generates print-ready vector A4 PDFs directly in the browser using `@react-pdf/renderer`.
* **Debounced Rendering Tree:** Uses debounced state synchronization (500ms) to ensure smooth input responsiveness during real-time typing.
* **Instant Download:** Direct PDF download without server processing or third-party data transfer.

### 3. Invoice Template System
* **Export Templates:** Export invoice configurations as `.template` / `.json` files via `file-saver`.
* **Import Templates:** Load existing template files with runtime schema validation powered by `zod` (`TInvoice.parse`).

### 4. Payment Tracking & Management
* **Status Lifecycle:** Categorizes invoices across `Paid`, `Pending`, and `Overdue` states.
* **Dashboard KPIs:** Real-time summary cards displaying Total Revenue, Collected Amount, Pending Amount, and Overdue Amount.
* **Status Filtering:** Tabbed payment management view with filters for `All`, `Paid`, `Pending`, and `Overdue`.
* **One-Click Settlement:** Quick "Mark as Paid" actions on individual invoices directly from the dashboard and payment list.
* **Recent Invoices:** Displays recent activity with client avatars and invoice identifiers.

### 5. Smart Payment Recovery
* **Automated Overdue Detection:** Automatically computes payment aging by evaluating invoice due dates against the current date on load.
* **Recovery Panel:** Dedicated overlay displaying overdue invoices with an active days-overdue counter.
* **Personalized Reminder Generator:** Generates pre-formatted, polite reminder copy pre-populated with client name, invoice number, overdue amount, and original due date.
* **One-Click Clipboard Copy:** Instant clipboard export (`navigator.clipboard.writeText`) for fast dispatch via email or chat.

### 6. Income & Collection Analytics
* **Collection Rate:** Visual calculation of total collected funds relative to total invoiced revenue (`(Paid / Total Revenue) × 100`).
* **Status Distribution:** Real-time count breakdown of paid, pending, and overdue invoices.
* **Income Overview Modal:** Dedicated business insights overlay providing a snapshot of overall cash flow health.

---

## Standalone Engines

This repository represents the main web application MVP. The broader project architecture includes three feature engines:

* **Feature #1: Invoice/PDF Engine**
  * *Status:* **Integrated**
  * Fully embedded within the main React application (`src/components/InvoicePage.tsx`, `@react-pdf/renderer` rendering pipeline, dual-mode component system, and Zod template parser).
* **Feature #2: smart-payment-recovery-engine**
  * *Status:* **Separately Extracted Standalone Engine**
  * A standalone engine providing formalized multi-stage payment recovery workflows, escalation rules, notification schedules, and REST API endpoints. *(The main app implements an inline, client-side reminder generation subset of this capability).*
* **Feature #3: recovery-analytics-engine**
  * *Status:* **Separately Extracted Standalone Engine**
  * A standalone analytics engine providing comprehensive portfolio analytics, aging buckets, recovery prioritization scoring, and financial risk metrics. *(The main app implements an inline client-side collection overview subset of this capability).*

> *Note: Features #2 and #3 exist as standalone engines and are not linked as runtime npm dependencies within this client-side MVP.*

---

## Tech Stack

| Category | Technologies | Description |
| :--- | :--- | :--- |
| **Framework & Core** | React 18.2, TypeScript 5.4 | Component-driven UI and strict type safety |
| **Bundler & Tooling** | Vite 5.2, `@vitejs/plugin-react-swc` 3.6 | Fast local HMR and optimized production bundling |
| **PDF Generation** | `@react-pdf/renderer` 3.4.2 | Client-side React-to-PDF rendering pipeline |
| **Schema Validation** | `zod` 3.22.4 | Runtime invoice schema validation and parser |
| **Date Utilities** | `date-fns` 3.6, `react-datepicker` 6.6 | Date formatting and interactive calendar inputs |
| **UI Components** | `rc-slider` 10.5, `react-textarea-autosize` 8.5 | Logo sizing slider and autosizing inputs |
| **Utilities** | `file-saver` 2.0, `@uidotdev/usehooks` 2.4 | File saving operations and `useDebounce` hook |
| **Styling** | Sass (SCSS 1.72), Vanilla CSS | Modular stylesheet architecture and responsive layout |

---

## Architecture

Workflow operates as a single-page application (SPA) with a dual-mode component rendering pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                           App.tsx                           │
│             (Local State & LocalStorage Routing)            │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
        [view === 'dashboard']       [view === 'invoice']
                │                             │
                ▼                             ▼
     ┌─────────────────────┐      ┌─────────────────────────────┐
     │    Dashboard.tsx    │      │       InvoicePage.tsx       │
     │  - KPI Cards        │      ├─────────────────────────────┤
     │  - Payment Tracking │      │    Dual-Mode Rendering:     │
     │  - Recovery Panel   │      │  • Web Mode (HTML Elements) │
     │  - Income Overview  │      │  • PDF Mode (@react-pdf)    │
     └─────────────────────┘      └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │       DownloadPDF.tsx       │
                                  │  - @react-pdf Renderer      │
                                  │  - Template JSON Import/Exp │
                                  │  - Zod Schema Validation    │
                                  └─────────────────────────────┘
```

* **Dual-Mode Primitives:** Custom layout components (`Page`, `View`, `Text`, `Document`, and `Editable*` inputs) inspect a `pdfMode` flag to render either standard HTML DOM nodes or `@react-pdf/renderer` layout nodes.
* **Zero Backend:** All business logic, aging calculations, and PDF generation execute locally in the user's browser.

---

## Data & Storage

Workflow persists all data directly in the browser using `window.localStorage`:

1. **`invoiceData`** (`Invoice`): Stores the latest working draft of the invoice form.
2. **`invoiceRecords`** (`InvoiceRecord[]`): Stores an array of saved invoice records with the following structure:
   ```ts
   type InvoiceRecord = {
     id: string;                       // Unique record UUID (crypto.randomUUID())
     invoice: Invoice;                 // Complete invoice data (Zod validated)
     amount: number;                   // Computed total (Subtotal + Tax)
     status: 'paid' | 'pending' | 'overdue';
   };
   ```

* **Privacy & Security:** Financial records remain entirely on the local device and are never transmitted over an external network.

---

## Project Structure

```
Independent-Worker-MVP/
├── public/                     # Static assets, icons, manifest
├── src/
│   ├── assets/                 # SVGs and static visual assets
│   ├── components/
│   │   ├── Dashboard.tsx       # Main dashboard, KPI cards, payment list, recovery modal
│   │   ├── Dashboard.css       # Dashboard and modal layout styles
│   │   ├── InvoicePage.tsx     # WYSIWYG invoice editor & PDF document layout
│   │   ├── DownloadPDF.tsx     # PDF download action & template export/import
│   │   ├── Document.tsx        # Dual-mode document wrapper
│   │   ├── Page.tsx            # Dual-mode page container
│   │   ├── View.tsx            # Dual-mode view block
│   │   ├── Text.tsx            # Dual-mode text element
│   │   ├── EditableInput.tsx   # Dual-mode text input
│   │   ├── EditableTextarea.tsx# Dual-mode autosizing textarea
│   │   ├── EditableSelect.tsx  # Dual-mode select input
│   │   ├── EditableCalendarInput.tsx # Dual-mode date picker
│   │   └── EditableFileImage.tsx # Dual-mode logo uploader & resizer
│   ├── data/
│   │   ├── types.ts            # TypeScript interfaces & Zod validation schemas
│   │   ├── initialData.ts      # Default template values
│   │   └── countryList.ts      # ISO country dataset
│   ├── hooks/
│   │   └── useOnClickOutside.ts # Click-outside detection hook
│   ├── images/                 # Editor action icons (download, upload, remove, resize)
│   ├── scss/                   # Modular Sass stylesheets (typography, variables, app)
│   ├── styles/
│   │   ├── compose.ts          # Stylesheet adapter for @react-pdf/renderer
│   │   └── styles.ts           # PDF stylesheet definition
│   ├── App.tsx                 # View state management, records synchronization
│   ├── main.tsx                # React DOM root mounting
│   └── vite-env.d.ts           # Vite client environment types
├── index.html                  # Main HTML entrypoint
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite bundler configuration
```

---

## Getting Started

### Prerequisites

* **Node.js** (v18.0.0 or higher recommended)
* **npm** (v9.0.0 or higher) or **yarn**

### Installation

Clone the repository and install project dependencies:

```bash
git clone https://github.com/forstudypiyush222-tech/Independent-Worker-MVP.git
cd Independent-Worker-MVP
npm install
```

### Running Locally

Start the Vite local development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

## Available Scripts

* `npm run dev` — Starts the Vite development server with Hot Module Replacement (HMR).
* `npm run build` — Runs TypeScript compilation (`tsc`) and bundles production assets into `dist/`.
* `npm run preview` — Locally previews the generated production build.
* `npm run lint` — Checks codebase formatting using Prettier.
* `npm run lint:write` — Automatically formats codebase files using Prettier.

---

## Deployment

The application is bundled into static HTML, JavaScript, and CSS assets and can be deployed to any static hosting provider (GitHub Pages, Vercel, Netlify, Cloudflare Pages, etc.).

To build for production:

```bash
npm run build
```

The output in `dist/` is ready for static deployment.

---

## Current Limitations

* **Local Storage Scoping:** Data is stored in browser `localStorage`. Clearing browser data or changing browsers/devices will not preserve records.
* **No Backend / Multi-Device Sync:** The MVP has no centralized database or cloud account synchronization.
* **Currency Formatting:** While individual invoices support any custom currency symbol (defaulting to `$`), summary dashboard stat cards display `₹` by default.
* **Tax Multiplier Synchronization:** The invoice editor dynamically parses custom tax percentages from the label string (e.g. `Sale Tax (10%)`), while the top-level dashboard record aggregator uses a standard 10% calculation on draft save.
* **Automated Testing:** There is currently no automated test suite (Jest/Vitest) configured in the build scripts.

---

## Future Direction

* Integration with backend recovery and analytics microservices (`smart-payment-recovery-engine` and `recovery-analytics-engine`).
* Multi-currency normalization across the dashboard.
* Cloud persistence with user authentication and multi-device synchronization.
* Automated invoice delivery and direct payment link integration (Stripe, PayPal, UPI).

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.