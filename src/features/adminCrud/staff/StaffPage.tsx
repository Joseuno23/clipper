import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/widgets/data-table/DataTable";
import {
  adminCrudKeys,
  AdminCrudApiError,
  staffApi,
  type StaffCreateInput,
  type StaffDto,
} from "@/shared/api/adminCrud";
import {
  CrudPageShell,
  DeleteDialog,
  PaginationControls,
  TableState,
} from "@/shared/components/adminCrud";

import { staffColumns } from "./columns";
import { StaffFormDialog } from "./StaffFormDialog";

const PAGE_SIZE = 10;

export function StaffCrudPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [formStaff, setFormStaff] = useState<StaffDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteStaff, setDeleteStaff] = useState<StaffDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listParams = { limit: PAGE_SIZE, offset };
  const staffQuery = useQuery({
    queryKey: adminCrudKeys.staffList(listParams),
    queryFn: () => staffApi.list(listParams),
  });

  const refreshStaff = () =>
    queryClient.invalidateQueries({ queryKey: adminCrudKeys.staff });

  const saveMutation = useMutation({
    mutationFn: (input: StaffCreateInput) =>
      formStaff ? staffApi.update(formStaff.id, input) : staffApi.create(input),
    onSuccess: async () => {
      setIsFormOpen(false);
      setFormStaff(null);
      setFormError(null);
      await refreshStaff();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (staff: StaffDto) => staffApi.delete(staff.id),
    onSuccess: async () => {
      setDeleteStaff(null);
      setDeleteError(null);
      await refreshStaff();
    },
    onError: (error) => setDeleteError(errorMessage(error)),
  });

  const rows = staffQuery.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const columns = useMemo(
    () =>
      staffColumns({
        onEdit: (staff) => {
          setFormStaff(staff);
          setFormError(null);
          setIsFormOpen(true);
        },
        onDelete: (staff) => {
          setDeleteStaff(staff);
          setDeleteError(null);
        },
      }),
    [],
  );

  return (
    <CrudPageShell
      eyebrow="Catálogo"
      title="Staff"
      description="Listado, alta, edición y baja conectado al API real de staff."
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setFormStaff(null);
            setFormError(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo staff
        </Button>
      }
    >
      {staffQuery.isLoading ? (
        <TableState kind="loading" title="Cargando staff" />
      ) : staffQuery.isError ? (
        <TableState
          kind="error"
          title="No se pudo cargar el staff"
          description={errorMessage(staffQuery.error)}
          onRetry={() => void staffQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <TableState
          kind="empty"
          title="Todavía no hay staff"
          description="Creá el primer integrante para gestionar roles y comisiones."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
          <PaginationControls
            offset={offset}
            limit={PAGE_SIZE}
            hasNext={hasNext}
            isFetching={staffQuery.isFetching}
            onPrevious={() =>
              setOffset((current) => Math.max(0, current - PAGE_SIZE))
            }
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        </>
      )}

      <StaffFormDialog
        open={isFormOpen}
        staff={formStaff}
        error={formError}
        isSubmitting={saveMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setFormStaff(null);
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <DeleteDialog
        open={deleteStaff !== null}
        title="Eliminar staff"
        description={
          deleteStaff
            ? `Vas a eliminar ${deleteStaff.displayName}.`
            : "Vas a eliminar este integrante del staff."
        }
        error={deleteError}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteStaff(null);
        }}
        onConfirm={() => {
          if (deleteStaff) deleteMutation.mutate(deleteStaff);
        }}
      />
    </CrudPageShell>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof AdminCrudApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
