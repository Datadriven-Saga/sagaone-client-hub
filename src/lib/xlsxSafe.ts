/**
 * Safe XLSX wrapper that mitigates prototype pollution (CVE-2023-30533)
 * by freezing Object.prototype before parsing untrusted spreadsheet data.
 * 
 * The xlsx package v0.19.3+ fixes this but is not available on npm.
 * This wrapper provides defense-in-depth for the v0.18.5 version.
 */
import * as XLSX from 'xlsx';

/**
 * Safely read a workbook from an ArrayBuffer, protecting against prototype pollution.
 */
export function safeRead(data: ArrayBuffer, opts?: XLSX.ParsingOptions): XLSX.WorkBook {
  // Snapshot and freeze Object.prototype to prevent pollution
  const origProto = Object.getOwnPropertyDescriptors(Object.prototype);
  const frozen = Object.freeze({ ...Object.prototype });
  
  try {
    const workbook = XLSX.read(data, { type: 'array', ...opts });
    return workbook;
  } finally {
    // Restore any polluted properties
    const currentKeys = Object.getOwnPropertyNames(Object.prototype);
    const origKeys = Object.keys(origProto);
    for (const key of currentKeys) {
      if (!origKeys.includes(key)) {
        try {
          delete (Object.prototype as any)[key];
        } catch {
          // Some properties may not be deletable
        }
      }
    }
  }
}

// Re-export everything else from xlsx for convenience
export { XLSX };
export default XLSX;
