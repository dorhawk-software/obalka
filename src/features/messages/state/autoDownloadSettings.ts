// Reading and writing the automatic-download switches (026 US4). One place, because the Settings screen
// writes them and `AttachmentPrefetcher` obeys them, and the two must never read them differently.

import {
  AUTO_DOWNLOAD_KEY,
  AUTO_DOWNLOAD_SINCE_KEY,
  AUTO_DOWNLOAD_WIFI_KEY,
} from '../../../app/settings/settingsKeys';
import type { AutoDownloadPrefs } from './attachmentPrefetch';

export interface AutoDownloadStore {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

/** Off, Wi-Fi only, every message: what a phone that never touched the switches has. */
export const AUTO_DOWNLOAD_DEFAULTS: AutoDownloadPrefs = { on: false, since: null, wifiOnly: true };

export async function readAutoDownload(store: AutoDownloadStore): Promise<AutoDownloadPrefs> {
  const [on, since, wifi] = await Promise.all([
    store.getSetting(AUTO_DOWNLOAD_KEY),
    store.getSetting(AUTO_DOWNLOAD_SINCE_KEY),
    store.getSetting(AUTO_DOWNLOAD_WIFI_KEY),
  ]);
  const parsed = since ? Number(since) : NaN;
  return {
    // Only an explicit '1': an unreadable value must not start downloads.
    on: on === '1',
    since: Number.isFinite(parsed) ? parsed : null,
    // Only an explicit '0' lets it use mobile data.
    wifiOnly: wifi !== '0',
  };
}

/**
 * Turn automatic download on or off. `onlyNew` is the dialog's choice: messages first seen from now
 * on, or every message already in the archive as well.
 */
export async function writeAutoDownload(
  store: AutoDownloadStore,
  on: boolean,
  options: { onlyNew?: boolean; now?: number } = {},
): Promise<void> {
  if (on) {
    await store.setSetting(
      AUTO_DOWNLOAD_SINCE_KEY,
      options.onlyNew ? String(options.now ?? Date.now()) : '',
    );
  }
  await store.setSetting(AUTO_DOWNLOAD_KEY, on ? '1' : '0');
}

export function writeAutoDownloadWifiOnly(
  store: AutoDownloadStore,
  wifiOnly: boolean,
): Promise<void> {
  return store.setSetting(AUTO_DOWNLOAD_WIFI_KEY, wifiOnly ? '1' : '0');
}
