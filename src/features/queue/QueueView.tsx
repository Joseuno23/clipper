import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Plus, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  AdminCrudApiError,
  adminCrudKeys,
  customersApi,
  servicesApi,
  staffApi,
  type CustomerDto,
  type ServiceDto,
  type StaffDto,
} from "@/shared/api/adminCrud";
import {
  queueApi,
  queueKeys,
  type QueueStatus,
  type QueueTicketDto,
  type StaffQueueDto,
} from "@/shared/api/queue";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ChairSlot({ ticket }: { ticket?: QueueTicketDto }) {
  const occupied = ticket !== undefined;

  return (
    <div
      className={cn(
        "group relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-2xl border transition-all",
        occupied
          ? "border-destructive/30 bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_oklch(from_var(--destructive)_l_c_h_/_0.15)]"
          : "border-success/30 bg-success/10 text-success",
      )}
      title={occupied ? `Atendiendo · ${ticket.clientName}` : "Silla libre"}
    >
      <Armchair className="h-9 w-9" strokeWidth={1.6} />
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {occupied ? "Atendiendo" : "Libre"}
      </span>
      <span
        className={cn(
          "absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full ring-2 ring-card",
          occupied ? "bg-destructive" : "bg-success",
        )}
      />
    </div>
  );
}

function WaitTicket({ ticket }: { ticket: QueueTicketDto }) {
  return (
    <div className="flex min-w-[92px] flex-col items-center gap-1.5">
      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-all"
        title={`${ticket.clientName} · ${ticket.serviceName ?? "Sin servicio"}`}
      >
        <User className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
        #{ticket.queuePosition ?? "—"}
      </span>
      <span className="max-w-[92px] truncate text-[11px] font-medium text-foreground">
        {ticket.clientName}
      </span>
    </div>
  );
}

