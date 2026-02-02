// Warda API Service
const API_URL = process.env.REACT_APP_API_URL || "http://13.40.187.182:3001";

export const checkHealth = async () => {
  const res = await fetch(API_URL + "/api/health");
  return res.json();
};

export const getContacts = async (userId: string) => {
  const res = await fetch(API_URL + "/api/family/" + userId + "/contacts");
  return res.json();
};

export const getMessages = async (userId: string, contactId: string) => {
  const res = await fetch(API_URL + "/api/messages/" + userId + "/" + contactId);
  return res.json();
};

export const sendMessage = async (senderId: string, recipientId: string, content: string) => {
  const res = await fetch(API_URL + "/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderId, recipientId, content }),
  });
  return res.json();
};

export const chatWithWarda = async (userId: string, message: string) => {
  const res = await fetch(API_URL + "/api/conversation/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message }),
  });
  return res.json();
};

export const getEvents = async (userId: string) => {
  const res = await fetch(API_URL + "/api/family/" + userId + "/events");
  return res.json();
};

