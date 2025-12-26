// Utility to process NDJSON (newline-delimited JSON) streams from a fetch Response.
// Given a Response with a body stream, returns an async generator of parsed JSON objects.
// Example usage:
// const response = await fetch(...);
// for await (const obj of parseNDJSON(response)) { ... }

export async function* parseNDJSON(response: Response): AsyncGenerator<any, void, undefined> {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer = buffer.trim();
        if (buffer) {
          try {
            yield JSON.parse(buffer);
          } catch (err) {
            console.error('Failed to parse JSON chunk', err);
          }
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            yield JSON.parse(line);
          } catch (err) {
            console.error('Failed to parse JSON line', err);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}