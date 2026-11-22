import { useState } from 'react';
import { CheckCircle2, MessageSquare, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import type { Comment, CommentTarget } from '@/data/types';
import { dateTimeLabel } from '@/lib/format';
import { Avatar, Button, Drawer, IconButton, Textarea } from './ui';

interface Target {
  targetType: CommentTarget;
  targetId: string;
  /** How the audit log names the thing, e.g. `campaign “Founding Draw”`. */
  label: string;
  link: string;
}

/**
 * A comment thread. Authors can edit their own comments; a comment can be
 * deleted by its author, or by an admin.
 */
export function Comments({ targetType, targetId, label, link }: Target) {
  const { data, can, member, role } = useSession();
  const actions = useActions();
  const name = useMemberName();
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const list = data.comments.filter((c) => c.targetType === targetType && c.targetId === targetId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const remove = (c: Comment) => {
    if (window.confirm(c.authorId === member.id ? 'Delete your comment?' : `Delete ${name(c.authorId)}’s comment? (You can because you’re an admin.)`)) actions.deleteComment(c);
  };

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 && <p className="text-[13px] text-muted">No comments yet.</p>}
      {list.map((c) => {
        const mine = c.authorId === member.id;
        const isEditing = editing?.id === c.id;
        return (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={name(c.authorId)} />
            <div className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
                <b className="font-semibold text-fg">{name(c.authorId)}</b>
                <span className="text-muted">
                  {dateTimeLabel(c.createdAt)}
                  {c.editedAt && <span title={`Edited ${dateTimeLabel(c.editedAt)}`}> · edited</span>}
                </span>
                {c.kind === 'approved' && (
                  <span className="inline-flex items-center gap-1 font-medium text-good-text">
                    <CheckCircle2 size={13} aria-hidden /> Approved
                  </span>
                )}
                {c.kind === 'changes' && (
                  <span className="inline-flex items-center gap-1 font-medium text-warning-text">
                    <RotateCcw size={13} aria-hidden /> Changes requested
                  </span>
                )}
                {!isEditing && (
                  <span className="ml-auto flex items-center">
                    {mine && can('comment') && (
                      <IconButton label="Edit comment" className="h-6 w-6" onClick={() => setEditing({ id: c.id, body: c.body })}>
                        <Pencil size={13} />
                      </IconButton>
                    )}
                    {(mine || role === 'admin') && (
                      <IconButton label="Delete comment" className="h-6 w-6" onClick={() => remove(c)}>
                        <Trash2 size={13} />
                      </IconButton>
                    )}
                  </span>
                )}
              </div>
              {isEditing ? (
                <form
                  className="mt-1.5 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editing.body.trim()) return;
                    actions.editComment(c, editing.body.trim());
                    setEditing(null);
                  }}
                >
                  <Textarea value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} rows={3} aria-label="Edit comment" autoFocus />
                  <span className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" type="submit" variant="primary" disabled={!editing.body.trim() || editing.body.trim() === c.body}>
                      Save
                    </Button>
                  </span>
                </form>
              ) : (
                <p className="mt-0.5 text-[13.5px] whitespace-pre-wrap text-fg">{c.body}</p>
              )}
            </div>
          </div>
        );
      })}
      {can('comment') ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            actions.addComment(targetType, targetId, body.trim(), label, link);
            setBody('');
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment. Use @name to mention someone." rows={2} aria-label="New comment" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-[12.5px] text-muted">Viewers can read comments but not add them.</p>
      )}
    </div>
  );
}

/** A "Discussion (n)" button that opens the thread in a side panel, like a post. */
export function DiscussionButton({ title, ...target }: Target & { title: string }) {
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const n = data.comments.filter((c) => c.targetType === target.targetType && c.targetId === target.targetId).length;
  return (
    <>
      <Button icon={<MessageSquare size={15} />} onClick={() => setOpen(true)}>
        Discussion{n ? ` (${n})` : ''}
      </Button>
      {open && (
        <Drawer
          open
          onClose={() => setOpen(false)}
          title={
            <span className="flex min-w-0 items-baseline gap-1.5">
              Discussion <span className="truncate text-[14px] font-normal text-muted">· {title}</span>
            </span>
          }
          footer={<Button onClick={() => setOpen(false)}>Close</Button>}
        >
          <Comments {...target} />
        </Drawer>
      )}
    </>
  );
}
