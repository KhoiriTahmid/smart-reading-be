import { URLSearchParams } from 'url';

const buildParams = (params: Record<string, any>) => {
  const url = new URLSearchParams();
  for (const key in params) {
    url.append(key, params[key]);
  }
  return `?${url.toString()}`;
};

export function generatePaginationResponse({
  count,
  query,
}: {
  count: number;
  query: Record<string, any>;
}) {
  const limit = Number(query.limit);
  const offset = Number(query.offset ?? 0);

  let nextQuery: string | undefined | null = undefined;
  let prevQuery: string | undefined | null = undefined;

  if (offset === 0) prevQuery = null;
  if (count <= limit + offset) nextQuery = null;

  if (nextQuery === null && prevQuery === null)
    return { count, nextQuery, prevQuery };

  if (nextQuery !== null)
    nextQuery = buildParams({ ...query, offset: offset + limit });
  if (prevQuery !== null)
    prevQuery = buildParams({ ...query, offset: Math.max(offset - limit, 0) });

  return {
    count,
    prevQuery,
    nextQuery,
  };
}
