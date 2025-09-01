async function clickButton(button) {
    if (!button || !button.isConnected) {
        logger("no target");
        return;
    }

    const isTouchscreenEnabled = await getFromStorage("isTouchscreenEnabled");

    if (!isTouchscreenEnabled) {
        button.click();
        return;
    }

    await ensureBridge();

    const token = Math.random().toString(36).slice(2);
    button.setAttribute("data-ext-target", token);

    // Post to the same frame the element is in
    const frameWin = button.ownerDocument.defaultView || window;
    // use '*' to handle about:blank/srcdoc
    frameWin.postMessage({ __ext__: "activate", token }, "*");
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

function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        // browser compatibility
        (typeof browser !== "undefined"
            ? browser.storage
            : chrome.storage
        ).sync.get(key, (result) => {
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
        console.log("nah.js -", ...data);
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

    const fontSizeStorage = await getFromStorage("fontSize");
    const fontSize = fontSizeStorage ? `${fontSizeStorage}px` : null;

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
                if (fontSize) button.style.fontSize = fontSize;
                vidBox.appendChild(button);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function hasMatchingPath(svgElement, targetPath) {
    const paths = svgElement.querySelectorAll("path");
    return Array.from(paths).some((p) => p.getAttribute("d") === targetPath);
}

function actionNah(svgPath) {
    return (event) => {
        event.preventDefault();
        event.stopPropagation();

        // prevent popup from appearing when custom button is pressed
        const popupWrapper = document.querySelector("ytd-popup-container");
        logger("popupWrapper", popupWrapper);
        popupWrapper.classList.add("hide-popup");
        const menuButtonSelectors = [
            // subscriptions page
            "#menu #button yt-icon",

            // homepage, recommended videos
            ".yt-lockup-metadata-view-model__menu-button button",
        ];
        const menuButton = event.target.parentElement.querySelector(
            menuButtonSelectors.join(",")
        );

        if (!menuButton) {
            logger("Could not find menu button");
            return;
        }

        logger("actionNah pressing button");
        clickButton(menuButton);

        // ..wait for popup to render using artificial delay
        setTimeout(async () => {
            try {
                // when navigating between pages, a new copy of the virtual list is added to popupWrapper children
                // we want the most recent (i.e. last in the last)
                const popupWrapperInner = popupWrapper.querySelector(
                    "tp-yt-iron-dropdown:last-of-type"
                );
                const popupSelectors = [
                    // subscriptions
                    "ytd-menu-popup-renderer #items",

                    // homepage, recommended videos
                    "yt-list-view-model",
                ];
                const popupNode = popupWrapperInner.querySelector(
                    popupSelectors.join(",")
                );
                logger("popupNode", popupNode);

                if (!popupNode) {
                    logger("Could not find popup menu in DOM");
                    return;
                }

                let buttonChildIndex = -1;
                const popupMenuChildren = Array.from(popupNode.children);

                logger("Scanning through popupMenuChildren:");
                for (let i = 0; i < popupMenuChildren.length; i++) {
                    const childNode = popupMenuChildren[i];
                    logger(childNode);
                    logger(childNode.textContent.trim());

                    const svgCandidateSelectors = [
                        // subscriptions
                        "ytd-menu-service-item-renderer tp-yt-paper-item yt-icon span div svg",

                        // homepage, recommended videos
                        "yt-list-item-view-model svg",
                    ];
                    const svgCandidate = childNode.querySelector(
                        svgCandidateSelectors.join(",")
                    );

                    logger(svgCandidate);
                    if (!svgCandidate) continue;
                    logger(svgCandidate.innerHTML);

                    const isCandidateCorrectButton = hasMatchingPath(
                        svgCandidate,
                        svgPath
                    );
                    if (isCandidateCorrectButton) {
                        logger(`found popupMenuChildren button at index ${i}`);
                        buttonChildIndex = i;
                        break;
                    }
                }

                if (buttonChildIndex === -1) {
                    logger("Could not find button in popupMenuChildren");
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
                const notInterestedBtn = popupNode.querySelector(
                    selectors.join(",")
                );
                logger("searching", selectors.join(","), popupNode);
                logger("notInterestedBtn", notInterestedBtn);

                if (notInterestedBtn) {
                    logger("clicking", notInterestedBtn.textContent.trim());
                    clickButton(notInterestedBtn);

                    // hide video preview
                    const videoPreview =
                        document.querySelector("ytd-video-preview");
                    videoPreview.hidden = true;
                } else {
                    logger("could not find notInterestedBtn");
                }
            } finally {
                logger("removing hide class from popup wrapper");
                popupWrapper.classList.remove("hide-popup"); // todo: control with display: none style
            }
        }, 50);

        return false;
    };
}
