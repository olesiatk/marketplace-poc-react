import { sendResizeIframe } from "./post-message";

/**
 * Reports this app's own content height to the host: once immediately,
 * then again on any layout change (ResizeObserver on `root`) and on
 * window resize. `reportNow` is also what the caller should invoke
 * whenever the host asks for an up-to-date height on demand.
 */
export function watchIframeHeight(root: HTMLElement): { reportNow: () => void; stop: () => void } {
  const reportNow = () => sendResizeIframe(root.getBoundingClientRect().height);

  const resizeObserver = new ResizeObserver(() => reportNow());
  resizeObserver.observe(root);
  window.addEventListener("resize", reportNow);
  reportNow();

  return {
    reportNow,
    stop: () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", reportNow);
    },
  };
}
