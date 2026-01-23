export function createSSEParser(onEvent) {
  let buffer = "";
  const emit = (raw) => {
    if (!raw) return;
    const lines = raw.split(/\r?\n/);
    const data = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        let chunk = line.slice(5);
        if (chunk.startsWith(" ")) chunk = chunk.slice(1);
        data.push(chunk);
      }
    }
    if (data.length) onEvent(data.join("\n"));
  };
  return {
    feed(chunk) {
      if (!chunk) return;
      buffer += chunk;
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() || "";
      for (const part of parts) emit(part);
    }
  };
}

export function parseOpenAIStreamData(data) {
  const payload = String(data || "");
  if (payload.trim() === "[DONE]") return { delta: "", done: true };
  try {
    const json = JSON.parse(payload);
    const delta = json?.choices?.[0]?.delta?.content || "";
    return { delta, done: false };
  } catch {
    return { delta: "", done: false };
  }
}

export function parseAnthropicStreamData(data) {
  const payload = String(data || "");
  try {
    const json = JSON.parse(payload);
    if (json?.type === "message_stop") return { delta: "", done: true };
    const delta = json?.delta?.text || "";
    return { delta, done: false };
  } catch {
    return { delta: "", done: false };
  }
}

export function parseGeminiStreamData(data) {
  const payload = String(data || "");
  if (!payload.trim()) return { delta: "", done: false };
  try {
    const json = JSON.parse(payload);
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const delta = parts.map((part) => part?.text || "").join("");
    return { delta, done: false };
  } catch {
    return { delta: "", done: false };
  }
}
