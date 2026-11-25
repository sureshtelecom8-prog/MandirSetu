export function formatStatus(status) {
    return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function splitList(value) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}
export function formatFileSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