function QueueRow({
  queue,
  staffOptions,
  onMoveTicket,
  onUpdateStatus,
  isUpdating,
}: {
  queue: StaffQueueDto;
  staffOptions: StaffOption[];
  onMoveTicket: (ticket: QueueTicketDto, staffMemberId: string) => void;
  onUpdateStatus: (ticket: QueueTicketDto, queueStatus: QueueStatus) => void;
  isUpdating: boolean;
}) {
  const chairTicket = queue.tickets.find(
    (ticket) => ticket.queueStatus === "IN_SERVICE",
  );
  const waitingTickets = queue.tickets.filter(
    (ticket) => ticket.queueStatus !== "IN_SERVICE",
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border/80">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-border">
            {initials(queue.staffName)}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground">
              {queue.staffName}
            </p>
            <p className="text-xs text-muted-foreground">
              {queue.roles.join(" · ") || "Staff"} ·{" "}
              {queue.specialties.join(" · ") || "Sin especialidades"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {queue.inServiceCount} en silla · {queue.waitingCount} esperando
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto">
          <ChairSlot ticket={chairTicket} />
          <div className="h-px w-6 bg-border" aria-hidden />
          <div className="flex items-start gap-2.5">
            {waitingTickets.length > 0 ? (
              waitingTickets.map((ticket) => (
                <WaitTicket key={ticket.id} ticket={ticket} />
              ))
            ) : (
              <p className="min-w-32 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-center text-xs text-muted-foreground">
                Sin turnos esperando
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:min-w-64">
          <div className="flex items-center gap-3 xl:justify-end">
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Turnos
              </p>
              <p className="font-display text-base font-semibold tabular-nums text-foreground">
                {queue.totalActiveCount}
              </p>
            </div>
            <StatusBadge tone={chairTicket ? "destructive" : "success"}>
              {chairTicket ? "Atendiendo" : "Disponible"}
            </StatusBadge>
          </div>

          {queue.tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {ticket.clientName} · {ticket.serviceName ?? "Sin servicio"}
              </span>
              {ticket.queueStatus === "WAITING" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(ticket, "IN_SERVICE")}
                >
                  Pasar
                </Button>
              )}
              {ticket.queueStatus === "IN_SERVICE" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(ticket, "SERVED")}
                >
                  Servido
                </Button>
              )}
              <Select
                value={ticket.staffMemberId ?? undefined}
                onValueChange={(staffMemberId) =>
                  onMoveTicket(ticket, staffMemberId)
                }
                disabled={isUpdating}
              >
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Mover a" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QueueView() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const queuesQuery = useQuery({
    queryKey: queueKeys.live,
    queryFn: queueApi.live,
  });
  const customersQuery = useQuery({
    queryKey: adminCrudKeys.customersList({ limit: PAGE_SIZE, offset: 0 }),
    queryFn: () => customersApi.list({ limit: PAGE_SIZE, offset: 0 }),
  });
  const servicesQuery = useQuery({
    queryKey: adminCrudKeys.servicesList({ limit: PAGE_SIZE, offset: 0 }),
    queryFn: () => servicesApi.list({ limit: PAGE_SIZE, offset: 0 }),
  });
  const staffQuery = useQuery({
    queryKey: adminCrudKeys.staffList({ limit: PAGE_SIZE, offset: 0 }),
    queryFn: () => staffApi.list({ limit: PAGE_SIZE, offset: 0 }),
  });

  const refreshQueue = () =>
    queryClient.invalidateQueries({ queryKey: queueKeys.live });

  const createMutation = useMutation({
    mutationFn: queueApi.createWalkIn,
    onSuccess: async () => {
      setIsDialogOpen(false);
      setFormError(null);
      await refreshQueue();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      staffMemberId?: string;
      queueStatus?: QueueStatus;
    }) => queueApi.updateTicket(id, input),
    onSuccess: async () => refreshQueue(),
  });

  const queues = queuesQuery.data?.queues ?? [];
  const staffOptions = useMemo(
    () =>
      (staffQuery.data ?? []).map((staff) => ({
        id: staff.id,
        name: staff.displayName,
      })),
    [staffQuery.data],
  );
  const totalWaiting = queues.reduce((acc, q) => acc + q.waitingCount, 0);
  const totalActive = queues.reduce((acc, q) => acc + q.totalActiveCount, 0);
  const chairsFree = queues.filter((q) => q.inServiceCount === 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Colas en vivo"
        description="Estado actual de cada barbero, silla de atención y posiciones en espera."
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setFormError(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo turno
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Personas esperando" value={totalWaiting} />
        <Metric label="Sillas libres" value={chairsFree} tone="success" />
        <Metric label="Turnos activos" value={totalActive} />
      </div>

      {queuesQuery.isLoading ? (
        <StateCard title="Cargando colas" />
      ) : queuesQuery.isError ? (
        <StateCard
          title="No se pudieron cargar las colas"
          description={errorMessage(queuesQuery.error)}
        />
      ) : queues.length === 0 ? (
        <StateCard title="No hay staff activo para mostrar" />
      ) : (
        <div className="space-y-3">
          {queues.map((queue) => (
            <QueueRow
              key={queue.staffId}
              queue={queue}
              staffOptions={staffOptions}
              isUpdating={updateMutation.isPending}
              onMoveTicket={(ticket, staffMemberId) => {
                if (staffMemberId === ticket.staffMemberId) return;
                updateMutation.mutate({ id: ticket.id, staffMemberId });
              }}
              onUpdateStatus={(ticket, queueStatus) =>
                updateMutation.mutate({ id: ticket.id, queueStatus })
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Mostrando {queues.length} barberos activos
      </div>

      <NewWalkInDialog
        open={isDialogOpen}
        customers={customersQuery.data ?? []}
        services={servicesQuery.data ?? []}
        staff={staffQuery.data ?? []}
        error={formError}
        isSubmitting={createMutation.isPending}
        isLoading={
          customersQuery.isLoading ||
          servicesQuery.isLoading ||
          staffQuery.isLoading
        }
        onOpenChange={setIsDialogOpen}
        onSubmit={(input) => createMutation.mutate(input)}
      />
    </>
  );
}

type StaffOption = { id: string; name: string };

function NewWalkInDialog({
  open,
  customers,
  services,
  staff,
  error,
  isSubmitting,
  isLoading,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  customers: CustomerDto[];
  services: ServiceDto[];
  staff: StaffDto[];
  error: string | null;
  isSubmitting: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    clientId: string;
    serviceId: string;
    staffMemberId: string;
  }) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffMemberId, setStaffMemberId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientId("");
    setServiceId("");
    setStaffMemberId("");
    setLocalError(null);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId || !serviceId || !staffMemberId) {
      setLocalError(
        "Seleccioná cliente, servicio y staff para crear el turno.",
      );
      return;
    }

    setLocalError(null);
    onSubmit({ clientId, serviceId, staffMemberId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo turno walk-in</DialogTitle>
            <DialogDescription>
              Elegí un cliente existente, el servicio y el staff preferido.
            </DialogDescription>
          </DialogHeader>

          {(localError ?? error) && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {localError ?? error}
            </p>
          )}

          <SelectField
            label="Cliente"
            value={clientId}
            placeholder={
              isLoading ? "Cargando clientes…" : "Seleccionar cliente"
            }
            disabled={isSubmitting || isLoading}
            onValueChange={setClientId}
            items={customers.map((customer) => ({
              value: customer.id,
              label: `${customer.firstName} ${customer.lastName}`,
            }))}
          />
          <SelectField
            label="Servicio"
            value={serviceId}
            placeholder={
              isLoading ? "Cargando servicios…" : "Seleccionar servicio"
            }
            disabled={isSubmitting || isLoading}
            onValueChange={setServiceId}
            items={services.map((service) => ({
              value: service.id,
              label: `${service.name} · ${service.durationMinutes}m`,
            }))}
          />
          <SelectField
            label="Staff preferido"
            value={staffMemberId}
            placeholder={isLoading ? "Cargando staff…" : "Seleccionar staff"}
            disabled={isSubmitting || isLoading}
            onValueChange={setStaffMemberId}
            items={staff.map((member) => ({
              value: member.id,
              label: member.displayName,
            }))}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "Creando…" : "Crear turno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  disabled,
  items,
  onValueChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  items: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StateCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="font-display text-base font-semibold text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof AdminCrudApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
