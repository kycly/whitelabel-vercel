import { z } from "zod";
import { env } from "@/config/env";
import { buildPartnerAccessHeaders } from "@/config/partner-access";
import {
  buildSessionMetadata,
  normalizeExternalId,
  type SessionContextInput,
} from "@/lib/verification";

const createdSessionSchema = z.object({
  sessionId: z.string().min(1),
  kyclinkUrl: z.string().url(),
  expiresAt: z.string().min(1),
});

const kycSessionResultSchema = z.object({
  sessionId: z.string().min(1),
  externalId: z.string().optional(),
  status: z.enum(["pending", "processing", "completed"]),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  validationStatus: z.enum(["APPROVED", "REJECTED", "REVIEW"]).nullable(),
});

const decisionStatusSchema = z.enum(["APPROVED", "REJECTED", "REVIEW"]);

const kycSessionsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["pending", "processing", "completed"]).optional(),
  decisionStatus: decisionStatusSchema.optional(),
});

const upstreamKycSessionSchema = z.object({
  session_id: z.string().min(1),
  external_id: z.string().nullable(),
  status: z.string().min(1),
  expires_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string().min(1),
});

const kycSessionsListSchema = z.object({
  data: z.array(
    z.object({
      sessionId: z.string().min(1),
      externalId: z.string().nullable(),
      status: z.string().min(1),
      completed: z.boolean(),
      completedAt: z.string().nullable(),
      expiresAt: z.string().nullable(),
      createdAt: z.string().min(1),
      validationStatus: z.enum(["APPROVED", "REJECTED", "REVIEW"]).nullable(),
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
    decisionCounts: z.object({
      all: z.number().int().min(0),
      APPROVED: z.number().int().min(0),
      REJECTED: z.number().int().min(0),
      REVIEW: z.number().int().min(0),
    }),
  }),
});

export type CreatedKycSession = z.infer<typeof createdSessionSchema>;
export type KycSessionResult = z.infer<typeof kycSessionResultSchema>;
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
    decisionStatus: input.get("decisionStatus") ?? undefined,
  });
}

async function fetchUpstreamKycSessionsPage(params: {
  cognitoIdToken: string;
  limit: number;
  offset: number;
}): Promise<z.infer<typeof upstreamKycSessionSchema>[]> {
  const endpoint = new URL("/kyclink/sessions", `${env.server.kyclyBaseUrl}/`);
  endpoint.searchParams.set("limit", String(params.limit));
  endpoint.searchParams.set("offset", String(params.offset));

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

  const parsedBody = z
    .object({
      data: z.array(upstreamKycSessionSchema),
      meta: z.object({
        returned: z.number().int().min(0),
        limit: z.number().int().positive(),
        offset: z.number().int().min(0),
      }),
    })
    .parse(body);

  return parsedBody.data;
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

export async function fetchKycSessionResult(params: {
  cognitoIdToken: string;
  sessionId: string;
}): Promise<KycSessionResult> {
  const endpoint = new URL(`/kyclink/${params.sessionId}/result`, `${env.server.kyclyBaseUrl}/`).toString();
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
        : "KYC session result fetch failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "KYCLINK_RESULT_FETCH_FAILED";

    throw new KycSessionError(message, response.status, code);
  }

  return kycSessionResultSchema.parse(body);
}

async function fetchKycSessionResultFromSessionsIndex(params: {
  cognitoIdToken: string;
  sessionId: string;
}): Promise<KycSessionResult> {
  const upstreamPageSize = 50;

  for (let upstreamOffset = 0; ; upstreamOffset += upstreamPageSize) {
    const page = await fetchUpstreamKycSessionsPage({
      cognitoIdToken: params.cognitoIdToken,
      limit: upstreamPageSize,
      offset: upstreamOffset,
    });

    const matchingSession = page.find((item) => item.session_id === params.sessionId);

    if (matchingSession) {
      return kycSessionResultSchema.parse({
        sessionId: matchingSession.session_id,
        externalId: matchingSession.external_id ?? undefined,
        status: matchingSession.status,
        completed: matchingSession.completed_at !== null || matchingSession.status === "completed",
        completedAt: matchingSession.completed_at,
        validationStatus: null,
      });
    }

    if (page.length < upstreamPageSize) {
      break;
    }
  }

  throw new KycSessionError("KycLink session not found", 404, "KYCLINK_SESSION_NOT_FOUND");
}

