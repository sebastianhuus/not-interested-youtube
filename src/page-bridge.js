window.__extBridgeReady = true;
window.dispatchEvent(new Event("ext:bridge-ready"));
// console.log("nah.js - page-bridge ready");

window.addEventListener("message", (e) => {
    // console.log("bridge event listener");
    const { token } = e.data || {};

    const el = document.querySelector(`[data-ext-target="${token}"]`);
    if (!el || !el.isConnected) return;

    const touchMode = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    if (!touchMode) {
        el.click();
        el.removeAttribute("data-ext-target");
        return;
    }

    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);

    const ptr = (type, init = {}) =>
        el.dispatchEvent(
            new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                isPrimary: true,
                pointerId: 1,
                pointerType: "touch",
                clientX: cx,
                clientY: cy,
                ...init,
            })
        );

    const mouse = (type, init = {}) =>
        el.dispatchEvent(
            new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                button: 0,
                buttons: 1,
                clientX: cx,
                clientY: cy,
                ...init,
            })
        );

    const tryTouch = (type) => {
        try {
            if (!window.Touch || !window.TouchEvent) return;
            const t = new Touch({
                identifier: 1,
                target: el,
                clientX: cx,
                clientY: cy,
                pageX: cx,
                pageY: cy,
                screenX: cx,
                screenY: cy,
            });
            el.dispatchEvent(
                new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    touches: type === "touchend" ? [] : [t],
                    targetTouches: type === "touchend" ? [] : [t],
                    changedTouches: [t],
                })
            );
        } catch {}
    };

    // replicating this sequence of events was necessary to get touch events working
    // pointerdown → touchstart → pointerup → touchend → mousedown → mouseup → click
    ptr("pointerdown");
    tryTouch("touchstart");

    // Give frameworks a frame to flip internal flags
    requestAnimationFrame(() => {
        ptr("pointerup");
        tryTouch("touchend");
        mouse("mousedown");
        mouse("mouseup");
        mouse("click");

        el.removeAttribute("data-ext-target");
    });
});
