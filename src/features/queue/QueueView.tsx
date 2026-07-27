import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Armchair,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
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
const CLIENT_SUGGESTION_LIMIT = 10;
const SERVICE_SUGGESTION_LIMIT = 8;
const MIN_SERVICE_SEARCH_LENGTH = 2;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ChairSlot({
  ticket,
  onEditTicket,
}: {
  ticket?: QueueTicketDto;
  onEditTicket: (ticket: QueueTicketDto) => void;
}) {
  const occupied = ticket !== undefined;
  const content = (
    <>
      <Armchair className="h-9 w-9" strokeWidth={1.6} />
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {occupied ? "Atendiendo" : "Libre"}
      </span>
      {occupied && (
        <span className="max-w-[78px] truncate text-[11px] font-semibold text-foreground">
          {ticket.clientName}
        </span>
      )}
      <span
        className={cn(
          "absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full ring-2 ring-card",
          occupied ? "bg-destructive" : "bg-success",
        )}
      />
    </>
  );

  const className = cn(
    "group relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-2xl border transition-all",
    occupied
      ? "border-destructive/30 bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_oklch(from_var(--destructive)_l_c_h_/_0.15)]"
      : "border-success/30 bg-success/10 text-success",
  );

  return occupied ? (
    <button
      type="button"
      className={className}
      title={`Editar turno · ${ticket.clientName}`}
      onClick={() => onEditTicket(ticket)}
    >
      {content}
    </button>
  ) : (
    <div className={cn(className)} title="Silla libre">
      {content}
    </div>
  );
}

function PublicChairSlot({ ticket }: { ticket?: QueueTicketDto }) {
  const occupied = ticket !== undefined;

  return (
    <div
      className={cn(
        "relative flex h-28 w-28 flex-col items-center justify-center rounded-3xl border text-center",
        occupied
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-success",
      )}
      title={occupied ? `Atendiendo · ${ticket.clientName}` : "Silla libre"}
    >
      <Armchair className="h-10 w-10" strokeWidth={1.6} />
      <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
        {occupied ? "Atendiendo" : "Libre"}
      </span>
      {occupied && (
        <span className="mt-1 max-w-[96px] truncate text-sm font-semibold text-foreground">
          {ticket.clientName}
        </span>
      )}
      <span
        className={cn(
          "absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full ring-2 ring-card",
          occupied ? "bg-destructive" : "bg-success",
        )}
      />
    </div>
  );
}

function WaitTicket({
  ticket,
  onEditTicket,
}: {
  ticket: QueueTicketDto;
  onEditTicket: (ticket: QueueTicketDto) => void;
}) {
  return (
    <div className="flex min-w-[92px] flex-col items-center gap-1.5">
      <button
        type="button"
        className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-all"
        title={`${ticket.clientName} · ${ticket.serviceName ?? "Sin servicio"}`}
        aria-label={`Editar turno de ${ticket.clientName}`}
        onClick={() => onEditTicket(ticket)}
      >
        <User className="h-5 w-5" strokeWidth={1.8} />
      </button>
      <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
        #{ticket.queuePosition ?? "—"}
      </span>
      <span className="max-w-[92px] truncate text-[11px] font-medium text-foreground">
        {ticket.clientName}
      </span>
    </div>
  );
}

function PublicWaitTicket({ ticket }: { ticket: QueueTicketDto }) {
  return (
    <div className="flex min-w-[112px] flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-center">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Posición {ticket.queuePosition ?? "—"}
      </span>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <User className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <span className="max-w-[104px] truncate text-sm font-semibold text-foreground">
        {ticket.clientName}
      </span>
    </div>
  );
}

