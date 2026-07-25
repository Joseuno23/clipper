import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/widgets/data-table/DataTable";
import {
  adminCrudKeys,
  AdminCrudApiError,
  customersApi,
  type CustomerCreateInput,
  type CustomerDto,
} from "@/shared/api/adminCrud";
import {
  CrudPageShell,
  DeleteDialog,
  PaginationControls,
  TableState,
} from "@/shared/components/adminCrud";

import { CustomerFormDialog } from "./CustomerFormDialog";
import { customerColumns, customerDisplayName } from "./columns";

const PAGE_SIZE = 10;

export function CustomersCrudPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [formCustomer, setFormCustomer] = useState<CustomerDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerDto | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listParams = { limit: PAGE_SIZE, offset };
  const customersQuery = useQuery({
    queryKey: adminCrudKeys.customersList(listParams),
    queryFn: () => customersApi.list(listParams),
  });

  const refreshCustomers = () =>
    queryClient.invalidateQueries({ queryKey: adminCrudKeys.customers });

  const saveMutation = useMutation({
    mutationFn: (input: CustomerCreateInput) =>
      formCustomer
        ? customersApi.update(formCustomer.id, input)
        : customersApi.create(input),
    onSuccess: async () => {
      setIsFormOpen(false);
      setFormCustomer(null);
      setFormError(null);
      await refreshCustomers();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (customer: CustomerDto) => customersApi.delete(customer.id),
    onSuccess: async () => {
      setDeleteCustomer(null);
      setDeleteError(null);
      await refreshCustomers();
    },
    onError: (error) => setDeleteError(errorMessage(error)),
  });

  const rows = customersQuery.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const columns = useMemo(
    () =>
      customerColumns({
        onEdit: (customer) => {
          setFormCustomer(customer);
          setFormError(null);
          setIsFormOpen(true);
        },
        onDelete: (customer) => {
          setDeleteCustomer(customer);
          setDeleteError(null);
        },
      }),
    [],
  );

  return (
    <CrudPageShell
      eyebrow="Catálogo"
      title="Clientes"
      description="Listado, alta, edición y bloqueo básico conectado al API real."
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setFormCustomer(null);
            setFormError(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      }
    >
      {customersQuery.isLoading ? (
        <TableState kind="loading" title="Cargando clientes" />
      ) : customersQuery.isError ? (
        <TableState
          kind="error"
          title="No se pudieron cargar los clientes"
          description={errorMessage(customersQuery.error)}
          onRetry={() => void customersQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <TableState
          kind="empty"
          title="Todavía no hay clientes"
          description="Creá el primer cliente para empezar a usar el catálogo."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
          <PaginationControls
            offset={offset}
            limit={PAGE_SIZE}
            hasNext={hasNext}
            isFetching={customersQuery.isFetching}
            onPrevious={() =>
              setOffset((current) => Math.max(0, current - PAGE_SIZE))
            }
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        </>
      )}

      <CustomerFormDialog
        open={isFormOpen}
        customer={formCustomer}
        error={formError}
        isSubmitting={saveMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setFormCustomer(null);
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <DeleteDialog
        open={deleteCustomer !== null}
        title="Eliminar cliente"
        description={
          deleteCustomer
            ? `Vas a eliminar a ${customerDisplayName(deleteCustomer)}.`
            : "Vas a eliminar este cliente."
        }
        error={deleteError}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteCustomer(null);
        }}
        onConfirm={() => {
          if (deleteCustomer) deleteMutation.mutate(deleteCustomer);
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
