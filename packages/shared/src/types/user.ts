export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "consultant" | "viewer";
  createdAt: string;
  updatedAt: string;
}
