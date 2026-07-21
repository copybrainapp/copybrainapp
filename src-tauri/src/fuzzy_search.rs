use crate::models::ClipboardItem;
use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::Serialize;

/// Matching runs against at most this many characters of `content` — huge
/// pasted documents would otherwise make every keystroke expensive. A match
/// buried past this point in a very long item won't be found, which is an
/// acceptable tradeoff for guaranteed responsiveness.
const MATCH_CONTENT_CHARS: usize = 4000;
/// How many recent items are always considered as fuzzy candidates, even if
/// FTS5's stricter prefix match misses them (e.g. on a typo) — keeps typo
/// tolerance working for the history a user actually searches day to day
/// without fuzzy-scoring the entire table on every keystroke.
pub const RECENT_CANDIDATE_LIMIT: i64 = 3000;

const SCORE_EXACT_BONUS: u32 = 100_000;
const SCORE_PREFIX_BONUS: u32 = 20_000;
const RECENCY_BONUS_MAX: f64 = 2_000.0;

#[derive(Serialize, Clone)]
pub struct FuzzySearchResult {
    #[serde(flatten)]
    pub item: ClipboardItem,
    pub score: u32,
    pub content_indices: Vec<u32>,
    pub app_name_indices: Vec<u32>,
}

fn recency_bonus(created_at: i64, now: i64) -> u32 {
    let age_days = ((now - created_at).max(0) as f64) / 86_400_000.0;
    (RECENCY_BONUS_MAX / (1.0 + age_days)) as u32
}

fn match_indices(pattern: &Pattern, haystack: &str, matcher: &mut Matcher) -> Option<(u32, Vec<u32>)> {
    if haystack.is_empty() {
        return None;
    }
    let truncated = match haystack.char_indices().nth(MATCH_CONTENT_CHARS) {
        Some((byte_idx, _)) => &haystack[..byte_idx],
        None => haystack,
    };
    let mut buf = Vec::new();
    let utf32 = Utf32Str::new(truncated, &mut buf);
    let mut indices = Vec::new();
    let score = pattern.indices(utf32, matcher, &mut indices)?;
    indices.sort_unstable();
    indices.dedup();
    Some((score as u32, indices))
}

/// Scores `candidates` against `query` and returns the top `limit` matches,
/// ranked exact-match > prefix-match > fuzzy score, with a small recency
/// boost so a fresher item edges out an equally-fuzzy older one.
pub fn search(query: &str, candidates: Vec<ClipboardItem>, limit: usize) -> Vec<FuzzySearchResult> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let pattern = Pattern::parse(trimmed, CaseMatching::Ignore, Normalization::Smart);
    let mut matcher = Matcher::new(Config::DEFAULT);
    let now = chrono::Utc::now().timestamp_millis();
    let lower_query = trimmed.to_lowercase();

    let mut results: Vec<FuzzySearchResult> = candidates
        .into_iter()
        .filter_map(|item| {
            let content_match = match_indices(&pattern, &item.content, &mut matcher);
            let app_match = item
                .app_name
                .as_deref()
                .and_then(|name| match_indices(&pattern, name, &mut matcher));

            if content_match.is_none() && app_match.is_none() {
                return None;
            }

            let (content_score, content_indices) = content_match.unwrap_or_default();
            let (app_score, app_name_indices) = app_match.unwrap_or_default();

            let lower_content = item.content.to_lowercase();
            let exact_bonus = if lower_content == lower_query {
                SCORE_EXACT_BONUS
            } else if lower_content.starts_with(&lower_query) {
                SCORE_PREFIX_BONUS
            } else {
                0
            };

            let score = content_score
                + app_score / 2
                + exact_bonus
                + recency_bonus(item.created_at, now);

            Some(FuzzySearchResult {
                item,
                score,
                content_indices,
                app_name_indices,
            })
        })
        .collect();

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(limit);
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, content: &str, app_name: Option<&str>, created_at: i64) -> ClipboardItem {
        ClipboardItem {
            id: id.to_string(),
            content: content.to_string(),
            content_type: "text".to_string(),
            app_name: app_name.map(|s| s.to_string()),
            is_favorite: false,
            created_at,
            char_count: content.chars().count() as i64,
        }
    }

    #[test]
    fn empty_query_returns_nothing() {
        let candidates = vec![item("1", "hello world", None, 0)];
        assert!(search("", candidates, 10).is_empty());
    }

    #[test]
    fn non_matching_items_are_excluded() {
        let candidates = vec![item("1", "completely unrelated text", None, 0)];
        assert!(search("zzzxxx", candidates, 10).is_empty());
    }

    #[test]
    fn exact_match_ranks_above_prefix_and_fuzzy() {
        let candidates = vec![
            item("fuzzy", "some invoice thing buried in text", None, 0),
            item("prefix", "invoice-2024-final", None, 0),
            item("exact", "invoice", None, 0),
        ];
        let results = search("invoice", candidates, 10);
        assert_eq!(results[0].item.id, "exact");
        assert_eq!(results[1].item.id, "prefix");
        assert_eq!(results[2].item.id, "fuzzy");
    }

    #[test]
    fn subsequence_matching_vscode_style() {
        // "gh react" should find "GitHub - facebook/react" via subsequence,
        // not substring, matching.
        let candidates = vec![item("1", "GitHub - facebook/react", None, 0)];
        let results = search("gh react", candidates, 10);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn typo_tolerance_missing_character() {
        // "invoce" (missing the second i) should still find "invoice".
        let candidates = vec![item("1", "invoice", None, 0)];
        let results = search("invoce", candidates, 10);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn app_name_is_searchable() {
        let candidates = vec![item("1", "some clipboard text", Some("Google Chrome"), 0)];
        let results = search("chrome", candidates, 10);
        assert_eq!(results.len(), 1);
        assert!(!results[0].app_name_indices.is_empty());
    }

    #[test]
    fn more_recent_item_wins_when_otherwise_tied() {
        let now = chrono::Utc::now().timestamp_millis();
        let candidates = vec![
            item("old", "banana split", None, now - 30 * 86_400_000),
            item("new", "banana split", None, now),
        ];
        let results = search("banana", candidates, 10);
        assert_eq!(results[0].item.id, "new");
    }

    #[test]
    fn limit_is_respected() {
        let candidates = (0..20)
            .map(|i| item(&i.to_string(), "matching text", None, i))
            .collect();
        let results = search("matching", candidates, 5);
        assert_eq!(results.len(), 5);
    }
}
