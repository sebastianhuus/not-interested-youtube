// injects a script into the page
function runInPage(fn, ...args) {
    const s = document.createElement("script");
    s.textContent = `(${fn})(...${JSON.stringify(args)});`;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
}

// script to click a button on a page using runInPage
function clickInPageRealm(button) {
    // add this token to the button so the page script can find it
    const token = Math.random().toString(36).slice(2);
    button.setAttribute("data-ext-target", token);

    runInPage((attr) => {
        const el = document.querySelector(`[data-ext-target="${attr}"]`);
        if (!el || !el.isConnected) return;

        const touchMode =
            navigator.maxTouchPoints > 0 || "ontouchstart" in window;
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
    }, token);
}

const NAH_SVG =
    "M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM3 12c0 2.31.87 4.41 2.29 6L18 5.29C16.41 3.87 14.31 3 12 3c-4.97 0-9 4.03-9 9zm15.71-6L6 18.71C7.59 20.13 9.69 21 12 21c4.97 0 9-4.03 9-9 0-2.31-.87-4.41-2.29-6z";
const CHANNEL_SVG =
    "M12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm7 11H5v-2h14v2z";

// keep running so when new videos appear, ie. on page scroll, we add button to them as well
setInterval(() => {
    // subscriptions
    addNahBtns("ytd-rich-grid-media #details");

    // homepage, recommended videos
    addNahBtns("yt-lockup-metadata-view-model");

    // not sure if this is needed anymore
    addNahBtns("ytd-compact-video-renderer #dismissible .details");
}, 2000);

const baseStyles = `
<style>
    .nah-btn {
        position: absolute;
        right: 0px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.5;
        color: #f1f1f1;
    }
    .nah-btn:hover {
        opacity: 1;
    }

    .btn-top {
        top: 45px;
    }

    .btn-bottom {
        top: 65px;
    }

    .hide-popup {
        opacity: 0;
        display: none;
    }
</style>`;
document.head.insertAdjacentHTML("beforeend", baseStyles);

// browser compatibility
const storage =
    typeof browser !== "undefined" ? browser.storage : chrome.storage;

function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        storage.sync.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}

async function logger(...data) {
    const isDebuggingEnabled = await getFromStorage("isDebuggingEnabled");
    if (isDebuggingEnabled) {
        console.log("nah -", ...data);
    }
}

async function addNahBtns(videoBoxSelector) {
    const nahButtonLabel = (await getFromStorage("nahButtonLabel")) || "👎";
    const nahButton = {
        onClick: actionNah(NAH_SVG),
        cssClass: "btn-top",
        textContent: nahButtonLabel,
        title: "Not interested",
    };
    const channelButtonLabel =
        (await getFromStorage("channelButtonLabel")) || "❌";
    const channelButton = {
        onClick: actionNah(CHANNEL_SVG),
        cssClass: "btn-bottom",
        textContent: channelButtonLabel,
        title: "Don't recommend channel",
    };
    const btnsToAdd = [];
    const shouldHideNahButton = await getFromStorage("shouldHideNahButton");
    const shouldHideChannelButton = await getFromStorage(
        "shouldHideChannelButton"
    );
    if (!shouldHideNahButton) {
        btnsToAdd.push(nahButton);
    }
    if (!shouldHideChannelButton) {
        btnsToAdd.push(channelButton);
    }

    try {
        for (const btnToAdd of btnsToAdd) {
            document.querySelectorAll(videoBoxSelector).forEach((vidBox) => {
                if (vidBox.querySelector(`button.${btnToAdd.cssClass}`) != null)
                    return; // if this vidBox has buttons already, can return early

                const button = document.createElement("button");
                button.classList.add("nah-btn");
                button.classList.add(btnToAdd.cssClass);
                button.textContent = btnToAdd.textContent;
                button.onclick = btnToAdd.onClick;
                button.title = btnToAdd.title;
                vidBox.appendChild(button);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function actionNah(svgPath) {
    return (event) => {
        event.preventDefault();
        event.stopPropagation();

        // prevent popup from appearing when custom button is pressed
        const popupWrapper = document.querySelector("ytd-popup-container");
        popupWrapper.classList.add("hide-popup");
        const menuButtonSelectors = [
            // subscriptions page
            "#menu #button yt-icon",

            // homepage, recommended videos
            ".yt-lockup-metadata-view-model-wiz__menu-button button",
        ];
        const menuButton = event.target.parentElement.querySelector(
            menuButtonSelectors.join(",")
        );

        if (!menuButton) {
            logger("Could not find menu button");
            return;
        }

        clickInPageRealm(menuButton);

        // ..wait for popup to render using artificial delay
        setTimeout(async () => {
            try {
                const popupSelectors = [
                    // subscriptions
                    "ytd-menu-popup-renderer #items",

                    // homepage, recommended videos
                    "yt-list-view-model.yt-list-view-model-wiz",
                ];
                const popupNode = popupWrapper.querySelector(
                    popupSelectors.join(",")
                );

                if (!popupNode) {
                    logger("Could not find popup menu in DOM");
                    return;
                }

                let buttonChildIndex;
                const popupMenuChildren = Array.from(popupNode.children);
                for (let i = 0; i < popupMenuChildren.length; i++) {
                    const childNode = popupMenuChildren[i];
                    const svgCandidateSelectors = [
                        // subscriptions
                        "ytd-menu-service-item-renderer tp-yt-paper-item yt-icon span div svg",

                        // homepage, recommended videos
                        ".yt-list-item-view-model-wiz__container svg",
                    ];
                    const svgCandidate = childNode.querySelector(
                        svgCandidateSelectors.join(",")
                    );

                    logger(childNode);
                    logger(childNode.textContent.trim());
                    logger(svgCandidate);
                    if (!svgCandidate) continue;
                    logger(svgCandidate.innerHTML);
                    const isCandidateCorrectButton = svgCandidate.innerHTML
                        .trim()
                        .indexOf(svgPath);
                    if (isCandidateCorrectButton !== -1) {
                        logger(`found button at index ${i}`);
                        buttonChildIndex = i;
                        break;
                    }
                }

                if (!buttonChildIndex) {
                    logger("Could not find button in DOM");
                    return;
                }
                // nth-child css selector index is 1-based
                buttonChildIndex += 1;

                const selectors = [
                    // subscriptions
                    `ytd-menu-popup-renderer #items > ytd-menu-service-item-renderer:nth-child(${buttonChildIndex})`,

                    // homepage, recommended videos
                    `:nth-child(${buttonChildIndex})`,
                ];
                const notInterestedBtn = popupWrapper.querySelector(
                    selectors.join(",")
                );

                if (notInterestedBtn) {
                    logger("clicking", notInterestedBtn.textContent.trim());
                    clickInPageRealm(notInterestedBtn);
                } else {
                    logger("could not find notInterestedBtn");
                }
            } finally {
                popupWrapper.classList.remove("hide-popup");
            }
        }, 100);

        return false;
    };
}
