export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function getHealth(): Promise<{ status: string; model: string }> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function sendChat(messages: Message[]): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Chat request failed (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return data.reply;
}
