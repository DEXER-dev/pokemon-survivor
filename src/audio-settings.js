/** Test-only audio switch: append `?mute=1` to silence local browser playtests. */
export function isTestAudioMuted () {
    if (typeof window === 'undefined' || !window.location) return false;
    return new URLSearchParams(window.location.search).get('mute') === '1';
}
