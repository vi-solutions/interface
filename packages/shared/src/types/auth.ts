export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "admin" | "consultant" | "viewer";
  };
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
