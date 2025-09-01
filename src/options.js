// browser compatibility
const storage =
    typeof browser !== "undefined" ? browser.storage : chrome.storage;

document.getElementById("save").addEventListener("click", () => {
    const fontSize = document.getElementById("font-size").value;
    const isDebuggingEnabled = document.getElementById("debug-mode").checked;
    const shouldHideNahButton =
        document.getElementById("hide-nah-button").checked;
    const shouldHideChannelButton = document.getElementById(
        "hide-channel-button"
    ).checked;
    const nahButtonLabel = document.getElementById("nah-button-label").value;
    const channelButtonLabel = document.getElementById(
        "channel-button-label"
    ).value;
    const isTouchscreenEnabled =
        document.getElementById("touchscreen-mode").checked;

    // Save the checkbox value in storage
    storage.sync.set(
        {
            fontSize,
            isDebuggingEnabled,
            shouldHideNahButton,
            shouldHideChannelButton,
            nahButtonLabel,
            channelButtonLabel,
            isTouchscreenEnabled,
        },
        () => {
            document.getElementById("status").innerHTML = "Settings saved!";
            setTimeout(() => {
                document.getElementById("status").innerHTML = "";
            }, 5000);
        }
    );
});

document.addEventListener("DOMContentLoaded", () => {
    storage.sync.get("fontSize", (data) => {
        document.getElementById("font-size").value = data.fontSize || "";
    });

    storage.sync.get("isDebuggingEnabled", (data) => {
        document.getElementById("debug-mode").checked =
            data.isDebuggingEnabled || false;
    });

    storage.sync.get("shouldHideNahButton", (data) => {
        document.getElementById("hide-nah-button").checked =
            data.shouldHideNahButton || false;
    });

    storage.sync.get("shouldHideChannelButton", (data) => {
        document.getElementById("hide-channel-button").checked =
            data.shouldHideChannelButton || false;
    });

    storage.sync.get("nahButtonLabel", (data) => {
        document.getElementById("nah-button-label").value =
            data.nahButtonLabel || "👎";
    });

    storage.sync.get("channelButtonLabel", (data) => {
        document.getElementById("channel-button-label").value =
            data.channelButtonLabel || "❌";
    });

    storage.sync.get("isTouchscreenEnabled", (data) => {
        document.getElementById("touchscreen-mode").checked =
            data.isTouchscreenEnabled || false;
    });
});
