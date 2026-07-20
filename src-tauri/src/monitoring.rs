use serde::Serialize;
use std::sync::{Arc, Mutex};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum CaptureState {
    Active,
    PausedUntil(i64),
    PausedIndefinite,
}

pub type MonitoringState = Arc<Mutex<CaptureState>>;
/// One-shot "don't record the very next copy" flag, distinct from the
/// duration-based pause above.
pub type IncognitoNextState = Arc<Mutex<bool>>;

pub fn new_monitoring_state() -> MonitoringState {
    Arc::new(Mutex::new(CaptureState::Active))
}

pub fn new_incognito_next_state() -> IncognitoNextState {
    Arc::new(Mutex::new(false))
}

#[derive(Serialize, Clone)]
pub struct MonitoringStateDto {
    pub paused: bool,
    pub paused_until: Option<i64>,
    pub paused_indefinite: bool,
    pub incognito_next: bool,
}

pub fn snapshot(monitoring: &MonitoringState, incognito_next: &IncognitoNextState) -> MonitoringStateDto {
    let state = *monitoring.lock().unwrap();
    let incognito = *incognito_next.lock().unwrap();
    let (paused, paused_until, paused_indefinite) = match state {
        CaptureState::Active => (false, None, false),
        CaptureState::PausedUntil(until) => (true, Some(until), false),
        CaptureState::PausedIndefinite => (true, None, true),
    };
    MonitoringStateDto {
        paused,
        paused_until,
        paused_indefinite,
        incognito_next: incognito,
    }
}

/// Consumes one-shot/expired state as a side effect. Returns
/// `(should_skip_this_capture, state_transitioned)` — callers should
/// broadcast a state-changed event/tray-refresh whenever the second value
/// is true, since that means the state just flipped on its own (incognito
/// consumed, or a timed pause auto-resumed) rather than via explicit action.
pub fn check_and_advance(
    monitoring: &MonitoringState,
    incognito_next: &IncognitoNextState,
) -> (bool, bool) {
    {
        let mut incognito = incognito_next.lock().unwrap();
        if *incognito {
            *incognito = false;
            return (true, true);
        }
    }
    let mut state = monitoring.lock().unwrap();
    match *state {
        CaptureState::Active => (false, false),
        CaptureState::PausedIndefinite => (true, false),
        CaptureState::PausedUntil(until_ms) => {
            if chrono::Utc::now().timestamp_millis() < until_ms {
                (true, false)
            } else {
                *state = CaptureState::Active;
                (false, true)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_never_skips() {
        let monitoring = new_monitoring_state();
        let incognito = new_incognito_next_state();
        assert_eq!(check_and_advance(&monitoring, &incognito), (false, false));
    }

    #[test]
    fn paused_indefinite_always_skips_and_never_auto_resumes() {
        let monitoring = Arc::new(Mutex::new(CaptureState::PausedIndefinite));
        let incognito = new_incognito_next_state();
        assert_eq!(check_and_advance(&monitoring, &incognito), (true, false));
        // calling it again should still skip — indefinite pause never expires on its own
        assert_eq!(check_and_advance(&monitoring, &incognito), (true, false));
        assert_eq!(*monitoring.lock().unwrap(), CaptureState::PausedIndefinite);
    }

    #[test]
    fn paused_until_future_skips_without_resuming() {
        let future = chrono::Utc::now().timestamp_millis() + 60_000;
        let monitoring = Arc::new(Mutex::new(CaptureState::PausedUntil(future)));
        let incognito = new_incognito_next_state();
        assert_eq!(check_and_advance(&monitoring, &incognito), (true, false));
        assert_eq!(*monitoring.lock().unwrap(), CaptureState::PausedUntil(future));
    }

    #[test]
    fn paused_until_past_auto_resumes_and_does_not_skip() {
        let past = chrono::Utc::now().timestamp_millis() - 1;
        let monitoring = Arc::new(Mutex::new(CaptureState::PausedUntil(past)));
        let incognito = new_incognito_next_state();
        assert_eq!(check_and_advance(&monitoring, &incognito), (false, true));
        assert_eq!(*monitoring.lock().unwrap(), CaptureState::Active);
        // the transition already happened — a second call is a normal Active check
        assert_eq!(check_and_advance(&monitoring, &incognito), (false, false));
    }

    #[test]
    fn incognito_next_is_one_shot() {
        let monitoring = new_monitoring_state();
        let incognito = Arc::new(Mutex::new(true));
        assert_eq!(check_and_advance(&monitoring, &incognito), (true, true));
        assert!(!*incognito.lock().unwrap());
        // consumed — the very next check behaves like plain Active
        assert_eq!(check_and_advance(&monitoring, &incognito), (false, false));
    }

    #[test]
    fn incognito_next_takes_priority_over_pause_state() {
        let monitoring = Arc::new(Mutex::new(CaptureState::PausedIndefinite));
        let incognito = Arc::new(Mutex::new(true));
        assert_eq!(check_and_advance(&monitoring, &incognito), (true, true));
        assert!(!*incognito.lock().unwrap());
        // pause state itself must be untouched by the incognito shortcut
        assert_eq!(*monitoring.lock().unwrap(), CaptureState::PausedIndefinite);
    }

    #[test]
    fn snapshot_reflects_each_state_variant() {
        let incognito = new_incognito_next_state();

        let active = new_monitoring_state();
        let dto = snapshot(&active, &incognito);
        assert!(!dto.paused && !dto.paused_indefinite && dto.paused_until.is_none());

        let until = chrono::Utc::now().timestamp_millis() + 1_000;
        let timed = Arc::new(Mutex::new(CaptureState::PausedUntil(until)));
        let dto = snapshot(&timed, &incognito);
        assert!(dto.paused && !dto.paused_indefinite && dto.paused_until == Some(until));

        let indefinite = Arc::new(Mutex::new(CaptureState::PausedIndefinite));
        let dto = snapshot(&indefinite, &incognito);
        assert!(dto.paused && dto.paused_indefinite && dto.paused_until.is_none());
    }
}
