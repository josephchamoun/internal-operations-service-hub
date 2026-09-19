import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, downloadFile } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { fileError } from "../lib/file-rules";
import type { AttachmentMeta, RequestItem, RequestMessage } from "../types";
import { Button } from "./button";
import { Card } from "./card";

export function RequestThread({
  request,
  canPost,
}: {
  request: RequestItem;
  canPost: boolean;
}) {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const messages = useApiQuery<RequestMessage[]>(
    ["messages", request.id],
    `/requests/${request.id}/messages`,
  );
  const files = useApiQuery<AttachmentMeta[]>(
    ["attachments", request.id],
    `/requests/${request.id}/attachments`,
  );
  const [body, setBody] = useState("");
  const [outgoing, setOutgoing] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const requestFiles = (files.data ?? []).filter((item) => !item.messageId);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.data]);

  const send = useMutation({
    mutationFn: () => {
      const blocked = outgoing.map(fileError).find(Boolean);
      if (blocked) {
        throw new Error(blocked);
      }
      const data = new FormData();
      if (body.trim()) data.append("body", body.trim());
      outgoing.forEach((file) => data.append("files", file));
      return api<RequestMessage>(`/requests/${request.id}/messages`, token, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      setBody("");
      setOutgoing([]);
      setLocalError(null);
      if (fileInput.current) fileInput.current.value = "";
      void client.invalidateQueries({ queryKey: ["messages", request.id] });
      void client.invalidateQueries({ queryKey: ["attachments", request.id] });
    },
    onError: (err: Error) => setLocalError(err.message),
  });
  const removeFile = useMutation({
    mutationFn: (attachmentId: string) =>
      api(`/requests/${request.id}/attachments/${attachmentId}`, token, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attachments", request.id] });
      void client.invalidateQueries({ queryKey: ["messages", request.id] });
    },
  });
  const replaceFile = useMutation({
    mutationFn: ({ attachmentId, file }: { attachmentId: string; file: File }) => {
      const blocked = fileError(file);
      if (blocked) throw new Error(blocked);
      const data = new FormData();
      data.append("file", file);
      return api(`/requests/${request.id}/attachments/${attachmentId}`, token, {
        method: "PATCH",
        body: data,
      });
    },
    onSuccess: () => {
      setLocalError(null);
      void client.invalidateQueries({ queryKey: ["attachments", request.id] });
      void client.invalidateQueries({ queryKey: ["messages", request.id] });
    },
    onError: (err: Error) => setLocalError(err.message),
  });

  const canMutateRequestFile = (item: AttachmentMeta) =>
    user?.userId === item.uploaderId &&
    request.status === "New" &&
    !request.claimedBy;

  return (
    <Card className="thread-card">
      <div className="thread-head">
        <div>
          <div className="eyebrow">Conversation</div>
          <h2>Messages</h2>
        </div>
        <span className="muted">
          {(messages.data ?? []).length}{" "}
          {(messages.data ?? []).length === 1 ? "message" : "messages"}
        </span>
      </div>
      {requestFiles.length > 0 && (
        <div className="thread-files">
          <p className="eyebrow">Files on this request</p>
          {requestFiles.map((item) => (
            <AttachmentChip
              key={item.id}
              item={item}
              requestId={request.id}
              token={token}
              canMutate={canMutateRequestFile(item)}
              onDelete={() => removeFile.mutate(item.id)}
              onReplace={(file) =>
                replaceFile.mutate({ attachmentId: item.id, file })
              }
            />
          ))}
        </div>
      )}
      <div className="thread" ref={scroller}>
        {(messages.data ?? [])
          .filter(
            (message) =>
              message.body.trim() !== "" || message.attachments.length > 0,
          )
          .map((message) => {
          const mine = message.senderId === user?.userId;
          return (
            <article
              key={message.id}
              className={mine ? "thread-item mine" : "thread-item"}
            >
              <div className="thread-avatar" aria-hidden>
                {message.senderName.slice(0, 1).toUpperCase()}
              </div>
              <div className="thread-bubble">
                <p className="thread-meta">
                  <span>{mine ? "You" : message.senderName}</span>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
                {message.body ? <p>{message.body}</p> : null}
                {message.attachments.length > 0 && (
                  <div className="thread-item-files">
                    {message.attachments.map((item) => (
                      <AttachmentChip
                        key={item.id}
                        item={item}
                        requestId={request.id}
                        token={token}
                        canMutate={canMutateRequestFile(item)}
                        onDelete={() => removeFile.mutate(item.id)}
                        onReplace={(file) =>
                          replaceFile.mutate({ attachmentId: item.id, file })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!(messages.data ?? []).some(
          (message) =>
            message.body.trim() !== "" || message.attachments.length > 0,
        ) && (
          <p className="thread-empty">No messages yet. Start the thread below.</p>
        )}
      </div>
      {canPost ? (
        <form
          className="thread-composer"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const blocked = outgoing.map(fileError).find(Boolean);
            if (blocked) {
              setLocalError(blocked);
              setOutgoing((current) => current.filter((file) => !fileError(file)));
              return;
            }
            if (!body.trim() && outgoing.length === 0) {
              setLocalError("Write a message or attach a file");
              return;
            }
            setLocalError(null);
            send.mutate();
          }}
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Write a reply…"
            aria-label="Message"
          />
          {outgoing.length > 0 && (
            <div className="composer-files">
              {outgoing.map((file) => (
                <span className="file-chip" key={`${file.name}-${file.size}`}>
                  {file.name}
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setOutgoing((current) =>
                        current.filter((item) => item !== file),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {(localError || send.isError) && (
            <p className="form-error">{localError ?? send.error?.message}</p>
          )}
          <div className="composer-bar">
            <label className="composer-attach">
              Attach
              <input
                ref={fileInput}
                type="file"
                multiple
                onChange={(event) => {
                  const next = Array.from(event.target.files ?? []);
                  const blocked = next.map(fileError).find(Boolean);
                  if (blocked) {
                    setLocalError(blocked);
                    event.target.value = "";
                    return;
                  }
                  setLocalError(null);
                  setOutgoing((current) => [...current, ...next]);
                  event.target.value = "";
                }}
              />
            </label>
            <Button
              type="submit"
              disabled={send.isPending || (!body.trim() && outgoing.length === 0)}
            >
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="thread-closed">This conversation is closed.</p>
      )}
    </Card>
  );
}

function AttachmentChip({
  item,
  requestId,
  token,
  canMutate,
  onDelete,
  onReplace,
}: {
  item: AttachmentMeta;
  requestId: string;
  token: string | null;
  canMutate: boolean;
  onDelete: () => void;
  onReplace: (file: File) => void;
}) {
  return (
    <span className="file-chip">
      <button
        type="button"
        className="attachment-link"
        onClick={() =>
          void downloadFile(
            `/requests/${requestId}/attachments/${item.id}`,
            token,
            item.fileName,
          )
        }
      >
        {item.fileName}
      </button>
      {canMutate && (
        <>
          <label className="file-chip-replace">
            Replace
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onReplace(file);
              }}
            />
          </label>
          <button type="button" aria-label={`Remove ${item.fileName}`} onClick={onDelete}>
            ×
          </button>
        </>
      )}
    </span>
  );
}
