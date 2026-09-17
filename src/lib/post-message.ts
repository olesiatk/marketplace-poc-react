/**
 * postMessage bridge for embedding this app in a host page's <iframe>.
 *
 * This is a subset of a larger shared contract — only the messages this
 * app actually has a use for: a ready handshake, height reporting so the
 * host can size the iframe without inner/outer scrollbars, and
 * status/dismiss plumbing for this app's two full-viewport overlays (the
 * guided tour and the product modal), since an embedded iframe can't see
 * a click or an Escape press that lands on the host's own page instead of
 * inside the frame. Left out: message types tied to features this app
 * doesn't have (file upload/preview, host-drawn confirmation dialogs,
 * client-side routing).
 *
 * Every inbound and outbound message is logged as it crosses the
 * boundary, so the bridge is easy to verify from devtools alone.
 */

export interface FrameReadyMessage {
  type: "poc-frame-ready";
}

export interface ResizeIframeMessage {
  type: "poc-resize-iframe";
  height: number;
}

export interface TourStatusMessage {
  type: "poc-tour-status";
  active: boolean;
}

export interface ModalMessage {
  type: "poc-modal";
  open: boolean;
  minHeight?: number;
}

export interface ScrollIntoViewMessage {
  type: "poc-scroll-into-view";
  top: number;
  height: number;
  block?: "center" | "start";
  padding?: number;
}

type OutboundMessage =
  | FrameReadyMessage
  | ResizeIframeMessage
  | TourStatusMessage
  | ModalMessage
  | ScrollIntoViewMessage;

// Inbound messages are matched against this explicit allow-list rather
// than a "poc-" prefix test, since ask-for-height doesn't carry the prefix.
const INBOUND_TYPES = ["ask-for-height", "poc-host-ready", "poc-dismiss"] as const;
type InboundType = (typeof INBOUND_TYPES)[number];

/** True when running inside an iframe with a different window than its parent. */
export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    // Cross-origin access to window.parent throws — that alone means embedded.
    return true;
  }
}

function post(message: OutboundMessage): void {
  if (!isEmbedded()) return;
  console.log(`REMOTE: type: ${message.type}`, message);
  // The host's origin isn't known in advance for a generically embeddable
  // widget — the host is expected to verify event.origin on its end.
  window.parent.postMessage(message, "*");
}

/** Sent once on init, before the first height report. The host acks with poc-host-ready. */
export function sendFrameReady(): void {
  post({ type: "poc-frame-ready" });
}

/** Reports this app's own content height so the host can size the <iframe> to fit. */
export function sendResizeIframe(height: number): void {
  post({ type: "poc-resize-iframe", height: Math.ceil(height) });
}

/** Fired when the guided tour opens/closes, so the host can dim its own chrome to match. */
export function sendTourStatus(active: boolean): void {
  post({ type: "poc-tour-status", active });
}

/** Fired when the in-iframe product modal opens/closes. */
export function sendModal(open: boolean, minHeight?: number): void {
  post(open ? { type: "poc-modal", open: true, minHeight: minHeight ?? 0 } : { type: "poc-modal", open: false });
}

/** Asks the host to scroll a region of this app's own document into view (the host's page is what actually scrolls). */
export function sendScrollIntoView(
  top: number,
  height: number,
  block: "center" | "start" = "center",
  padding?: number
): void {
  post({ type: "poc-scroll-into-view", top, height, block, padding });
}

export interface HostMessageHandlers {
  /** The host wants an immediate, up-to-date height report. */
  onAskForHeight?: () => void;
  /** The host acked poc-frame-ready — the bridge is connected. */
  onHostReady?: () => void;
  /** The user dismissed the host's dim (click or Escape) for whichever app-drawn overlay is up. */
  onDismiss?: () => void;
}

/** Subscribes to messages from the host. Returns an unsubscribe function. */
export function listenToHost(handlers: HostMessageHandlers): () => void {
  const onMessage = (event: MessageEvent) => {
    if (!isEmbedded() || event.source !== window.parent) return;
    const data = event.data as { type?: unknown } | null | undefined;
    const type = data?.type;
    if (typeof type !== "string" || !(INBOUND_TYPES as readonly string[]).includes(type)) return;

    console.log(`REMOTE: type: ${type}`, data);
    switch (type as InboundType) {
      case "ask-for-height":
        handlers.onAskForHeight?.();
        break;
      case "poc-host-ready":
        handlers.onHostReady?.();
        break;
      case "poc-dismiss":
        handlers.onDismiss?.();
        break;
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
