export interface Client {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  qboCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWithPrimaryContact extends Client {
  primaryContact: {
    id: string;
    name: string;
    email: string | null;
    title: string | null;
  } | null;
}

export interface CreateClientDto {
  name: string;
  address?: string;
  notes?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}
