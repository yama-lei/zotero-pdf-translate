import { config, homepage } from "../../package.json";
import { LANG_CODE } from "../utils/config";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { setServiceSecret, validateServiceSecret } from "../utils/secret";
import { createServiceSettingsDialog } from "../utils";
import { services } from "./services";
import {
  checkAnkiConnection,
  refreshAnkiConfig,
  getCachedDeckNames,
  getCachedModelNames,
  getFieldsForModel,
} from "./anki";

export function registerPrefsWindow() {
  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    label: getString("pref-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    helpURL: homepage,
  });
}

export function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  addon.data.prefs.window = _window;
  buildPrefsPane();
  updatePrefsPaneDefault();
}

function buildPrefsPane() {
  const doc = addon.data.prefs.window?.document;
  if (!doc) {
    return;
  }

  // menus
  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("sentenceServices"),
      attributes: {
        value: getPref("translateSource") as string,
        native: "true",
      },
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            onPrefsEvents("setSentenceService");
          },
        },
      ],
      children: [
        {
          tag: "menupopup",
          children: services.getAllServicesWithType("sentence").map((s) => ({
            tag: "menuitem",
            attributes: {
              label: services.getServiceNameByID(s.id),
              value: s.id,
            },
          })),
        },
      ],
    },
    doc.querySelector(`#${makeId("sentenceServices-placeholder")}`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("wordServices"),
      attributes: {
        value: getPref("dictSource") as string,
        native: "true",
      },
      classList: ["use-word-service"],
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            onPrefsEvents("setWordService");
          },
        },
      ],
      children: [
        {
          tag: "menupopup",
          children: services.getAllServicesWithType("word").map((s) => ({
            tag: "menuitem",
            attributes: {
              label: services.getServiceNameByID(s.id),
              value: s.id,
            },
          })),
        },
      ],
    },
    doc.querySelector(`#${makeId("wordServices-placeholder")}`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("langfrom"),
      attributes: {
        value: getPref("sourceLanguage") as string,
        native: "true",
      },
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            onPrefsEvents("setSourceLanguage");
          },
        },
      ],
      styles: {
        maxWidth: "250px",
      },
      children: [
        {
          tag: "menupopup",
          children: LANG_CODE.map((lang) => ({
            tag: "menuitem",
            attributes: {
              label: lang.name,
              value: lang.code,
            },
          })),
        },
      ],
    },
    doc.querySelector(`#${makeId("langfrom-placeholder")}`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: makeId("langto"),
      attributes: {
        value: getPref("targetLanguage") as string,
        native: "true",
      },
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            onPrefsEvents("setTargetLanguage");
          },
        },
      ],
      styles: {
        maxWidth: "250px",
      },
      children: [
        {
          tag: "menupopup",
          children: LANG_CODE.map((lang) => ({
            tag: "menuitem",
            attributes: {
              label: lang.name,
              value: lang.code,
            },
          })),
        },
      ],
    },
    doc.querySelector(`#${makeId("langto-placeholder")}`)!,
  );

  doc
    .querySelector(`#${makeId("manageKeys")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("manageKeys");
    });
  doc
    .querySelector(`#${makeId("renameServices")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("renameServices");
    });

  doc
    .querySelector(`#${makeId("enableAuto")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setAutoTranslateSelection");
    });

  doc
    .querySelector(`#${makeId("enableComment")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setAutoTranslateAnnotation");
    });

  doc
    .querySelector(`#${makeId("enablePopup")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setEnablePopup");
    });

  doc
    .querySelector(`#${makeId("enableAddToNote")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setEnableAddToNote");
    });

  doc
    .querySelector(`#${makeId("showPlayBtn")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setShowPlayBtn");
    });

  doc
    .querySelector(`#${makeId("useWordService")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setUseWordService");
    });

  doc
    .querySelector(`#${makeId("hideUnconfiguredServices")}`)
    ?.addEventListener("command", () => {
      addon.hooks.onReaderTabPanelRefresh();
    });

  doc
    .querySelector(`#${makeId("sentenceServicesSecret")}`)
    ?.addEventListener("input", (e: Event) => {
      onPrefsEvents("updateSentenceSecret");
    });

  doc
    .querySelector(`#${makeId("wordServicesSecret")}`)
    ?.addEventListener("input", (e: Event) => {
      onPrefsEvents("updateWordSecret");
    });

  doc
    .querySelector(`#${makeId("fontSize")}`)
    ?.addEventListener("input", (e: Event) => {
      onPrefsEvents("updateFontSize");
    });

  doc
    .querySelector(`#${makeId("lineHeight")}`)
    ?.addEventListener("input", (e: Event) => {
      onPrefsEvents("updatelineHeight");
    });

  doc
    .querySelector(`#${makeId("reset-titleTranslation")}`)
    ?.addEventListener("command", (e: Event) => {
      ztoolkit
        .getGlobal("ZoteroPane")
        .getSelectedItems()
        .forEach((item) => {
          ztoolkit.ExtraField.setExtraField(item, "titleTranslation", "");
        });
    });

  doc
    .querySelector(`#${makeId("reset-abstractTranslation")}`)
    ?.addEventListener("command", (e: Event) => {
      ztoolkit
        .getGlobal("ZoteroPane")
        .getSelectedItems()
        .forEach((item) => {
          ztoolkit.ExtraField.setExtraField(item, "abstractTranslation", "");
        });
    });

  doc
    .querySelector(`#${makeId("enableAutoTagAnnotation")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvents("setEnableAutoTagAnnotation");
    });

  // Anki Integration settings
  doc
    .querySelector(`#${makeId("anki-enabled")}`)
    ?.addEventListener("command", async () => {
      const checkbox = doc.querySelector(
        `#${makeId("anki-enabled")}`,
      ) as XUL.Checkbox;

      if (checkbox.checked) {
        const confirmed =
          addon.data.prefs.window?.confirm(getString("anki-enable-confirm")) ??
          true;
        if (!confirmed) {
          checkbox.checked = false;
          setPref("anki.enabled", false);
          onPrefsEvents("setAnkiEnabled");
          return;
        }

        setPref("anki.enabled", true);
        onPrefsEvents("setAnkiEnabled");
        await refreshAnkiConfigIfEnabled();
        return;
      }

      setPref("anki.enabled", false);
      onPrefsEvents("setAnkiEnabled");
    });

  doc
    .querySelector(`#${makeId("anki-test")}`)
    ?.addEventListener("command", async () => {
      try {
        const connected = await checkAnkiConnection();
        addon.data.prefs.window?.alert(
          connected
            ? getString("anki-progress-success")
            : getString("anki-error-connection"),
        );
      } catch {
        addon.data.prefs.window?.alert(getString("anki-error-connection"));
      }
    });

  doc
    .querySelector(`#${makeId("anki-refresh")}`)
    ?.addEventListener("command", async () => {
      try {
        await refreshAnkiConfig();
        updateAnkiMenus();
        await updateAnkiFieldMenus();
        addon.data.prefs.window?.alert("Anki configuration refreshed!");
      } catch (e) {
        addon.data.prefs.window?.alert(
          `Failed to refresh: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    });

  doc
    .querySelector(`#${makeId("anki-deck")}`)
    ?.addEventListener("command", () => {
      const menulist = doc.querySelector(
        `#${makeId("anki-deck")}`,
      ) as XUL.MenuList;
      setPref("anki.deckName", menulist.value);
    });

  doc
    .querySelector(`#${makeId("anki-model")}`)
    ?.addEventListener("command", () => {
      const menulist = doc.querySelector(
        `#${makeId("anki-model")}`,
      ) as XUL.MenuList;
      setPref("anki.modelName", menulist.value);
      void updateAnkiFieldMenus(menulist.value);
    });

  doc
    .querySelector(`#${makeId("anki-frontField")}`)
    ?.addEventListener("command", () => {
      const menulist = doc.querySelector(
        `#${makeId("anki-frontField")}`,
      ) as XUL.MenuList;
      setPref("anki.frontField", menulist.value);
    });

  doc
    .querySelector(`#${makeId("anki-backField")}`)
    ?.addEventListener("command", () => {
      const menulist = doc.querySelector(
        `#${makeId("anki-backField")}`,
      ) as XUL.MenuList;
      setPref("anki.backField", menulist.value);
    });

  // Initialize Anki menus
  updateAnkiMenus();
  void updateAnkiFieldMenus();
}

function updatePrefsPaneDefault() {
  onPrefsEvents("setAutoTranslateAnnotation", false);
  onPrefsEvents("setEnablePopup", false);
  onPrefsEvents("setShowPlayBtn", false);
  onPrefsEvents("setUseWordService", false);
  onPrefsEvents("setSentenceSecret", false);
  onPrefsEvents("setWordSecret", false);
  onPrefsEvents("setEnableAutoTagAnnotation", false);
  onPrefsEvents("setAnkiEnabled", false);
  void refreshAnkiConfigIfEnabled();
}

function onPrefsEvents(type: string, fromElement: boolean = true) {
  const doc = addon.data.prefs.window?.document;
  if (!doc) {
    return;
  }

  const setDisabled = (className: string, disabled: boolean) => {
    doc
      .querySelectorAll(`.${className}`)
      .forEach(
        (elem) => ((elem as XUL.Element & XUL.IDisabled).disabled = disabled),
      );
  };
  switch (type) {
    case "setAutoTranslateSelection":
      addon.hooks.onReaderTabPanelRefresh();
      break;
    case "setAutoTranslateAnnotation":
      {
        addon.hooks.onReaderTabPanelRefresh();
      }
      break;
    case "setEnablePopup":
      {
        const elemValue = fromElement
          ? (doc.querySelector(`#${makeId("enablePopup")}`) as XUL.Checkbox)
              .checked
          : (getPref("enablePopup") as boolean);
        const hidden = !elemValue;
        setDisabled("enable-popup", hidden);
        if (!hidden) {
          onPrefsEvents("setEnableAddToNote", fromElement);
        }
      }
      break;
    case "setEnableAddToNote":
      {
        const elemValue = fromElement
          ? (doc.querySelector(`#${makeId("enableAddToNote")}`) as XUL.Checkbox)
              .checked
          : (getPref("enableNote") as boolean);
        const hidden = !elemValue;
        setDisabled("enable-popup-addtonote", hidden);
      }
      break;
    case "setShowPlayBtn":
      {
        const elemValue = fromElement
          ? (doc.querySelector(`#${makeId("showPlayBtn")}`) as XUL.Checkbox)
              .checked
          : (getPref("showPlayBtn") as boolean);
        const hidden = !elemValue;
        setDisabled("show-play-btn", hidden);
      }
      break;
    case "setUseWordService":
      {
        const elemValue = fromElement
          ? (doc.querySelector(`#${makeId("useWordService")}`) as XUL.Checkbox)
              .checked
          : (getPref("enableDict") as boolean);
        const hidden = !elemValue;
        setDisabled("use-word-service", hidden);
        if (!hidden) {
          onPrefsEvents("setShowPlayBtn", fromElement);
        }
      }
      break;
    case "setEnableAutoTagAnnotation":
      {
        const elemValue = fromElement
          ? (
              doc.querySelector(
                `#${makeId("enableAutoTagAnnotation")}`,
              ) as XUL.Checkbox
            ).checked
          : (getPref("enableAutoTagAnnotation") as boolean);
        const hidden = !elemValue;
        setDisabled("enable-auto-tag-annotation", hidden);
      }
      break;
    case "setSentenceService":
      {
        setPref(
          "translateSource",
          (
            doc.querySelector(`#${makeId("sentenceServices")}`) as XUL.MenuList
          ).getAttribute("value")!,
        );
        onPrefsEvents("setSentenceSecret", fromElement);
        addon.hooks.onReaderTabPanelRefresh();
      }
      break;
    case "updateSentenceSecret":
      {
        setServiceSecret(
          getPref("translateSource") as string,
          (
            doc.querySelector(
              `#${makeId("sentenceServicesSecret")}`,
            ) as HTMLInputElement
          ).value,
        );
      }
      break;
    case "setSentenceSecret":
      {
        const serviceId = getPref("translateSource") as string;
        const secretCheckResult = validateServiceSecret(
          serviceId,
          (validateResult) => {
            if (fromElement && !validateResult.status) {
              addon.data.prefs.window?.alert(
                `You see this because the translation service ${serviceId} requires SECRET, which is NOT correctly set.\n\nDetails:\n${validateResult.info}`,
              );
            }
          },
        );
        (
          doc.querySelector(
            `#${makeId("sentenceServicesSecret")}`,
          ) as HTMLInputElement
        ).value = secretCheckResult.secret;

        // Update secret status button
        const statusButton = doc.querySelector(
          `#${makeId("sentenceServicesStatus")}`,
        ) as XUL.Button;
        const service =
          addon.data.translate.services.getServiceById(serviceId)!;
        if (service.config) {
          statusButton.hidden = false;
          statusButton.label = getString("service-dialog-config");
          statusButton.onclick = (ev) => {
            createServiceSettingsDialog(service);
          };
        } else {
          statusButton.hidden = true;
        }
      }
      break;
    case "setWordService":
      {
        setPref(
          "dictSource",
          (
            doc.querySelector(`#${makeId("wordServices")}`) as XUL.MenuList
          ).getAttribute("value")!,
        );
        onPrefsEvents("setWordSecret", fromElement);
      }
      break;
    case "updateWordSecret":
      {
        setServiceSecret(
          getPref("dictSource") as string,
          (
            doc.querySelector(
              `#${makeId("wordServicesSecret")}`,
            ) as HTMLInputElement
          ).value,
        );
      }
      break;
    case "setWordSecret":
      {
        const serviceId = getPref("dictSource") as string;
        const secretCheckResult = validateServiceSecret(
          serviceId,
          (validateResult) => {
            if (fromElement && !validateResult.status) {
              addon.data.prefs.window?.alert(
                `You see this because the translation service ${serviceId} requires SECRET, which is NOT correctly set.\n\nDetails:\n${validateResult.info}`,
              );
            }
          },
        );
        (
          doc.querySelector(
            `#${makeId("wordServicesSecret")}`,
          ) as HTMLInputElement
        ).value = secretCheckResult.secret;
      }
      break;
    case "setSourceLanguage":
      {
        setPref(
          "sourceLanguage",
          (
            doc.querySelector(`#${makeId("langfrom")}`) as XUL.MenuList
          ).getAttribute("value")!,
        );
        addon.hooks.onReaderTabPanelRefresh();
      }
      break;
    case "setTargetLanguage":
      {
        setPref(
          "targetLanguage",
          (
            doc.querySelector(`#${makeId("langto")}`) as XUL.MenuList
          ).getAttribute("value")!,
        );
        addon.hooks.onReaderTabPanelRefresh();
      }
      break;
    case "updateFontSize":
      addon.api.getTemporaryRefreshHandler()();
      break;
    case "updatelineHeight":
      addon.api.getTemporaryRefreshHandler()();
      break;
    case "manageKeys":
      {
        import("../modules/settings/manageKeys").then(
          ({ manageKeysDialog }) => {
            manageKeysDialog();
          },
        );
      }
      break;
    case "renameServices":
      {
        import("../modules/settings/renameServices").then(
          ({ renameServicesDialog }) => {
            renameServicesDialog();
          },
        );
      }
      break;
    case "setAnkiEnabled":
      {
        const elemValue = fromElement
          ? (doc.querySelector(`#${makeId("anki-enabled")}`) as XUL.Checkbox)
              .checked
          : (getPref("anki.enabled") as boolean);
        const disabled = !elemValue;
        const container = doc.querySelector(
          `#${makeId("anki-setting-container")}`,
        ) as XUL.Element | null;
        if (container) {
          (container as XUL.Element & { hidden?: boolean }).hidden = disabled;
        }
        setDisabled("anki-setting", disabled);
      }
      break;
    default:
      return;
  }
}

function makeId(type: string) {
  return `${config.addonRef}-${type}`;
}

function updateAnkiMenus() {
  const doc = addon.data.prefs.window?.document;
  if (!doc) return;

  const decks = getCachedDeckNames();
  const models = getCachedModelNames();

  const currentDeck = (getPref("anki.deckName") as string) || "Default";
  const currentModel = (getPref("anki.modelName") as string) || "Basic";

  // Update deck menu
  const deckPopup = doc.querySelector(`#${makeId("anki-deck-popup")}`);
  if (deckPopup) {
    deckPopup.innerHTML = "";
    const deckList = decks.length > 0 ? decks : ["Default"];
    deckList.forEach((deck) => {
      const menuitem = doc.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is" + ".only.xul",
        "menuitem",
      ) as XUL.MenuItem;
      menuitem.setAttribute("label", deck);
      menuitem.setAttribute("value", deck);
      deckPopup.appendChild(menuitem);
    });
    const deckMenulist = doc.querySelector(
      `#${makeId("anki-deck")}`,
    ) as XUL.MenuList;
    if (deckMenulist) {
      deckMenulist.value = currentDeck;
    }
  }

  // Update model menu
  const modelPopup = doc.querySelector(`#${makeId("anki-model-popup")}`);
  if (modelPopup) {
    modelPopup.innerHTML = "";
    const modelList = models.length > 0 ? models : ["Basic"];
    modelList.forEach((model) => {
      const menuitem = doc.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is" + ".only.xul",
        "menuitem",
      ) as XUL.MenuItem;
      menuitem.setAttribute("label", model);
      menuitem.setAttribute("value", model);
      modelPopup.appendChild(menuitem);
    });
    const modelMenulist = doc.querySelector(
      `#${makeId("anki-model")}`,
    ) as XUL.MenuList;
    if (modelMenulist) {
      modelMenulist.value = currentModel;
    }
  }
}

async function refreshAnkiConfigIfEnabled() {
  const enabled = getPref("anki.enabled") as boolean;
  if (!enabled) return;

  try {
    await refreshAnkiConfig();
    updateAnkiMenus();
    await updateAnkiFieldMenus();
  } catch {
    return;
  }
}

async function updateAnkiFieldMenus(modelName?: string) {
  const doc = addon.data.prefs.window?.document;
  if (!doc) return;

  const enabled = getPref("anki.enabled") as boolean;
  if (!enabled && !modelName) return;

  const currentModel = modelName || (getPref("anki.modelName") as string) || "";
  const fields = await getFieldsForModel(currentModel);

  const currentFront = (getPref("anki.frontField") as string) || "";
  const currentBack = (getPref("anki.backField") as string) || "";

  const frontValue =
    (currentFront && fields.includes(currentFront) && currentFront) ||
    fields[0] ||
    "Front";
  const backValue =
    (currentBack && fields.includes(currentBack) && currentBack) ||
    fields[1] ||
    fields[0] ||
    "Back";

  const frontPopup = doc.querySelector(`#${makeId("anki-frontField-popup")}`);
  if (frontPopup) {
    frontPopup.innerHTML = "";
    (fields.length ? fields : [frontValue]).forEach((field) => {
      const menuitem = doc.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is" + ".only.xul",
        "menuitem",
      ) as XUL.MenuItem;
      menuitem.setAttribute("label", field);
      menuitem.setAttribute("value", field);
      frontPopup.appendChild(menuitem);
    });
    const frontMenulist = doc.querySelector(
      `#${makeId("anki-frontField")}`,
    ) as XUL.MenuList;
    if (frontMenulist) {
      frontMenulist.value = frontValue;
    }
  }

  const backPopup = doc.querySelector(`#${makeId("anki-backField-popup")}`);
  if (backPopup) {
    backPopup.innerHTML = "";
    (fields.length ? fields : [backValue]).forEach((field) => {
      const menuitem = doc.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is" + ".only.xul",
        "menuitem",
      ) as XUL.MenuItem;
      menuitem.setAttribute("label", field);
      menuitem.setAttribute("value", field);
      backPopup.appendChild(menuitem);
    });
    const backMenulist = doc.querySelector(
      `#${makeId("anki-backField")}`,
    ) as XUL.MenuList;
    if (backMenulist) {
      backMenulist.value = backValue;
    }
  }

  if ((getPref("anki.frontField") as string) !== frontValue) {
    setPref("anki.frontField", frontValue);
  }
  if ((getPref("anki.backField") as string) !== backValue) {
    setPref("anki.backField", backValue);
  }
}