export async function fetchKycSessionResultWithFallback(params: {
  cognitoIdToken: string;
  sessionId: string;
}): Promise<KycSessionResult> {
  try {
    return await fetchKycSessionResult(params);
  } catch (error) {
    if (!(error instanceof KycSessionError) || error.statusCode !== 404) {
      throw error;
    }

    return fetchKycSessionResultFromSessionsIndex(params);
  }
}

export async function fetchKycSessions(params: {
  cognitoIdToken: string;
  query: KycSessionsListQuery;
}): Promise<KycSessionsList> {
  const upstreamPageSize = 50;
  const upstreamRows: z.infer<typeof upstreamKycSessionSchema>[] = [];

  for (let upstreamOffset = 0; ; upstreamOffset += upstreamPageSize) {
    const page = await fetchUpstreamKycSessionsPage({
      cognitoIdToken: params.cognitoIdToken,
      limit: upstreamPageSize,
      offset: upstreamOffset,
    });

    upstreamRows.push(...page);

    if (page.length < upstreamPageSize) {
      break;
    }
  }

  const data = await Promise.all(
    upstreamRows.map(async (item) => {
      const completed = item.completed_at !== null || item.status === "completed";
      let validationStatus: KycSessionResult["validationStatus"] = null;

      if (completed) {
        try {
          const result = await fetchKycSessionResult({
            cognitoIdToken: params.cognitoIdToken,
            sessionId: item.session_id,
          });
          validationStatus = result.validationStatus;
        } catch (error) {
          if (!(error instanceof KycSessionError)) {
            throw error;
          }
        }
      }

      return {
        sessionId: item.session_id,
        externalId: item.external_id,
        status: item.status,
        completed,
        completedAt: item.completed_at,
        expiresAt: item.expires_at,
        createdAt: item.created_at,
        validationStatus,
      };
    }),
  );

  const statusCountsScope =
    params.query.decisionStatus === undefined
      ? data
      : data.filter((item) => item.validationStatus === params.query.decisionStatus);

  const decisionCountsScope =
    params.query.status === undefined
      ? data
      : data.filter((item) => item.status === params.query.status);

  const filteredData = data.filter((item) => {
    if (params.query.status && item.status !== params.query.status) {
      return false;
    }

    if (params.query.decisionStatus && item.validationStatus !== params.query.decisionStatus) {
      return false;
    }

    return true;
  });

  filteredData.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const pageData = filteredData.slice(params.query.offset, params.query.offset + params.query.limit);

  return kycSessionsListSchema.parse({
    data: pageData,
    meta: {
      returned: pageData.length,
      limit: params.query.limit,
      offset: params.query.offset,
      total: filteredData.length,
      statusCounts: {
        all: statusCountsScope.length,
        pending: statusCountsScope.filter((item) => item.status === "pending").length,
        processing: statusCountsScope.filter((item) => item.status === "processing").length,
        completed: statusCountsScope.filter((item) => item.status === "completed").length,
      },
      decisionCounts: {
        all: decisionCountsScope.length,
        APPROVED: decisionCountsScope.filter((item) => item.validationStatus === "APPROVED").length,
        REJECTED: decisionCountsScope.filter((item) => item.validationStatus === "REJECTED").length,
        REVIEW: decisionCountsScope.filter((item) => item.validationStatus === "REVIEW").length,
      },
    },
  });
}