import { z } from "zod";
import { env } from "@/config/env";
import { resolveCreatedFrom } from "@/lib/session-period";
import { buildPartnerAccessHeaders } from "@/config/partner-access";
import {
  buildSessionMetadata,
  normalizeExternalId,
  type SessionContextInput,
} from "@/lib/verification";
import { projectVerificationDetail, type VerificationDetail } from "@/server/verification-detail";
import type { SessionState } from "@/components/verify/verification-view-state";

const createdSessionSchema = z.object({
  sessionId: z.string().min(1),
  kyclinkUrl: z.string().url(),
  expiresAt: z.string().min(1),
});

const sessionStatusSchema = z.enum(["pending", "processing", "completed"]);
const sessionStateSchema = z.enum(["ACTIVE", "SUBMITTED", "COMPLETED", "EXPIRED"]) satisfies z.ZodType<SessionState>;

const kycSessionSchema = z.object({
  sessionId: z.string().min(1),
  externalId: z.string().nullable(),
  kyclinkUrl: z.string().url(),
  status: sessionStatusSchema,
  expiresAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  workflowStatus: z.enum(["PENDING", "IN_REVIEW", "ESCALATED", "APPROVED", "REJECTED"]).nullable(),
  sessionState: sessionStateSchema,
  resumeAvailable: z.boolean(),
});

const workflowStatusSchema = z.enum(["PENDING", "IN_REVIEW", "ESCALATED", "APPROVED", "REJECTED"]);

const kycSessionsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["pending", "processing", "completed"]).optional(),
  workflowStatus: workflowStatusSchema.optional(),
  q: z.string().min(1).max(120).optional(),
  period: z.enum(["7d", "30d", "all"]).default("all"),
});

const upstreamKycSessionSchema = z.object({
  session_id: z.string().min(1),
  external_id: z.string().nullable(),
  status: z.string().min(1),
  workflow_status: workflowStatusSchema.nullable().optional(),
  expires_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string().min(1),
  sessionState: sessionStateSchema,
  resumeAvailable: z.boolean(),
});

// La meta de l'amont est desormais exigee complete : c'est lui qui compte, plus nous.
const upstreamMetaSchema = z.object({
  returned: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  total: z.number().int().min(0),
  statusCounts: z.object({
    all: z.number().int().min(0),
    pending: z.number().int().min(0),
    processing: z.number().int().min(0),
    completed: z.number().int().min(0),
  }),
  workflowCounts: z.object({
    all: z.number().int().min(0),
    PENDING: z.number().int().min(0),
    IN_REVIEW: z.number().int().min(0),
    ESCALATED: z.number().int().min(0),
    APPROVED: z.number().int().min(0),
    REJECTED: z.number().int().min(0),
  }),
});

const kycSessionsListSchema = z.object({
  data: z.array(
    z.object({
      sessionId: z.string().min(1),
      externalId: z.string().nullable(),
      status: z.string().min(1),
      completedAt: z.string().nullable(),
      expiresAt: z.string().nullable(),
      createdAt: z.string().min(1),
      workflowStatus: workflowStatusSchema.nullable(),
      sessionState: sessionStateSchema,
      resumeAvailable: z.boolean(),
    }),
  ),
  meta: z.object({
    returned: z.number().int().min(0),
    limit: z.number().int().positive().max(50),
    offset: z.number().int().min(0),
    total: z.number().int().min(0),
    statusCounts: z.object({
      all: z.number().int().min(0),
      pending: z.number().int().min(0),
      processing: z.number().int().min(0),
      completed: z.number().int().min(0),
    }),
    workflowCounts: z.object({
      all: z.number().int().min(0),
      PENDING: z.number().int().min(0),
      IN_REVIEW: z.number().int().min(0),
      ESCALATED: z.number().int().min(0),
      APPROVED: z.number().int().min(0),
      REJECTED: z.number().int().min(0),
    }),
  }),
});

export type CreatedKycSession = z.infer<typeof createdSessionSchema>;
export type KycSession = z.infer<typeof kycSessionSchema>;
export type KycSessionsListQuery = z.infer<typeof kycSessionsListQuerySchema>;
export type KycSessionsList = z.infer<typeof kycSessionsListSchema>;

export class KycSessionError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function parseKycSessionsListQuery(input: URLSearchParams): KycSessionsListQuery {
  return kycSessionsListQuerySchema.parse({
    limit: input.get("limit") ?? undefined,
    offset: input.get("offset") ?? undefined,
    status: input.get("status") ?? undefined,
    workflowStatus: input.get("workflowStatus") ?? undefined,
    q: input.get("q") ?? undefined,
    period: input.get("period") ?? undefined,
  });
}

