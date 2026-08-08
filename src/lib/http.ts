import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export { AppError } from "@/lib/errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields ?? {} } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
    );
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Перевірте введені дані.",
          fields,
        },
      },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "SERVER_ERROR",
        message: "Сервер тимчасово недоступний.",
        fields: {},
      },
    },
    { status: 500 },
  );
}
