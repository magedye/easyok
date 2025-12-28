import {
  AskRequest,
  TrainingItemRequest,
  QueryAssetCreate,
  ScheduleCreate,
  FeatureToggle,
  SandboxPromotion,
  NDJSONChunk,
} from "./types";
import { parseNDJSONStream } from "./ndjson";

export class EasyDataClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  // ----------------------------------
  // Hot Path
  // ----------------------------------

  async *ask(request: AskRequest): AsyncGenerator<NDJSONChunk> {
    const res = await fetch(`${this.baseUrl}/api/v1/ask`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`Ask failed: ${res.status}`);
    }

    for await (const chunk of parseNDJSONStream(res)) {
      yield chunk as NDJSONChunk;
    }
  }

  // ----------------------------------
  // Training (Admin)
  // ----------------------------------

  async train(
    type: "schema" | "ddl" | "documentation" | "sql" | "csv",
    payload: TrainingItemRequest
  ): Promise<void> {
    await this.post(`/train/v1/${type}`, payload);
  }

  async approveAssumption(id: string): Promise<void> {
    await this.post(`/train/v1/assumptions/${id}/approve`, {});
  }

  async rejectAssumption(id: string): Promise<void> {
    await this.post(`/train/v1/assumptions/${id}/reject`, {});
  }

  // ----------------------------------
  // Assets
  // ----------------------------------

  async createAsset(payload: QueryAssetCreate): Promise<void> {
    await this.post(`/platform/v1/assets/queries`, payload);
  }

  async listAssets(): Promise<any[]> {
    return this.get(`/platform/v1/assets/queries`);
  }

  async shareAsset(assetId: string): Promise<void> {
    await this.post(`/platform/v1/assets/queries/${assetId}/share`, {});
  }

  async archiveAsset(assetId: string): Promise<void> {
    await fetch(
      `${this.baseUrl}/api/v1/platform/v1/assets/queries/${assetId}`,
      {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${this.token}` },
      }
    );
  }

  // ----------------------------------
  // Scheduling
  // ----------------------------------

  async createSchedule(payload: ScheduleCreate): Promise<void> {
    await this.post(`/platform/v1/schedules`, payload);
  }

  // ----------------------------------
  // Admin / Governance
  // ----------------------------------

  async getAuditLogs(): Promise<any[]> {
    return this.get(`/admin/v1/audit/logs`);
  }

  async getSchemaDrifts(): Promise<any[]> {
    return this.get(`/admin/v1/schema/drift`);
  }

  async toggleFeature(payload: FeatureToggle): Promise<void> {
    await this.post(`/admin/v1/toggles`, payload);
  }

  async promoteSandbox(payload: SandboxPromotion): Promise<void> {
    await this.post(`/admin/sandbox/promote`, payload);
  }

  // ----------------------------------
  // Internal helpers
  // ----------------------------------

  private async get(path: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Authorization": `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`GET ${path} failed`);
    return res.json();
  }

  private async post(path: string, body: any): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed`);
  }
}
