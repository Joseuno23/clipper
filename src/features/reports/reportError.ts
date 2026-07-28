export function reportLoadErrorMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message) {
    return "No se pudo cargar el reporte.";
  }

  const code = apiErrorCode(error);
  const codeSuffix = code ? ` (${code})` : "";

  return `No se pudo cargar el reporte: ${error.message}${codeSuffix}`;
}

function apiErrorCode(error: Error) {
  const code = (error as { code?: unknown }).code;

  return typeof code === "string" && code.length > 0 ? code : null;
}
