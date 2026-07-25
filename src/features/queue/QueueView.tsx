import { Armchair, User, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { staff, customers } from "@/entities/mock-data";
import { cn } from "@/lib/utils";

type Slot = { occupied: boolean; customerName?: string; waitMin?: number };

interface BarberQueue {
  staffId: string;
  chair: Slot;
  waiting: Slot[];
}

const SLOTS_PER_QUEUE = 5;

// Mock queues per active barber
const queues: BarberQueue[] = [
  {
    staffId: "s1",
    chair: { occupied: true, customerName: customers[0].name, waitMin: 12 },
    waiting: [
      { occupied: true, customerName: customers[1].name, waitMin: 8 },
      { occupied: true, customerName: customers[4].name, waitMin: 3 },
      { occupied: false },
      { occupied: false },
      { occupied: false },
    ],
  },
  {
    staffId: "s2",
    chair: { occupied: true, customerName: customers[2].name, waitMin: 25 },
    waiting: [
      { occupied: true, customerName: customers[5].name, waitMin: 10 },
      { occupied: false },
      { occupied: false },
      { occupied: false },
      { occupied: false },
    ],
  },
  {
    staffId: "s3",
    chair: { occupied: false },
    waiting: [
      { occupied: true, customerName: customers[1].name, waitMin: 2 },
      { occupied: false },
      { occupied: false },
      { occupied: false },
      { occupied: false },
    ],
  },
  {
    staffId: "s4",
    chair: { occupied: false },
    waiting: [
      { occupied: false },
      { occupied: false },
      { occupied: false },
      { occupied: false },
      { occupied: false },
    ],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ChairSlot({ slot }: { slot: Slot }) {
  const occupied = slot.occupied;
  return (
    <div
      className={cn(
        "group relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-2xl border transition-all",
        occupied
          ? "border-destructive/30 bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_oklch(from_var(--destructive)_l_c_h_/_0.15)]"
          : "border-success/30 bg-success/10 text-success",
      )}
      title={occupied ? `Ocupada · ${slot.customerName}` : "Silla libre"}
    >
      <Armchair className="h-9 w-9" strokeWidth={1.6} />
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {occupied ? "Ocupada" : "Libre"}
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

function WaitSlot({ slot, position }: { slot: Slot; position: number }) {
  const occupied = slot.occupied;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all",
          occupied
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border bg-surface text-muted-foreground/50",
        )}
        title={
          occupied ? `${slot.customerName} · ${slot.waitMin}m` : "Disponible"
        }
      >
        <User className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
        {position}
      </span>
    </div>
  );
}

function QueueRow({ q }: { q: BarberQueue }) {
  const barber = staff.find((s) => s.id === q.staffId)!;
  const occupiedCount =
    (q.chair.occupied ? 1 : 0) + q.waiting.filter((w) => w.occupied).length;
  const total = 1 + q.waiting.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border/80">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Barber identity */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-border"
            style={{ backgroundColor: barber.avatarColor }}
          >
            {initials(barber.name)}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground">
              {barber.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {barber.role === "SPECIALIST" ? "Especialista" : "Barbero"} ·{" "}
              {barber.specialties.join(" · ") || "—"}
            </p>
          </div>
        </div>

        {/* Queue visualization */}
        <div className="flex items-center gap-4 overflow-x-auto">
          <ChairSlot slot={q.chair} />
          <div className="h-px w-6 bg-border" aria-hidden />
          <div className="flex items-end gap-2.5">
            {q.waiting.slice(0, SLOTS_PER_QUEUE).map((slot, i) => (
              <WaitSlot key={i} slot={slot} position={i + 1} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Ocupación
            </p>
            <p className="font-display text-base font-semibold tabular-nums text-foreground">
              {occupiedCount}/{total}
            </p>
          </div>
          <StatusBadge tone={q.chair.occupied ? "destructive" : "success"}>
            {q.chair.occupied ? "Atendiendo" : "Disponible"}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}

export function QueueView() {
  const totalOccupied = queues.reduce(
    (acc, q) =>
      acc +
      (q.chair.occupied ? 1 : 0) +
      q.waiting.filter((w) => w.occupied).length,
    0,
  );
  const totalWaiting = queues.reduce(
    (acc, q) => acc + q.waiting.filter((w) => w.occupied).length,
    0,
  );
  const chairsFree = queues.filter((q) => !q.chair.occupied).length;

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Colas en vivo"
        description="Estado actual de cada barbero, silla de atención y posiciones en espera."
        actions={
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" /> Libre
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-destructive" /> Ocupado
            </span>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Personas en cola
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {totalWaiting}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sillas libres
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-success">
            {chairsFree}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Capacidad usada
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {totalOccupied}
            <span className="text-base text-muted-foreground">
              /{queues.length * (1 + SLOTS_PER_QUEUE)}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {queues.map((q) => (
          <QueueRow key={q.staffId} q={q} />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Mostrando {queues.length} barberos activos
      </div>
    </>
  );
}
