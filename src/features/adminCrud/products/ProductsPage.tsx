import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/widgets/data-table/DataTable";
import {
  adminCrudKeys,
  AdminCrudApiError,
  productsApi,
  type ProductCreateInput,
  type ProductDto,
} from "@/shared/api/adminCrud";
import {
  CrudPageShell,
  DeleteDialog,
  PaginationControls,
  TableState,
} from "@/shared/components/adminCrud";

import { productColumns } from "./columns";
import { ProductFormDialog } from "./ProductFormDialog";

const PAGE_SIZE = 10;

export function ProductsCrudPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [formProduct, setFormProduct] = useState<ProductDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<ProductDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listParams = { limit: PAGE_SIZE, offset };
  const productsQuery = useQuery({
    queryKey: adminCrudKeys.productsList(listParams),
    queryFn: () => productsApi.list(listParams),
  });

  const refreshProducts = () =>
    queryClient.invalidateQueries({ queryKey: adminCrudKeys.products });

  const saveMutation = useMutation({
    mutationFn: (input: ProductCreateInput) =>
      formProduct
        ? productsApi.update(formProduct.id, input)
        : productsApi.create(input),
    onSuccess: async () => {
      setIsFormOpen(false);
      setFormProduct(null);
      setFormError(null);
      await refreshProducts();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (product: ProductDto) => productsApi.delete(product.id),
    onSuccess: async () => {
      setDeleteProduct(null);
      setDeleteError(null);
      await refreshProducts();
    },
    onError: (error) => setDeleteError(errorMessage(error)),
  });

  const rows = productsQuery.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const columns = useMemo(
    () =>
      productColumns({
        onEdit: (product) => {
          setFormProduct(product);
          setFormError(null);
          setIsFormOpen(true);
        },
        onDelete: (product) => {
          setDeleteProduct(product);
          setDeleteError(null);
        },
      }),
    [],
  );

  return (
    <CrudPageShell
      eyebrow="Catálogo"
      title="Productos"
      description="Listado, alta, edición y baja conectado al API real de productos. El stock se escribe explícitamente como stock."
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setFormProduct(null);
            setFormError(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      }
    >
      {productsQuery.isLoading ? (
        <TableState kind="loading" title="Cargando productos" />
      ) : productsQuery.isError ? (
        <TableState
          kind="error"
          title="No se pudieron cargar los productos"
          description={errorMessage(productsQuery.error)}
          onRetry={() => void productsQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <TableState
          kind="empty"
          title="Todavía no hay productos"
          description="Creá el primer producto para empezar a gestionar el catálogo retail."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
          <PaginationControls
            offset={offset}
            limit={PAGE_SIZE}
            hasNext={hasNext}
            isFetching={productsQuery.isFetching}
            onPrevious={() =>
              setOffset((current) => Math.max(0, current - PAGE_SIZE))
            }
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        </>
      )}

      <ProductFormDialog
        open={isFormOpen}
        product={formProduct}
        error={formError}
        isSubmitting={saveMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setFormProduct(null);
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <DeleteDialog
        open={deleteProduct !== null}
        title="Eliminar producto"
        description={
          deleteProduct
            ? `Vas a eliminar ${deleteProduct.name}.`
            : "Vas a eliminar este producto."
        }
        error={deleteError}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteProduct(null);
        }}
        onConfirm={() => {
          if (deleteProduct) deleteMutation.mutate(deleteProduct);
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
