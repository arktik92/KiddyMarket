// NFC helper. Real NFC works only on a native build (react-native-nfc-manager).
// In Expo Go / web the native module is absent, so we expose a graceful
// isSupported() check and the scan button is disabled accordingly.

let NfcManager: any = null;
let NfcTech: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("react-native-nfc-manager");
  NfcManager = mod.default;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

let started = false;

export async function isNfcSupported(): Promise<boolean> {
  if (!NfcManager) return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

async function ensureStarted() {
  if (!NfcManager) throw new Error("NFC non disponible");
  if (!started) {
    await NfcManager.start();
    started = true;
  }
}

// Reads a card and returns its UID as an uppercase hex string.
export async function readNfcUid(): Promise<string> {
  await ensureStarted();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const id: string = tag?.id ?? "";
    return id.toUpperCase();
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }
}
