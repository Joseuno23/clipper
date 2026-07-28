import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminCrudApiError } from "@/shared/api/adminCrud";
import { authKeys } from "@/shared/api/auth";
import { settingsApi, settingsKeys } from "@/shared/api/settings";
import { PageHeader } from "@/shared/components/PageHeader";

export function SettingsView() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: settingsKeys.detail,
    queryFn: settingsApi.get,
  });
  const [shopName, setShopName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;

    setShopName(settingsQuery.data.shop.name);
    setDisplayName(settingsQuery.data.user.displayName);
  }, [settingsQuery.data]);

  const refreshSettings = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
      queryClient.invalidateQueries({ queryKey: authKeys.me }),
    ]);

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: async () => {
      await refreshSettings();
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: settingsApi.updatePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordError(null);
      setPasswordMessage("Contraseña actualizada.");
    },
    onError: (error) => {
      setPasswordMessage(null);
      setPasswordError(errorMessage(error));
    },
  });

  function handleShopSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextShopName = shopName.trim();

    setShopMessage(null);
    if (!nextShopName) {
      setShopError("El nombre de la barbería es obligatorio.");
      return;
    }

    setShopError(null);
    updateSettingsMutation.mutate(
      { shopName: nextShopName },
      {
        onSuccess: () => setShopMessage("Nombre del negocio actualizado."),
        onError: (error) => setShopError(errorMessage(error)),
      },
    );
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayName.trim();

    setProfileMessage(null);
    if (!nextDisplayName) {
      setProfileError("Tu nombre visible es obligatorio.");
      return;
    }

    setProfileError(null);
    updateSettingsMutation.mutate(
      { displayName: nextDisplayName },
      {
        onSuccess: () => setProfileMessage("Perfil actualizado."),
        onError: (error) => setProfileError(errorMessage(error)),
      },
    );
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPasswordMessage(null);
    if (!currentPassword) {
      setPasswordError("Ingresá tu contraseña actual.");
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError(
        "La nueva contraseña debe tener al menos 12 caracteres.",
      );
      return;
    }

    setPasswordError(null);
    updatePasswordMutation.mutate({ currentPassword, newPassword });
  }

  const isSavingSettings = updateSettingsMutation.isPending;
  const userEmail = settingsQuery.data?.user.email ?? "";

  return (
    <>
      <PageHeader
        eyebrow="Negocio"
        title="Configuración"
        description="Datos básicos del negocio y de tu usuario. Los ajustes operativos quedan fuera de esta pantalla por ahora."
      />

      {settingsQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(settingsQuery.error)}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Negocio</CardTitle>
            <CardDescription>
              Nombre visible de la barbería dentro del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleShopSubmit} className="space-y-4">
              <Field label="Nombre de la barbería" htmlFor="shopName">
                <Input
                  id="shopName"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  disabled={settingsQuery.isLoading || isSavingSettings}
                />
              </Field>

              <FormFeedback error={shopError} message={shopMessage} />

              <Button
                type="submit"
                disabled={settingsQuery.isLoading || isSavingSettings}
              >
                {isSavingSettings ? "Guardando..." : "Guardar negocio"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mi perfil</CardTitle>
            <CardDescription>
              Datos básicos de tu usuario y cambio de contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <Field label="Nombre visible" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={settingsQuery.isLoading || isSavingSettings}
                />
              </Field>

              <Field label="Email" htmlFor="email">
                <Input id="email" value={userEmail} disabled readOnly />
              </Field>

              <FormFeedback error={profileError} message={profileMessage} />

              <Button
                type="submit"
                disabled={settingsQuery.isLoading || isSavingSettings}
              >
                {isSavingSettings ? "Guardando..." : "Guardar perfil"}
              </Button>
            </form>

            <div className="border-t border-border pt-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Cambiar contraseña
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Usá una contraseña nueva de al menos 12 caracteres.
                  </p>
                </div>

                <Field label="Contraseña actual" htmlFor="currentPassword">
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    disabled={updatePasswordMutation.isPending}
                  />
                </Field>

                <Field label="Nueva contraseña" htmlFor="newPassword">
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={updatePasswordMutation.isPending}
                  />
                </Field>

                <FormFeedback error={passwordError} message={passwordMessage} />

                <Button
                  type="submit"
                  disabled={updatePasswordMutation.isPending}
                >
                  {updatePasswordMutation.isPending
                    ? "Actualizando..."
                    : "Cambiar contraseña"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function FormFeedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (message) {
    return <p className="text-sm text-success">{message}</p>;
  }

  return null;
}

function errorMessage(error: unknown) {
  if (error instanceof AdminCrudApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
