import { PaginationMeta } from '../types';

export const getOffset = (page: number, limit: number): number => (page - 1) * limit;

export const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
