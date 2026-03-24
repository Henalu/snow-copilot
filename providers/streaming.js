// providers/streaming.js -- Shared streaming parsers for SSE and NDJSON responses.

export async function* readSseEventData(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const data = extractSseData(rawEvent);
      if (data !== null) {
        yield data;
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  const trailingData = extractSseData(buffer);
  if (trailingData !== null) {
    yield trailingData;
  }
}

export async function* readNdjsonLines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        yield trimmed;
      }
    }

    if (done) break;
  }

  const trailingLine = buffer.trim();
  if (trailingLine) {
    yield trailingLine;
  }
}

function extractSseData(rawEvent) {
  if (!rawEvent) return null;

  const dataLines = [];
  for (const rawLine of rawEvent.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  return dataLines.join('\n').trim();
}
