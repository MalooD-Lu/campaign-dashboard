// app/api/transliterate/route.js
// ============================================================
// SMART TRANSLITERATION API - Next.js Backend
// Converts English/Roman names to regional scripts with intelligent
// handling of formatting quirks, abbreviations, and phonetics.
// ============================================================

// ---- CONFIG ----
const BATCH_SIZE = 250; // Names per API call (5x larger than frontend batch)
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms

// ---- ABBREVIATION MAP ----
// Common abbreviations found in Indian name databases
// Keys must be UPPERCASE. Matching is case-insensitive and whole-word only.
const NAME_ABBREVIATIONS = {
  // Honorifics & titles
  'MR': 'Mister',
  'MRS': 'Misses',
  'MS': 'Miss',
  'SMT': 'Shrimati',
  'SH': 'Shri',
  'DR': 'Doctor',
  'PROF': 'Professor',
  'LATE': 'Late',
  'KM': 'Kumari',
  'KUM': 'Kumari',
  'CAPT': 'Captain',
  'MAJ': 'Major',
  'COL': 'Colonel',
  'GEN': 'General',
  'SGT': 'Sergeant',

  // Common name abbreviations
  'MD': 'Mohammed',
  'MOHD': 'Mohammed',
  'MHD': 'Mohammed',
  'MHMD': 'Mohammed',
  'MOID': 'Mohammed',
  'SK': 'Sheikh',
  'SHAIK': 'Sheikh',
  'CH': 'Choudhary',
  'CHDR': 'Chaudhary',
  'CHDRY': 'Chaudhary',
  'PT': 'Pandit',
  'PD': 'Prasad',
  'LD': 'Lal Das',
  'JR': 'Junior',
  'SR': 'Senior',
  'BHAI': 'Bhai',
  'BEN': 'Ben',
  'BEGUM': 'Begum',
  'BIBI': 'Bibi',
  'BI': 'Bi',
  'BEE': 'Bee',
  'BAI': 'Bai',
  'DEVI': 'Devi',
  'KUMR': 'Kumar',
  'KR': 'Kumar',
  'SINGH': 'Singh',
  'SGH': 'Singh',
  'NATH': 'Nath',
  'DAS': 'Das',
  'YADV': 'Yadav',
  'SEN': 'Sen',
  'GH': 'Ghulam',
  'AB': 'Abdul',
  'ABD': 'Abdul',
};

// Relationship markers like S/O, W/O, D/O
const RELATIONSHIP_MAP = {
  'S': 'Son of',
  'W': 'Wife of',
  'D': 'Daughter of',
  'F': 'Father of',
};

