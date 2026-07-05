import { useEffect, useState } from "react";
import { getHealth } from "./api";
import ChatTest from "./components/ChatTest";

export default function App() {
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [model, setModel] = useState("");

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth("ok");
        setModel(h.model);
      })
      .catch(() => setHealth("down"));
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>AI Interview Practice</h1>
      <p>
        Backend:{" "}
        {health === "checking" && <span>checking...</span>}
        {health === "ok" && <span style={{ color: "green" }}>connected (model: {model})</span>}
        {health === "down" && <span style={{ color: "crimson" }}>unavailable</span>}
      </p>
      <ChatTest />
    </main>
  );
}
