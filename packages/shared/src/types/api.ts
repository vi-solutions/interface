export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