// Language-specific system prompts
const LANGUAGE_PROMPTS = {
  'Hindi': `You are an expert Hindi transliteration engine. Your job is to convert English/Roman script Indian names into Devanagari (Hindi) script.

RULES:
1. Return ONLY the Devanagari transliterations, one per line, numbered to match input.
2. Use SMART phonetic transliteration — not character-by-character mapping.
   - "SUNNY" → "सनी" (not "सुन्नी")
   - "Sunetra" → "सुनेत्रा" (correct nasal/vowel sounds)
   - "Prashant" → "प्रशांत" (use anusvara correctly)
   - "Bhoite" → "भोईटे" (Marathi surname — respect regional phonetics)
   - "Shriram" → "श्रीराम"
3. Handle compound/joined names intelligently:
   - "Hussainbee D" → "हुसैन बी डी"
   - If a single letter follows a name, treat it as an initial.
4. Handle initials: "S.K. Rajan" → "एस. के. राजन"
5. Remove junk characters (*, #, numbers) — just transliterate the name portion.
6. Abbreviations have been PRE-EXPANDED before reaching you. Just transliterate naturally.
7. If a name has "Mister", "Shrimati", "Shri", "Doctor" as prefix, transliterate accordingly:
   - "Shrimati Lakshmi" → "श्रीमती लक्ष्मी"
   - "Shri Rajan" → "श्री राजन"
8. Regional phonetics:
   - South Indian: "th" is often "त" not "थ" (e.g., "Ramachandranath")
   - Marathi: "bh" is "भ", vowel endings are important
   - Punjabi: "deep" suffix → "दीप", "preet" → "प्रीत"
   - Muslim names: "Khan" → "खान", "Shaikh" → "शेख", "Bee/Bi" → "बी"
9. For ambiguous names, prefer the most common Indian pronunciation.
10. Never add extra words. Never explain. Just numbered Devanagari names.`,

  'Tamil': `You are an expert Tamil transliteration engine. Your job is to convert English/Roman script Indian names into Tamil script.

RULES:
1. Return ONLY Tamil transliterations, one per line, numbered to match input.
2. Use SMART phonetic transliteration respecting Tamil phonetics.
   - "Sunetra" → "சுனேத்ரா"
   - "Prashant" → "பிரசாந்த்"
   - "Ramachandran" → "ராமசந்திரன்"
3. Handle Tamil-specific sounds: "zh", "tth", "kk", "nng" etc.
4. Respect Tamil vowel patterns and nasal sounds.
5. Never add extra words. Just numbered Tamil names.`,

  'Telugu': `You are an expert Telugu transliteration engine. Your job is to convert English/Roman script Indian names into Telugu script.

RULES:
1. Return ONLY Telugu transliterations, one per line, numbered to match input.
2. Use SMART phonetic transliteration respecting Telugu phonetics.
   - "Sunetra" → "సునేత్ర"
   - "Prashant" → "ప్రశాంత్"
   - "Ramakrishna" → "రామకృష్ణ"
3. Handle Telugu vowel marks and consonant combinations correctly.
4. Respect regional naming conventions.
5. Never add extra words. Just numbered Telugu names.`,

  'Kannada': `You are an expert Kannada transliteration engine. Your job is to convert English/Roman script Indian names into Kannada script.

RULES:
1. Return ONLY Kannada transliterations, one per line, numbered to match input.
2. Use SMART phonetic transliteration respecting Kannada phonetics.
   - "Sunetra" → "ಸುನೇತ್ರ"
   - "Prashant" → "ಪ್ರಶಾಂತ್"
   - "Ramakrishna" → "ರಾಮಕೃಷ್ಣ"
3. Handle Kannada vowel marks and consonant combinations correctly.
4. Never add extra words. Just numbered Kannada names.`,

  'Malayalam': `You are an expert Malayalam transliteration engine. Your job is to convert English/Roman script Indian names into Malayalam script.

RULES:
1. Return ONLY Malayalam transliterations, one per line, numbered to match input.
2. Use SMART phonetic transliteration respecting Malayalam phonetics.
   - "Sunetra" → "സുനേത്ര"
   - "Prashant" → "പ്രശാന്ത്"
   - "Ramakrishna" → "രാമകൃഷ്ണ"
3. Handle Malayalam-specific sounds and vowel patterns.
4. Never add extra words. Just numbered Malayalam names.`,
};

// ---- PRE-CLEANING UTILITY FUNCTIONS ----
function preCleanName(name) {
  let n = name.toString().trim();

  // Remove @ symbols sometimes found in names (e.g., "R@hul" -> "Rahul")
  n = n.replace(/@/g, 'a');

  // Remove digits unless they look intentional (like a suffix)
  n = n.replace(/\d+/g, ' ').trim();

  // Collapse multiple spaces
  n = n.replace(/\s+/g, ' ');

  // Check if it's ALL CAPS or all lowercase for later title casing
  const wasUpperOrLower = (n === n.toUpperCase() || n === n.toLowerCase());

  // Expand relationship markers: S/O, W/O, D/O, F/O
  n = expandRelationshipMarkers(n);

  // Expand abbreviations (whole-word, case-insensitive)
  n = expandAbbreviations(n);

  // Apply title case if it was all caps/lowercase
  if (wasUpperOrLower) {
    n = toTitleCase(n);
  }

  // Remove trailing/leading special chars
  n = n.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');

  // Collapse multiple spaces again after all transformations
  n = n.replace(/\s+/g, ' ');

  // If after cleaning it's empty, return original
  if (!n || n.trim() === '') return name;

  return n.trim();
}

