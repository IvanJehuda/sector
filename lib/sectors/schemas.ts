import { z } from 'zod';

export const DailySchema = z.array(
  z.object({ symbol: z.string(), date: z.string(), close: z.number() }).passthrough(),
);

export const IndexDailySchema = z.array(
  z.object({ index_code: z.string(), date: z.string(), price: z.number() }).passthrough(),
);

export const ForeignFlowSchema = z
  .object({
    symbol: z.string(),
    data: z.array(z.object({ date: z.string(), net_foreign_inflow: z.number() }).passthrough()),
  })
  .passthrough();

const PaginationSchema = z
  .object({ total_count: z.number(), has_next: z.boolean(), next_offset: z.number().nullable() })
  .passthrough();

export const ScreenerSchema = z
  .object({
    results: z.array(
      z
        .object({
          symbol: z.string(),
          company_name: z.string(),
          query_values: z.record(z.unknown()).nullable().optional(),
        })
        .passthrough(),
    ),
    pagination: PaginationSchema,
  })
  .passthrough();

export const CompanyOverviewSchema = z
  .object({
    symbol: z.string(),
    company_name: z.string(),
    overview: z
      .object({
        sub_sector: z.string().nullable().optional(),
        affiliates: z.array(z.string()).nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const MoverSchema = z
  .object({ name: z.string(), symbol: z.string(), price_change: z.number(), latest_close_date: z.string() })
  .passthrough();

export const TopChangesSchema = z
  .object({
    top_losers: z.record(z.array(MoverSchema)).optional(),
    top_gainers: z.record(z.array(MoverSchema)).optional(),
  })
  .passthrough();

export const NewsArticleSchema = z
  .object({
    title: z.string(),
    body: z.string().nullable().optional(),
    source: z.string(),
    timestamp: z.string(),
    sector: z.string().nullable().optional(),
    sub_sector: z.array(z.string()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    symbols: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

export const NewsPageSchema = z.object({ results: z.array(NewsArticleSchema), pagination: PaginationSchema }).passthrough();

export const TagsSchema = z.array(z.string());
