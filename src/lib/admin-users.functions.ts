import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores podem fazer isso.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const base = {
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  email: z.string().trim().email("E-mail inválido.").max(200),
  isAdmin: z.boolean(),
  systemIds: z.array(z.string().uuid()).max(50),
};

function ptError(msg: string) {
  if (/weak|easy to guess|pwned/i.test(msg)) return "Senha muito fraca ou já vazada na internet. Escolha uma senha mais forte.";
  if (/already/i.test(msg)) return "Já existe uma pessoa com esse e-mail.";
  return msg;
}

async function syncRolesAndAccess(admin: Awaited<ReturnType<typeof assertAdmin>>, id: string, isAdmin: boolean, systemIds: string[], by: string) {
  if (isAdmin) {
    const r = await admin.from("user_roles").upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
    if (r.error) throw new Error(r.error.message);
  } else {
    const r = await admin.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (r.error) throw new Error(r.error.message);
  }
  const del = await admin.from("user_system_access").delete().eq("user_id", id);
  if (del.error) throw new Error(del.error.message);
  if (systemIds.length) {
    const ins = await admin.from("user_system_access").insert(systemIds.map((s) => ({ user_id: id, system_id: s, granted_by: by })));
    if (ins.error) throw new Error(ins.error.message);
  }
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ ...base, password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(72) }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as Ctx);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true, user_metadata: { display_name: data.name },
    });
    if (error || !created.user) throw new Error(ptError(error?.message ?? "Falha ao criar."));
    const id = created.user.id;
    await admin.from("profiles").upsert({ id, display_name: data.name });
    await syncRolesAndAccess(admin, id, data.isAdmin, data.systemIds, context.userId);
    return { id };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ ...base, id: z.string().uuid(), password: z.string().max(72).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as Ctx);
    if (data.id === context.userId && !data.isAdmin) throw new Error("Você não pode remover seu próprio acesso de administrador.");
    if (data.password && data.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const { error } = await admin.auth.admin.updateUserById(data.id, {
      email: data.email, email_confirm: true, user_metadata: { display_name: data.name },
      ...(data.password ? { password: data.password } : {}),
    });
    if (error) throw new Error(ptError(error.message));
    await admin.from("profiles").upsert({ id: data.id, display_name: data.name });
    await syncRolesAndAccess(admin, data.id, data.isAdmin, data.systemIds, context.userId);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as Ctx);
    if (data.id === context.userId) throw new Error("Você não pode excluir a sua própria conta.");
    await admin.from("user_system_access").delete().eq("user_id", data.id);
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
