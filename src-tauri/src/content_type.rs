use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;

static EMAIL_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$").unwrap());
static URL_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(https?://|www\.)\S+$").unwrap());
static PHONE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\+?[0-9][0-9\s\-().]{6,}[0-9]$").unwrap());
// `.` (not `\S`) so paths containing spaces still match — common on Windows
// (`C:\Program Files\...`, `C:\Users\John Doe\...`) and not unheard of on
// macOS/Linux either. `.` doesn't match newlines by default, so multi-line
// text still correctly falls through to plain "text".
static FILE_PATH_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(/|~/|[A-Za-z]:\\|file://).+$").unwrap());

// Well-known secret/API-key formats, checked before anything else so a
// pasted credential is never misfiled as a plain URL or path fragment.
static AWS_KEY_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(AKIA|ASIA)[0-9A-Z]{16}$").unwrap());
static GITHUB_TOKEN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})$").unwrap()
});
static SLACK_TOKEN_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^xox[baprs]-[A-Za-z0-9-]{10,}$").unwrap());
static GOOGLE_API_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^AIza[0-9A-Za-z\-_]{35}$").unwrap());
static STRIPE_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}$").unwrap());
static OPENAI_KEY_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^sk-[A-Za-z0-9]{20,}$").unwrap());
static JWT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$").unwrap());

// Social-media links get their own category (with per-platform icons on the
// frontend) instead of the generic "url" bucket.
static SOCIAL_URL_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)^(https?://|www\.)([a-z0-9-]+\.)*(instagram\.com|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.com|fb\.watch|linkedin\.com|pinterest\.com|pin\.it|snapchat\.com|reddit\.com|threads\.net|discord\.com|discord\.gg|t\.me|telegram\.me|telegram\.org|wa\.me|whatsapp\.com|twitch\.tv)(/\S*)?$",
    )
    .unwrap()
});

// Distinctive one-line declarations that essentially never occur in prose —
// enough on their own to call something code.
static STRONG_CODE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?m)^\s*(function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+[\s{:(]|fn\s+\w+\s*\(|#include\s*[<\x22]|<\?php|package\s+[\w.]+;)",
    )
    .unwrap()
});

// Common language keywords that show up in code but occasionally in prose
// too, so these only count as code alongside a structural signal (multiple
// lines, braces, or a semicolon-terminated line).
static WEAK_CODE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?m)^\s*(import\s+[\w{}, *.]+|export\s+(default\s+)?(function|class|const|let)\b|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|public\s+(static\s+)?[\w<>\[\]]+\s+\w+\s*\(|private\s+[\w<>\[\]]+|using\s+namespace\s+\w|console\.log\s*\(|System\.out\.println|println!\s*\(|SELECT\s+[^\n]+\s+FROM\s+|CREATE\s+TABLE\s)",
    )
    .unwrap()
});

fn looks_like_code(trimmed: &str) -> bool {
    if trimmed.contains("```") || trimmed.starts_with("#!/") {
        return true;
    }
    if STRONG_CODE_RE.is_match(trimmed) {
        return true;
    }
    if !WEAK_CODE_RE.is_match(trimmed) {
        return false;
    }
    let has_braces = trimmed.contains('{') || trimmed.contains('}');
    let has_semicolon_line = trimmed.lines().any(|l| l.trim_end().ends_with(';'));
    trimmed.lines().count() >= 2 || has_braces || has_semicolon_line
}

fn matches_known_secret_format(trimmed: &str) -> bool {
    // PEM-style private key blocks are multi-line, so they never reach the
    // single-line regexes below — catch them by marker instead.
    if trimmed.contains("PRIVATE KEY-----") {
        return true;
    }
    AWS_KEY_RE.is_match(trimmed)
        || GITHUB_TOKEN_RE.is_match(trimmed)
        || SLACK_TOKEN_RE.is_match(trimmed)
        || GOOGLE_API_KEY_RE.is_match(trimmed)
        || STRIPE_KEY_RE.is_match(trimmed)
        || OPENAI_KEY_RE.is_match(trimmed)
        || JWT_RE.is_match(trimmed)
}

fn shannon_entropy(s: &str) -> f64 {
    let len = s.chars().count() as f64;
    if len == 0.0 {
        return 0.0;
    }
    let mut counts: HashMap<char, u32> = HashMap::new();
    for c in s.chars() {
        *counts.entry(c).or_insert(0) += 1;
    }
    counts
        .values()
        .map(|&c| {
            let p = c as f64 / len;
            -p * p.log2()
        })
        .sum()
}

/// Generic fallback for tokens/passwords that don't match a known vendor
/// format: a single "word" (no whitespace) of plausible secret length with
/// mixed character classes and high randomness (Shannon entropy).
fn looks_high_entropy(trimmed: &str) -> bool {
    if trimmed.contains(char::is_whitespace) {
        return false;
    }
    let len = trimmed.chars().count();
    if !(20..=200).contains(&len) {
        return false;
    }
    let has_lower = trimmed.chars().any(|c| c.is_ascii_lowercase());
    let has_upper = trimmed.chars().any(|c| c.is_ascii_uppercase());
    let has_digit = trimmed.chars().any(|c| c.is_ascii_digit());
    let class_count = [has_lower, has_upper, has_digit]
        .iter()
        .filter(|&&b| b)
        .count();
    if class_count < 2 {
        return false;
    }
    shannon_entropy(trimmed) >= 3.5
}

pub fn detect_content_type(content: &str) -> &'static str {
    let trimmed = content.trim();

    if trimmed.is_empty() {
        return "text";
    }
    if matches_known_secret_format(trimmed) {
        return "secret";
    }
    if EMAIL_RE.is_match(trimmed) {
        return "email";
    }
    if URL_RE.is_match(trimmed) {
        if SOCIAL_URL_RE.is_match(trimmed) {
            return "social";
        }
        return "url";
    }
    if FILE_PATH_RE.is_match(trimmed) {
        return "file_path";
    }
    if PHONE_RE.is_match(trimmed) && trimmed.chars().filter(|c| c.is_ascii_digit()).count() >= 7 {
        return "phone";
    }
    if looks_like_code(trimmed) {
        return "code";
    }
    if looks_high_entropy(trimmed) {
        return "secret";
    }
    "text"
}
