export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  threadId?: string; // link to pabili or restock order
  context?: "pabili" | "restock" | "support";
}

type Listener = (message: ChatMessage) => void;

const listeners = new Set<Listener>();
const history: ChatMessage[] = [];

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function sendMessage(input: Omit<ChatMessage, "id" | "timestamp"> & { id?: string; timestamp?: string }): ChatMessage {
  const message: ChatMessage = {
    id: input.id || uuid(),
    timestamp: input.timestamp || new Date().toISOString(),
    senderId: input.senderId,
    receiverId: input.receiverId,
    message: input.message,
    context: input.context,
    threadId: input.threadId,
  };
  history.push(message);
  listeners.forEach(fn => fn(message));
  return message;
}

export function getConversation(a: string, b: string): ChatMessage[] {
  return history
    .filter(m =>
      (m.senderId === a && m.receiverId === b) ||
      (m.senderId === b && m.receiverId === a)
    )
    .sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAllMessages() {
  return [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

