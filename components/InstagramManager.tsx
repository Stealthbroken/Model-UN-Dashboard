"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InstagramPost {
  id: number;
  caption: string;
  imagePath: string | null;
  status: string;
  postedAt: string | null;
  createdAt: string;
}

interface Props {
  posts: InstagramPost[];
  apiConfigured: boolean;
}

export function InstagramManager({ posts, apiConfigured }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);

  const drafts = posts.filter((p) => p.status !== "posted");
  const posted = posts.filter((p) => p.status === "posted");

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pseudo-access to <span className="font-medium">@irhsmodelun</span> — compose, preview, save drafts, and publish.
          </p>
        </div>
        <div className="text-xs flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${apiConfigured ? "bg-green-500" : "bg-gray-300"}`} />
          {apiConfigured ? "API connected" : "Preview only (API not configured)"}
        </div>
      </div>

      {/* Composer for a brand-new post */}
      {editingId === null && (
        <div className="mb-8">
          <PostComposer
            key="new"
            apiConfigured={apiConfigured}
            onSaved={() => router.refresh()}
          />
        </div>
      )}

      {/* Drafts & failed */}
      <Section title="Drafts" count={drafts.length}>
        {drafts.length === 0 ? (
          <Empty text="No drafts. Use the composer above." />
        ) : (
          drafts.map((p) =>
            editingId === p.id ? (
              <PostComposer
                key={p.id}
                post={p}
                apiConfigured={apiConfigured}
                onSaved={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PostCard
                key={p.id}
                post={p}
                onEdit={() => setEditingId(p.id)}
                onDelete={async () => {
                  if (!confirm("Delete this draft?")) return;
                  await fetch("/api/instagram", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: p.id }),
                  });
                  router.refresh();
                }}
              />
            ),
          )
        )}
      </Section>

      {/* Posted history */}
      <Section title="Posted" count={posted.length}>
        {posted.length === 0 ? (
          <Empty text="Nothing posted from the dashboard yet." />
        ) : (
          posted.map((p) => <PostCard key={p.id} post={p} readOnly />)
        )}
      </Section>
    </div>
  );
}

/* ───────────── Composer ───────────── */
function PostComposer({
  post,
  apiConfigured,
  onSaved,
  onCancel,
}: {
  post?: InstagramPost;
  apiConfigured: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [caption, setCaption] = useState(post?.caption || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(post?.imagePath || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit(autoPost: boolean) {
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    if (post) fd.append("id", String(post.id));
    fd.append("caption", caption);
    fd.append("autoPost", autoPost.toString());
    if (imageFile) fd.append("image", imageFile);

    const res = await fetch("/api/instagram", { method: "POST", body: fd });
    const data = await res.json();
    if (data.error) setMessage(`Error: ${data.error}`);
    else if (data.status === "posted") setMessage("Posted to Instagram!");
    else setMessage(post ? "Updated." : "Draft saved.");
    setSaving(false);
    if (!data.error) {
      if (!post) {
        setCaption("");
        setImageFile(null);
        setImagePreview(null);
      }
      onSaved();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{post ? "Edit draft" : "New post"}</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Phone-style preview */}
        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-sm">
          <div className="flex items-center gap-2 p-2.5 border-b border-gray-100">
            <img
              src="/images/irhs-modelun-pfp.png"
              alt="irhsmodelun"
              className="w-7 h-7 rounded-full object-cover"
            />
            <span className="text-sm font-semibold">irhsmodelun</span>
          </div>
          <div className="aspect-square bg-gray-100 flex items-center justify-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-xs">No image</span>
            )}
          </div>
          <div className="p-2.5 text-sm">
            <span className="font-semibold">irhsmodelun</span>{" "}
            <span className="text-gray-700 whitespace-pre-wrap">{caption || "Caption..."}</span>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-600">Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImage}
              className="block w-full text-xs mt-1"
            />
          </label>
          <textarea
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption..."
            className="input text-sm"
          />
          {message && (
            <p className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => submit(false)}
              disabled={saving || !caption}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : post ? "Update draft" : "Save draft"}
            </button>
            <button
              onClick={() => submit(true)}
              disabled={saving || !caption || !imagePreview}
              title={!apiConfigured ? "Instagram API not configured" : ""}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Posting..." : "Post now"}
            </button>
            {!apiConfigured && (
              <p className="text-[11px] text-gray-500 self-center">
                Auto-post requires API setup; drafts work without it.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Read-only card ───────────── */
function PostCard({
  post,
  readOnly,
  onEdit,
  onDelete,
}: {
  post: InstagramPost;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const status = post.status;
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    posted: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4">
      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
        {post.imagePath ? (
          <img src={post.imagePath} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || colors.draft}`}>
            {status}
          </span>
          <span className="text-xs text-gray-400">
            {post.postedAt
              ? `Posted ${new Date(post.postedAt).toLocaleString()}`
              : `Created ${new Date(post.createdAt).toLocaleDateString()}`}
          </span>
        </div>
        <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{post.caption}</p>
        {!readOnly && (
          <div className="mt-2 flex gap-3 text-xs">
            {onEdit && (
              <button onClick={onEdit} className="text-primary-600 hover:underline">
                Edit
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="text-red-500 hover:underline">
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Helpers ───────────── */
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
        {title} <span className="text-gray-400 font-normal">({count})</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic">{text}</p>;
}
