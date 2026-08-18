import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';

/**
 * Opens an external URL in the user's default system web browser.
 * Uses Tauri's plugin-opener with fallbacks to custom backend command and browser window.open.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
    return;
  } catch (err) {
    console.warn('plugin-opener failed, attempting invoke fallback:', err);
  }

  try {
    await invoke('open_external_url', { url });
    return;
  } catch (err) {
    console.warn('invoke open_external_url failed, falling back to window.open:', err);
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('All methods to open URL failed:', err);
  }
}
