import { api } from "./client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  companies?: {
    companyId: string;
    status: string;
    membershipRole: string | null;
  }[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: string;
  companyIds?: string[];
}

export const usersApi = {
  me: () => api.get<User>("/users/me"),
  updateMe: (data: { name?: string }) => api.patch<User>("/users/me", data),
  list: () => api.get<User[]>("/users"),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: CreateUserInput) => api.post<User>("/users", data),
  update: (id: string, data: { name?: string; email?: string }) => api.patch<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  changeRole: (id: string, role: string) => api.patch<User>(`/users/${id}/role`, { role }),
  addToCompany: (id: string, companyId: string) => api.post<User>(`/users/${id}/companies`, { companyId }),
  removeFromCompany: (id: string, companyId: string) => api.delete(`/users/${id}/companies/${companyId}`),
};
