export const getSkipNumber = (
  page: number | string,
  pageSize: number | string,
): number => {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.max(1, Number(pageSize) || 10);
  return (p - 1) * ps;
};

export const normalizePagination = (
  page?: number | string | null,
  pageSize?: number | string | null,
  maxPageSize = 100,
): { page: number; pageSize: number } => {
  const p = Math.max(1, Number(page) || 1);
  let ps = Math.max(1, Number(pageSize) || 10);
  if (ps > maxPageSize) ps = maxPageSize;
  return { page: p, pageSize: ps };
};
