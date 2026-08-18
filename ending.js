/* LAST SEEN — ending.js
   Ending state machine: notification -> actual Inbox insertion -> pixel LCD
   message -> ten-second realization -> black fade -> newer phone -> replay.
*/
(function () {
  "use strict";

  const notification = document.getElementById("ls-notification");
  const inboxTakeover = document.getElementById("ls-inbox-takeover");
  const messageReader = document.getElementById("messageReader");
  const readerBody = document.getElementById("readerBody");
  const man = document.getElementById("ls-man-silhouette");
  const newerPhone = document.getElementById("ls-newer-phone");
  const danteTime = document.querySelector(".ls-dante-time");
  const creditCard = document.getElementById("ls-credit-card");
  const fade = document.getElementById("ls-fade");
  const lcdFrame = document.querySelector(".lcd-frame");

  if (!notification || !inboxTakeover || !man || !newerPhone || !creditCard || !fade) return;

  const MESSAGE = "Nadito na ako";
  const PHONE_TIME = "07:12 · 16-02-1999";
  let notificationOpen = false;
  let notificationPending = false;
  let messageOpened = false;
  let messageVisible = false;
  let endingStarted = false;
  const timers = new Set();

  function later(fn, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(id => window.clearTimeout(id));
    timers.clear();
  }

  function isCorridor() {
    return Boolean(window.LS_CORRIDOR?.isActive?.() || window.LS_NARRATIVE?.getFlags?.().corridorActive);
  }

  function positionOverPhone(element) {
    if (!lcdFrame || !element) return;
    const rect = lcdFrame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    element.style.inset = "auto";
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.left = `${rect.left + rect.width / 2}px`;
    element.style.top = `${rect.top + rect.height / 2}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.transform = "translate(-50%, -50%)";
  }

  function setFlag(name, value) {
    try { window.LS_NARRATIVE.setFlag(name, value); } catch (_) {}
  }

  function injectInbox() {
    document.dispatchEvent(new CustomEvent("ls:injectInboxMessage"));
  }

  function hideNotification(keepPending = false) {
    notification.classList.remove("is-active");
    notification.setAttribute("aria-hidden", "true");
    notificationOpen = false;
    if (!keepPending) notificationPending = false;
    setFlag("notificationActive", false);
  }

  function hideInboxMessage() {
    inboxTakeover.classList.remove("is-active");
    inboxTakeover.setAttribute("aria-hidden", "true");
    inboxTakeover.tabIndex = -1;
    messageVisible = false;
  }

  function showNotification() {
    if (endingStarted || notificationOpen) return;
    injectInbox();
    if (isCorridor()) {
      notificationPending = true;
      return;
    }
    notificationPending = false;
    positionOverPhone(notification);
    notification.classList.add("is-active");
    notification.setAttribute("aria-hidden", "false");
    notification.tabIndex = 0;
    notificationOpen = true;
    setFlag("notificationActive", true);
    notification.focus?.({ preventScroll: true });
  }

  function showInboxMessage() {
    // Kept as a safe fallback for an external phone implementation, but the
    // normal path opens the real Inbox list through the legacy phone renderer.
    if (endingStarted || !messageOpened || isCorridor()) return;
    positionOverPhone(inboxTakeover);
    inboxTakeover.classList.add("is-active");
    inboxTakeover.setAttribute("aria-hidden", "false");
    inboxTakeover.tabIndex = 0;
    messageVisible = true;
    inboxTakeover.focus?.({ preventScroll: true });
  }

  function openMessage() {
    if (!notificationOpen || endingStarted || isCorridor()) return;
    hideNotification();
    // Do not reveal the message directly after the notification click. The
    // message has already been inserted into the actual Inbox archive; hand
    // control back to the pixel phone so the player opens Inbox and selects it.
    document.dispatchEvent(new CustomEvent("ls:openEndingInbox"));
  }

  function revealMan() {
    if (endingStarted) return;
    endingStarted = true;
    hideNotification();
    hideInboxMessage();
    if (messageReader) {
      messageReader.classList.remove("is-open");
      messageReader.setAttribute("aria-hidden", "true");
    }

    man.classList.add("is-revealed");
    try { window.LS_STORM?.flash?.(); } catch (_) {
      document.dispatchEvent(new CustomEvent("ls:lightning", { detail: { source: "window" } }));
    }
    // A secondary reflection gives the silhouette a readable, frightening
    // hold without turning the reveal into a jump scare.
    later(() => { try { window.LS_STORM?.flash?.(); } catch (_) {} }, 720);

    // Hold the realization, then commit to a real full black interval.
    later(() => {
      fade.classList.add("is-fading", "is-holding");
    }, 1800);
    later(showNewerPhone, 3600);
  }

  function showNewerPhone() {
    try { window.LS_NARRATIVE.enterEnding(); } catch (_) {}
    try { window.LS_AUDIO.stopAmbience(900); } catch (_) {}
    try { window.LS_AUDIO.playEnding(); } catch (_) {}
    if (danteTime) danteTime.textContent = PHONE_TIME;

    // Keep the new phone prepared underneath the black screen. It fades in
    // only after the old room has actually completed its black transition.
    newerPhone.classList.add("is-active", "is-preparing");
    newerPhone.setAttribute("aria-hidden", "false");
    man.classList.remove("is-revealed");

    later(() => {
      fade.classList.remove("is-holding", "is-fading");
      newerPhone.classList.remove("is-preparing");
      try { window.LS_AUDIO.playEAS(); } catch (_) {}
    }, 1100);

    // Let the final alert remain readable before the credit card.
    later(() => {
      try { window.LS_AUDIO.stopEAS(); } catch (_) {}
      showCreditCard();
    }, 15500);
  }

  function showCreditCard() {
    // A complete black transition separates the newer phone from the final
    // credit card. The credit card then precedes the interactive title screen.
    fade.classList.add("is-fading", "is-holding");
    newerPhone.classList.remove("is-active", "is-preparing");
    newerPhone.setAttribute("aria-hidden", "true");
    later(() => {
      creditCard.classList.add("is-active");
      creditCard.setAttribute("aria-hidden", "false");
      fade.classList.remove("is-holding", "is-fading");
    }, 1500);
    later(() => {
      try { window.LS_NARRATIVE.replay(); } catch (_) { window.location.reload(); }
    }, 6500);
  }

  function onNotificationClick(event) {
    event.preventDefault();
    openMessage();
  }

  function onNotificationKey(event) {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    openMessage();
  }

  notification.addEventListener("click", onNotificationClick);
  notification.addEventListener("keydown", onNotificationKey);

  document.addEventListener("ls:triggerNotification", showNotification);
  document.addEventListener("ls:triggerEndingSequence", () => {
    if (messageOpened && !endingStarted) later(revealMan, 10000);
  });

  // If a legacy phone reader opens the message through the underlying archive,
  // retain the same ending gate but keep the visible message pixel-styled.
  document.addEventListener("ls:naditoMessageOpened", () => {
    if (messageOpened) return;
    messageOpened = true;
    hideNotification();
    setFlag("naditoOpened", true);
    // The ten-second reveal starts from the actual Inbox message-open event.
    later(revealMan, 10000);
  });

  // Never leave a phone-only takeover floating over the hallway. Queue it and
  // reveal it only after the camera is back in the room.
  document.addEventListener("ls:flagChange", event => {
    if (event.detail.flag !== "corridorActive") return;
    if (event.detail.value) {
      if (notificationOpen) hideNotification(true);
      if (messageVisible) hideInboxMessage();
    } else {
      if (notificationPending && !messageOpened) showNotification();
      if (messageOpened && !endingStarted) showInboxMessage();
    }
  });

  window.addEventListener("resize", () => {
    if (notificationOpen) positionOverPhone(notification);
    if (messageVisible) positionOverPhone(inboxTakeover);
  }, { passive: true });

  document.addEventListener("ls:narrativeState", event => {
    if (event.detail.to !== "title") return;
    clearTimers();
    hideNotification();
    hideInboxMessage();
      newerPhone.classList.remove("is-active", "is-preparing");
      newerPhone.setAttribute("aria-hidden", "true");
      creditCard.classList.remove("is-active");
      creditCard.setAttribute("aria-hidden", "true");
      man.classList.remove("is-revealed", "is-fading");
      fade.classList.remove("is-fading", "is-holding");
    document.dispatchEvent(new CustomEvent("ls:removeEndingInboxMessage"));
    notificationOpen = false;
    notificationPending = false;
    messageOpened = false;
    messageVisible = false;
    endingStarted = false;
  });

  window.LS_ENDING = {
    showNotification,
    openMessage,
    revealMan,
    showNewerPhone,
    reset: clearTimers
  };
})();
