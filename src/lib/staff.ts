// Empleados del panel: cada uno con su nombre y un PIN propio de 6 dígitos (solo guardamos su huella scrypt).
// Así cada sello y cada cambio queda con el nombre de quien lo hizo. El dueño los da de alta o de baja.
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet } from "./store";

export interface Staff { id: string; name: string; pin: string; active: boolean; createdAt: string }
const KEY = "lg:staff";
const N = { N: 16384, r: 8, p: 1 } as const;

const hash = (pin: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(pin, salt, 32, N).toString("hex")}`; };
const matches = (pin: string, stored: string) => {
  const [salt, hex] = stored.split(":");
  return !!salt && !!hex && timingSafeEqual(scryptSync(pin, salt, 32, N), Buffer.from(hex, "hex"));
};
const easy = (p: string) => /^(\d)\1+$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p);
function newPin(): string { for (;;) { const p = String(randomInt(0, 1_000_000)).padStart(6, "0"); if (!easy(p)) return p; } }

export const listStaff = async () => (await kvGet<Staff[]>(KEY)) ?? [];
export const publicStaff = (s: Staff) => ({ id: s.id, name: s.name, active: s.active, createdAt: s.createdAt });

/** Alta: regresa el PIN UNA sola vez para que el dueño se lo dé al empleado. */
export async function addStaff(name: string): Promise<{ staff: Staff; pin: string }> {
  const all = await listStaff();
  const pins = new Set<string>();
  let pin = newPin();
  // Dos empleados no pueden tener el mismo PIN (el PIN identifica a la persona).
  while (all.some((s) => s.active && matches(pin, s.pin)) || pins.has(pin)) { pins.add(pin); pin = newPin(); }
  const staff: Staff = { id: randomBytes(9).toString("base64url"), name: name.trim().slice(0, 40), pin: hash(pin), active: true, createdAt: new Date().toISOString() };
  await kvSet(KEY, [...all, staff]);
  return { staff, pin };
}

export async function setStaffActive(id: string, active: boolean): Promise<Staff | null> {
  const all = await listStaff();
  const s = all.find((x) => x.id === id);
  if (!s) return null;
  s.active = active;
  await kvSet(KEY, all);
  return s;
}

export async function newStaffPin(id: string): Promise<{ staff: Staff; pin: string } | null> {
  const all = await listStaff();
  const s = all.find((x) => x.id === id);
  if (!s) return null;
  let pin = newPin();
  while (all.some((x) => x.id !== id && x.active && matches(pin, x.pin))) pin = newPin();
  s.pin = hash(pin);
  s.active = true;
  await kvSet(KEY, all);
  return { staff: s, pin };
}

/** ¿De quién es este PIN? Solo empleados activos. */
export async function staffByPin(pin: string): Promise<Staff | null> {
  if (!/^\d{6}$/.test(pin)) return null;
  return (await listStaff()).find((s) => s.active && matches(pin, s.pin)) ?? null;
}
export const getStaff = async (id: string) => (await listStaff()).find((s) => s.id === id) ?? null;
