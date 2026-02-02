import { useState, useCallback } from "react";

const API_URL = "http://13.40.187.182:3001";

interface Message {
  id: string;
  from: "user" | "warda";
  text: string;
  time: string;
}

export function useWarda(userId: string, residentName: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    setIsLoading(true);
    const userMsg: Message = {
      id: Date.now().toString(),
      from: "user",
      text,
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(API_URL + "/api/conversation/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text, context: { residentName } })
      });
      const data = await res.json();
      if (data.success) {
        const wardaMsg: Message = {
          id: (Date.now() + 1).toString(),
          from: "warda",
          text: data.response.text,
          time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, wardaMsg]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  }, [userId, residentName]);

  return { messages, sendMessage, isLoading };
}
