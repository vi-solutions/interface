export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  isAdmin?: boolean;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  isAdmin?: boolean;
}
