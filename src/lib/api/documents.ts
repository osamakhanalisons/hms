import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

import { getDb } from "../db.server";

import { getSessionUser, getUserTenantId, getTenantScoping } from "./auth-helper";

export const getDocumentsFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "d.tenant_id");
    const [rows] = (await db.query(
      `SELECT d.*, p.full_name AS uploader_name
       FROM documents d
       LEFT JOIN profiles p ON p.id = d.uploaded_by
       WHERE ${sqlFilter} ORDER BY d.created_at DESC`,
      sqlParams,
    )) as any[];
    return rows;
  });

import fs from "node:fs/promises";
import path from "node:path";

export const uploadDocumentFn = createServerFn({ method: "POST" })
  .validator((val: unknown) => {
    if (!(val instanceof FormData)) {
      throw new Error("Expected FormData");
    }
    return val;
  })
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const name = data.get("name")?.toString();
    const category = data.get("category")?.toString();
    const expiryDate = data.get("expiryDate")?.toString();
    const file = data.get("file") as File | null;

    if (!name || !category || !file) {
      throw new Error("Missing required fields (name, category, file)");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("File too large (max 10MB)");
    }

    const ALLOWED_EXTENSIONS = [
      ".pdf", ".doc", ".docx", 
      ".jpg", ".jpeg", ".png", ".gif", ".webp",
      ".xls", ".xlsx",
      ".txt", ".csv",
      ".zip"
    ];

    const BLOCKED_EXTENSIONS = [
      ".exe", ".php", ".js", ".ts", ".py", ".sh", ".bat", 
      ".cmd", ".ps1", ".vbs", ".jar", ".html", ".htm"
    ];

    const originalFileName = file.name || name || "";
    const fileExt = path.extname(originalFileName).toLowerCase();

    if (!fileExt || BLOCKED_EXTENSIONS.includes(fileExt)) {
      throw new Error(
        `File type "${fileExt || "unknown"}" is not allowed. Blocked for security reasons.`
      );
    }

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      throw new Error(
        `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
      );
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "documents");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const ext = fileExt;
    const uniqueFilename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;

    const filePath = path.join(uploadsDir, uniqueFilename);
    const fileUrl = `/uploads/documents/${uniqueFilename}`;

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const db = getDb();
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO documents (id, tenant_id, name, category, file_url, uploaded_by, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, category, fileUrl, userId, expiryDate || null],
    );

    return { id, fileUrl };
  });

export const deleteDocumentFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    await db.query("DELETE FROM documents WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);

    return { success: true };
  });
