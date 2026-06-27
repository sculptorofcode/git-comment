/**
 * Helper to parse Server-Sent Events (SSE) streams from standard Fetch API responses.
 * @param response The Fetch API Response object.
 * @param onToken Callback executed when a new text token is parsed.
 * @param onParse Mapping function that receives each trimmed line of data (usually starting with 'data: ')
 *                and returns the text token if parsed successfully, or undefined.
 */
export async function parseStream(
    response: Response,
    onToken: (token: string) => void,
    onParse: (line: string) => string | undefined
): Promise<string> {
    if (!response.body) {
        throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    continue;
                }

                const token = onParse(trimmed);
                if (token !== undefined) {
                    accumulatedText += token;
                    onToken(token);
                }
            }
        }

        // Process any remaining text in the buffer
        if (buffer.trim()) {
            const token = onParse(buffer.trim());
            if (token !== undefined) {
                accumulatedText += token;
                onToken(token);
            }
        }
    } finally {
        reader.releaseLock();
    }

    return accumulatedText;
}
