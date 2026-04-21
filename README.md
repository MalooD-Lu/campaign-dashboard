# Campaign CSV Dashboard - Setup & Deployment Guide

A **Next.js full-stack application** that:
- ✅ Runs on your server (keeps API key secure)
- ✅ Processes **250 names per batch** (5x faster than original 50)
- ✅ Handles CSV uploads, transliteration, and file splitting
- ✅ Deploys to Vercel

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ installed 
- Anthropic API key
### 2. Setup
```bash
# Navigate to the project folder
cd campaign-dashboard

# Install dependencies
npm install

# Create .env.local file with your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
```

### 3. Run Locally
```bash
npm run dev
```
Open http://localhost:3000 in your browser. You'll see the dashboard immediately.

### 4. Test It
- Upload your CSV (must have "Numbers" column)
- Enable "Transliterate names" 
- Select a name column and language (Hindi, Tamil, etc.)
- Click Process
- Download the results

The transliteration will be **5x faster** than your original setup because we're batching 250 names per API call

---


## How It Works (Architecture)

```
Frontend (React) → Backend API Route → Claude API
- Fast: 250 names per batch = fewer calls
- Secure: API key only on server
- Scalable: Can add caching, logging, etc.
```

---

## File Structure

```
campaign-dashboard/
├── app/
│   ├── api/
│   │   └── transliterate/
│   │       └── route.js          # Backend transliteration logic
│   ├── page.jsx                  # Frontend dashboard component
│   ├── page.module.css           # Styling
│   ├── layout.jsx                # Root HTML layout
├── package.json
├── next.config.js
├── .env.local                    # Add your API key here (dev only)
├── .gitignore
└── README.md
```

---

## Tweaking Settings

### Faster Transliteration?
In `app/api/transliterate/route.js`, change `BATCH_SIZE`:
```javascript
const BATCH_SIZE = 300; // Increase from 250 to 300
```
Higher = faster but more tokens per call.

### Add More Languages?
In `app/page.jsx`, modify the languages array:
```javascript
const languages = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi'];
```

### Change Default Rows Per File?
In `app/page.jsx`:
```javascript
const [rowsPerFile, setRowsPerFile] = useState(2000); // Changed from 1000
```

---

## Troubleshooting

### "API key not configured" error
Make sure your `.env.local` file has `ANTHROPIC_API_KEY=sk-ant-...`

### CSV parsing fails
Ensure your CSV:
1. Has a "Numbers" column (case-sensitive)
2. Uses commas as delimiters (not semicolons)
3. Doesn't have weird quotes or special characters in headers

### Transliteration returns garbage
This happens with:
- Non-English names (the API expects English script input)
- Very short names or abbreviations
- Names with numbers or symbols

