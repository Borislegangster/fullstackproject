"use client";

import { Facebook, Heart, Link2, Linkedin, Mail, MessageCircle, Reply, Send, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { relative } from "@/lib/format";
import { track } from "@/lib/tracker";

export function BlogViewTracker({ slug, postId }: { slug: string; postId: string }) {
  useEffect(() => {
    const key = `globus_view_${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void api(`/public/blog/posts/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => undefined);
    track({ type: "blog_view", content_type: "blog_post", content_id: postId });
  }, [slug, postId]);
  return null;
}

export function LikeButton({ slug, initial }: { slug: string; initial: number }) {
  const [count, setCount] = useState(initial);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setLiked(localStorage.getItem(`globus_like_${slug}`) === "1"), [slug]);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await api<{ liked: boolean; like_count: number }>(`/public/blog/posts/${encodeURIComponent(slug)}/like`, { method: "POST" });
          setCount(res.like_count);
          setLiked(res.liked);
          localStorage.setItem(`globus_like_${slug}`, res.liked ? "1" : "0");
        } catch {
          /* limite atteinte */
        } finally {
          setBusy(false);
        }
      }}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${liked ? "bg-accent-50 text-accent-700 ring-accent-200" : "bg-white text-ink ring-line hover:bg-accent-50"}`}
    >
      <Heart className={`h-4 w-4 ${liked ? "fill-accent-500 text-accent-500" : ""}`} /> {count} J'aime
    </button>
  );
}

const NETWORKS = [
  { key: "facebook", label: "Facebook", icon: Facebook, url: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, url: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, url: (u: string, t: string) => `https://wa.me/?text=${t}%20${u}` },
  { key: "x", label: "X", icon: Send, url: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
  { key: "email", label: "E-mail", icon: Mail, url: (u: string, t: string) => `mailto:?subject=${t}&body=${u}` },
] as const;

export function ShareButtons({ slug, title, url, initial }: { slug: string; title: string; url: string; initial: number }) {
  const [count, setCount] = useState(initial);
  const [copied, setCopied] = useState(false);
  const record = async (network: string) => {
    track({ type: "social_click", target: network, props: { location: "blog_share" } });
    try {
      const res = await api<{ share_count: number }>(`/public/blog/posts/${encodeURIComponent(slug)}/share`, { method: "POST", body: { network } });
      setCount(res.share_count);
    } catch {
      /* limite atteinte */
    }
  };
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-muted">
        <Share2 className="h-4 w-4" /> Partager ({count})
      </span>
      {NETWORKS.map((n) => (
        <a
          key={n.key}
          href={n.url(u, t)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void record(n.key)}
          className="rounded-full bg-white p-2 text-brand-700 ring-1 ring-line hover:bg-brand-50"
          aria-label={`Partager sur ${n.label}`}
        >
          <n.icon className="h-4 w-4" />
        </a>
      ))}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            void record("copy");
          } catch {
            /* presse-papiers indisponible */
          }
        }}
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-brand-700 ring-1 ring-line hover:bg-brand-50"
      >
        <Link2 className="h-4 w-4" /> {copied ? "Lien copié" : "Copier le lien"}
      </button>
    </div>
  );
}

interface CommentNode {
  id: string;
  author_name: string;
  content: string;
  is_staff: boolean;
  like_count: number;
  created_at: string;
  replies: CommentNode[];
}

function CommentForm({ slug, parentId, renderedAt, onDone }: { slug: string; parentId?: string; renderedAt: number; onDone: (message: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await api<{ message?: string }>(`/public/blog/posts/${encodeURIComponent(slug)}/comments`, {
            method: "POST",
            body: { author_name: name, author_email: email || null, content, parent_id: parentId ?? null, website: honeypot || null, rendered_at: renderedAt },
          });
          setContent("");
          onDone(res?.message ?? "Merci ! Votre commentaire sera publié après modération.");
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
        </Field>
        <Field label="E-mail (non publié)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
        </Field>
      </div>
      <Field label={parentId ? "Votre réponse" : "Votre commentaire"} required>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} required minLength={3} maxLength={3000} rows={4} />
      </Field>
      <input className="hidden" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} aria-hidden="true" />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" loading={busy} disabled={name.trim().length < 2 || content.trim().length < 3}>
        Publier
      </Button>
    </form>
  );
}

function CommentItem({ node, slug, renderedAt, depth }: { node: CommentNode; slug: string; renderedAt: number; depth: number }) {
  const [replying, setReplying] = useState(false);
  const [likes, setLikes] = useState(node.like_count);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <li className={depth ? "ml-6 border-l-2 border-brand-100 pl-4" : ""}>
      <div className="rounded-xl bg-white p-4 ring-1 ring-line">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-800">
            {node.author_name}
            {node.is_staff ? <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">GLOBUS</span> : null}
          </p>
          <time className="text-xs text-muted" dateTime={node.created_at}>
            {relative(node.created_at)}
          </time>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm text-ink">{node.content}</p>
        <div className="mt-3 flex gap-3 text-xs">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted hover:text-accent-600"
            onClick={async () => {
              try {
                const res = await api<{ like_count: number }>(`/public/blog/comments/${node.id}/like`, { method: "POST" });
                setLikes(res.like_count);
              } catch {
                /* ignoré */
              }
            }}
          >
            <Heart className="h-3.5 w-3.5" /> {likes}
          </button>
          {depth < 2 ? (
            <button type="button" className="inline-flex items-center gap-1 text-muted hover:text-brand-600" onClick={() => setReplying((r) => !r)}>
              <Reply className="h-3.5 w-3.5" /> Répondre
            </button>
          ) : null}
        </div>
      </div>
      {notice ? <p className="mt-2 text-xs text-emerald-700">{notice}</p> : null}
      {replying ? (
        <div className="mt-3">
          <CommentForm
            slug={slug}
            parentId={node.id}
            renderedAt={renderedAt}
            onDone={(m) => {
              setNotice(m);
              setReplying(false);
            }}
          />
        </div>
      ) : null}
      {node.replies.length ? (
        <ul className="mt-3 space-y-3">
          {node.replies.map((r) => (
            <CommentItem key={r.id} node={r} slug={slug} renderedAt={renderedAt} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Comments({ slug, comments, allow, renderedAt }: { slug: string; comments: CommentNode[]; allow: boolean; renderedAt: number }) {
  const [notice, setNotice] = useState<string | null>(null);
  const count = (list: CommentNode[]): number => list.reduce((n, c) => n + 1 + count(c.replies), 0);
  return (
    <section aria-labelledby="comments-title" className="space-y-6">
      <h2 id="comments-title" className="text-2xl font-bold text-brand-800">
        Commentaires ({count(comments)})
      </h2>
      {comments.length ? (
        <ul className="space-y-4">
          {comments.map((c) => (
            <CommentItem key={c.id} node={c} slug={slug} renderedAt={renderedAt} depth={0} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Soyez le premier à réagir.</p>
      )}
      {allow ? (
        <div className="rounded-2xl bg-surface p-5">
          <p className="mb-3 font-semibold text-brand-800">Laisser un commentaire</p>
          {notice ? <Alert tone="success">{notice}</Alert> : <CommentForm slug={slug} renderedAt={renderedAt} onDone={setNotice} />}
        </div>
      ) : (
        <p className="text-sm text-muted">Les commentaires sont fermés pour cet article.</p>
      )}
    </section>
  );
}
