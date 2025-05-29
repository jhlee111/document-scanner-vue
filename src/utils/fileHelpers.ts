/**
 * File 객체를 Data URL 문자열로 변환합니다.
 * FileReader를 사용하여 비동기적으로 파일을 읽습니다.
 * @param {File} file - Data URL로 변환할 File 객체
 * @returns {Promise<string>} - 파일의 Data URL을 resolve하는 Promise
 */
export function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            if (e.target && typeof e.target.result === 'string') {
                resolve(e.target.result);
            } else {
                reject(new Error('Failed to read file as Data URL.'));
            }
        };

        reader.onerror = (e) => {
            reject(e.target?.error || new Error('FileReader error.'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * URL.createObjectURL()로 생성된 객체 URL을 해제하여 메모리를 확보합니다.
 * 이 함수는 더 이상 필요 없는 객체 URL을 정리할 때 사용해야 합니다.
 * @param {string} url - 해제할 객체 URL
 */
export function revokeObjectURL(url: string): void {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    } else {
        // Data URL (data:)은 revoke할 필요가 없습니다.
        // URL.createObjectURL()로 생성된 blob: URL만 revoke합니다.
        console.warn('Attempted to revoke a non-blob URL or an empty URL:', url);
    }
}