function expandRelationshipMarkers(name) {
  // Match patterns like "S/O", "W/O", "D/O", "F/O" (case-insensitive)
  return name.replace(/\b([SWDF])\/O\b/gi, (match, letter) => {
    return RELATIONSHIP_MAP[letter.toUpperCase()] || match;
  });
}

function expandAbbreviations(name) {
  const words = name.split(/\s+/);
  const expanded = words.map(word => {
    // Strip trailing dots/periods for matching: "MD." -> "MD"
    const stripped = word.replace(/\.+$/, '').toUpperCase();
    if (NAME_ABBREVIATIONS[stripped]) {
      return NAME_ABBREVIATIONS[stripped];
    }
    return word;
  });
  return expanded.join(' ');
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---- SMART TRANSLITERATION API CALL ----
async function callTransliterationAPI(names, language) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const systemPrompt = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS['Hindi'];
  const numberedList = names
    .map((name, i) => `${i + 1}. ${name}`)
    .join('\n');

  const userMessage = `Convert these names to ${language} script. Return numbered results matching input order:\n\n${numberedList}`;

  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  };

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      const httpCode = response.status;

      // Handle rate limiting with backoff
      if (httpCode === 429 || httpCode === 529) {
        const waitTime = RETRY_DELAY * attempt;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/${MAX_RETRIES}`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || `HTTP ${httpCode}`);
      }

      const data = await response.json();
      const textContent = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();

      // Parse numbered response: "1. नाम\n2. नाम"
      return parseNumberedResponse(textContent, names.length);

    } catch (err) {
      console.error(`Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

      if (attempt === MAX_RETRIES) {
        throw new Error(`API failed after ${MAX_RETRIES} retries: ${err.message}`);
      }

      // Wait before retry with exponential backoff
      await sleep(RETRY_DELAY * attempt);
    }
  }
}

// ---- PARSE NUMBERED RESPONSE ----
// Handles responses like "1. प्रशांत\n2. सनी" etc.
function parseNumberedResponse(text, expectedCount) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const results = [];

  for (const line of lines) {
    // Strip numbering: "1. प्रशांत" or "1) प्रशांत" -> "प्रशांत"
    const cleaned = line.replace(/^\d+[\.\)\-\s]+/, '').trim();
    if (cleaned) {
      results.push(cleaned);
    }
  }

  // Pad with errors if we got fewer results than expected
  while (results.length < expectedCount) {
    results.push('⚠️ MISSING');
  }

  return results.slice(0, expectedCount);
}

// ---- UTILITY ----
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- MAIN ROUTE HANDLER ----
export async function POST(req) {
  try {
    const { names, language } = await req.json();

    if (!names || !Array.isArray(names) || names.length === 0) {
      return Response.json(
        { error: 'No names provided or invalid format' },
        { status: 400 }
      );
    }

    if (!language) {
      return Response.json(
        { error: 'Language not specified' },
        { status: 400 }
      );
    }

    // Pre-clean all names
    const cleanedNames = names.map(preCleanName);

    console.log(`Processing ${cleanedNames.length} names for ${language}`);

    // Process in batches with smart batching
    const results = [];
    const totalBatches = Math.ceil(cleanedNames.length / BATCH_SIZE);

    for (let i = 0; i < cleanedNames.length; i += BATCH_SIZE) {
      const batch = cleanedNames.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} names`);

      const batchResults = await callTransliterationAPI(batch, language);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < cleanedNames.length) {
        await sleep(500);
      }
    }

    return Response.json({
      transliterated: results,
      processed: results.length,
      batches: totalBatches
    });

  } catch (err) {
    console.error('Transliteration error:', err);
    return Response.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
