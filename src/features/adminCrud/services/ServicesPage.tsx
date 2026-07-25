import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/widgets/data-table/DataTable";
import {
  adminCrudKeys,
  AdminCrudApiError,
  servicesApi,
  type ServiceCreateInput,
  type ServiceDto,
} from "@/shared/api/adminCrud";
import {
  CrudPageShell,
  DeleteDialog,
  PaginationControls,
  TableState,
} from "@/shared/components/adminCrud";

import { ServiceFormDialog } from "./ServiceFormDialog";
import { serviceColumns } from "./columns";

const PAGE_SIZE = 10;

export function ServicesCrudPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [formService, setFormService] = useState<ServiceDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteService, setDeleteService] = useState<ServiceDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listParams = { limit: PAGE_SIZE, offset };
  const servicesQuery = useQuery({
    queryKey: adminCrudKeys.servicesList(listParams),
    queryFn: () => servicesApi.list(listParams),
  });

  const refreshServices = () =>
    queryClient.invalidateQueries({ queryKey: adminCrudKeys.services });

  const saveMutation = useMutation({
    mutationFn: (input: ServiceCreateInput) =>
      formService
        ? servicesApi.update(formService.id, input)
        : servicesApi.create(input),
    onSuccess: async () => {
      setIsFormOpen(false);
      setFormService(null);
      setFormError(null);
      await refreshServices();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (service: ServiceDto) => servicesApi.delete(service.id),
    onSuccess: async () => {
      setDeleteService(null);
      setDeleteError(null);
      await refreshServices();
    },
    onError: (error) => setDeleteError(errorMessage(error)),
  });

  const rows = servicesQuery.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const columns = useMemo(
    () =>
      serviceColumns({
        onEdit: (service) => {
          setFormService(service);
          setFormError(null);
          setIsFormOpen(true);
        },
        onDelete: (service) => {
          setDeleteService(service);
          setDeleteError(null);
        },
      }),
    [],
  );

  return (
    <CrudPageShell
      eyebrow="Catálogo"
      title="Servicios"
      description="Listado, alta, edición y baja conectado al API real de servicios."
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setFormService(null);
            setFormError(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      }
    >
      {servicesQuery.isLoading ? (
        <TableState kind="loading" title="Cargando servicios" />
      ) : servicesQuery.isError ? (
        <TableState
          kind="error"
          title="No se pudieron cargar los servicios"
          description={errorMessage(servicesQuery.error)}
          onRetry={() => void servicesQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <TableState
          kind="empty"
          title="Todavía no hay servicios"
          description="Creá el primer servicio para empezar a usar el catálogo."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
          <PaginationControls
            offset={offset}
            limit={PAGE_SIZE}
            hasNext={hasNext}
            isFetching={servicesQuery.isFetching}
            onPrevious={() =>
              setOffset((current) => Math.max(0, current - PAGE_SIZE))
            }
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        </>
      )}

      <ServiceFormDialog
        open={isFormOpen}
        service={formService}
        error={formError}
        isSubmitting={saveMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setFormService(null);
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <DeleteDialog
        open={deleteService !== null}
        title="Eliminar servicio"
        description={
          deleteService
            ? `Vas a eliminar ${deleteService.name}.`
            : "Vas a eliminar este servicio."
        }
        error={deleteError}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteService(null);
        }}
        onConfirm={() => {
          if (deleteService) deleteMutation.mutate(deleteService);
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
