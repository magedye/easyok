export async function* parseNDJSONStream(
  response: Response
): AsyncGenerator<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      yield JSON.parse(line);
    }
  }

  if (buffer.trim()) {
    yield JSON.parse(buffer);
  }
}
