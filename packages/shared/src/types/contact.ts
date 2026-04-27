export interface Contact {
  id: string;
  clientId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  agency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDto {
  clientId?: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  agency?: string;
}

export interface UpdateContactDto {
  name?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  agency?: string | null;
}

export interface ProjectContact {
  id: string;
  projectId: string;
  contactId: string;
  createdAt: string;
}

export interface ProjectContactWithDetails extends ProjectContact {
  contact: Contact;
}

export interface CreateProjectContactDto {
  projectId: string;
  contactId: string;
}
