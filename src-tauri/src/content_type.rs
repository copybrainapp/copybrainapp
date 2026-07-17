use once_cell::sync::Lazy;
use regex::Regex;

static EMAIL_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$").unwrap());
static URL_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(https?://|www\.)\S+$").unwrap());
static PHONE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\+?[0-9][0-9\s\-().]{6,}[0-9]$").unwrap());
static FILE_PATH_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(/|~/|[A-Za-z]:\\|file://)\S+$").unwrap());

pub fn detect_content_type(content: &str) -> &'static str {
    let trimmed = content.trim();

    if trimmed.is_empty() {
        return "text";
    }
    if EMAIL_RE.is_match(trimmed) {
        return "email";
    }
    if URL_RE.is_match(trimmed) {
        return "url";
    }
    if FILE_PATH_RE.is_match(trimmed) {
        return "file_path";
    }
    if PHONE_RE.is_match(trimmed) && trimmed.chars().filter(|c| c.is_ascii_digit()).count() >= 7 {
        return "phone";
    }
    "text"
}
