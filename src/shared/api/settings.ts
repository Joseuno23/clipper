import { adminRequest } from "@/shared/api/adminCrud/client";

export type SettingsResponse = {
  shop: {
    name: string;
    slug: string;
  };
  user: {
    displayName: string;
    email: string;
  };
};

export type SettingsUpdateInput = {
  shopName?: string;
  displayName?: string;
};

export type PasswordUpdateInput = {
  currentPassword: string;
  newPassword: string;
};

export const settingsKeys = {
  all: ["settings"] as const,
  detail: ["settings", "detail"] as const,
};

export const settingsApi = {
  get() {
    return adminRequest<SettingsResponse>("/api/settings");
  },

  update(input: SettingsUpdateInput) {
    return adminRequest<SettingsResponse>("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  updatePassword(input: PasswordUpdateInput) {
    return adminRequest<{ updated: true }>("/api/settings/password", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