async function fetchUpstreamKycSessions(params: {
  cognitoIdToken: string;
  query: KycSessionsListQuery;
}): Promise<{
  data: z.infer<typeof upstreamKycSessionSchema>[];
  meta: z.infer<typeof upstreamMetaSchema>;
}> {
  const endpoint = new URL("/kyclink/sessions", `${env.server.kyclyBaseUrl}/`);
  endpoint.searchParams.set("limit", String(params.query.limit));
  endpoint.searchParams.set("offset", String(params.query.offset));
  if (params.query.status) endpoint.searchParams.set("status", params.query.status);
  if (params.query.workflowStatus) {
    endpoint.searchParams.set("workflowStatus", params.query.workflowStatus);
  }
  if (params.query.q) endpoint.searchParams.set("q", params.query.q);

  // Le vocabulaire d'interface (« 30 derniers jours ») est traduit ici en borne absolue :
  // partner-node ne connait que `createdFrom`.
  const createdFrom = resolveCreatedFrom(params.query.period, new Date());
  if (createdFrom) endpoint.searchParams.set("createdFrom", createdFrom);

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.cognitoIdToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "KYC sessions fetch failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "KYCLINK_SESSIONS_FETCH_FAILED";

    throw new KycSessionError(message, response.status, code);
  }

  return z
    .object({ data: z.array(upstreamKycSessionSchema), meta: upstreamMetaSchema })
    .parse(body);
}

export async function createKycSession(params: {
  cognitoIdToken: string;
  input: SessionContextInput;
  parentOrigin: string;
}): Promise<CreatedKycSession> {
  const endpoint = new URL("/kyclink/create", `${env.server.kyclyBaseUrl}/`).toString();
  const payload = {
    externalId: normalizeExternalId(params.input.referenceClient),
    parentOrigin: params.parentOrigin,
    metadata: buildSessionMetadata(params.input),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.cognitoIdToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "KYC session creation failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "KYCLINK_CREATE_FAILED";

    throw new KycSessionError(message, response.status, code);
  }

  return createdSessionSchema.parse(body);
}

export async function fetchKycSession(params: {
  cognitoIdToken: string;
  sessionId: string;
}): Promise<KycSession> {
  const endpoint = new URL(`/kyclink/${params.sessionId}`, `${env.server.kyclyBaseUrl}/`).toString();
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.cognitoIdToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "KYC session fetch failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "KYCLINK_SESSION_FETCH_FAILED";

    throw new KycSessionError(message, response.status, code);
  }

  return kycSessionSchema.parse(body);
}

export async function fetchKycSessions(params: {
  cognitoIdToken: string;
  query: KycSessionsListQuery;
}): Promise<KycSessionsList> {
  // Passe-plat. Le filtrage, le tri, la pagination et les compteurs sont faits par l'amont, qui
  // a la base : rapatrier toute la liste pour la retrier ici ne passait pas a l'echelle et ne
  // pouvait pas servir la recherche.
  const upstream = await fetchUpstreamKycSessions(params);

  const data = upstream.data.map((item) => ({
    sessionId: item.session_id,
    externalId: item.external_id,
    status: item.status,
    completedAt: item.completed_at,
    expiresAt: item.expires_at,
    createdAt: item.created_at,
    workflowStatus: item.workflow_status ?? null,
    // Servis tels quels par partner-node : la reprenabilite ne se recalcule pas ici.
    sessionState: item.sessionState,
    resumeAvailable: item.resumeAvailable,
  }));

  return kycSessionsListSchema.parse({ data, meta: upstream.meta });
}

export async function fetchKycVerificationDetail(params: {
  cognitoIdToken: string;
  sessionId: string;
}): Promise<VerificationDetail> {
  const endpoint = new URL(
    `/kyclink/${params.sessionId}/verification-detail`,
    `${env.server.kyclyBaseUrl}/`,
  ).toString();
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.cognitoIdToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "Verification detail fetch failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "VERIFICATION_DETAIL_FETCH_FAILED";
    throw new KycSessionError(message, response.status, code);
  }

  return projectVerificationDetail(body);
}

export async function fetchKycVerificationImage(params: {
  cognitoIdToken: string;
  sessionId: string;
  side: string;
}): Promise<{ body: ArrayBuffer; contentType: string }> {
  const endpoint = new URL(
    `/kyclink/${params.sessionId}/verification-detail/images/${params.side}`,
    `${env.server.kyclyBaseUrl}/`,
  ).toString();
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.cognitoIdToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new KycSessionError("Verification image fetch failed", response.status, "VERIFICATION_IMAGE_FETCH_FAILED");
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}