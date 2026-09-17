import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmbedded, listenToHost, sendFrameReady, sendModal, sendResizeIframe, sendScrollIntoView, sendTourStatus } from "./post-message";

function withEmbeddedParent<T>(run: (postMessage: ReturnType<typeof vi.fn>) => T): T {
  const postMessage = vi.fn();
  const fakeParent = { postMessage } as unknown as Window;
  const originalParent = window.parent;
  Object.defineProperty(window, "parent", { value: fakeParent, configurable: true });
  try {
    return run(postMessage);
  } finally {
    Object.defineProperty(window, "parent", { value: originalParent, configurable: true });
  }
}

describe("isEmbedded", () => {
  it("is false when window.parent is window itself", () => {
    expect(isEmbedded()).toBe(false);
  });

  it("is true when window.parent differs from window", () => {
    withEmbeddedParent(() => {
      expect(isEmbedded()).toBe(true);
    });
  });
});

describe("sending messages to the host", () => {
  it("does nothing when not embedded", () => {
    const spy = vi.spyOn(window.parent, "postMessage");
    sendFrameReady();
    sendResizeIframe(100);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("posts poc-resize-iframe with the height rounded up", () => {
    withEmbeddedParent((postMessage) => {
      sendResizeIframe(123.2);
      expect(postMessage).toHaveBeenCalledWith({ type: "poc-resize-iframe", height: 124 }, "*");
    });
  });

  it("posts poc-tour-status with the active flag", () => {
    withEmbeddedParent((postMessage) => {
      sendTourStatus(true);
      expect(postMessage).toHaveBeenCalledWith({ type: "poc-tour-status", active: true }, "*");
    });
  });

  it("posts poc-modal with minHeight only when opening", () => {
    withEmbeddedParent((postMessage) => {
      sendModal(true, 640);
      expect(postMessage).toHaveBeenCalledWith({ type: "poc-modal", open: true, minHeight: 640 }, "*");
      sendModal(false);
      expect(postMessage).toHaveBeenLastCalledWith({ type: "poc-modal", open: false }, "*");
    });
  });

  it("posts poc-scroll-into-view with a center block by default", () => {
    withEmbeddedParent((postMessage) => {
      sendScrollIntoView(50, 200);
      expect(postMessage).toHaveBeenCalledWith(
        { type: "poc-scroll-into-view", top: 50, height: 200, block: "center", padding: undefined },
        "*"
      );
    });
  });
});

describe("listenToHost", () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
  });

  function dispatchFromParent(data: unknown, source: unknown = window.parent) {
    window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
  }

  it("ignores messages not sourced from window.parent", () => {
    withEmbeddedParent(() => {
      const onAskForHeight = vi.fn();
      stop = listenToHost({ onAskForHeight });
      dispatchFromParent({ type: "ask-for-height" }, window);
      expect(onAskForHeight).not.toHaveBeenCalled();
    });
  });

  it("ignores message types outside the inbound allow-list", () => {
    withEmbeddedParent(() => {
      const onDismiss = vi.fn();
      stop = listenToHost({ onDismiss });
      dispatchFromParent({ type: "poc-open-media" });
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  it("dispatches ask-for-height, poc-host-ready and poc-dismiss to their handlers", () => {
    withEmbeddedParent(() => {
      const onAskForHeight = vi.fn();
      const onHostReady = vi.fn();
      const onDismiss = vi.fn();
      stop = listenToHost({ onAskForHeight, onHostReady, onDismiss });

      dispatchFromParent({ type: "ask-for-height" });
      dispatchFromParent({ type: "poc-host-ready" });
      dispatchFromParent({ type: "poc-dismiss" });

      expect(onAskForHeight).toHaveBeenCalledTimes(1);
      expect(onHostReady).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  it("stops listening once unsubscribed", () => {
    withEmbeddedParent(() => {
      const onDismiss = vi.fn();
      const unsubscribe = listenToHost({ onDismiss });
      unsubscribe();
      dispatchFromParent({ type: "poc-dismiss" });
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
