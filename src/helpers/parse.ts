export function generatePaginationResponse(
  count: number,
  limit: number,
  offset: number,
) {
  return {
    limit,
    offset,
    count,
  };
}