function PublicQueueRow({ queue }: { queue: StaffQueueDto }) {
  const chairTicket = queue.tickets.find(
    (ticket) => ticket.queueStatus === "IN_SERVICE",
  );
  const waitingTickets = queue.tickets.filter(
    (ticket) => ticket.queueStatus !== "IN_SERVICE",
  );

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground ring-2 ring-border">
            {initials(queue.staffName)}
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {queue.staffName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {queue.inServiceCount} en silla · {queue.waitingCount} esperando
            </p>
          </div>
        </div>
        <StatusBadge tone={chairTicket ? "destructive" : "success"}>
          {chairTicket ? "Atendiendo" : "Disponible"}
        </StatusBadge>
      </div>

      <div className="flex items-center gap-5 overflow-x-auto pb-1">
        <PublicChairSlot ticket={chairTicket} />
        <div className="h-px w-8 shrink-0 bg-border" aria-hidden />
        <div className="flex items-stretch gap-3">
          {waitingTickets.length > 0 ? (
            waitingTickets.map((ticket) => (
              <PublicWaitTicket key={ticket.id} ticket={ticket} />
            ))
          ) : (
            <p className="min-w-40 rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
              Sin turnos esperando
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function QueueRow({
  queue,
  staffOptions,
  onMoveTicket,
  onReorderTicket,
  onUpdateStatus,
  onEditTicket,
  isUpdating,
}: {
  queue: StaffQueueDto;
  staffOptions: StaffOption[];
  onMoveTicket: (ticket: QueueTicketDto, staffMemberId: string) => void;
  onReorderTicket: (
    ticket: QueueTicketDto,
    positionAction: "UP" | "DOWN" | "FIRST_WAITING" | "LAST" | "CHAIR",
  ) => void;
  onUpdateStatus: (ticket: QueueTicketDto, queueStatus: QueueStatus) => void;
  onEditTicket: (ticket: QueueTicketDto) => void;
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
          <ChairSlot ticket={chairTicket} onEditTicket={onEditTicket} />
          <div className="h-px w-6 bg-border" aria-hidden />
          <div className="flex items-start gap-2.5">
            {waitingTickets.length > 0 ? (
              waitingTickets.map((ticket) => (
                <WaitTicket
                  key={ticket.id}
                  ticket={ticket}
                  onEditTicket={onEditTicket}
                />
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
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left hover:text-primary"
                onClick={() => onEditTicket(ticket)}
              >
                {ticket.clientName} · {ticket.serviceName ?? "Sin servicio"}
              </button>
              {ticket.queueStatus === "WAITING" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => onReorderTicket(ticket, "CHAIR")}
                  >
                    Pasar a silla
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Subir turno de ${ticket.clientName}`}
                    title="Subir"
                    disabled={isUpdating}
                    onClick={() => onReorderTicket(ticket, "UP")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Bajar turno de ${ticket.clientName}`}
                    title="Bajar"
                    disabled={isUpdating}
                    onClick={() => onReorderTicket(ticket, "DOWN")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Enviar turno de ${ticket.clientName} al final`}
                    title="Enviar al final"
                    disabled={isUpdating}
                    onClick={() => onReorderTicket(ticket, "LAST")}
                  >
                    <ChevronsDown className="h-3.5 w-3.5" />
                  </Button>
                </>
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
  const [editingTicket, setEditingTicket] = useState<QueueTicketDto | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const queuesQuery = useQuery({
    queryKey: queueKeys.live,
    queryFn: queueApi.live,
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
      positionAction?: "UP" | "DOWN" | "FIRST_WAITING" | "LAST" | "CHAIR";
    }) => queueApi.updateTicket(id, input),
    onSuccess: async () => refreshQueue(),
  });

  const editMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      clientId?: string;
      staffMemberId?: string;
      serviceIds?: string[];
    }) => queueApi.updateTicket(id, input),
    onSuccess: async () => {
      setEditingTicket(null);
      setEditError(null);
      await refreshQueue();
    },
    onError: (error) => setEditError(errorMessage(error)),
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
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/queue/display">Vista TV</a>
            </Button>
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
          </div>
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
              onReorderTicket={(ticket, positionAction) =>
                updateMutation.mutate({ id: ticket.id, positionAction })
              }
              onEditTicket={(ticket) => {
                setEditError(null);
                setEditingTicket(ticket);
              }}
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
        staff={staffQuery.data ?? []}
        error={formError}
        isSubmitting={createMutation.isPending}
        isLoading={staffQuery.isLoading}
        onOpenChange={setIsDialogOpen}
        onSubmit={(input) => createMutation.mutate(input)}
      />
      <EditQueueTicketDialog
        ticket={editingTicket}
        staff={staffQuery.data ?? []}
        error={editError}
        isSubmitting={editMutation.isPending}
        isLoading={staffQuery.isLoading}
        onOpenChange={(open) => {
          if (!open) setEditingTicket(null);
        }}
        onSubmit={(input) =>
          editingTicket &&
          editMutation.mutate({ id: editingTicket.id, ...input })
        }
      />
    </>
  );
}

export function QueueDisplayView({
  refetchIntervalMs = 5_000,
}: {
  refetchIntervalMs?: number;
}) {
  const queuesQuery = useQuery({
    queryKey: queueKeys.live,
    queryFn: queueApi.live,
    refetchInterval: refetchIntervalMs,
  });
  const queues = queuesQuery.data?.queues ?? [];
  const totalWaiting = queues.reduce((acc, q) => acc + q.waitingCount, 0);
  const totalActive = queues.reduce((acc, q) => acc + q.totalActiveCount, 0);
  const chairsFree = queues.filter((q) => q.inServiceCount === 0).length;

  return (
    <main className="min-h-screen bg-background p-6 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Vista TV"
          title="Colas en vivo"
          description="Estado visual de sillas y turnos para clientes en espera. Se actualiza automáticamente."
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
          <div className="space-y-4">
            {queues.map((queue) => (
              <PublicQueueRow key={queue.staffId} queue={queue} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Mostrando {queues.length} barberos activos · actualización automática
        </div>
      </div>
    </main>
  );
}

type StaffOption = { id: string; name: string };

function EditQueueTicketDialog({
  ticket,
  staff,
  error,
  isSubmitting,
  isLoading,
  onOpenChange,
  onSubmit,
}: {
  ticket: QueueTicketDto | null;
  staff: StaffDto[];
  error: string | null;
  isSubmitting: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    clientId: string;
    staffMemberId?: string;
    serviceIds: string[];
  }) => void;
}) {
  const open = ticket !== null;
  const [clientSearch, setClientSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(
    null,
  );
  const [selectedServices, setSelectedServices] = useState<ServiceDto[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const selectedServiceIds = useMemo(
    () => selectedServices.map((service) => service.id),
    [selectedServices],
  );
  const canSearchClients = shouldSearchClients(clientSearch);
  const clientSuggestionsQuery = useQuery({
    queryKey: adminCrudKeys.customersList({
      limit: CLIENT_SUGGESTION_LIMIT,
      offset: 0,
      query: clientSearch,
    }),
    queryFn: () =>
      customersApi.list({
        limit: CLIENT_SUGGESTION_LIMIT,
        offset: 0,
        query: clientSearch,
      }),
    enabled: open && canSearchClients && !selectedCustomer,
  });
  const clientSuggestions = useMemo(
    () =>
      prioritizeExactDocument(clientSuggestionsQuery.data ?? [], clientSearch),
    [clientSuggestionsQuery.data, clientSearch],
  );
  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === selectedStaffId) ?? null,
    [staff, selectedStaffId],
  );

  useEffect(() => {
    if (!ticket) return;

    setClientSearch(ticket.clientName);
    setSelectedCustomer(customerFromTicket(ticket));
    setSelectedServices(ticket.services.map(serviceFromTicketService));
    setSelectedStaffId(ticket.staffMemberId ?? "");
    setLocalError(null);
  }, [ticket]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) {
      setLocalError("Buscá y seleccioná el cliente correcto.");
      return;
    }
    if (selectedServiceIds.length === 0) {
      setLocalError("El turno debe tener al menos un servicio.");
      return;
    }
    if (
      selectedServiceIds.some((serviceId) => serviceId.startsWith("snapshot:"))
    ) {
      setLocalError(
        "Este turno tiene un servicio histórico sin ID. Quitalo y seleccioná el servicio activo correcto.",
      );
      return;
    }

    setLocalError(null);
    onSubmit({
      clientId: selectedCustomer.id,
      ...(selectedStaffId && selectedStaffId !== ticket?.staffMemberId
        ? { staffMemberId: selectedStaffId }
        : {}),
      serviceIds: selectedServiceIds,
    });
  }

  function addService(service: ServiceDto) {
    setSelectedServices((current) =>
      current.some((selected) => selected.id === service.id)
        ? current
        : [...current, service],
    );
  }

  function removeService(serviceId: string) {
    setSelectedServices((current) =>
      current.filter((service) => service.id !== serviceId),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Editar turno</DialogTitle>
            <DialogDescription>
              Corregí el cliente o los servicios cuando hubo un error operativo.
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

          <ClientAutocompleteField
            value={clientSearch}
            selectedCustomer={selectedCustomer}
            suggestions={clientSuggestions}
            isSearching={clientSuggestionsQuery.isFetching}
            disabled={isSubmitting}
            onChange={(value) => {
              setClientSearch(value);
              setSelectedCustomer(null);
            }}
            onSelect={(customer) => {
              setSelectedCustomer(customer);
              setClientSearch(customerLabel(customer));
            }}
          />

          <ServiceMultiSelect
            selectedStaff={selectedStaff}
            selectedServiceIds={selectedServiceIds}
            selectedServices={selectedServices}
            disabled={isSubmitting || isLoading}
            isLoading={isLoading}
            onAddService={addService}
            onRemoveService={removeService}
          />

          <SelectField
            label="Staff asignado"
            value={selectedStaffId}
            placeholder={isLoading ? "Cargando staff…" : "Seleccionar staff"}
            disabled={
              isSubmitting || isLoading || ticket?.queueStatus === "IN_SERVICE"
            }
            onValueChange={setSelectedStaffId}
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
            <Button
              type="submit"
              disabled={isSubmitting || selectedServiceIds.length === 0}
            >
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewWalkInDialog({
  open,
  staff,
  error,
  isSubmitting,
  isLoading,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  staff: StaffDto[];
  error: string | null;
  isSubmitting: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    serviceIds: string[];
    staffMemberId: string;
    client:
      | { kind: "existing"; clientId: string }
      | {
          kind: "new";
          firstName: string;
          lastName: string;
          phone?: string | null;
          documentNumber?: string | null;
        };
  }) => void;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(
    null,
  );
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceDto[]>([]);
  const [staffMemberId, setStaffMemberId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const selectedServiceIds = useMemo(
    () => selectedServices.map((service) => service.id),
    [selectedServices],
  );
  const canSearchClients = shouldSearchClients(clientSearch);
  const clientSuggestionsQuery = useQuery({
    queryKey: adminCrudKeys.customersList({
      limit: CLIENT_SUGGESTION_LIMIT,
      offset: 0,
      query: clientSearch,
    }),
    queryFn: () =>
      customersApi.list({
        limit: CLIENT_SUGGESTION_LIMIT,
        offset: 0,
        query: clientSearch,
      }),
    enabled: open && canSearchClients,
  });
  const rawClientSuggestions = clientSuggestionsQuery.data;
  const clientSuggestions = useMemo(
    () => prioritizeExactDocument(rawClientSuggestions ?? [], clientSearch),
    [rawClientSuggestions, clientSearch],
  );
  const searchDigits = onlyDigits(clientSearch);
  const exactDocumentMatch = (rawClientSuggestions ?? []).some(
    (customer) =>
      customer.normalizedDocument !== null &&
      customer.normalizedDocument !== undefined &&
      customer.normalizedDocument === searchDigits,
  );
  const canCreateNewClient =
    isDocumentLikeInput(clientSearch) &&
    !selectedCustomer &&
    !exactDocumentMatch;

  useEffect(() => {
    if (!open) return;
    setClientSearch("");
    setSelectedCustomer(null);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setSelectedServices([]);
    setStaffMemberId("");
    setLocalError(null);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedServiceIds.length === 0 || !staffMemberId) {
      setLocalError("Seleccioná servicio y staff para crear el turno.");
      return;
    }

    const client = selectedCustomer
      ? ({ kind: "existing", clientId: selectedCustomer.id } as const)
      : canCreateNewClient
        ? ({
            kind: "new",
            firstName: newFirstName,
            lastName: newLastName,
            phone: newPhone || null,
            documentNumber: clientSearch,
          } as const)
        : null;

    if (!client) {
      setLocalError(
        "Buscá y seleccioná un cliente, o cargá uno nuevo por DNI.",
      );
      return;
    }

    if (
      client.kind === "new" &&
      (!newFirstName.trim() || !newLastName.trim())
    ) {
      setLocalError("Completá nombre y apellido para crear el cliente.");
      return;
    }

    setLocalError(null);
    onSubmit({ client, serviceIds: selectedServiceIds, staffMemberId });
  }

  function addService(service: ServiceDto) {
    setSelectedServices((current) =>
      current.some((selected) => selected.id === service.id)
        ? current
        : [...current, service],
    );
  }

  function removeService(serviceId: string) {
    setSelectedServices((current) =>
      current.filter((service) => service.id !== serviceId),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo turno walk-in</DialogTitle>
            <DialogDescription>
              Buscá por DNI, teléfono o nombre. Si el DNI no existe, cargá el
              cliente y el turno juntos.
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

          <ClientAutocompleteField
            value={clientSearch}
            selectedCustomer={selectedCustomer}
            suggestions={clientSuggestions}
            isSearching={clientSuggestionsQuery.isFetching}
            disabled={isSubmitting}
            onChange={(value) => {
              setClientSearch(value);
              setSelectedCustomer(null);
            }}
            onSelect={(customer) => {
              setSelectedCustomer(customer);
              setClientSearch(customerLabel(customer));
            }}
          />
          {canCreateNewClient && !clientSuggestionsQuery.isFetching && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">
                No encontramos ese DNI. Completá los datos para crear el cliente
                junto con el turno.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Nombre"
                  value={newFirstName}
                  disabled={isSubmitting}
                  onChange={setNewFirstName}
                />
                <TextField
                  label="Apellido"
                  value={newLastName}
                  disabled={isSubmitting}
                  onChange={setNewLastName}
                />
              </div>
              <TextField
                label="Teléfono"
                value={newPhone}
                disabled={isSubmitting}
                onChange={setNewPhone}
              />
            </div>
          )}
          <ServiceMultiSelect
            selectedStaff={
              staff.find((member) => member.id === staffMemberId) ?? null
            }
            selectedServiceIds={selectedServiceIds}
            selectedServices={selectedServices}
            disabled={isSubmitting || isLoading}
            isLoading={isLoading}
            onAddService={addService}
            onRemoveService={removeService}
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
            <Button
              type="submit"
              disabled={
                isSubmitting || isLoading || selectedServiceIds.length === 0
              }
            >
              {isSubmitting ? "Creando…" : "Crear turno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceMultiSelect({
  selectedStaff,
  selectedServiceIds,
  selectedServices,
  disabled,
  isLoading,
  onAddService,
  onRemoveService,
}: {
  selectedStaff: StaffDto | null;
  selectedServiceIds: string[];
  selectedServices: ServiceDto[];
  disabled: boolean;
  isLoading: boolean;
  onAddService: (service: ServiceDto) => void;
  onRemoveService: (serviceId: string) => void;
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const serviceSearchQuery = serviceSearch.trim();
  const canSearchServices = shouldSearchServices(serviceSearch);
  const serviceSuggestionsQuery = useQuery({
    queryKey: adminCrudKeys.servicesList({
      limit: SERVICE_SUGGESTION_LIMIT,
      offset: 0,
      query: serviceSearchQuery,
    }),
    queryFn: () =>
      servicesApi.list({
        limit: SERVICE_SUGGESTION_LIMIT,
        offset: 0,
        query: serviceSearchQuery,
      }),
    enabled: isSearchOpen && canSearchServices && !disabled,
  });
  const selectedIds = useMemo(
    () => new Set(selectedServiceIds),
    [selectedServiceIds],
  );
  const suggestions = useMemo(
    () =>
      canSearchServices
        ? (serviceSuggestionsQuery.data ?? [])
            .filter((service) => !selectedIds.has(service.id))
            .filter((service) => serviceMatchesStaff(service, selectedStaff))
            .slice(0, SERVICE_SUGGESTION_LIMIT)
        : [],
    [
      canSearchServices,
      selectedIds,
      selectedStaff,
      serviceSuggestionsQuery.data,
    ],
  );

  function handleAddService(service: ServiceDto) {
    if (selectedIds.has(service.id)) return;

    onAddService(service);
    setServiceSearch("");
    setIsSearchOpen(false);
  }

  return (
    <section className="space-y-3" aria-labelledby="services-heading">
      <div className="flex items-center justify-between gap-3">
        <Label id="services-heading">Servicios del turno</Label>
        <span className="text-xs text-muted-foreground">
          {selectedServiceIds.length} seleccionado
          {selectedServiceIds.length === 1 ? "" : "s"}
        </span>
      </div>

      {selectedServices.length > 0 ? (
        <div className="space-y-2" aria-label="Servicios seleccionados">
          {selectedServices.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {service.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {service.durationMinutes}m · ${service.basePrice}
                </span>
              </span>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                onClick={() => onRemoveService(service.id)}
                aria-label={`Quitar ${service.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          Todavía no agregaste servicios.
        </p>
      )}

      {!isSearchOpen ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          disabled={disabled}
          onClick={() => setIsSearchOpen(true)}
        >
          + Agregar servicio
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <Label htmlFor="service-search">Buscar servicio</Label>
          <Input
            id="service-search"
            value={serviceSearch}
            disabled={disabled}
            placeholder={
              isLoading
                ? "Cargando servicios…"
                : "Escribí el nombre del servicio"
            }
            autoComplete="off"
            autoFocus
            onChange={(event) => setServiceSearch(event.target.value)}
          />
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando servicios…</p>
          ) : canSearchServices ? (
            <div className="rounded-md border border-border bg-card shadow-sm">
              {serviceSuggestionsQuery.isFetching ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Buscando…
                </p>
              ) : suggestions.length > 0 ? (
                suggestions.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                    onClick={() => handleAddService(service)}
                  >
                    <span className="font-medium">{service.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {service.durationMinutes}m · ${service.basePrice}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Sin coincidencias disponibles.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Escribí al menos {MIN_SERVICE_SEARCH_LENGTH} caracteres para{" "}
              buscar sin cargar toda la lista.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function serviceMatchesStaff(
  service: ServiceDto,
  selectedStaff: StaffDto | null,
) {
  if (!selectedStaff || service.allowedRoles.length === 0) return true;

  return service.allowedRoles.some((role) =>
    selectedStaff.roles.includes(role),
  );
}

function ClientAutocompleteField({
  value,
  selectedCustomer,
  suggestions,
  isSearching,
  disabled,
  onChange,
  onSelect,
}: {
  value: string;
  selectedCustomer: CustomerDto | null;
  suggestions: CustomerDto[];
  isSearching: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onSelect: (customer: CustomerDto) => void;
}) {
  const showSuggestions = shouldSearchClients(value) && !selectedCustomer;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cliente">Cliente</Label>
      <Input
        id="cliente"
        value={value}
        disabled={disabled}
        placeholder="DNI desde 4 dígitos, teléfono o nombre"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {!shouldSearchClients(value) && value.trim() && (
        <p className="text-xs text-muted-foreground">
          Escribí al menos 4 dígitos de DNI/teléfono o 3 letras del nombre.
        </p>
      )}
      {selectedCustomer && (
        <p className="text-xs text-success">
          Seleccionado: {customerLabel(selectedCustomer)}
        </p>
      )}
      {showSuggestions && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          {isSearching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
          ) : suggestions.length > 0 ? (
            suggestions.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                onClick={() => onSelect(customer)}
              >
                <span className="font-medium">{customerLabel(customer)}</span>
                <span className="block text-xs text-muted-foreground">
                  {[customer.documentNumber, customer.phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin documento/teléfono"}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin coincidencias.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function customerLabel(customer: CustomerDto) {
  return `${customer.firstName} ${customer.lastName}`;
}

function customerFromTicket(ticket: QueueTicketDto): CustomerDto | null {
  if (!ticket.clientId) return null;

  const [firstName = ticket.clientName, ...lastNameParts] =
    ticket.clientName.split(" ");

  return {
    id: ticket.clientId,
    firstName,
    lastName: lastNameParts.join(" "),
    email: null,
    phone: null,
    normalizedPhone: null,
    documentNumber: null,
    normalizedDocument: null,
    notes: null,
    isBlocked: false,
    createdAt: "",
    updatedAt: "",
  };
}

function serviceFromTicketService(
  service: QueueTicketDto["services"][number],
): ServiceDto {
  return {
    id: service.serviceId ?? `snapshot:${service.name}`,
    name: service.name,
    description: null,
    durationMinutes: service.durationMinutes,
    basePrice: service.price,
    isActive: true,
    allowedRoles: [],
    createdAt: "",
    updatedAt: "",
  };
}

function shouldSearchClients(value: string) {
  const trimmed = value.trim();
  if (onlyDigits(trimmed).length >= 4) return true;
  return trimmed.replace(/\d/g, "").length >= 3;
}

function isDocumentLikeInput(value: string) {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);

  if (digits.length < 4 || digits.length > 9) return false;
  if (/^\+/.test(trimmed)) return false;

  return true;
}

function shouldSearchServices(value: string) {
  return value.trim().length >= MIN_SERVICE_SEARCH_LENGTH;
}

function prioritizeExactDocument(customers: CustomerDto[], search: string) {
  const searchDigits = onlyDigits(search);
  const visibleCustomers = customers.filter((customer) => !customer.isBlocked);

  if (!searchDigits) return visibleCustomers;

  return [...visibleCustomers].sort((left, right) => {
    const leftExact = left.normalizedDocument === searchDigits;
    const rightExact = right.normalizedDocument === searchDigits;

    if (leftExact === rightExact) return 0;
    return leftExact ? -1 : 1;
  });
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
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
