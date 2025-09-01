const api = typeof browser !== "undefined" ? browser : chrome;
const IS_FIREFOX =
    typeof browser !== "undefined" && /firefox/i.test(navigator.userAgent);

// Inject the bridge by URL (Chromium path; CSP-safe)
function injectBridgeByUrl() {
    console.log("injectBridgeByUrl");
    if (window.__extBridgeReady || document.getElementById("ext-bridge"))
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.id = "ext-bridge";
        s.src = api.runtime.getURL("page-bridge.js"); // exact path/case
        s.onload = resolve;
        s.onerror = () => reject(new Error("bridge load error (WAR)"));
        (document.head || document.documentElement).appendChild(s);
    });
}

// Inject the exact same file, but inline (Firefox path; tolerant of about:blank/srcdoc)
async function injectBridgeInlineFromFile() {
    if (
        window.__extBridgeReady ||
        document.getElementById("ext-bridge-inline")
    ) {
        logger("Script already injected - skipping");
        return;
    }
    const url = api.runtime.getURL("page-bridge.js");
    const src = await fetch(url).then((r) => {
        if (!r.ok) throw new Error("bridge fetch failed: " + r.status);
        return r.text();
    });
    const s = document.createElement("script");
    s.id = "ext-bridge-inline";
    s.textContent = `${src}\n//# sourceURL=ext-bridge-inline.js`; // handy in devtools
    (document.head || document.documentElement).appendChild(s);
    s.remove();
}

async function ensureBridge() {
    logger("ensureBridge");
    if (window.__extBridgeReady) return;

    const waitReady = new Promise((res) => {
        if (window.__extBridgeReady) return res();
        const onReady = () => {
            window.removeEventListener("ext:bridge-ready", onReady);
            res();
        };
        window.addEventListener("ext:bridge-ready", onReady, { once: true });
    });

    try {
        if (IS_FIREFOX) {
            console.log("IS_FIREFOX");
            // Inline first (works even for null-origin frames)
            await injectBridgeInlineFromFile();
        } else {
            console.log("IS_CHROMIUM");
            // Chromium: URL injection bypasses page CSP
            await injectBridgeByUrl();
        }
    } catch {
        // Fallback: try the other way round
        if (IS_FIREFOX) {
            await injectBridgeByUrl().catch(() => {}); // usually won’t be needed
        } else {
            await injectBridgeInlineFromFile().catch(() => {});
        }
    }

    await waitReady;
}
