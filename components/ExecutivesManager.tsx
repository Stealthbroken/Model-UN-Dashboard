"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Executive {
  id: number;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  sortOrder: number;
}

export function ExecutivesManager({ initial }: { initial: Executive[] }) {
  const router = useRouter();
  const [execs, setExecs] = useState<Executive[]>(initial);
  const [form, setForm] = useState({ name: "", role: "", email: "" });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/executives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setExecs([...execs, created]);
      setForm({ name: "", role: "", email: "" });
    }
    setSaving(false);
    router.refresh();
  }

  async function update(id: number, patch: Partial<Executive>) {
    setExecs((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await fetch(`/api/executives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    router.refresh();
  }

  async function remove(id: number) {
    if (
      !confirm(
        "Delete this executive? All of their assigned tasks across all meetings will also be deleted.",
      )
    )
      return;
    await fetch(`/api/executives/${id}`, { method: "DELETE" });
    setExecs((cur) => cur.filter((e) => e.id !== id));
    router.refresh();
  }

  const activeExecs = execs.filter((e) => e.active);
  const inactiveExecs = execs.filter((e) => !e.active);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Add executive</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="input"
          />
          <input
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="Role (e.g. Secretary-General)"
            className="input"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email (optional)"
            type="email"
            className="input"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={add}
            disabled={saving || !form.name.trim()}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Adding..." : "+ Add"}
          </button>
        </div>
      </div>

      {/* Active list */}
      <ExecList
        title="Active"
        execs={activeExecs}
        onUpdate={update}
        onRemove={remove}
      />

      {inactiveExecs.length > 0 && (
        <ExecList
          title="Inactive"
          execs={inactiveExecs}
          onUpdate={update}
          onRemove={remove}
        />
      )}
    </div>
  );
}

function ExecList({
  title,
  execs,
  onUpdate,
  onRemove,
}: {
  title: string;
  execs: Executive[];
  onUpdate: (id: number, patch: Partial<Executive>) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-3">
        {title} <span className="text-gray-400 font-normal">({execs.length})</span>
      </h2>
      {execs.length === 0 ? (
        <p className="text-sm text-gray-400">None.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {execs.map((e) => (
            <ExecRow key={e.id} exec={e} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExecRow({
  exec,
  onUpdate,
  onRemove,
}: {
  exec: Executive;
  onUpdate: (id: number, patch: Partial<Executive>) => void;
  onRemove: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: exec.name,
    role: exec.role,
    email: exec.email || "",
  });

  async function save() {
    onUpdate(exec.id, { name: form.name, role: form.role, email: form.email });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
          placeholder="Name"
        />
        <input
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="input"
          placeholder="Role"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input"
          placeholder="Email"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={save} className="text-sm text-primary-600 hover:underline">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{exec.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {[exec.role, exec.email].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <button
        onClick={() => onUpdate(exec.id, { active: !exec.active })}
        className="text-xs text-gray-500 hover:underline"
        title={exec.active ? "Hide from new meetings without losing history" : "Restore to roster"}
      >
        {exec.active ? "Deactivate" : "Reactivate"}
      </button>
      <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:underline">
        Edit
      </button>
      <button onClick={() => onRemove(exec.id)} className="text-xs text-red-500 hover:underline">
        Delete
      </button>
    </li>
  );
}
