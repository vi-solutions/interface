export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}
