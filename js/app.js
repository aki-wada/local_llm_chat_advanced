(() => {
  "use strict";

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/pdf.worker.min.js";
  }

  // ===================================================================
  // Section 1: Constants
  // ===================================================================

  const STORAGE_KEYS = {
    SETTINGS: "llmchat.settings.v173",
    HISTORY: "llmchat.history.v173",
    SESSIONS: "llmchat.sessions.v1",
    CURRENT_SESSION_ID: "llmchat.currentSessionId.v1",
    DRAFT: "llmchat.draft.v173",
    PRESETS: "llmchat.presets.v173",
    SYSTEM_PROMPT_PRESETS: "llmchat.systemPromptPresets.v173",
    MEMORIES: "llmchat.memories.v1"
  };

  const LEGACY_STORAGE_KEYS = {
    SETTINGS: ["llmchat.settings", "local_llm_chat.settings"],
    HISTORY: ["llmchat.history", "local_llm_chat.history"],
    DRAFT: ["llmchat.draft", "local_llm_chat.draft"]
  };

  const LIMITS = {
    IMAGE_MB: 5,
    IMAGE_MAX_DIMENSION: 2048,
    TEXT_MB: 2,
    PDF_MB: 10,
    MAX_HISTORY_FOR_API: 6,
    IMPORT_MAX_SIZE: 10 * 1024 * 1024
  };

  const SETTING_OPTIONS = {
    sendKey: new Set(["shift-enter-send", "enter-send"]),
    responseStyle: new Set(["concise", "standard", "detailed", "professional"]),
    userLevel: new Set(["", "beginner", "intermediate", "advanced", "expert"]),
    reasoningEffort: new Set(["", "low", "medium", "high"])
  };

  const VISION_KEYWORDS = [
    "vision", "llava", "qwen-vl", "qwen2-vl", "qwen3-vl", "pixtral", "devstral", "magistral",
    "gemma-3", "bakllava", "obsidian", "moondream", "minicpm-v", "cogvlm", "glm-4v",
    "internlm-xcomposer", "internvl", "yi-vl", "phi-3-vision", "llama-3-vision", "mllama"
  ];

  const EMBEDDING_KEYWORDS = ["embed", "embedding", "bge", "e5-", "gte-", "jina"];
  const PRESET_NEW_OPTION_VALUE = "__new__";
  const STANDARD_SYSTEM_PROMPT = `あなたは優秀な汎用AIアシスタントです。ユーザーの質問や依頼に対して、正確で分かりやすい回答を日本語で提供してください。
回答は簡潔かつ要点を押さえた内容にし、必要に応じて箇条書きや見出しを使って整理してください。
不明な点がある場合は、推測せずにユーザーに確認してください。`;

  const DEFAULT_SETTINGS = {
    schemaVersion: 2,
    darkMode: false,
    showLogprobs: false,
    hideThinking: false,
    autoUnload: false,
    deepDive: false,
    helpMode: false,
    memoryEnabled: true,
    autoGreetingOnNewTopic: false,
    baseUrl: "http://localhost:1234/v1",
    apiKey: "lmstudio",
    temperature: 0.7,
    maxTokens: 2048,
    sendKey: "shift-enter-send",
    responseStyle: "standard",
    userLevel: "",
    userProfession: "",
    userInterests: "",
    userDisplayName: "",
    visibleModels: null,
    systemPrompt:
      "あなたは放射線画像診断、技術、研究のエキスパートアシスタントです。日本語で簡潔でバランスの取れたアドバイスを提供してください。フォーマルとカジュアルのバランスを保ち、専門用語は英語（日本語）の形式で表記してください。",
    webSearchEnabled: false,
    webSearchUrl: "http://localhost:8888",
    webSearchResults: 5,
    webSearchCategories: "general",
    reasoningEffort: "",
    autoTitleEnabled: true,
    ttsEnabled: false,
    ttsAutoRead: false,
    ttsVoice: "",
    ttsRate: 1.0,
    ttsBackend: "browser",
    qwen3TtsUrl: "http://localhost:8520",
    qwen3TtsSpeaker: "ono_anna",
    ttsSummarize: false,
    model: ""
  };

  const DEFAULT_PRESETS = {
    disease: {
      label: "疾患まとめ",
      prompt: "次の疾患について、定義・病態・画像所見・鑑別・注意点を簡潔に整理してください。"
    },
    ddx: {
      label: "鑑別診断",
      prompt: "次の症例の鑑別診断を、可能性順に5つ挙げ、各候補の支持所見/否定所見を示してください。"
    },
    review: {
      label: "読影レビュー",
      prompt: "以下の所見文をレビューし、曖昧表現・不足情報・誤解リスクを指摘した上で改善案を提示してください。"
    },
    stats: {
      label: "統計相談",
      prompt: "この研究課題に適した統計解析計画を、仮説・主要評価項目・サンプルサイズ・解析手順の順で提案してください。"
    },
    email: {
      label: "メール下書き",
      prompt: "以下の要件で、丁寧かつ簡潔な日本語メール文面を作成してください。件名案を3つ付けてください。"
    },
    pdf: {
      label: "PDF要約",
      prompt: "添付資料を読み取り、背景・方法・結果・限界・臨床的含意を箇条書きで要約してください。"
    }
  };

  const DEFAULT_SYSTEM_PROMPT_PRESETS = {
    radiology_expert: {
      label: "放射線診断エキスパート",
      prompt: DEFAULT_SETTINGS.systemPrompt
    },
    standard_assistant: {
      label: "標準アシスタント",
      prompt: STANDARD_SYSTEM_PROMPT
    },
    concise_teacher: {
      label: "簡潔な教育者",
      prompt:
        "あなたは医療教育を支援するアシスタントです。日本語で簡潔に説明し、必要に応じて短い例を添えてください。"
    }
  };

  const APP_MANUAL_CONTENT =
    asString(window.APP_MANUAL_CONTENT).trim() ||
    "MANUAL未読込。UI表示ラベルを優先し、操作手順を番号付きで案内してください。";

  // ===================================================================
  // Section 2: State and DOM
  // ===================================================================

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    featureFlags: {
      deepDive: false,
      helpMode: false,
      showLogprobs: false,
      webSearch: false,
      ttsAutoRead: false
    },
    sessions: [],
    currentSessionId: "",
    history: [],
    attachments: [],
    presets: {
      custom: {},
      systemPrompts: {}
    },
    compare: {
      enabled: false,
      modelA: "",
      modelB: "",
      streamingA: false,
      streamingB: false,
      resultA: "",
      resultB: ""
    },
    runtime: {
      streaming: false,
      abortController: null,
      compareAbortControllers: [],
      draftTimer: null,
      settingsSaveTimer: null,
      modelLoadStatusTimer: null,
      modelLoadRequestId: 0,
      loadedModelIds: new Set(),
      loadingModelIds: new Set(),
      loadedModelKeys: new Set(),
      loadingModelKeys: new Set(),
      modelLoadTasks: new Map(),
      modelLoadCooldownUntil: new Map(),
      lmStudioStatesCache: new Map(),
      lmStudioStatesFetchedAt: 0,
      lmStudioStatesTask: null,
      lmStudioNativeApiAvailable: null,
      lmStudioNativeApiCheckedAt: 0,
      lmStudioNativeApiTask: null,
      composingText: false,
      memoryExtracting: false,
      lastModelRefreshAt: 0,
      presetPopoverOpen: false,
      editingIndex: null,
      pendingAutoGreetingModelId: "",
      streamMetrics: { startTime: 0, tokenCount: 0, firstTokenTime: 0, lastTokenTime: 0 },
      unreadCount: 0,
      searchQuery: "",
      searchActive: false,
      ttsSpeaking: false,
      ttsCurrentUtterance: null,
      ttsAudioElement: null,
      ttsQwen3Available: null
    },
    modelsById: new Map(),
    availableModels: [],
    memories: []
  };

  const el = {
    modelSelect: document.getElementById("modelSelect"),
    modelLoadStatus: document.getElementById("modelLoadStatus"),
    refreshModelsBtn: document.getElementById("refreshModelsBtn"),
    compareModeBtn: document.getElementById("compareModeBtn"),
    newTopicBtn: document.getElementById("newTopicBtn"),
    newChatBtn: document.getElementById("newChatBtn"),
    sessionLogsBtn: document.getElementById("sessionLogsBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    settingsTabBasic: document.getElementById("settingsTabBasic"),
    settingsTabPresets: document.getElementById("settingsTabPresets"),
    settingsTabData: document.getElementById("settingsTabData"),
    settingsTabWebSearch: document.getElementById("settingsTabWebSearch"),
    settingsTabVoice: document.getElementById("settingsTabVoice"),
    settingsPanelBasic: document.getElementById("settingsPanelBasic"),
    settingsPanelPresets: document.getElementById("settingsPanelPresets"),
    settingsPanelData: document.getElementById("settingsPanelData"),
    settingsPanelWebSearch: document.getElementById("settingsPanelWebSearch"),
    settingsPanelVoice: document.getElementById("settingsPanelVoice"),
    settingsPanel: document.getElementById("settingsPanel"),
    overlay: document.getElementById("overlay"),
    chatMain: document.getElementById("chatMain"),
    compareControls: document.getElementById("compareControls"),
    compareModelASelect: document.getElementById("compareModelASelect"),
    compareModelBSelect: document.getElementById("compareModelBSelect"),
    chatContainer: document.getElementById("chatContainer"),
    messageInput: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    stopBtn: document.getElementById("stopBtn"),
    fileInput: document.getElementById("fileInput"),
    imageInput: document.getElementById("imageInput"),
    attachmentList: document.getElementById("attachmentList"),
    sendKeyHint: document.getElementById("sendKeyHint"),
    presetBtn: document.getElementById("presetBtn"),
    presetPopover: document.getElementById("presetPopover"),
    presetList: document.getElementById("presetList"),
    openPresetManagerBtn: document.getElementById("openPresetManagerBtn"),
    deepDiveBtn: document.getElementById("deepDiveBtn"),
    helpModeBtn: document.getElementById("helpModeBtn"),
    webSearchBtn: document.getElementById("webSearchBtn"),

    baseUrlInput: document.getElementById("baseUrlInput"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    temperatureInput: document.getElementById("temperatureInput"),
    maxTokensInput: document.getElementById("maxTokensInput"),
    reasoningEffortSelect: document.getElementById("reasoningEffortSelect"),
    autoTitleInput: document.getElementById("autoTitleInput"),
    ttsEnabledInput: document.getElementById("ttsEnabledInput"),
    ttsAutoReadInput: document.getElementById("ttsAutoReadInput"),
    ttsVoiceSelect: document.getElementById("ttsVoiceSelect"),
    ttsRateInput: document.getElementById("ttsRateInput"),
    ttsRateValue: document.getElementById("ttsRateValue"),
    ttsAutoBtn: document.getElementById("ttsAutoBtn"),
    ttsBackendSelect: document.getElementById("ttsBackendSelect"),
    qwen3TtsUrlInput: document.getElementById("qwen3TtsUrlInput"),
    qwen3TtsSpeakerSelect: document.getElementById("qwen3TtsSpeakerSelect"),
    qwen3TtsStatus: document.getElementById("qwen3TtsStatus"),
    browserTtsOptions: document.getElementById("browserTtsOptions"),
    qwen3TtsOptions: document.getElementById("qwen3TtsOptions"),
    ttsSummarizeInput: document.getElementById("ttsSummarizeInput"),
    systemPromptInput: document.getElementById("systemPromptInput"),

    sendKeySelect: document.getElementById("sendKeySelect"),
    responseStyleSelect: document.getElementById("responseStyleSelect"),
    userLevelSelect: document.getElementById("userLevelSelect"),
    userProfessionInput: document.getElementById("userProfessionInput"),
    userInterestsInput: document.getElementById("userInterestsInput"),
    userDisplayNameInput: document.getElementById("userDisplayNameInput"),

    autoGreetingOnNewTopicInput: document.getElementById("autoGreetingOnNewTopicInput"),
    memoryEnabledInput: document.getElementById("memoryEnabledInput"),
    darkModeInput: document.getElementById("darkModeInput"),
    autoUnloadInput: document.getElementById("autoUnloadInput"),
    showLogprobsInput: document.getElementById("showLogprobsInput"),
    hideThinkingInput: document.getElementById("hideThinkingInput"),
    deepDiveInput: document.getElementById("deepDiveInput"),
    helpModeInput: document.getElementById("helpModeInput"),
    webSearchEnabledInput: document.getElementById("webSearchEnabledInput"),
    webSearchUrlInput: document.getElementById("webSearchUrlInput"),
    webSearchResultsInput: document.getElementById("webSearchResultsInput"),
    webSearchCategoriesSelect: document.getElementById("webSearchCategoriesSelect"),

    presetManageSelect: document.getElementById("presetManageSelect"),
    presetManageKeyInput: document.getElementById("presetManageKeyInput"),
    presetManageLabelInput: document.getElementById("presetManageLabelInput"),
    presetManageContentInput: document.getElementById("presetManageContentInput"),
    presetManageNewBtn: document.getElementById("presetManageNewBtn"),
    presetManageSaveBtn: document.getElementById("presetManageSaveBtn"),
    presetManageDeleteBtn: document.getElementById("presetManageDeleteBtn"),
    presetManageResetBtn: document.getElementById("presetManageResetBtn"),

    systemPromptPresetSelect: document.getElementById("systemPromptPresetSelect"),
    systemPromptPresetNameInput: document.getElementById("systemPromptPresetNameInput"),
    systemPromptApplyBtn: document.getElementById("systemPromptApplyBtn"),
    systemPromptSaveBtn: document.getElementById("systemPromptSaveBtn"),
    systemPromptDeleteBtn: document.getElementById("systemPromptDeleteBtn"),

    exportHistoryBtn: document.getElementById("exportHistoryBtn"),
    importBtn: document.getElementById("importBtn"),
    importInput: document.getElementById("importInput"),
    resetSettingsBtn: document.getElementById("resetSettingsBtn"),
    clearAllDataBtn: document.getElementById("clearAllDataBtn"),
    tempValue: document.getElementById("tempValue"),
    termCheckModal: document.getElementById("termCheckModal"),
    termCheckContent: document.getElementById("termCheckContent"),
    termCheckCloseBtn: document.getElementById("termCheckCloseBtn"),
    createSessionBtn: document.getElementById("createSessionBtn"),
    sessionCount: document.getElementById("sessionCount"),
    sessionList: document.getElementById("sessionList"),
    memoryCount: document.getElementById("memoryCount"),
    memoryList: document.getElementById("memoryList"),
    clearMemoriesBtn: document.getElementById("clearMemoriesBtn"),
    modelVisibilityList: document.getElementById("modelVisibilityList"),
    modelVisibilityCount: document.getElementById("modelVisibilityCount"),
    modelVisibilitySelectAllBtn: document.getElementById("modelVisibilitySelectAllBtn"),
    modelVisibilityClearBtn: document.getElementById("modelVisibilityClearBtn"),

    searchBtn: document.getElementById("searchBtn"),
    searchBar: document.getElementById("searchBar"),
    searchInput: document.getElementById("searchInput"),
    searchCount: document.getElementById("searchCount"),
    searchCloseBtn: document.getElementById("searchCloseBtn"),
    scrollBottomBtn: document.getElementById("scrollBottomBtn"),
    scrollBottomBadge: document.getElementById("scrollBottomBadge"),
    tokenEstimate: document.getElementById("tokenEstimate"),
    exportMarkdownBtn: document.getElementById("exportMarkdownBtn"),
    shortcutsModal: document.getElementById("shortcutsModal"),
    shortcutsCloseBtn: document.getElementById("shortcutsCloseBtn"),
    bookmarkModal: document.getElementById("bookmarkModal"),
    bookmarkContent: document.getElementById("bookmarkContent"),
    bookmarkCloseBtn: document.getElementById("bookmarkCloseBtn")
  };

  // ===================================================================
  // Section 3: Utility and Storage
  // ===================================================================

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  let _savingStorage = false;

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        console.warn("localStorage quota exceeded for key:", key);
        if (!_savingStorage) {
          _savingStorage = true;
          try {
            appendSystem("⚠ ストレージ容量が不足しています。古い会話ログの削除を検討してください。");
          } finally {
            _savingStorage = false;
          }
        }
      }
    }
  }

  function loadWithLegacyFallback(primaryKey, legacyKeys, fallback) {
    const primary = loadFromStorage(primaryKey, null);
    if (primary !== null) return primary;

    for (const legacyKey of legacyKeys) {
      const legacy = loadFromStorage(legacyKey, null);
      if (legacy !== null) {
        saveToStorage(primaryKey, legacy);
        return legacy;
      }
    }

    return fallback;
  }

  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function toBool(value, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
  }

  function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }

  function toModelId(value) {
    return asString(value).trim();
  }

  function toModelKey(value) {
    return toModelId(value).replace(/:\d+$/, "");
  }

  function isModelLoadedStateValue(stateValue) {
    const normalized = asString(stateValue).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === "loaded" || normalized === "ready" || normalized === "running") return true;
    if (normalized === "not-loaded" || normalized === "unloaded" || normalized === "error" || normalized === "failed") {
      return false;
    }
    return false;
  }

  function isModelLoadingStateValue(stateValue) {
    const normalized = asString(stateValue).trim().toLowerCase();
    if (!normalized) return false;
    return (
      normalized === "loading" ||
      normalized === "queued" ||
      normalized === "initializing" ||
      normalized === "downloading" ||
      normalized === "pulling"
    );
  }

  function isModelLoadedInfo(info) {
    if (!info || typeof info !== "object") return false;
    if (typeof info.loaded === "boolean") return info.loaded;
    return isModelLoadedStateValue(info.state);
  }

  function isModelLoadingInfo(info) {
    if (!info || typeof info !== "object") return false;
    if (typeof info.loading === "boolean") return info.loading;
    return isModelLoadingStateValue(info.state);
  }

  function hasModelWithKeyByPredicate(lmStudioStates, modelId, predicate) {
    const targetModel = toModelId(modelId);
    const targetKey = toModelKey(targetModel);
    const exact = lmStudioStates.get(targetModel);
    if (exact && predicate(exact)) return true;
    for (const [id, info] of lmStudioStates.entries()) {
      if (toModelKey(id) !== targetKey) continue;
      if (predicate(info)) return true;
    }
    return false;
  }

  function normalizeStringArray(input, max = 1000) {
    if (!Array.isArray(input)) return [];
    const out = [];
    const seen = new Set();
    for (const item of input) {
      const val = asString(item).trim();
      if (!val || seen.has(val)) continue;
      seen.add(val);
      out.push(val);
      if (out.length >= max) break;
    }
    return out;
  }

  function normalizeSettings(input) {
    const raw = input && typeof input === "object" ? input : {};
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    const rawSendKey = asString(merged.sendKey, DEFAULT_SETTINGS.sendKey);
    const normalizedSendKey = (() => {
      if (SETTING_OPTIONS.sendKey.has(rawSendKey)) return rawSendKey;
      // Legacy migration:
      // old "enter"=Enter送信, "ctrl-enter"=Ctrl+Enter送信
      // new default is Shift+Enter送信; alternate is Enter送信
      if (rawSendKey === "enter" || rawSendKey === "ctrl-enter") return "enter-send";
      return DEFAULT_SETTINGS.sendKey;
    })();
    const normalizedVisibleModels = merged.visibleModels === null ? null : normalizeStringArray(merged.visibleModels);

    const normalized = {
      schemaVersion: 2,
      darkMode: toBool(merged.darkMode, DEFAULT_SETTINGS.darkMode),
      showLogprobs: toBool(merged.showLogprobs, DEFAULT_SETTINGS.showLogprobs),
      hideThinking: toBool(merged.hideThinking, DEFAULT_SETTINGS.hideThinking),
      autoUnload: toBool(merged.autoUnload, DEFAULT_SETTINGS.autoUnload),
      deepDive: toBool(merged.deepDive, DEFAULT_SETTINGS.deepDive),
      helpMode: toBool(merged.helpMode, DEFAULT_SETTINGS.helpMode),
      memoryEnabled: toBool(merged.memoryEnabled, DEFAULT_SETTINGS.memoryEnabled),
      autoGreetingOnNewTopic: toBool(merged.autoGreetingOnNewTopic, DEFAULT_SETTINGS.autoGreetingOnNewTopic),
      baseUrl: asString(merged.baseUrl, DEFAULT_SETTINGS.baseUrl).trim() || DEFAULT_SETTINGS.baseUrl,
      apiKey: asString(merged.apiKey, DEFAULT_SETTINGS.apiKey).trim() || DEFAULT_SETTINGS.apiKey,
      temperature: clampNumber(merged.temperature, 0, 2, DEFAULT_SETTINGS.temperature),
      maxTokens: Math.floor(clampNumber(merged.maxTokens, 1, 8192, DEFAULT_SETTINGS.maxTokens)),
      sendKey: normalizedSendKey,
      responseStyle: SETTING_OPTIONS.responseStyle.has(merged.responseStyle)
        ? merged.responseStyle
        : DEFAULT_SETTINGS.responseStyle,
      userLevel: SETTING_OPTIONS.userLevel.has(merged.userLevel) ? merged.userLevel : DEFAULT_SETTINGS.userLevel,
      userProfession: asString(merged.userProfession, DEFAULT_SETTINGS.userProfession).trim(),
      userInterests: asString(merged.userInterests, DEFAULT_SETTINGS.userInterests).trim(),
      userDisplayName: asString(merged.userDisplayName, DEFAULT_SETTINGS.userDisplayName).trim().slice(0, 48),
      visibleModels: normalizedVisibleModels,
      systemPrompt: asString(merged.systemPrompt, DEFAULT_SETTINGS.systemPrompt).trim() || DEFAULT_SETTINGS.systemPrompt,
      webSearchEnabled: toBool(merged.webSearchEnabled, DEFAULT_SETTINGS.webSearchEnabled),
      webSearchUrl: asString(merged.webSearchUrl, DEFAULT_SETTINGS.webSearchUrl).trim() || DEFAULT_SETTINGS.webSearchUrl,
      webSearchResults: Math.floor(clampNumber(merged.webSearchResults, 1, 10, DEFAULT_SETTINGS.webSearchResults)),
      webSearchCategories: asString(merged.webSearchCategories, DEFAULT_SETTINGS.webSearchCategories).trim() || DEFAULT_SETTINGS.webSearchCategories,
      reasoningEffort: SETTING_OPTIONS.reasoningEffort.has(merged.reasoningEffort) ? merged.reasoningEffort : DEFAULT_SETTINGS.reasoningEffort,
      autoTitleEnabled: toBool(merged.autoTitleEnabled, DEFAULT_SETTINGS.autoTitleEnabled),
      ttsEnabled: toBool(merged.ttsEnabled, DEFAULT_SETTINGS.ttsEnabled),
      ttsAutoRead: toBool(merged.ttsAutoRead, DEFAULT_SETTINGS.ttsAutoRead),
      ttsVoice: asString(merged.ttsVoice, DEFAULT_SETTINGS.ttsVoice),
      ttsRate: clampNumber(merged.ttsRate, 0.5, 2.0, DEFAULT_SETTINGS.ttsRate),
      ttsBackend: merged.ttsBackend === "qwen3" ? "qwen3" : "browser",
      qwen3TtsUrl: asString(merged.qwen3TtsUrl, DEFAULT_SETTINGS.qwen3TtsUrl) || DEFAULT_SETTINGS.qwen3TtsUrl,
      qwen3TtsSpeaker: asString(merged.qwen3TtsSpeaker, DEFAULT_SETTINGS.qwen3TtsSpeaker) || DEFAULT_SETTINGS.qwen3TtsSpeaker,
      ttsSummarize: toBool(merged.ttsSummarize, DEFAULT_SETTINGS.ttsSummarize),
      model: asString(merged.model, DEFAULT_SETTINGS.model)
    };

    return normalized;
  }

  function normalizeHistory(input) {
    if (!Array.isArray(input)) return [];

    const validRoles = new Set(["user", "assistant", "system", "compare"]);
    const transientLoadErrorPattern = /^モデル読み込みに失敗しました\s*\([^)]+\)$/;
    return input
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const role = validRoles.has(item.role) ? item.role : "system";
        if (role === "compare") {
          return {
            role: "compare",
            modelA: asString(item.modelA, "Model A"),
            modelB: asString(item.modelB, "Model B"),
            contentA: asString(item.contentA, ""),
            contentB: asString(item.contentB, ""),
            timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined
          };
        }

        const msg = {
          role,
          content: asString(item.content, ""),
          imageData: typeof item.imageData === "string" ? item.imageData : undefined,
          logprobs: Array.isArray(item.logprobs) ? item.logprobs.slice(0, 200) : undefined,
          termCheck: typeof item.termCheck === "string" ? item.termCheck : undefined,
          interrupted: toBool(item.interrupted, false),
          resumeModel: asString(item.resumeModel, ""),
          timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined,
          bookmarked: toBool(item.bookmarked, false)
        };
        if (item.metrics && typeof item.metrics === "object") {
          msg.metrics = {
            totalTokens: typeof item.metrics.totalTokens === "number" ? item.metrics.totalTokens : 0,
            elapsedMs: typeof item.metrics.elapsedMs === "number" ? item.metrics.elapsedMs : 0,
            tokensPerSecond: typeof item.metrics.tokensPerSecond === "number" ? item.metrics.tokensPerSecond : 0,
            timeToFirstTokenMs: typeof item.metrics.timeToFirstTokenMs === "number" ? item.metrics.timeToFirstTokenMs : 0
          };
        }
        return msg;
      })
      .filter((item) => {
        if (item.role === "system" && transientLoadErrorPattern.test(asString(item.content).trim())) {
          return false;
        }
        return item.role === "compare" || item.content || item.imageData;
      });
  }

  function cloneHistory(history) {
    return normalizeHistory(history).map((item) => {
      if (item.role === "compare") {
        return {
          role: "compare",
          modelA: item.modelA,
          modelB: item.modelB,
          contentA: item.contentA,
          contentB: item.contentB,
          timestamp: item.timestamp
        };
      }
      const cloned = {
        role: item.role,
        content: item.content,
        logprobs: Array.isArray(item.logprobs) ? item.logprobs.map((entry) => ({ ...entry })) : undefined,
        termCheck: item.termCheck,
        interrupted: toBool(item.interrupted, false),
        resumeModel: asString(item.resumeModel, ""),
        timestamp: item.timestamp,
        bookmarked: toBool(item.bookmarked, false)
      };
      if (item.metrics) {
        cloned.metrics = { ...item.metrics };
      }
      return cloned;
    });
  }

  function normalizeIsoDate(value, fallback = null) {
    const raw = asString(value);
    const parsed = raw ? new Date(raw) : null;
    if (parsed && Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
    if (fallback) return fallback;
    return new Date().toISOString();
  }

  function formatSessionDate(isoDate) {
    const d = new Date(normalizeIsoDate(isoDate));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  function pickSessionSummary(history) {
    const cleaned = (text) =>
      asString(text)
        .replace(/\s+/g, " ")
        .replace(/^[-\s]*新しい話題[-\s]*$/g, "")
        .trim();

    for (const item of history) {
      if (item.role !== "user") continue;
      const value = cleaned(item.content);
      if (!value || value === "(添付のみ)") continue;
      return value.slice(0, 36);
    }

    for (const item of history) {
      if (item.role !== "assistant") continue;
      const value = cleaned(item.content);
      if (!value) continue;
      return value.slice(0, 36);
    }

    for (const item of history) {
      if (item.role !== "compare") continue;
      const a = cleaned(item.contentA);
      const b = cleaned(item.contentB);
      if (a || b) return `比較: ${item.modelA} / ${item.modelB}`.slice(0, 36);
    }

    return "新規会話";
  }

  function buildSessionTitle(createdAt, history) {
    return `${formatSessionDate(createdAt)} ${pickSessionSummary(history)}`;
  }

  function generateSessionId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeSessions(input) {
    if (!Array.isArray(input)) return [];

    const out = [];
    const seen = new Set();

    for (const raw of input) {
      if (!raw || typeof raw !== "object") continue;
      const id = asString(raw.id).trim() || generateSessionId();
      if (seen.has(id)) continue;
      seen.add(id);

      const createdAt = normalizeIsoDate(raw.createdAt);
      const updatedAt = normalizeIsoDate(raw.updatedAt, createdAt);
      const history = normalizeHistory(raw.history);
      const fallbackTitle = buildSessionTitle(createdAt, history);
      const title = asString(raw.title).trim().slice(0, 120) || fallbackTitle;

      const autoTitled = raw.autoTitled === true ? true : raw.autoTitled === false ? false : undefined;
      out.push({ id, title, createdAt, updatedAt, history, autoTitled });
      if (out.length >= 200) break;
    }

    out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return out;
  }

  function normalizeMemories(input) {
    if (!Array.isArray(input)) return [];

    const validCategories = new Set(["profile", "preference", "goal", "context", "other"]);
    const out = [];
    const seen = new Set();

    for (const item of input) {
      if (!item || typeof item !== "object") continue;
      const fact = asString(item.fact).trim().replace(/\s+/g, " ");
      if (!fact || fact.length < 4 || fact.length > 220) continue;

      const dedupeKey = fact.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const category = validCategories.has(item.category) ? item.category : "other";
      const priority = Math.min(5, Math.max(1, Number(item.priority) || 3));
      const createdAt = asString(item.createdAt) || new Date().toISOString();
      const updatedAt = asString(item.updatedAt) || createdAt;

      out.push({
        id: asString(item.id) || `${Date.now()}-${out.length}`,
        fact,
        category,
        priority,
        createdAt,
        updatedAt
      });
    }

    out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return out.slice(0, 120);
  }

  function sanitizePresetKey(value) {
    return asString(value).trim().toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, "_").replace(/_{2,}/g, "_").replace(/^_|_$/g, "").slice(0, 48);
  }

  function normalizePresetMap(input) {
    if (!input || typeof input !== "object") return {};

    const out = {};
    for (const [rawKey, rawValue] of Object.entries(input)) {
      const key = sanitizePresetKey(rawKey);
      if (!key) continue;
      if (!rawValue || typeof rawValue !== "object") continue;

      const label = asString(rawValue.label).trim();
      const prompt = asString(rawValue.prompt).trim();
      if (!label || !prompt) continue;

      out[key] = { label, prompt };
    }

    return out;
  }

  // ===================================================================
  // Section 3b: v2.0 Utilities (Token Estimation, Timestamps, Syntax Highlighting)
  // ===================================================================

  function estimateTokens(text) {
    if (!text) return 0;
    let tokens = 0;
    for (let i = 0; i < text.length; i += 1) {
      tokens += text.charCodeAt(i) > 0x2fff ? 0.5 : 0.25;
    }
    return Math.max(1, Math.round(tokens));
  }

  function updateTokenEstimate() {
    if (!el.tokenEstimate) return;
    const text = el.messageInput.value;
    if (!text.trim()) {
      el.tokenEstimate.textContent = "";
      return;
    }
    el.tokenEstimate.textContent = `~${estimateTokens(text)} tokens`;
  }

  function formatMessageTimestamp(isoDate) {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (!Number.isFinite(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHours = Math.floor(diffMin / 60);
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (sameDay) return `${hh}:${mm}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨日 ${hh}:${mm}`;
    const mon = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${mon}/${day} ${hh}:${mm}`;
  }

  function formatNumber(n) {
    return n.toLocaleString("ja-JP");
  }

  // --- Lightweight Syntax Highlighter ---

  function buildHighlightRules() {
    const CMT_LINE = /(?:\/\/[^\n]*|#[^\n]*)/;
    const CMT_BLOCK = /\/\*[\s\S]*?\*\//;
    const STR_DQ = /"(?:[^"\\]|\\.)*"/;
    const STR_SQ = /'(?:[^'\\]|\\.)*'/;
    const STR_BT = /`(?:[^`\\]|\\.)*`/;
    const STR_TDQ = /"""[\s\S]*?"""/;
    const STR_TSQ = /'''[\s\S]*?'''/;
    const NUM = /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/;

    function kw(words) {
      return new RegExp("\\b(?:" + words + ")\\b");
    }

    function combine() {
      return new RegExp(Array.from(arguments).map(r => r.source).join("|"), "g");
    }

    const JS_KW = "abstract|arguments|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield";
    const JS_TYPE = "Array|Boolean|Date|Error|Function|Map|Math|Number|Object|Promise|Proxy|RegExp|Set|String|Symbol|WeakMap|WeakSet|BigInt|undefined|null|NaN|Infinity|true|false|globalThis|console|window|document|JSON|parseInt|parseFloat|isNaN|isFinite";

    const PY_KW = "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None";
    const PY_TYPE = "int|float|str|list|dict|tuple|set|bool|bytes|type|object|Exception|range|len|print|super|property|classmethod|staticmethod|enumerate|zip|map|filter|sorted|reversed|any|all|isinstance|issubclass|getattr|setattr|hasattr|open|input";

    const C_KW = "auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|bool|true|false|NULL|nullptr|class|namespace|template|typename|virtual|override|final|public|private|protected|new|delete|throw|try|catch|using|operator|explicit|friend|mutable|constexpr|static_cast|dynamic_cast|reinterpret_cast|const_cast|noexcept|decltype|static_assert|thread_local|alignas|alignof|concept|requires|co_await|co_yield|co_return|import|module|export";
    const C_TYPE = "int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|size_t|ptrdiff_t|intptr_t|uintptr_t|string|vector|map|set|array|unique_ptr|shared_ptr|weak_ptr|optional|variant|any|tuple|pair|deque|list|queue|stack|priority_queue|unordered_map|unordered_set|FILE|stdin|stdout|stderr";

    const GO_KW = "break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var";
    const GO_TYPE = "bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|nil|true|false|iota|append|cap|close|copy|delete|len|make|new|panic|print|println|recover";

    const RUST_KW = "as|async|await|break|const|continue|crate|dyn|else|enum|extern|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|type|union|unsafe|use|where|while|yield|true|false";
    const RUST_TYPE = "i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|Box|Rc|Arc|Cell|RefCell|Option|Result|Some|None|Ok|Err|HashMap|HashSet|BTreeMap|BTreeSet|Cow|Pin|Future";

    const JAVA_KW = "abstract|assert|break|case|catch|class|const|continue|default|do|else|enum|extends|final|finally|for|goto|if|implements|import|instanceof|interface|native|new|package|private|protected|public|return|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null";
    const JAVA_TYPE = "boolean|byte|char|double|float|int|long|short|String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Class|System|Thread|Runnable|Exception|RuntimeException|ArrayList|HashMap|HashSet|LinkedList|TreeMap|TreeSet|List|Map|Set|Collection|Iterator|Stream|Optional|CompletableFuture|var";

    const SQL_KW = "SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|GROUP|BY|ORDER|ASC|DESC|HAVING|LIMIT|OFFSET|UNION|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|VIEW|TRIGGER|FUNCTION|PROCEDURE|IF|ELSE|THEN|END|BEGIN|COMMIT|ROLLBACK|TRANSACTION|EXISTS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|COALESCE|CAST|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|CONSTRAINT|CASCADE|TRUNCATE|GRANT|REVOKE|WITH|RECURSIVE|EXPLAIN|ANALYZE|FETCH|CURSOR|DECLARE|OPEN|CLOSE|TRUE|FALSE";
    const SQL_TYPE = "INT|INTEGER|BIGINT|SMALLINT|TINYINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|CHAR|VARCHAR|TEXT|BLOB|DATE|TIME|DATETIME|TIMESTAMP|BOOLEAN|SERIAL|UUID|JSONB|ARRAY|BYTEA|REAL|MONEY|INTERVAL|POINT|LINE|POLYGON|CIDR|INET|MACADDR|BIT|XML|ENUM|BINARY|VARBINARY|NCHAR|NVARCHAR|NTEXT|IMAGE|CLOB";

    const BASH_KW = "if|then|else|elif|fi|for|while|do|done|in|case|esac|function|return|local|declare|export|readonly|unset|shift|break|continue|exit|trap|source|alias|eval|exec|set|true|false";
    const BASH_TYPE = "echo|printf|read|cd|ls|pwd|mkdir|rmdir|rm|cp|mv|cat|grep|sed|awk|find|sort|uniq|wc|head|tail|cut|tr|tee|xargs|chmod|chown|chgrp|kill|ps|bg|fg|jobs|nohup|sudo|su|ssh|scp|rsync|curl|wget|tar|gzip|gunzip|zip|unzip|git|docker|npm|yarn|pip|python|node|make|cmake|go|cargo|apt|brew|dnf|yum|pacman|systemctl|journalctl|crontab|df|du|free|top|htop|mount|umount|ln|touch|diff|patch|which|whereis|type|file|stat|date|cal|uptime|whoami|hostname|uname|env|printenv";

    const rules = {};

    // JavaScript / TypeScript
    const jsRe = combine(CMT_BLOCK, CMT_LINE, STR_BT, STR_DQ, STR_SQ, kw(JS_KW), kw(JS_TYPE), /\b[a-zA-Z_$]\w*(?=\s*\()/, /\/(?:[^\/\\]|\\.)+\/[gimsuy]*/, NUM);
    rules.javascript = rules.js = rules.typescript = rules.ts = rules.jsx = rules.tsx = function(code) {
      return code.replace(jsRe, function(m) {
        if (m.startsWith("/*") || m.startsWith("//")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'") || m.startsWith("`")) return '<span class="sh-str">' + m + "</span>";
        if (m.startsWith("/") && m.length > 1 && !m.startsWith("//") && !m.startsWith("/*")) return '<span class="sh-re">' + m + "</span>";
        if (new RegExp("^(?:" + JS_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + JS_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_$]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // Python
    const pyRe = combine(STR_TDQ, STR_TSQ, /(?:#[^\n]*)/, STR_DQ, STR_SQ, kw(PY_KW), kw(PY_TYPE), /\b[a-zA-Z_]\w*(?=\s*\()/, /@\w+/, NUM);
    rules.python = rules.py = function(code) {
      return code.replace(pyRe, function(m) {
        if (m.startsWith("#")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'")) return '<span class="sh-str">' + m + "</span>";
        if (m.startsWith("@")) return '<span class="sh-attr">' + m + "</span>";
        if (new RegExp("^(?:" + PY_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + PY_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // JSON
    rules.json = function(code) {
      return code.replace(/(")([^"\\]*(?:\\.[^"\\]*)*)(")(?=\s*:)|(")((?:[^"\\]|\\.)*)(")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/g, function(_m, pq1, pk, pq2, sq1, sv, sq2, boolNull, num) {
        if (pq1) return '<span class="sh-prop">' + pq1 + pk + pq2 + "</span>";
        if (sq1) return '<span class="sh-str">' + sq1 + sv + sq2 + "</span>";
        if (boolNull) return '<span class="sh-kw">' + boolNull + "</span>";
        if (num) return '<span class="sh-num">' + num + "</span>";
        return _m;
      });
    };

    // HTML / XML
    rules.html = rules.xml = rules.svg = function(code) {
      return code.replace(/(&lt;\/?)([\w-]+)|(\s)([\w-]+)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(&lt;!--[\s\S]*?--&gt;)/g, function(_m, tagOpen, tagName, sp, attrName, eq, attrVal, comment) {
        if (comment) return '<span class="sh-cm">' + comment + "</span>";
        if (tagOpen) return '<span class="sh-op">' + tagOpen + '</span><span class="sh-tag">' + tagName + "</span>";
        if (sp && attrName) return sp + '<span class="sh-attr">' + attrName + '</span><span class="sh-op">' + eq + '</span><span class="sh-str">' + attrVal + "</span>";
        return _m;
      });
    };

    // CSS
    const cssRe = /(\/\*[\s\S]*?\*\/)|(@[\w-]+)|([.#][\w-]+(?:\s*[\w-]*)*(?=\s*\{))|([\w-]+)(?=\s*:(?!:))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|deg|s|ms|fr|ch)?\b)|(\b(?:inherit|initial|unset|none|auto|transparent|currentColor|!important)\b)/g;
    rules.css = rules.scss = rules.less = function(code) {
      return code.replace(cssRe, function(m, comment, atRule, selector, prop, str, hex, num, kwVal) {
        if (comment) return '<span class="sh-cm">' + m + "</span>";
        if (atRule) return '<span class="sh-attr">' + m + "</span>";
        if (selector) return '<span class="sh-tag">' + m + "</span>";
        if (prop) return '<span class="sh-prop">' + m + "</span>";
        if (str) return '<span class="sh-str">' + m + "</span>";
        if (hex) return '<span class="sh-num">' + m + "</span>";
        if (num) return '<span class="sh-num">' + m + "</span>";
        if (kwVal) return '<span class="sh-kw">' + m + "</span>";
        return m;
      });
    };

    // SQL
    const sqlRe = combine(/--[^\n]*/, CMT_BLOCK, STR_SQ, STR_DQ, new RegExp("\\b(?:" + SQL_KW + ")\\b", "i"), new RegExp("\\b(?:" + SQL_TYPE + ")\\b", "i"), NUM);
    rules.sql = function(code) {
      return code.replace(sqlRe, function(m) {
        if (m.startsWith("--") || m.startsWith("/*")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith("'") || m.startsWith('"')) return '<span class="sh-str">' + m + "</span>";
        if (new RegExp("^(?:" + SQL_KW + ")$", "i").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + SQL_TYPE + ")$", "i").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        return m;
      });
    };

    // Bash / Shell
    const bashRe = combine(/(?:#[^\n]*)/, STR_DQ, STR_SQ, /\$\{[^}]*\}|\$\w+/, kw(BASH_KW), kw(BASH_TYPE), NUM);
    rules.bash = rules.sh = rules.shell = rules.zsh = function(code) {
      return code.replace(bashRe, function(m) {
        if (m.startsWith("#")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'")) return '<span class="sh-str">' + m + "</span>";
        if (m.startsWith("$")) return '<span class="sh-attr">' + m + "</span>";
        if (new RegExp("^(?:" + BASH_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + BASH_TYPE + ")$").test(m)) return '<span class="sh-fn">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        return m;
      });
    };

    // C / C++
    const cRe = combine(CMT_BLOCK, CMT_LINE, /#\w+[^\n]*/, STR_DQ, STR_SQ, kw(C_KW), kw(C_TYPE), /\b[a-zA-Z_]\w*(?=\s*\()/, NUM);
    rules.c = rules.cpp = rules["c++"] = rules.h = rules.hpp = rules.cc = rules.cxx = function(code) {
      return code.replace(cRe, function(m) {
        if (m.startsWith("/*") || m.startsWith("//")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith("#")) return '<span class="sh-attr">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'")) return '<span class="sh-str">' + m + "</span>";
        if (new RegExp("^(?:" + C_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + C_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // Go
    const goRe = combine(CMT_BLOCK, CMT_LINE, STR_DQ, STR_SQ, STR_BT, kw(GO_KW), kw(GO_TYPE), /\b[a-zA-Z_]\w*(?=\s*\()/, NUM);
    rules.go = function(code) {
      return code.replace(goRe, function(m) {
        if (m.startsWith("/*") || m.startsWith("//")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'") || m.startsWith("`")) return '<span class="sh-str">' + m + "</span>";
        if (new RegExp("^(?:" + GO_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + GO_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // Rust
    const rustRe = combine(CMT_BLOCK, CMT_LINE, STR_DQ, STR_SQ, kw(RUST_KW), kw(RUST_TYPE), /\b[a-zA-Z_]\w*(?=\s*[!(]?)/, /#\[[\w:]+\]/, NUM);
    rules.rust = rules.rs = function(code) {
      return code.replace(rustRe, function(m) {
        if (m.startsWith("/*") || m.startsWith("//")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'")) return '<span class="sh-str">' + m + "</span>";
        if (m.startsWith("#[")) return '<span class="sh-attr">' + m + "</span>";
        if (new RegExp("^(?:" + RUST_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + RUST_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // Java
    const javaRe = combine(CMT_BLOCK, CMT_LINE, STR_DQ, STR_SQ, kw(JAVA_KW), kw(JAVA_TYPE), /\b[a-zA-Z_]\w*(?=\s*\()/, /@\w+/, NUM);
    rules.java = rules.kotlin = function(code) {
      return code.replace(javaRe, function(m) {
        if (m.startsWith("/*") || m.startsWith("//")) return '<span class="sh-cm">' + m + "</span>";
        if (m.startsWith('"') || m.startsWith("'")) return '<span class="sh-str">' + m + "</span>";
        if (m.startsWith("@")) return '<span class="sh-attr">' + m + "</span>";
        if (new RegExp("^(?:" + JAVA_KW + ")$").test(m)) return '<span class="sh-kw">' + m + "</span>";
        if (new RegExp("^(?:" + JAVA_TYPE + ")$").test(m)) return '<span class="sh-type">' + m + "</span>";
        if (/^\d/.test(m)) return '<span class="sh-num">' + m + "</span>";
        if (/^[a-zA-Z_]/.test(m)) return '<span class="sh-fn">' + m + "</span>";
        return m;
      });
    };

    // YAML
    rules.yaml = rules.yml = function(code) {
      return code.replace(/(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([\w][\w.-]*\s*)(?=:(?:\s|$))|(\b(?:true|false|null|yes|no|on|off)\b)|(\b\d+(?:\.\d+)?\b)/g, function(m, cm, str, key, kw, num) {
        if (cm) return '<span class="sh-cm">' + m + "</span>";
        if (str) return '<span class="sh-str">' + m + "</span>";
        if (key) return '<span class="sh-prop">' + m + "</span>";
        if (kw) return '<span class="sh-kw">' + m + "</span>";
        if (num) return '<span class="sh-num">' + m + "</span>";
        return m;
      });
    };

    // Markdown
    rules.markdown = rules.md = function(code) {
      return code.replace(/(#{1,6}\s+[^\n]+)|(`[^`\n]+`)|(\*\*[^*]+\*\*|\*[^*\n]+\*)|(\[[^\]]+\]\([^)]+\))|(^\s*[-*+]\s+)/gm, function(m, heading, inlineCode, bold, link, bullet) {
        if (heading) return '<span class="sh-kw">' + m + "</span>";
        if (inlineCode) return '<span class="sh-str">' + m + "</span>";
        if (bold) return '<span class="sh-attr">' + m + "</span>";
        if (link) return '<span class="sh-fn">' + m + "</span>";
        if (bullet) return '<span class="sh-op">' + m + "</span>";
        return m;
      });
    };

    return rules;
  }

  const SYNTAX_HIGHLIGHT_RULES = buildHighlightRules();

  function highlightCode(escapedCode, lang) {
    if (!lang) return escapedCode;
    const normalizedLang = lang.toLowerCase().replace(/[^a-z0-9+#-]/g, "");
    const highlighter = SYNTAX_HIGHLIGHT_RULES[normalizedLang];
    if (!highlighter) return escapedCode;
    try {
      return highlighter(escapedCode);
    } catch {
      return escapedCode;
    }
  }

  function loadPresetMaps() {
    state.presets.custom = normalizePresetMap(loadFromStorage(STORAGE_KEYS.PRESETS, {}));
    state.presets.systemPrompts = normalizePresetMap(loadFromStorage(STORAGE_KEYS.SYSTEM_PROMPT_PRESETS, {}));

    saveToStorage(STORAGE_KEYS.PRESETS, state.presets.custom);
    saveToStorage(STORAGE_KEYS.SYSTEM_PROMPT_PRESETS, state.presets.systemPrompts);
  }

  function loadMemories() {
    state.memories = normalizeMemories(loadFromStorage(STORAGE_KEYS.MEMORIES, []));
    saveToStorage(STORAGE_KEYS.MEMORIES, state.memories);
  }

  function persistMemories() {
    state.memories = normalizeMemories(state.memories);
    saveToStorage(STORAGE_KEYS.MEMORIES, state.memories);
  }

  function persistSessionStore() {
    state.sessions = normalizeSessions(state.sessions);
    saveToStorage(STORAGE_KEYS.SESSIONS, state.sessions);
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION_ID, state.currentSessionId || "");
  }

  function ensureCurrentSession() {
    if (state.currentSessionId && state.sessions.some((session) => session.id === state.currentSessionId)) {
      return;
    }

    if (state.sessions.length > 0) {
      state.currentSessionId = state.sessions[0].id;
      return;
    }

    const now = new Date().toISOString();
    const history = [];
    const session = {
      id: generateSessionId(),
      createdAt: now,
      updatedAt: now,
      title: buildSessionTitle(now, history),
      history
    };
    state.sessions = [session];
    state.currentSessionId = session.id;
  }

  function upsertCurrentSessionFromHistory() {
    ensureCurrentSession();
    const history = cloneHistory(state.history);
    const now = new Date().toISOString();
    const index = state.sessions.findIndex((session) => session.id === state.currentSessionId);
    const existing = index >= 0 ? state.sessions[index] : null;

    const createdAt = existing?.createdAt || now;
    const updatedAt = now;
    const title = (existing?.autoTitled === true || existing?.autoTitled === false)
      ? existing.title
      : buildSessionTitle(createdAt, history);
    const nextSession = {
      id: state.currentSessionId,
      createdAt,
      updatedAt,
      title,
      history,
      autoTitled: existing?.autoTitled
    };

    if (index >= 0) {
      state.sessions[index] = nextSession;
    } else {
      state.sessions.push(nextSession);
    }

    persistSessionStore();
    renderSessionList();
  }

  function loadConversationSessions() {
    const rawSessions = loadFromStorage(STORAGE_KEYS.SESSIONS, null);
    const sessions = normalizeSessions(rawSessions);
    const savedCurrentId = asString(loadFromStorage(STORAGE_KEYS.CURRENT_SESSION_ID, ""));

    if (sessions.length > 0) {
      state.sessions = sessions;
      state.currentSessionId = sessions.some((session) => session.id === savedCurrentId) ? savedCurrentId : sessions[0].id;
      const current = state.sessions.find((session) => session.id === state.currentSessionId) || state.sessions[0];
      state.history = cloneHistory(current?.history || []);
      persistSessionStore();
      saveToStorage(STORAGE_KEYS.HISTORY, state.history);
      return;
    }

    const legacyHistory = normalizeHistory(loadWithLegacyFallback(STORAGE_KEYS.HISTORY, LEGACY_STORAGE_KEYS.HISTORY, []));
    const now = new Date().toISOString();
    const session = {
      id: generateSessionId(),
      createdAt: now,
      updatedAt: now,
      title: buildSessionTitle(now, legacyHistory),
      history: cloneHistory(legacyHistory)
    };

    state.sessions = [session];
    state.currentSessionId = session.id;
    state.history = cloneHistory(session.history);
    persistSessionStore();
    saveToStorage(STORAGE_KEYS.HISTORY, state.history);
  }

  function createNewConversationSession(options = { activate: true }) {
    if (state.runtime.streaming) return null;

    const now = new Date().toISOString();
    const session = {
      id: generateSessionId(),
      createdAt: now,
      updatedAt: now,
      title: buildSessionTitle(now, []),
      history: []
    };

    state.sessions.unshift(session);
    if (options.activate) {
      state.currentSessionId = session.id;
      state.history = [];
      state.attachments = [];
      state.runtime.editingIndex = null;
      el.messageInput.value = "";
      renderAttachments();
      renderHistory();
      resizeInput();
      updateSendKeyHint();
    }

    persistSessionStore();
    saveToStorage(STORAGE_KEYS.HISTORY, state.history);
    return session.id;
  }

  function switchConversationSession(sessionId) {
    if (state.runtime.streaming) {
      alert("応答中は会話を切り替えできません。");
      return;
    }

    const target = state.sessions.find((session) => session.id === sessionId);
    if (!target) return;

    state.currentSessionId = target.id;
    state.history = cloneHistory(target.history);
    state.attachments = [];
    state.runtime.editingIndex = null;
    el.messageInput.value = "";
    renderAttachments();
    renderHistory();
    resizeInput();
    updateSendKeyHint();
    persistSessionStore();
    saveToStorage(STORAGE_KEYS.HISTORY, state.history);

    if (state.history.length === 0) {
      appendSystem("ローカルLLMチャットへようこそ。モデルを選択して開始してください。");
    } else {
      renderSessionList();
    }
  }

  function deleteConversationSession(sessionId) {
    const target = state.sessions.find((session) => session.id === sessionId);
    if (!target) return;
    if (!confirm(`この会話ログを削除しますか？\n${target.title}`)) return;

    state.sessions = state.sessions.filter((session) => session.id !== sessionId);
    if (state.sessions.length === 0) {
      createNewConversationSession({ activate: true });
      appendSystem("ローカルLLMチャットへようこそ。モデルを選択して開始してください。");
      return;
    }

    if (state.currentSessionId === sessionId) {
      switchConversationSession(state.sessions[0].id);
      return;
    }

    persistSessionStore();
    renderSessionList();
  }

  function persistCustomPresets() {
    state.presets.custom = normalizePresetMap(state.presets.custom);
    saveToStorage(STORAGE_KEYS.PRESETS, state.presets.custom);
  }

  function persistSystemPromptPresets() {
    state.presets.systemPrompts = normalizePresetMap(state.presets.systemPrompts);
    saveToStorage(STORAGE_KEYS.SYSTEM_PROMPT_PRESETS, state.presets.systemPrompts);
  }

  function getMergedTextPresets() {
    return { ...DEFAULT_PRESETS, ...state.presets.custom };
  }

  function getMergedSystemPromptPresets() {
    return { ...DEFAULT_SYSTEM_PROMPT_PRESETS, ...state.presets.systemPrompts };
  }

  function getApiBaseUrl() {
    return asString(state.settings.baseUrl, DEFAULT_SETTINGS.baseUrl).replace(/\/$/, "");
  }

  function getLmStudioRoot() {
    try {
      const parsed = new URL(getApiBaseUrl());
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return "";
    }
  }

  function getReadHeaders() {
    if (!state.settings.apiKey) return {};
    return { Authorization: `Bearer ${state.settings.apiKey}` };
  }

  function getJsonHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (state.settings.apiKey) headers.Authorization = `Bearer ${state.settings.apiKey}`;
    return headers;
  }

  async function isLmStudioNativeModelApiAvailable(options = {}) {
    const { force = false, ttlMs = 10000 } = options;
    const lmRoot = getLmStudioRoot();
    if (!lmRoot) return false;

    const now = Date.now();
    const cached = state.runtime.lmStudioNativeApiAvailable;
    if (!force && cached !== null && now - state.runtime.lmStudioNativeApiCheckedAt < ttlMs) {
      return cached;
    }
    if (state.runtime.lmStudioNativeApiTask) {
      return state.runtime.lmStudioNativeApiTask;
    }

    const task = (async () => {
      try {
        const res = await fetch(`${lmRoot}/api/v1/models`, { headers: getReadHeaders() });
        if (res.status === 404) {
          state.runtime.lmStudioNativeApiAvailable = false;
          state.runtime.lmStudioNativeApiCheckedAt = Date.now();
          return false;
        }
        // Verify that the response contains native API fields (state/loaded),
        // not just the OpenAI-compatible format without model state info
        try {
          const data = await res.json();
          const models = Array.isArray(data?.data) ? data.data : [];
          const hasNativeFields =
            models.length > 0 &&
            models.some(
              (m) => m && (typeof m.state === "string" || typeof m.loaded === "boolean")
            );
          state.runtime.lmStudioNativeApiAvailable = hasNativeFields;
          state.runtime.lmStudioNativeApiCheckedAt = Date.now();
          return hasNativeFields;
        } catch {
          state.runtime.lmStudioNativeApiAvailable = false;
          state.runtime.lmStudioNativeApiCheckedAt = Date.now();
          return false;
        }
      } catch {
        state.runtime.lmStudioNativeApiAvailable = false;
        state.runtime.lmStudioNativeApiCheckedAt = Date.now();
        return false;
      }
    })();

    state.runtime.lmStudioNativeApiTask = task;
    try {
      return await task;
    } finally {
      if (state.runtime.lmStudioNativeApiTask === task) {
        state.runtime.lmStudioNativeApiTask = null;
      }
    }
  }

  async function syncLoadedModelStateFromLmStudio(options = {}) {
    const { force = false, minIntervalMs = 1800 } = options;
    const lmRoot = getLmStudioRoot();
    if (!lmRoot) return state.runtime.lmStudioStatesCache;

    const now = Date.now();
    if (!force && now - state.runtime.lmStudioStatesFetchedAt < minIntervalMs) {
      return state.runtime.lmStudioStatesCache;
    }
    if (state.runtime.lmStudioStatesTask) {
      return state.runtime.lmStudioStatesTask;
    }

    const task = (async () => {
      const lmStudioStates = new Map();
      const lmRes = await fetch(`${lmRoot}/api/v1/models`, { headers: getReadHeaders() });
      if (!lmRes.ok) {
        if (lmRes.status === 404) {
          state.runtime.lmStudioNativeApiAvailable = false;
          state.runtime.lmStudioNativeApiCheckedAt = Date.now();
        }
        return state.runtime.lmStudioStatesCache;
      }
      const lmData = await lmRes.json();
      const modelsArray = lmData.data || [];

      // Detect if response is OpenAI-compatible format (no state/loaded fields)
      // vs true LM Studio native API format
      const hasNativeFields =
        modelsArray.length > 0 &&
        modelsArray.some(
          (m) => m && (typeof m.state === "string" || typeof m.loaded === "boolean")
        );

      if (!hasNativeFields) {
        state.runtime.lmStudioNativeApiAvailable = false;
        state.runtime.lmStudioNativeApiCheckedAt = Date.now();
        return state.runtime.lmStudioStatesCache;
      }

      const loadedModelIds = new Set();
      const loadedModelKeys = new Set();
      for (const model of modelsArray) {
        const id = toModelId(model?.id);
        if (!id) continue;
        lmStudioStates.set(id, model);
        if (isModelLoadedInfo(model)) {
          loadedModelIds.add(id);
          loadedModelKeys.add(toModelKey(id));
        }
      }
      state.runtime.loadedModelIds = loadedModelIds;
      state.runtime.loadedModelKeys = loadedModelKeys;
      state.runtime.lmStudioStatesCache = lmStudioStates;
      state.runtime.lmStudioStatesFetchedAt = Date.now();
      state.runtime.lmStudioNativeApiAvailable = true;
      state.runtime.lmStudioNativeApiCheckedAt = Date.now();
      return lmStudioStates;
    })().catch(() => {
      // keep last known loaded cache on transient failure
      return state.runtime.lmStudioStatesCache;
    });

    state.runtime.lmStudioStatesTask = task;
    try {
      return await task;
    } finally {
      if (state.runtime.lmStudioStatesTask === task) {
        state.runtime.lmStudioStatesTask = null;
      }
    }
  }

  async function isModelLoadedOnLmStudio(modelId, options = {}) {
    const model = toModelId(modelId);
    const modelKey = toModelKey(model);
    if (!model) return false;
    if (state.runtime.lmStudioNativeApiAvailable === false) return true;
    const lmStudioStates = await syncLoadedModelStateFromLmStudio(options);
    if (state.runtime.lmStudioNativeApiAvailable === false) return true;
    const exactInfo = lmStudioStates.get(model);
    if (exactInfo) return isModelLoadedInfo(exactInfo);
    for (const [id, info] of lmStudioStates.entries()) {
      if (toModelKey(id) !== modelKey) continue;
      if (isModelLoadedInfo(info)) return true;
    }
    return state.runtime.loadedModelIds.has(model) || state.runtime.loadedModelKeys.has(modelKey);
  }

  async function waitForModelLoaded(modelId, options = {}) {
    const model = toModelId(modelId);
    if (!model) return false;
    if (state.runtime.lmStudioNativeApiAvailable === false) return true;

    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 45000);
    const intervalMs = Math.max(400, Number(options.intervalMs) || 2000);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (state.runtime.lmStudioNativeApiAvailable === false) return true;
      try {
        if (await isModelLoadedOnLmStudio(model, { force: true, minIntervalMs: 0 })) return true;
      } catch {
        // keep polling within timeout
      }
      await wait(intervalMs);
    }

    try {
      return await isModelLoadedOnLmStudio(model);
    } catch {
      return false;
    }
  }

  async function unloadModelInstanceOnLmStudio(modelId) {
    const id = toModelId(modelId);
    const lmRoot = getLmStudioRoot();
    if (!lmRoot || !id) return false;
    const nativeAvailable = await isLmStudioNativeModelApiAvailable();
    if (!nativeAvailable) return false;
    try {
      const res = await fetch(`${lmRoot}/api/v1/models/unload`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ model: id })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function cleanupDuplicateLoadedInstancesByKey(modelKey) {
    const key = toModelKey(modelKey);
    if (!key) return;
    const nativeAvailable = await isLmStudioNativeModelApiAvailable();
    if (!nativeAvailable) return;
    const lmStudioStates = await syncLoadedModelStateFromLmStudio({ force: true, minIntervalMs: 0 });
    const loadedIds = [];
    for (const [id, info] of lmStudioStates.entries()) {
      if (toModelKey(id) !== key) continue;
      if (!isModelLoadedInfo(info)) continue;
      loadedIds.push(id);
    }
    if (loadedIds.length <= 1) return;

    loadedIds.sort((a, b) => {
      const aPriority = a === key ? 0 : 1;
      const bPriority = b === key ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.localeCompare(b, "ja");
    });
    const keepId = loadedIds[0];
    for (const id of loadedIds.slice(1)) {
      const ok = await unloadModelInstanceOnLmStudio(id);
      if (ok) {
        state.runtime.loadedModelIds.delete(id);
        state.runtime.loadingModelIds.delete(id);
      }
    }
    await syncLoadedModelStateFromLmStudio({ force: true, minIntervalMs: 0 });
    state.runtime.modelLoadCooldownUntil.set(key, Date.now() + 6000);
    if (keepId) state.runtime.loadedModelIds.add(keepId);
  }

  function syncFeatureFlagsFromSettings() {
    state.featureFlags.deepDive = state.settings.deepDive;
    state.featureFlags.helpMode = state.settings.helpMode;
    state.featureFlags.showLogprobs = state.settings.showLogprobs;
    state.featureFlags.webSearch = state.settings.webSearchEnabled;
    state.featureFlags.ttsAutoRead = state.settings.ttsEnabled && state.settings.ttsAutoRead;
  }

  function persistSettings() {
    state.settings = normalizeSettings(state.settings);
    syncFeatureFlagsFromSettings();
    saveToStorage(STORAGE_KEYS.SETTINGS, state.settings);
  }

  function loadSettings() {
    const raw = loadWithLegacyFallback(STORAGE_KEYS.SETTINGS, LEGACY_STORAGE_KEYS.SETTINGS, {});
    state.settings = normalizeSettings(raw);
    syncFeatureFlagsFromSettings();
    saveToStorage(STORAGE_KEYS.SETTINGS, state.settings);
  }

  // ===================================================================
  // Section 4: Settings UI
  // ===================================================================

  function updateSendKeyHint() {
    if (!el.sendKeyHint) return;
    const baseText =
      state.settings.sendKey === "enter-send"
        ? "Enter送信 / Shift+Enter改行"
        : "Enter改行 / Shift+Enter送信";
    const suffix = [];
    if (isCompareModeActive()) suffix.push("比較モード");
    if (state.featureFlags.deepDive) suffix.push("深掘りモード");
    if (state.featureFlags.helpMode) suffix.push("ヘルプモード");
    if (state.featureFlags.webSearch) suffix.push("Web検索");
    if (state.featureFlags.ttsAutoRead) suffix.push("自動読み上げ");
    if (state.runtime.editingIndex !== null) suffix.push("編集再送モード");
    el.sendKeyHint.textContent = suffix.length ? `${baseText} | ${suffix.join(" | ")}` : baseText;
  }

  function setModelLoadStatus(message = "", tone = "loading", persistMs = 0) {
    if (!el.modelLoadStatus) return;

    clearTimeout(state.runtime.modelLoadStatusTimer);
    state.runtime.modelLoadStatusTimer = null;

    if (!message) {
      el.modelLoadStatus.hidden = true;
      el.modelLoadStatus.dataset.state = "";
      el.modelLoadStatus.textContent = "";
      return;
    }

    el.modelLoadStatus.hidden = false;
    el.modelLoadStatus.dataset.state = tone;
    el.modelLoadStatus.textContent = message;

    if (persistMs > 0) {
      state.runtime.modelLoadStatusTimer = setTimeout(() => {
        setModelLoadStatus();
      }, persistMs);
    }
  }

  function updateModeButtons() {
    const deepActive = state.settings.deepDive;
    const helpActive = state.settings.helpMode;

    if (el.deepDiveBtn) {
      el.deepDiveBtn.dataset.active = String(deepActive);
      el.deepDiveBtn.setAttribute("aria-pressed", String(deepActive));
    }

    if (el.helpModeBtn) {
      el.helpModeBtn.dataset.active = String(helpActive);
      el.helpModeBtn.setAttribute("aria-pressed", String(helpActive));
    }

    if (el.webSearchBtn) {
      el.webSearchBtn.dataset.active = String(state.settings.webSearchEnabled);
      el.webSearchBtn.setAttribute("aria-pressed", String(state.settings.webSearchEnabled));
    }

    if (el.ttsAutoBtn) {
      const ttsActive = state.featureFlags.ttsAutoRead;
      el.ttsAutoBtn.dataset.active = String(ttsActive);
      el.ttsAutoBtn.setAttribute("aria-pressed", String(ttsActive));
    }
  }

  function updateCompareModeUI() {
    document.body.classList.toggle("compare-active", state.compare.enabled);
    if (el.compareModeBtn) {
      el.compareModeBtn.dataset.active = String(state.compare.enabled);
      el.compareModeBtn.setAttribute("aria-pressed", String(state.compare.enabled));
    }
    if (el.compareControls) {
      el.compareControls.hidden = !state.compare.enabled;
    }
  }

  function setCompareModeEnabled(enabled) {
    state.compare.enabled = !!enabled;
    updateCompareModeUI();
    updateSendKeyHint();
  }

  function isCompareModeActive() {
    return state.compare.enabled;
  }

  function applySettingsToUI() {
    el.baseUrlInput.value = state.settings.baseUrl;
    el.apiKeyInput.value = state.settings.apiKey;
    el.temperatureInput.value = String(state.settings.temperature);
    if (el.tempValue) el.tempValue.textContent = String(state.settings.temperature);
    el.maxTokensInput.value = String(state.settings.maxTokens);
    if (el.reasoningEffortSelect) el.reasoningEffortSelect.value = state.settings.reasoningEffort;
    el.systemPromptInput.value = state.settings.systemPrompt;

    el.sendKeySelect.value = state.settings.sendKey;
    el.responseStyleSelect.value = state.settings.responseStyle;
    el.userLevelSelect.value = state.settings.userLevel;
    el.userProfessionInput.value = state.settings.userProfession;
    el.userInterestsInput.value = state.settings.userInterests;
    el.userDisplayNameInput.value = state.settings.userDisplayName;

    el.autoGreetingOnNewTopicInput.checked = state.settings.autoGreetingOnNewTopic;
    el.memoryEnabledInput.checked = state.settings.memoryEnabled;
    el.darkModeInput.checked = state.settings.darkMode;
    el.autoUnloadInput.checked = state.settings.autoUnload;
    if (el.autoTitleInput) el.autoTitleInput.checked = state.settings.autoTitleEnabled;
    if (el.ttsEnabledInput) el.ttsEnabledInput.checked = state.settings.ttsEnabled;
    if (el.ttsAutoReadInput) el.ttsAutoReadInput.checked = state.settings.ttsAutoRead;
    if (el.ttsRateInput) {
      el.ttsRateInput.value = String(state.settings.ttsRate);
      if (el.ttsRateValue) el.ttsRateValue.textContent = String(state.settings.ttsRate);
    }
    populateTtsVoiceSelect();
    if (el.ttsBackendSelect) el.ttsBackendSelect.value = state.settings.ttsBackend;
    if (el.qwen3TtsUrlInput) el.qwen3TtsUrlInput.value = state.settings.qwen3TtsUrl;
    if (el.qwen3TtsSpeakerSelect) el.qwen3TtsSpeakerSelect.value = state.settings.qwen3TtsSpeaker;
    if (el.ttsSummarizeInput) el.ttsSummarizeInput.checked = state.settings.ttsSummarize;
    updateTtsBackendVisibility();
    el.showLogprobsInput.checked = state.settings.showLogprobs;
    if (el.hideThinkingInput) el.hideThinkingInput.checked = state.settings.hideThinking;
    if (el.deepDiveInput) el.deepDiveInput.checked = state.settings.deepDive;
    if (el.helpModeInput) el.helpModeInput.checked = state.settings.helpMode;
    if (el.webSearchEnabledInput) el.webSearchEnabledInput.checked = state.settings.webSearchEnabled;
    if (el.webSearchUrlInput) el.webSearchUrlInput.value = state.settings.webSearchUrl;
    if (el.webSearchResultsInput) el.webSearchResultsInput.value = String(state.settings.webSearchResults);
    if (el.webSearchCategoriesSelect) el.webSearchCategoriesSelect.value = state.settings.webSearchCategories;

    document.body.classList.toggle("dark-mode", state.settings.darkMode);
    updateSendKeyHint();
    updateModeButtons();
    updateCompareModeUI();
    renderModelVisibilityManager();
    renderMemoryList();
    renderSessionList();
  }

  function readSettingsFromUI() {
    return {
      ...state.settings,
      baseUrl: el.baseUrlInput.value,
      apiKey: el.apiKeyInput.value,
      temperature: el.temperatureInput.value,
      maxTokens: el.maxTokensInput.value,
      systemPrompt: el.systemPromptInput.value,
      sendKey: el.sendKeySelect.value,
      responseStyle: el.responseStyleSelect.value,
      userLevel: el.userLevelSelect.value,
      userProfession: el.userProfessionInput.value,
      userInterests: el.userInterestsInput.value,
      userDisplayName: el.userDisplayNameInput.value,
      autoGreetingOnNewTopic: el.autoGreetingOnNewTopicInput.checked,
      memoryEnabled: el.memoryEnabledInput.checked,
      darkMode: el.darkModeInput.checked,
      autoUnload: el.autoUnloadInput.checked,
      autoTitleEnabled: el.autoTitleInput ? el.autoTitleInput.checked : state.settings.autoTitleEnabled,
      ttsEnabled: el.ttsEnabledInput ? el.ttsEnabledInput.checked : state.settings.ttsEnabled,
      ttsAutoRead: el.ttsAutoReadInput ? el.ttsAutoReadInput.checked : state.settings.ttsAutoRead,
      ttsVoice: el.ttsVoiceSelect ? el.ttsVoiceSelect.value : state.settings.ttsVoice,
      ttsRate: el.ttsRateInput ? Number(el.ttsRateInput.value) : state.settings.ttsRate,
      ttsBackend: el.ttsBackendSelect ? el.ttsBackendSelect.value : state.settings.ttsBackend,
      qwen3TtsUrl: el.qwen3TtsUrlInput ? el.qwen3TtsUrlInput.value : state.settings.qwen3TtsUrl,
      qwen3TtsSpeaker: el.qwen3TtsSpeakerSelect ? el.qwen3TtsSpeakerSelect.value : state.settings.qwen3TtsSpeaker,
      ttsSummarize: el.ttsSummarizeInput ? el.ttsSummarizeInput.checked : state.settings.ttsSummarize,
      showLogprobs: el.showLogprobsInput.checked,
      hideThinking: el.hideThinkingInput ? el.hideThinkingInput.checked : state.settings.hideThinking,
      deepDive: el.deepDiveInput ? el.deepDiveInput.checked : state.settings.deepDive,
      helpMode: el.helpModeInput ? el.helpModeInput.checked : state.settings.helpMode,
      webSearchEnabled: el.webSearchEnabledInput ? el.webSearchEnabledInput.checked : state.settings.webSearchEnabled,
      webSearchUrl: el.webSearchUrlInput ? el.webSearchUrlInput.value : state.settings.webSearchUrl,
      webSearchResults: el.webSearchResultsInput ? Number(el.webSearchResultsInput.value) : state.settings.webSearchResults,
      webSearchCategories: el.webSearchCategoriesSelect ? el.webSearchCategoriesSelect.value : state.settings.webSearchCategories,
      reasoningEffort: el.reasoningEffortSelect ? el.reasoningEffortSelect.value : state.settings.reasoningEffort,
      model: el.modelSelect.value || state.settings.model
    };
  }

  function saveSettingsFromUI() {
    state.settings = normalizeSettings(readSettingsFromUI());
    persistSettings();
    document.body.classList.toggle("dark-mode", state.settings.darkMode);
    updateSendKeyHint();
    updateModeButtons();
    renderMemoryList();
    renderSessionList();
  }

  function scheduleSettingsSave() {
    clearTimeout(state.runtime.settingsSaveTimer);
    state.runtime.settingsSaveTimer = setTimeout(() => {
      saveSettingsFromUI();
    }, 220);
  }

  function setDeepDiveEnabled(enabled, options = { persist: true, reflectUI: true }) {
    state.settings.deepDive = !!enabled;
    syncFeatureFlagsFromSettings();

    if (options.reflectUI && el.deepDiveInput) {
      el.deepDiveInput.checked = state.settings.deepDive;
    }

    updateModeButtons();
    if (options.persist) persistSettings();
  }

  function setHelpModeEnabled(enabled, options = { persist: true, reflectUI: true }) {
    state.settings.helpMode = !!enabled;
    syncFeatureFlagsFromSettings();

    if (options.reflectUI && el.helpModeInput) {
      el.helpModeInput.checked = state.settings.helpMode;
    }

    updateModeButtons();
    if (options.persist) persistSettings();
  }

  function setWebSearchEnabled(enabled, options = { persist: true, reflectUI: true }) {
    state.settings.webSearchEnabled = !!enabled;
    syncFeatureFlagsFromSettings();

    if (options.reflectUI && el.webSearchEnabledInput) {
      el.webSearchEnabledInput.checked = state.settings.webSearchEnabled;
    }

    updateModeButtons();
    updateSendKeyHint();
    if (options.persist) persistSettings();
  }

  function openSettings(tab = "basic") {
    el.settingsPanel.classList.add("open");
    el.settingsPanel.setAttribute("aria-hidden", "false");
    el.overlay.hidden = false;
    setSettingsTab(tab);
  }

  function closeSettings() {
    el.settingsPanel.classList.remove("open");
    el.settingsPanel.setAttribute("aria-hidden", "true");
    el.overlay.hidden = true;
  }

  function setSettingsTab(tab) {
    const validTabs = ["presets", "data", "websearch", "voice"];
    const activeTab = validTabs.includes(tab) ? tab : "basic";
    const tabMap = [
      { key: "basic", button: el.settingsTabBasic, panel: el.settingsPanelBasic },
      { key: "presets", button: el.settingsTabPresets, panel: el.settingsPanelPresets },
      { key: "data", button: el.settingsTabData, panel: el.settingsPanelData },
      { key: "websearch", button: el.settingsTabWebSearch, panel: el.settingsPanelWebSearch },
      { key: "voice", button: el.settingsTabVoice, panel: el.settingsPanelVoice }
    ];

    for (const item of tabMap) {
      const isActive = item.key === activeTab;
      item.panel.hidden = !isActive;
      item.button.classList.toggle("is-active", isActive);
      item.button.setAttribute("aria-selected", String(isActive));
    }
  }

  function closePresetPopover() {
    state.runtime.presetPopoverOpen = false;
    if (el.presetPopover) el.presetPopover.hidden = true;
    if (el.presetBtn) {
      el.presetBtn.dataset.active = "false";
      el.presetBtn.setAttribute("aria-pressed", "false");
    }
  }

  function togglePresetPopover(forceOpen = null) {
    const nextOpen = forceOpen === null ? !state.runtime.presetPopoverOpen : !!forceOpen;
    state.runtime.presetPopoverOpen = nextOpen;
    if (el.presetPopover) el.presetPopover.hidden = !nextOpen;
    if (el.presetBtn) {
      el.presetBtn.dataset.active = String(nextOpen);
      el.presetBtn.setAttribute("aria-pressed", String(nextOpen));
    }
  }

  function insertTextAtCursor(textarea, textToInsert) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const head = textarea.value.slice(0, start);
    const tail = textarea.value.slice(end);
    const spacer = head && !head.endsWith("\n") ? "\n\n" : "";
    const insert = `${spacer}${textToInsert}\n`;
    textarea.value = `${head}${insert}${tail}`;
    const pos = (head + insert).length;
    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
    textarea.focus();
    resizeInput();
    scheduleDraftSave();
  }

  function renderPresetPopover() {
    const merged = getMergedTextPresets();
    if (!el.presetList) return;

    el.presetList.innerHTML = "";
    for (const [key, preset] of Object.entries(merged)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-item";
      btn.innerHTML = `<strong>${escapeHtml(preset.label)}</strong><span>${escapeHtml(key)}</span>`;
      btn.addEventListener("click", () => {
        insertTextAtCursor(el.messageInput, preset.prompt);
        closePresetPopover();
      });
      el.presetList.appendChild(btn);
    }
  }

  function renderPresetManagerSelect(preferredKey = null) {
    const merged = getMergedTextPresets();
    const entries = Object.entries(merged).sort((a, b) => a[1].label.localeCompare(b[1].label, "ja"));
    const lastSelected = preferredKey ?? el.presetManageSelect.value;

    el.presetManageSelect.innerHTML = "";
    const newOpt = document.createElement("option");
    newOpt.value = PRESET_NEW_OPTION_VALUE;
    newOpt.textContent = "＋ 新規プリセット";
    el.presetManageSelect.appendChild(newOpt);

    for (const [key, preset] of entries) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${preset.label} (${key})`;
      el.presetManageSelect.appendChild(opt);
    }

    if (lastSelected && merged[lastSelected]) {
      el.presetManageSelect.value = lastSelected;
    } else if (entries.length > 0) {
      el.presetManageSelect.value = entries[0][0];
    } else {
      el.presetManageSelect.value = PRESET_NEW_OPTION_VALUE;
    }
  }

  function syncPresetManagerFieldsFromSelect() {
    const selectedKey = el.presetManageSelect.value;
    if (selectedKey === PRESET_NEW_OPTION_VALUE) {
      el.presetManageKeyInput.value = "";
      el.presetManageLabelInput.value = "";
      el.presetManageContentInput.value = "";
      return;
    }

    const key = sanitizePresetKey(selectedKey);
    const merged = getMergedTextPresets();
    const selected = merged[key];
    if (!selected) return;

    el.presetManageKeyInput.value = key;
    el.presetManageLabelInput.value = selected.label;
    el.presetManageContentInput.value = selected.prompt;
  }

  function startNewPresetDraft() {
    el.presetManageSelect.value = PRESET_NEW_OPTION_VALUE;
    syncPresetManagerFieldsFromSelect();
    el.presetManageKeyInput.focus();
  }

  function saveManagedPreset() {
    const key = sanitizePresetKey(el.presetManageKeyInput.value);
    const label = asString(el.presetManageLabelInput.value).trim();
    const prompt = asString(el.presetManageContentInput.value).trim();

    if (!key || !label || !prompt) {
      alert("キー・表示名・内容を入力してください。");
      return;
    }
    if (key === PRESET_NEW_OPTION_VALUE) {
      alert("このキー名は予約済みです。別のキーを指定してください。");
      return;
    }

    state.presets.custom[key] = { label, prompt };
    persistCustomPresets();

    renderPresetPopover();
    renderPresetManagerSelect(key);
    el.presetManageSelect.value = key;
    syncPresetManagerFieldsFromSelect();
  }

  function deleteManagedPreset() {
    if (el.presetManageSelect.value === PRESET_NEW_OPTION_VALUE) {
      alert("削除するプリセットを選択してください。");
      return;
    }

    const key = sanitizePresetKey(el.presetManageSelect.value);
    if (!key) return;

    const hasCustom = Object.prototype.hasOwnProperty.call(state.presets.custom, key);
    if (!hasCustom) {
      alert("デフォルトプリセットは直接削除できません。上書き保存したもののみ削除できます。");
      return;
    }

    if (!confirm(`プリセット ${key} を削除しますか？`)) return;
    delete state.presets.custom[key];
    persistCustomPresets();

    renderPresetPopover();
    renderPresetManagerSelect();
    syncPresetManagerFieldsFromSelect();
  }

  function resetCustomPresets() {
    if (!confirm("カスタムプリセットをすべて削除してデフォルトに戻しますか？")) return;

    state.presets.custom = {};
    persistCustomPresets();
    renderPresetPopover();
    renderPresetManagerSelect();
    startNewPresetDraft();
  }

  function renderSystemPromptPresetSelect() {
    const merged = getMergedSystemPromptPresets();
    const entries = Object.entries(merged).sort((a, b) => a[1].label.localeCompare(b[1].label, "ja"));

    el.systemPromptPresetSelect.innerHTML = "";
    for (const [key, preset] of entries) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${preset.label} (${key})`;
      el.systemPromptPresetSelect.appendChild(opt);
    }
  }

  function applySelectedSystemPromptPreset() {
    const key = sanitizePresetKey(el.systemPromptPresetSelect.value);
    const merged = getMergedSystemPromptPresets();
    const selected = merged[key];
    if (!selected) return;

    el.systemPromptInput.value = selected.prompt;
    state.settings.systemPrompt = selected.prompt;
    persistSettings();
  }

  function saveCurrentAsSystemPromptPreset() {
    const key = sanitizePresetKey(el.systemPromptPresetNameInput.value);
    if (!key) {
      alert("新規保存名を入力してください。");
      return;
    }

    const label = asString(el.systemPromptPresetNameInput.value).trim();
    const prompt = asString(el.systemPromptInput.value).trim();
    if (!prompt) {
      alert("System Promptが空です。");
      return;
    }

    state.presets.systemPrompts[key] = { label, prompt };
    persistSystemPromptPresets();
    renderSystemPromptPresetSelect();
    el.systemPromptPresetSelect.value = key;
    el.systemPromptPresetNameInput.value = "";
  }

  function deleteSelectedSystemPromptPreset() {
    const key = sanitizePresetKey(el.systemPromptPresetSelect.value);
    if (!key) return;

    const isDefault = Object.prototype.hasOwnProperty.call(DEFAULT_SYSTEM_PROMPT_PRESETS, key);
    if (isDefault && !Object.prototype.hasOwnProperty.call(state.presets.systemPrompts, key)) {
      alert("デフォルトSystem Promptプリセットは削除できません。");
      return;
    }

    if (!confirm(`System Promptプリセット ${key} を削除しますか？`)) return;
    delete state.presets.systemPrompts[key];
    persistSystemPromptPresets();
    renderSystemPromptPresetSelect();
  }

  function renderPresetUI() {
    renderPresetPopover();
    renderPresetManagerSelect();
    syncPresetManagerFieldsFromSelect();
    renderSystemPromptPresetSelect();
  }

  function exportHistoryData() {
    const payload = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      currentSessionId: state.currentSessionId,
      sessions: state.sessions
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `local-llm-chat-sessions-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importHistory() {
    if (el.importInput) el.importInput.click();
  }

  async function handleImportFile(file) {
    if (!file) return;
    if (file.size > LIMITS.IMPORT_MAX_SIZE) {
      alert("ファイルサイズが大きすぎます（上限: 10MB）");
      return;
    }
    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      // Support both session-export format and raw message array
      let sessions = null;
      let currentSessionId = null;

      if (imported && typeof imported === "object" && !Array.isArray(imported) && imported.sessions) {
        // Session-based export format
        sessions = imported.sessions;
        currentSessionId = imported.currentSessionId || null;
      } else if (Array.isArray(imported)) {
        // Legacy raw message array
        const validRoles = new Set(["user", "assistant", "system"]);
        if (!imported.every((m) => m && validRoles.has(m.role) && typeof m.content === "string")) {
          alert("無効な形式のファイルです");
          return;
        }
        const sessionId = "imported_" + Date.now();
        sessions = [{
          id: sessionId,
          title: "インポート済み会話",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: imported
        }];
        currentSessionId = sessionId;
      } else {
        alert("無効な形式のファイルです");
        return;
      }

      if (!confirm(`${sessions.length}件のセッションをインポートします。\n既存の履歴を置き換えますか？`)) return;

      state.sessions = sessions;
      state.currentSessionId = currentSessionId;
      saveToStorage(STORAGE_KEYS.SESSIONS, state.sessions);
      saveToStorage(STORAGE_KEYS.CURRENT_SESSION_ID, state.currentSessionId);

      // Load the active session history
      const activeSession = state.sessions.find((s) => s.id === state.currentSessionId);
      state.history = activeSession ? activeSession.history || [] : [];
      persistHistory();
      renderHistory();
      renderSessionList();
      appendSystem("インポートが完了しました。");
    } catch (err) {
      console.error("インポートエラー:", err);
      alert("ファイルの読み込みに失敗しました: " + err.message);
    } finally {
      if (el.importInput) el.importInput.value = "";
    }
  }

  function resetSettings() {
    if (!confirm("設定をデフォルトに戻しますか？")) return;
    state.settings = { ...DEFAULT_SETTINGS };
    persistSettings();
    applySettingsToUI();
    appendSystem("設定をデフォルトに戻しました。");
  }

  function clearAllData() {
    if (!confirm("すべての保存データ（設定・履歴・プリセット・メモリー）を削除しますか？\n\nこの操作は取り消せません。")) return;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    state.history = [];
    state.sessions = [];
    state.currentSessionId = "";
    state.settings = { ...DEFAULT_SETTINGS };
    state.memories = [];
    el.chatContainer.innerHTML = "";
    applySettingsToUI();
    renderPresetUI();
    appendSystem("すべてのデータを削除しました。");
  }

  // ===================================================================
  // Section 5: Rendering and Chat UI
  // ===================================================================

  function escapeHtml(value) {
    return asString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return asString(value).replace(/"/g, "&quot;");
  }

  function formatInlineMarkdown(text) {
    return asString(text)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
        const href = escapeAttr(url);
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      });
  }

  function splitTableCells(line) {
    let row = asString(line).trim();
    if (!row) return [];
    if (!row.includes("|")) return [row];
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);

    const cells = [];
    let buf = "";
    let escapeNext = false;
    let inCode = false;
    let squareDepth = 0;
    let roundDepth = 0;

    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (escapeNext) {
        buf += ch;
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        escapeNext = true;
        buf += ch;
        continue;
      }

      if (ch === "`") {
        inCode = !inCode;
        buf += ch;
        continue;
      }

      if (!inCode) {
        if (ch === "[") {
          squareDepth += 1;
          buf += ch;
          continue;
        }
        if (ch === "]") {
          if (squareDepth > 0) squareDepth -= 1;
          buf += ch;
          continue;
        }
        if (ch === "(") {
          if (squareDepth > 0) roundDepth += 1;
          buf += ch;
          continue;
        }
        if (ch === ")") {
          if (roundDepth > 0) roundDepth -= 1;
          buf += ch;
          continue;
        }
        if (ch === "|" && squareDepth === 0 && roundDepth === 0) {
          cells.push(buf.trim());
          buf = "";
          continue;
        }
      }

      buf += ch;
    }

    cells.push(buf.trim());
    return cells;
  }

  function isTableRowCandidate(line) {
    const trimmed = asString(line).trim();
    if (!trimmed.includes("|")) return false;
    return splitTableCells(trimmed).length >= 2;
  }

  function isTableSeparatorLine(line) {
    const cells = splitTableCells(line).map((cell) => cell.trim());
    if (cells.length < 2) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function sanitizeTableCellText(text) {
    return asString(text)
      .replace(/\\\|/g, "|")
      .replace(/&lt;\s*br\s*\/?\s*&gt;/gi, " / ")
      .replace(/<\s*br\s*\/?\s*>/gi, " / ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseTableRow(line) {
    return splitTableCells(line).map((cell) => formatInlineMarkdown(sanitizeTableCellText(cell)));
  }

  function renderMarkdown(text) {
    const src = asString(text).replace(/\r\n?/g, "\n");

    // --- Strip <think>...</think> blocks (thinking models) ---
    let thinkingContent = "";
    let mainSrc = src;
    let thinkingPartial = false;

    // Pattern 1: <think>...</think> or <seed:think>...</seed:think> (standard paired tags)
    const thinkBlocks = [];
    mainSrc = mainSrc.replace(/<(?:\w+:)?think>([\s\S]*?)<\/(?:\w+:)?think>/g, (_m, content) => {
      thinkBlocks.push(content.trim());
      return "";
    });
    if (thinkBlocks.length) thinkingContent = thinkBlocks.join("\n");

    // Pattern 2: <think>... or <seed:think>... (streaming, no closing tag yet)
    if (!thinkBlocks.length) {
      const partialOpen = mainSrc.match(/<(?:\w+:)?think>([\s\S]*)$/);
      if (partialOpen) {
        thinkingContent = partialOpen[1].trim();
        mainSrc = mainSrc.replace(/<(?:\w+:)?think>[\s\S]*$/, "");
        thinkingPartial = true;
      }
    }

    // Pattern 3: No opening tag but </think> or </seed:think> present (some models omit opening tag)
    if (!thinkBlocks.length && !thinkingPartial) {
      const closeOnly = mainSrc.match(/^([\s\S]*?)<\/(?:\w+:)?think>([\s\S]*)$/);
      if (closeOnly) {
        thinkingContent = closeOnly[1].trim();
        mainSrc = closeOnly[2].trim();
      }
    }

    // Pattern 4: <unusedNN>thought... (medgemma, no closing tag)
    if (!thinkingContent && !thinkingPartial) {
      const medgemmaMatch = mainSrc.match(/^([\s\S]*?)<unused\d+>thought([\s\S]*)$/);
      if (medgemmaMatch) {
        mainSrc = medgemmaMatch[1].trim();
        thinkingContent = medgemmaMatch[2].trim();
        if (!mainSrc) thinkingPartial = true;
      }
    }

    mainSrc = mainSrc.trim();

    // Build thinking block HTML (collapsible, unless hidden by setting)
    let thinkingHtml = "";
    if (thinkingContent && !state.settings.hideThinking) {
      const label = thinkingPartial ? "思考中…" : "思考プロセス";
      thinkingHtml = '<details class="thinking-block"' + (thinkingPartial ? " open" : "") + ">"
        + '<summary class="thinking-summary">' + label + "</summary>"
        + '<div class="thinking-content">' + escapeHtml(thinkingContent) + "</div>"
        + "</details>";
    }

    // If only thinking content with no main response yet, return just the thinking block
    if (thinkingContent && !mainSrc) return thinkingHtml;

    // --- KaTeX: extract math expressions into placeholders ---
    const mathPlaceholders = [];
    let mathIdx = 0;
    let processed = mainSrc;

    if (typeof katex !== "undefined") {
      // Step 0: Shield regular code blocks from math extraction;
      //         render ```math/latex/tex``` blocks as block math.
      const codeBlockShields = [];
      processed = processed.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_m, lang, content) => {
        if (/^(?:math|latex|tex)$/i.test(lang)) {
          const id = "\x00MATH_BLOCK_" + (mathIdx++) + "\x00";
          mathPlaceholders.push({ id, expr: content.trim(), displayMode: true });
          return id;
        }
        const token = "\x01CSHIELD_" + codeBlockShields.length + "\x01";
        codeBlockShields.push(_m);
        return token;
      });

      // Block math: $$...$$ (multiline)
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
        const id = "\x00MATH_BLOCK_" + (mathIdx++) + "\x00";
        mathPlaceholders.push({ id, expr: expr.trim(), displayMode: true });
        return id;
      });
      // Block math: \[...\] (multiline)
      processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_m, expr) => {
        const id = "\x00MATH_BLOCK_" + (mathIdx++) + "\x00";
        mathPlaceholders.push({ id, expr: expr.trim(), displayMode: true });
        return id;
      });
      // Inline math: \(...\) — lookbehind prevents false match on \exp\( etc.
      processed = processed.replace(/(?<![a-zA-Z])\\\(([\s\S]+?)\\\)/g, (_m, expr) => {
        const id = "\x00MATH_INLINE_" + (mathIdx++) + "\x00";
        mathPlaceholders.push({ id, expr: expr.trim(), displayMode: false });
        return id;
      });
      // Inline math: $...$ (exclude $$, escaped \$, leading/trailing whitespace)
      processed = processed.replace(/(?<!\$)\$(?!\$)(?!\s)((?:[^$\\]|\\.)+?)(?<!\s)\$/g, (_m, expr) => {
        const id = "\x00MATH_INLINE_" + (mathIdx++) + "\x00";
        mathPlaceholders.push({ id, expr: expr.trim(), displayMode: false });
        return id;
      });

      // Restore shielded code blocks
      processed = processed.replace(/\x01CSHIELD_(\d+)\x01/g, (_m, idx) => codeBlockShields[Number(idx)] || "");
    }

    const codeBlocks = [];
    const safe = escapeHtml(processed).replace(/```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_m, rawLang, rawCode) => {
      const lang = asString(rawLang).toLowerCase();
      const code = asString(rawCode).replace(/\n$/, "");
      const highlighted = highlightCode(code, lang);
      const classAttr = lang ? ` class="language-${escapeAttr(lang)}"` : "";
      const langLabel = lang ? `<span class="code-header__lang">${escapeHtml(lang)}</span>` : `<span class="code-header__lang">code</span>`;
      const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
      const blockIdx = codeBlocks.length;
      codeBlocks.push(`<pre class="md-code"><div class="code-header">${langLabel}<button class="code-header__copy" data-code-block="${blockIdx}">Copy</button></div><code${classAttr}>${highlighted}</code></pre>`);
      return token;
    });

    const lines = safe.split("\n");
    const out = [];
    let inUl = false;
    let inOl = false;
    let inQuote = false;

    const closeLists = () => {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
    };

    const closeQuote = () => {
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        closeLists();
        closeQuote();
        continue;
      }

      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (isTableRowCandidate(trimmed) && isTableSeparatorLine(nextLine)) {
        closeLists();
        closeQuote();

        const headers = parseTableRow(trimmed);
        let tableHtml = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        tableHtml += headers.map((cell) => `<th>${cell}</th>`).join("");
        tableHtml += "</tr></thead><tbody>";

        i += 2;
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine || !isTableRowCandidate(rowLine) || isTableSeparatorLine(rowLine)) break;
          const cells = parseTableRow(rowLine);
          tableHtml += "<tr>";
          for (let col = 0; col < headers.length; col += 1) {
            tableHtml += `<td>${cells[col] || ""}</td>`;
          }
          tableHtml += "</tr>";
          i += 1;
        }

        tableHtml += "</tbody></table></div>";
        out.push(tableHtml);
        i -= 1;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        closeLists();
        closeQuote();
        const level = heading[1].length;
        out.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        closeLists();
        if (!inQuote) {
          out.push("<blockquote>");
          inQuote = true;
        }
        out.push(`<p>${formatInlineMarkdown(quote[1])}</p>`);
        continue;
      }

      closeQuote();

      const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
      if (bullet) {
        if (!inUl) {
          if (inOl) {
            out.push("</ol>");
            inOl = false;
          }
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${formatInlineMarkdown(bullet[1])}</li>`);
        continue;
      }

      const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
      if (ordered) {
        if (!inOl) {
          if (inUl) {
            out.push("</ul>");
            inUl = false;
          }
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${formatInlineMarkdown(ordered[1])}</li>`);
        continue;
      }

      closeLists();
      // Block math placeholder: render as <div> instead of <p> for proper display
      if (/^\x00MATH_BLOCK_\d+\x00$/.test(trimmed)) {
        out.push(`<div class="math-block-wrap">${trimmed}</div>`);
      } else {
        out.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
      }
    }

    closeLists();
    closeQuote();

    let html = out.join("").replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, idx) => codeBlocks[Number(idx)] || "");

    // --- KaTeX: restore math placeholders ---
    for (const ph of mathPlaceholders) {
      try {
        const rendered = katex.renderToString(ph.expr, {
          displayMode: ph.displayMode,
          throwOnError: false,
          output: "htmlAndMathml"
        });
        html = html.replace(escapeHtml(ph.id), rendered);
      } catch {
        const fallback = ph.displayMode
          ? '<div class="math-error">$$' + escapeHtml(ph.expr) + "$$</div>"
          : '<span class="math-error">$' + escapeHtml(ph.expr) + "$</span>";
        html = html.replace(escapeHtml(ph.id), fallback);
      }
    }

    return thinkingHtml + html;
  }

  function createIconButton(kind, iconId, label) {
    const btn = document.createElement("button");
    btn.className = `btn ${kind} icon-btn icon-only`;
    btn.setAttribute("data-tooltip", label);
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${iconId}"></use></svg>`;
    return btn;
  }

  function displayLogprobsInfo(msgDiv, logprobs) {
    if (!logprobs || logprobs.length === 0) return;

    let totalLogprob = 0;
    let count = 0;
    const alternativesMap = new Map();

    for (const item of logprobs) {
      if (item && typeof item.logprob === "number") {
        totalLogprob += item.logprob;
        count++;
        if (item.top_logprobs && item.top_logprobs.length > 1) {
          const alternatives = item.top_logprobs
            .filter((alt) => alt.token !== item.token)
            .slice(0, 3)
            .map((alt) => ({ token: alt.token, prob: Math.exp(alt.logprob) * 100 }));
          if (alternatives.length > 0) alternativesMap.set(item.token, alternatives);
        }
      }
    }

    if (count === 0) return;

    const avgLogprob = totalLogprob / count;
    const avgProb = Math.exp(avgLogprob);
    const confidencePercent = Math.min(100, Math.max(0, avgProb * 100));

    let confidenceLevel, confidenceColor;
    if (confidencePercent >= 80) { confidenceLevel = "高"; confidenceColor = "#28a745"; }
    else if (confidencePercent >= 50) { confidenceLevel = "中"; confidenceColor = "#ffc107"; }
    else { confidenceLevel = "低"; confidenceColor = "#dc3545"; }

    const topAlternatives = Array.from(alternativesMap.entries())
      .filter(([, alts]) => alts[0].prob > 5)
      .slice(0, 5);

    let alternativesHtml = "";
    if (topAlternatives.length > 0) {
      alternativesHtml = `
        <div class="alternatives-section">
          <span class="alternatives-label">検討された代替候補:</span>
          <div class="alternatives-list">
            ${topAlternatives.map(([selectedToken, alts]) => `
              <div class="alternative-item">
                <span class="selected-token">"${escapeHtml(selectedToken)}"</span>
                <span class="arrow">&rarr;</span>
                ${alts.map((alt) => `<span class="alt-token" title="${alt.prob.toFixed(1)}%">${escapeHtml(alt.token)} (${alt.prob.toFixed(0)}%)</span>`).join(" / ")}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    const infoDiv = document.createElement("div");
    infoDiv.className = "logprobs-info";
    infoDiv.innerHTML = `
      <div class="confidence-section">
        <span class="confidence-label">応答の確信度:</span>
        <div class="confidence-bar-container">
          <div class="confidence-bar" style="width: ${confidencePercent}%; background: ${confidenceColor}"></div>
        </div>
        <span class="confidence-value" style="color: ${confidenceColor}">${confidencePercent.toFixed(0)}% (${confidenceLevel})</span>
      </div>
      ${alternativesHtml}
      <div class="logprobs-note">
        <small>logprobs: ${logprobs.length} tokens</small>
      </div>
    `;

    msgDiv.appendChild(infoDiv);
  }

  function updateReasoningBlock(index, reasoningText, isStreaming) {
    if (state.settings.hideThinking) return;
    const wrap = el.chatContainer.querySelector(`article[data-index="${index}"]`);
    if (!wrap) return;
    let block = wrap.querySelector(".thinking-block");
    if (!block) {
      block = document.createElement("details");
      block.className = "thinking-block";
      if (isStreaming) block.open = true;
      block.innerHTML = '<summary class="thinking-summary"></summary><div class="thinking-content"></div>';
      const mdBody = wrap.querySelector(".markdown-body");
      if (mdBody) wrap.insertBefore(block, mdBody);
      else wrap.prepend(block);
    }
    const summary = block.querySelector(".thinking-summary");
    if (summary) summary.textContent = isStreaming ? "思考中…" : "思考プロセス";
    const content = block.querySelector(".thinking-content");
    if (content) content.textContent = reasoningText;
  }

  function getThinkingIndicatorHtml(label = "Thinking...") {
    return `
      <div class="thinking-indicator" aria-live="polite" aria-label="${escapeHtml(label)}">
        <span class="thinking-text">${escapeHtml(label)}</span>
        <span class="thinking-dots" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
      </div>
    `;
  }

  function buildMsgInfoLine(message) {
    const parts = [];
    const text = asString(message.content);
    if (text) {
      parts.push(`${formatNumber(text.length)}文字`);
      parts.push(`~${formatNumber(estimateTokens(text))} tokens`);
    }
    if (message.metrics) {
      const m = message.metrics;
      if (m.tokensPerSecond > 0) parts.push(`${m.tokensPerSecond.toFixed(1)} t/s`);
      if (m.elapsedMs > 0) parts.push(`${(m.elapsedMs / 1000).toFixed(1)}秒`);
    }
    if (message.timestamp) {
      parts.push(formatMessageTimestamp(message.timestamp));
    }
    return parts.join(" / ");
  }

  function appendMessage(message, index) {
    // Render topic separator as styled element instead of system message
    if (message.role === "system" && message.content === "--- 新しい話題 ---") {
      const sep = document.createElement("div");
      sep.className = "topic-separator";
      sep.dataset.index = String(index);
      sep.innerHTML = '<span class="separator-line"></span><span class="separator-text">新しい話題</span><span class="separator-line"></span>';
      el.chatContainer.appendChild(sep);
      return;
    }

    const wrap = document.createElement("article");
    wrap.className = `message ${message.role}`;
    if (message.bookmarked) wrap.classList.add("bookmarked");
    wrap.dataset.index = String(index);

    if (message.role === "compare") {
      wrap.innerHTML = `
        <div class="compare-grid">
          <section class="compare-col compare-a">
            <p class="compare-title">${escapeHtml(message.modelA)}</p>
            <div class="compare-content markdown-body">${renderMarkdown(message.contentA || "")}</div>
            ${message.thinkingA ? getThinkingIndicatorHtml("Thinking...") : ""}
          </section>
          <section class="compare-col compare-b">
            <p class="compare-title">${escapeHtml(message.modelB)}</p>
            <div class="compare-content markdown-body">${renderMarkdown(message.contentB || "")}</div>
            ${message.thinkingB ? getThinkingIndicatorHtml("Thinking...") : ""}
          </section>
        </div>
      `;
      el.chatContainer.appendChild(wrap);
      return;
    }

    // Reasoning block (gpt-oss etc. via delta.reasoning)
    if (message.role === "assistant" && message.reasoning && !state.settings.hideThinking) {
      const block = document.createElement("details");
      block.className = "thinking-block";
      block.innerHTML = '<summary class="thinking-summary">思考プロセス</summary>'
        + '<div class="thinking-content">' + escapeHtml(message.reasoning) + "</div>";
      wrap.appendChild(block);
    }

    const content = document.createElement("div");
    content.className = "markdown-body";
    content.innerHTML = renderMarkdown(message.content || "");
    wrap.appendChild(content);

    // Code block copy button handler
    content.addEventListener("click", (e) => {
      const btn = e.target.closest(".code-header__copy");
      if (!btn) return;
      const pre = btn.closest(".md-code");
      const codeEl = pre?.querySelector("code");
      if (!codeEl) return;
      navigator.clipboard.writeText(codeEl.textContent || "").then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      });
    });

    if (message.role === "assistant" && message.thinking) {
      wrap.insertAdjacentHTML("beforeend", getThinkingIndicatorHtml("Thinking..."));
    }

    if (message.role === "assistant" && Array.isArray(message.logprobs) && message.logprobs.length) {
      displayLogprobsInfo(wrap, message.logprobs);
    }

    if (message.role === "assistant" && typeof message.termCheck === "string" && message.termCheck.trim()) {
      const details = document.createElement("details");
      details.className = "termcheck-panel";
      const summary = document.createElement("summary");
      summary.textContent = "医学用語チェック結果";
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "termcheck-content markdown-body";
      body.innerHTML = renderMarkdown(message.termCheck);
      details.appendChild(body);
      wrap.appendChild(details);
    }

    if (message.imageData) {
      const img = document.createElement("img");
      img.src = message.imageData;
      img.alt = "attached image";
      img.style.maxWidth = "260px";
      img.style.borderRadius = "8px";
      img.style.marginTop = "8px";
      wrap.appendChild(img);
    }

    if (message.role !== "system") {
      const meta = document.createElement("div");
      meta.className = "meta";

      const bookmarkBtn = createIconButton("ghost", message.bookmarked ? "i-star-filled" : "i-star", message.bookmarked ? "ブックマーク解除" : "ブックマーク");
      if (message.bookmarked) bookmarkBtn.style.color = "#f59e0b";
      bookmarkBtn.addEventListener("click", () => {
        const idx = Number(wrap.dataset.index);
        const target = state.history[idx];
        if (!target) return;
        target.bookmarked = !target.bookmarked;
        persistHistory();
        renderHistory();
      });
      meta.appendChild(bookmarkBtn);

      const copyBtn = createIconButton("ghost", "i-copy", "コピー");
      copyBtn.addEventListener("click", () => {
        const raw = message.content || "";
        navigator.clipboard.writeText(raw).then(() => {
          copyBtn.setAttribute("data-tooltip", "コピー済");
          setTimeout(() => { copyBtn.setAttribute("data-tooltip", "コピー"); }, 1500);
        });
      });
      meta.appendChild(copyBtn);

      if (message.role === "user") {
        const editBtn = createIconButton("ghost", "i-edit", "編集");
        editBtn.addEventListener("click", beginEditUserMessage.bind(null, Number(wrap.dataset.index)));
        meta.appendChild(editBtn);
      }

      const delBtn = createIconButton("ghost", "i-trash", "削除");
      delBtn.addEventListener("click", () => {
        if (state.runtime.streaming) return;
        state.history.splice(Number(wrap.dataset.index), 1);
        persistHistory();
        renderHistory();
      });
      meta.appendChild(delBtn);

      if (message.role === "assistant") {
        if (message.interrupted) {
          const resumeBtn = createIconButton("ghost", "i-refresh", "再開");
          resumeBtn.addEventListener("click", resumeAssistantAt.bind(null, Number(wrap.dataset.index)));
          meta.appendChild(resumeBtn);
        }

        const ttsBtn = createIconButton("ghost", "i-speaker", "読み上げ");
        ttsBtn.addEventListener("click", toggleSpeakMessage.bind(null, Number(wrap.dataset.index)));
        meta.appendChild(ttsBtn);

        const termBtn = createIconButton("ghost", "i-termcheck", "医学用語チェック");
        termBtn.addEventListener("click", runMedicalTermCheck.bind(null, Number(wrap.dataset.index)));
        meta.appendChild(termBtn);

        const regenBtn = createIconButton("ghost", "i-repeat", "再生成");
        regenBtn.addEventListener("click", regenerateAssistantAt.bind(null, Number(wrap.dataset.index)));
        meta.appendChild(regenBtn);
      }

      wrap.appendChild(meta);
    }

    // Info line (assistant messages: char count, tokens, metrics, timestamp)
    if (message.role === "assistant" && !message.thinking) {
      const infoText = buildMsgInfoLine(message);
      if (infoText) {
        const info = document.createElement("div");
        info.className = "msg-info";
        info.textContent = infoText;
        wrap.appendChild(info);
      }
    }
    // Timestamp for user messages
    if (message.role === "user" && message.timestamp) {
      const info = document.createElement("div");
      info.className = "msg-info";
      info.textContent = formatMessageTimestamp(message.timestamp);
      wrap.appendChild(info);
    }

    el.chatContainer.appendChild(wrap);
  }

  function updateCompareMessageCell(index, side, content) {
    const selector = side === "a" ? ".compare-a .compare-content" : ".compare-b .compare-content";
    const node = el.chatContainer.querySelector(`article[data-index="${index}"] ${selector}`);
    if (node) node.innerHTML = renderMarkdown(content);
  }

  function renderHistory() {
    el.chatContainer.innerHTML = "";
    state.history.forEach((m, i) => appendMessage(m, i));
    smartScrollToBottom(true);
  }

  function stripImageDataForStorage(history) {
    return history.map((item) => {
      if (!item.imageData) return item;
      const { imageData, ...rest } = item;
      return rest;
    });
  }

  function persistHistory() {
    state.history = normalizeHistory(state.history);
    saveToStorage(STORAGE_KEYS.HISTORY, stripImageDataForStorage(state.history));
    upsertCurrentSessionFromHistory();
  }

  function appendSystem(text) {
    const msg = { role: "system", content: text, timestamp: new Date().toISOString() };
    state.history.push(msg);
    persistHistory();
    appendMessage(msg, state.history.length - 1);
    smartScrollToBottom(true);
  }

  function beginEditUserMessage(index) {
    if (state.runtime.streaming) return;
    const target = state.history[index];
    if (!target || target.role !== "user") return;

    state.runtime.editingIndex = index;
    el.messageInput.value = target.content === "(添付のみ)" ? "" : target.content;
    resizeInput();
    el.messageInput.focus();
    updateSendKeyHint();
  }

  function resizeInput() {
    el.messageInput.style.height = "auto";
    el.messageInput.style.height = `${Math.min(el.messageInput.scrollHeight, 180)}px`;
  }

  function scheduleDraftSave() {
    clearTimeout(state.runtime.draftTimer);
    state.runtime.draftTimer = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.DRAFT, { text: el.messageInput.value });
    }, 300);
  }

  function isNearBottom() {
    const container = el.chatMain;
    if (!container) return true;
    return container.scrollTop + container.clientHeight > container.scrollHeight - 150;
  }

  function smartScrollToBottom(force = false) {
    if (!force && !isNearBottom()) return;
    const container = el.chatMain;
    if (!container) return;
    window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  }

  function renderSessionList() {
    if (!el.sessionList || !el.sessionCount) return;

    const sessions = normalizeSessions(state.sessions);
    state.sessions = sessions;
    el.sessionList.innerHTML = "";
    el.sessionCount.textContent = `保存ログ: ${sessions.length}件`;

    if (sessions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "session-list-empty";
      empty.textContent = "会話ログはありません。";
      el.sessionList.appendChild(empty);
      return;
    }

    for (const session of sessions) {
      const item = document.createElement("article");
      item.className = "session-item";
      if (session.id === state.currentSessionId) item.classList.add("is-active");

      const header = document.createElement("div");
      header.className = "session-item-header";

      const title = document.createElement("h4");
      title.className = "session-item-title";
      title.textContent = session.title;
      title.addEventListener("dblclick", () => beginSessionRename(session.id, title));

      const meta = document.createElement("p");
      meta.className = "session-item-meta";
      meta.textContent = `更新: ${formatSessionDate(session.updatedAt)} / ${session.history.length}件`;

      header.appendChild(title);
      header.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "session-item-actions";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "btn ghost";
      renameBtn.textContent = "名前変更";
      renameBtn.addEventListener("click", () => beginSessionRename(session.id, title));

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn ghost";
      openBtn.dataset.sessionAction = "open";
      openBtn.dataset.sessionId = session.id;
      openBtn.textContent = session.id === state.currentSessionId ? "表示中" : "再開";
      openBtn.disabled = session.id === state.currentSessionId;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn ghost";
      deleteBtn.dataset.sessionAction = "delete";
      deleteBtn.dataset.sessionId = session.id;
      deleteBtn.textContent = "削除";

      actions.appendChild(renameBtn);
      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(header);
      item.appendChild(actions);
      el.sessionList.appendChild(item);
    }
  }

  // ===================================================================
  // Section 5b: v2.0 UI Functions (Search, Shortcuts, Rename, Export, Scroll)
  // ===================================================================

  // --- Session Rename ---
  function beginSessionRename(sessionId, titleEl) {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "session-item-title-input";
    input.value = session.title;
    input.maxLength = 80;

    const commit = () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== session.title) {
        session.title = newTitle;
        session.autoTitled = false;
        saveToStorage(STORAGE_KEYS.SESSIONS, state.sessions);
      }
      renderSessionList();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { renderSessionList(); }
    });
    input.addEventListener("blur", commit);

    titleEl.textContent = "";
    titleEl.appendChild(input);
    input.focus();
    input.select();
  }

  // --- Search ---
  function openSearchBar() {
    if (!el.searchBar) return;
    state.runtime.searchActive = true;
    el.searchBar.hidden = false;
    el.searchInput.value = state.runtime.searchQuery;
    el.searchInput.focus();
  }

  function closeSearchBar() {
    if (!el.searchBar) return;
    state.runtime.searchActive = false;
    state.runtime.searchQuery = "";
    el.searchBar.hidden = true;
    el.searchInput.value = "";
    if (el.searchCount) el.searchCount.textContent = "";
    clearSearchHighlights();
  }

  function clearSearchHighlights() {
    el.chatContainer.querySelectorAll(".message").forEach((m) => {
      m.classList.remove("search-hidden");
    });
    el.chatContainer.querySelectorAll("mark.search-highlight").forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  function performSearch() {
    const query = asString(el.searchInput.value).trim().toLowerCase();
    state.runtime.searchQuery = query;
    clearSearchHighlights();

    if (!query) {
      if (el.searchCount) el.searchCount.textContent = "";
      return;
    }

    let matchCount = 0;
    el.chatContainer.querySelectorAll(".message").forEach((msgEl) => {
      const contentEl = msgEl.querySelector(".markdown-body");
      if (!contentEl) { msgEl.classList.add("search-hidden"); return; }

      const text = contentEl.textContent || "";
      if (text.toLowerCase().includes(query)) {
        matchCount++;
        highlightTextNodes(contentEl, query);
      } else {
        msgEl.classList.add("search-hidden");
      }
    });

    if (el.searchCount) {
      el.searchCount.textContent = matchCount > 0 ? `${matchCount}件` : "0件";
    }

    // Scroll to first match
    const firstMatch = el.chatContainer.querySelector("mark.search-highlight");
    if (firstMatch) firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function highlightTextNodes(root, query) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentNode.tagName === "CODE" || node.parentNode.tagName === "PRE") continue;
      const idx = node.textContent.toLowerCase().indexOf(query);
      if (idx !== -1) matches.push({ node, idx });
    }
    // Process in reverse to avoid offset issues
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, idx } = matches[i];
      const before = node.textContent.slice(0, idx);
      const match = node.textContent.slice(idx, idx + query.length);
      const after = node.textContent.slice(idx + query.length);

      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = match;

      const parent = node.parentNode;
      if (after) parent.insertBefore(document.createTextNode(after), node.nextSibling);
      parent.insertBefore(mark, node.nextSibling);
      node.textContent = before;
    }
  }

  // --- Scroll to bottom button ---
  function updateScrollBottomButton() {
    if (!el.scrollBottomBtn) return;
    const nearBottom = isNearBottom();
    el.scrollBottomBtn.classList.toggle("visible", !nearBottom);
    if (nearBottom) {
      state.runtime.unreadCount = 0;
    }
    if (el.scrollBottomBadge) {
      el.scrollBottomBadge.textContent = state.runtime.unreadCount > 0 ? String(state.runtime.unreadCount) : "";
      el.scrollBottomBadge.hidden = state.runtime.unreadCount === 0;
    }
  }

  // --- Keyboard Shortcuts Modal ---
  function toggleShortcutsOverlay() {
    if (!el.shortcutsModal) return;
    const isHidden = el.shortcutsModal.hidden;
    el.shortcutsModal.hidden = !isHidden;
  }

  // --- Bookmark Modal ---
  function renderBookmarkList() {
    if (!el.bookmarkContent) return;
    el.bookmarkContent.innerHTML = "";

    const bookmarks = [];
    for (const session of state.sessions) {
      for (let i = 0; i < session.history.length; i++) {
        const msg = session.history[i];
        if (msg.bookmarked) {
          bookmarks.push({ sessionId: session.id, sessionTitle: session.title, index: i, message: msg });
        }
      }
    }

    if (bookmarks.length === 0) {
      el.bookmarkContent.innerHTML = '<p style="text-align:center;color:var(--color-neutral-400);padding:24px 0">ブックマークはありません。</p>';
      return;
    }

    for (const bm of bookmarks) {
      const item = document.createElement("div");
      item.style.cssText = "padding:10px;margin-bottom:8px;border:1px solid rgba(148,163,184,0.22);border-radius:10px;cursor:pointer;transition:background 0.15s";
      item.addEventListener("mouseenter", () => { item.style.background = "rgba(148,163,184,0.08)"; });
      item.addEventListener("mouseleave", () => { item.style.background = ""; });
      const preview = asString(bm.message.content).slice(0, 200);
      item.innerHTML =
        '<div style="font-size:11px;color:var(--color-neutral-400);margin-bottom:4px">' + escapeHtml(bm.sessionTitle) + "</div>" +
        '<div style="font-size:13px;line-height:1.45">' + escapeHtml(preview) + (bm.message.content.length > 200 ? "…" : "") + "</div>";
      item.addEventListener("click", () => {
        el.bookmarkModal.hidden = true;
        if (state.currentSessionId !== bm.sessionId) {
          switchConversationSession(bm.sessionId);
        }
        setTimeout(() => {
          const msgEl = el.chatContainer.querySelector('article[data-index="' + bm.index + '"]');
          if (msgEl) msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      });
      el.bookmarkContent.appendChild(item);
    }
  }

  function toggleBookmarkModal() {
    if (!el.bookmarkModal) return;
    if (el.bookmarkModal.hidden) {
      renderBookmarkList();
      el.bookmarkModal.hidden = false;
    } else {
      el.bookmarkModal.hidden = true;
    }
  }

  // --- TTS / Speech Synthesis ---

  function getTtsVoices() {
    if (!window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices();
  }

  function getJapaneseVoices() {
    return getTtsVoices().filter((v) => v.lang.startsWith("ja"));
  }

  function populateTtsVoiceSelect() {
    if (!el.ttsVoiceSelect) return;
    const voices = getJapaneseVoices();
    const allVoices = getTtsVoices();
    el.ttsVoiceSelect.innerHTML = "";

    if (voices.length === 0 && allVoices.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "音声なし";
      el.ttsVoiceSelect.appendChild(opt);
      return;
    }

    const grouped = [
      { label: "日本語", items: voices },
      { label: "その他", items: allVoices.filter((v) => !v.lang.startsWith("ja")) }
    ];

    for (const group of grouped) {
      if (group.items.length === 0) continue;
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      for (const voice of group.items) {
        const opt = document.createElement("option");
        opt.value = voice.name;
        opt.textContent = voice.name + " (" + voice.lang + ")";
        optgroup.appendChild(opt);
      }
      el.ttsVoiceSelect.appendChild(optgroup);
    }

    if (state.settings.ttsVoice) {
      el.ttsVoiceSelect.value = state.settings.ttsVoice;
    }
  }

  function stripMarkdownForTts(text) {
    return asString(text)
      .replace(/<[^>]*>/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/[*_~]{1,3}/g, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/^\s*>\s*/gm, "")
      .replace(/\|/g, " ")
      .replace(/---+/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function speakText(text, messageIndex) {
    const plainText = stripMarkdownForTts(text);
    if (!plainText) return;

    if (state.settings.ttsSummarize && state.settings.model) {
      setTtsStatus(messageIndex, "要約中…");
      summarizeForSpeech(plainText).then((summary) => {
        const finalText = summary || plainText;
        if (summary && messageIndex !== undefined) {
          showTtsSummary(messageIndex, summary);
        }
        dispatchTts(finalText, messageIndex);
      });
    } else {
      dispatchTts(plainText, messageIndex);
    }
  }

  function dispatchTts(text, messageIndex) {
    if (state.settings.ttsBackend === "qwen3") {
      speakTextWithQwen3(text, messageIndex);
    } else {
      speakTextWithBrowser(text);
      setTtsStatus(messageIndex, null);
    }
  }

  function setTtsStatus(messageIndex, statusText) {
    if (messageIndex === undefined) return;
    const wrap = el.chatContainer.querySelector(`article[data-index="${messageIndex}"]`);
    if (!wrap) return;
    let badge = wrap.querySelector(".tts-status-badge");
    if (!statusText) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "tts-status-badge";
      badge.style.cssText = "display:block;font-size:0.8em;color:var(--accent,#2196f3);padding:4px 8px;margin-top:4px;animation:tts-pulse 1.2s ease-in-out infinite;";
      const meta = wrap.querySelector(".msg-meta");
      if (meta) {
        meta.parentNode.insertBefore(badge, meta);
      } else {
        wrap.appendChild(badge);
      }
    }
    badge.textContent = statusText;
  }

  async function summarizeForSpeech(text) {
    const maxInput = 3000;
    const truncated = text.length > maxInput ? text.slice(0, maxInput) + "…" : text;

    const systemPrompt =
      "あなたは音声読み上げ用の要約アシスタントです。" +
      "ユーザーから渡されたテキストを、音声で聞いて理解しやすい簡潔な日本語にまとめてください。\n\n" +
      "ルール:\n" +
      "- マークダウン記法、箇条書き記号、コードブロックは使わない\n" +
      "- 自然な話し言葉で、句読点を適切に入れる\n" +
      "- 要点を漏らさず、冗長な表現は省く\n" +
      "- 出力は要約文のみ（前置き・説明不要）\n" +
      "- 200文字〜400文字程度を目安にまとめる";

    try {
      const resp = await fetch(`${getApiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
          model: state.settings.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: truncated }
          ],
          temperature: 0.3,
          max_tokens: 512,
          stream: false
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content?.trim();
      if (summary) {
        console.log("[TTS] Summarized for speech:", summary.slice(0, 80) + "...");
        return summary;
      }
      return null;
    } catch (err) {
      console.warn("[TTS] Summarization failed, using original text:", err.message);
      return null;
    }
  }

  function speakTextWithBrowser(plainText) {
    if (!window.speechSynthesis) return;
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = state.settings.ttsRate;
    utterance.lang = "ja-JP";

    const voices = getTtsVoices();
    if (state.settings.ttsVoice) {
      const selected = voices.find((v) => v.name === state.settings.ttsVoice);
      if (selected) utterance.voice = selected;
    } else {
      const japaneseVoice = voices.find((v) => v.lang.startsWith("ja"));
      if (japaneseVoice) utterance.voice = japaneseVoice;
    }

    utterance.onstart = () => { state.runtime.ttsSpeaking = true; };
    utterance.onend = () => { state.runtime.ttsSpeaking = false; state.runtime.ttsCurrentUtterance = null; };
    utterance.onerror = () => { state.runtime.ttsSpeaking = false; state.runtime.ttsCurrentUtterance = null; };

    state.runtime.ttsCurrentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  async function speakTextWithQwen3(plainText, messageIndex) {
    stopSpeaking();

    const url = (state.settings.qwen3TtsUrl || "http://localhost:8520").replace(/\/+$/, "");
    const truncated = plainText.length > 2000 ? plainText.slice(0, 2000) : plainText;

    state.runtime.ttsSpeaking = true;
    setTtsStatus(messageIndex, "音声生成中…");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const resp = await fetch(url + "/api/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: truncated,
          speaker: state.settings.qwen3TtsSpeaker || "ono_anna",
          language: "Japanese",
          format: "wav"
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error("Qwen3-TTS returned " + resp.status);
      }

      const blob = await resp.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      setTtsStatus(messageIndex, "再生中…");

      audio.onended = () => {
        state.runtime.ttsSpeaking = false;
        state.runtime.ttsAudioElement = null;
        URL.revokeObjectURL(audioUrl);
        setTtsStatus(messageIndex, null);
      };
      audio.onerror = () => {
        state.runtime.ttsSpeaking = false;
        state.runtime.ttsAudioElement = null;
        URL.revokeObjectURL(audioUrl);
        setTtsStatus(messageIndex, null);
        console.warn("[TTS] Qwen3 audio playback error, falling back to browser TTS");
        speakTextWithBrowser(plainText);
      };

      state.runtime.ttsAudioElement = audio;
      audio.play();
    } catch (err) {
      clearTimeout(timeoutId);
      state.runtime.ttsSpeaking = false;
      setTtsStatus(messageIndex, null);
      console.warn("[TTS] Qwen3-TTS failed, falling back to browser TTS:", err.message);
      speakTextWithBrowser(plainText);
    }
  }

  function stopSpeaking() {
    if (state.runtime.ttsAudioElement) {
      const audio = state.runtime.ttsAudioElement;
      const src = audio.src;
      audio.pause();
      audio.currentTime = 0;
      state.runtime.ttsAudioElement = null;
      if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    state.runtime.ttsSpeaking = false;
    state.runtime.ttsCurrentUtterance = null;
  }

  function toggleSpeakMessage(index) {
    const msg = state.history[index];
    if (!msg || msg.role !== "assistant") return;
    if (state.runtime.ttsSpeaking) {
      stopSpeaking();
      return;
    }
    speakText(msg.content, index);
  }

  function setTtsAutoReadEnabled(enabled, options) {
    options = options || { persist: true, reflectUI: true };
    state.settings.ttsAutoRead = !!enabled;
    if (enabled) state.settings.ttsEnabled = true;
    syncFeatureFlagsFromSettings();
    if (options.reflectUI) {
      if (el.ttsAutoReadInput) el.ttsAutoReadInput.checked = state.settings.ttsAutoRead;
      if (el.ttsEnabledInput) el.ttsEnabledInput.checked = state.settings.ttsEnabled;
    }
    updateModeButtons();
    updateSendKeyHint();
    if (options.persist) persistSettings();
  }

  function showTtsSummary(messageIndex, summaryText) {
    const wrap = el.chatContainer.querySelector(`article[data-index="${messageIndex}"]`);
    if (!wrap) return;

    let container = wrap.querySelector(".tts-summary-container");
    if (container) {
      const textEl = container.querySelector(".tts-summary-text");
      if (textEl) textEl.textContent = summaryText;
      container.hidden = false;
      return;
    }

    container = document.createElement("div");
    container.className = "tts-summary-container";
    container.style.cssText = "margin-top:4px;padding:6px 10px;border-left:3px solid var(--accent,#888);background:var(--bg-secondary,#f5f5f5);border-radius:4px;font-size:0.85em;";

    const toggle = document.createElement("span");
    toggle.className = "tts-summary-toggle";
    toggle.textContent = "音声用テキスト ▸";
    toggle.style.cssText = "cursor:pointer;color:var(--text-secondary,#888);user-select:none;font-size:0.85em;";

    const textEl = document.createElement("div");
    textEl.className = "tts-summary-text";
    textEl.textContent = summaryText;
    textEl.hidden = true;
    textEl.style.cssText = "margin-top:4px;color:var(--text-primary,#333);white-space:pre-wrap;";

    toggle.addEventListener("click", () => {
      textEl.hidden = !textEl.hidden;
      toggle.textContent = textEl.hidden ? "音声用テキスト ▸" : "音声用テキスト ▾";
    });

    container.appendChild(toggle);
    container.appendChild(textEl);

    const meta = wrap.querySelector(".msg-meta");
    if (meta) {
      wrap.insertBefore(container, meta);
    } else {
      wrap.appendChild(container);
    }
  }

  function updateTtsBackendVisibility() {
    const isQwen3 = state.settings.ttsBackend === "qwen3";
    if (el.browserTtsOptions) el.browserTtsOptions.hidden = isQwen3;
    if (el.qwen3TtsOptions) el.qwen3TtsOptions.hidden = !isQwen3;
  }

  async function checkQwen3TtsStatus() {
    if (!el.qwen3TtsStatus) return;
    const url = (state.settings.qwen3TtsUrl || "http://localhost:8520").replace(/\/+$/, "");
    el.qwen3TtsStatus.textContent = "接続確認中...";
    el.qwen3TtsStatus.style.color = "var(--text-secondary)";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const resp = await fetch(url + "/api/v1/status", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      state.runtime.ttsQwen3Available = true;
      const modelName = data.model_id ? data.model_id.split("/").pop() : "unknown";
      const device = data.device || "?";
      el.qwen3TtsStatus.textContent = "接続OK — モデル: " + modelName + " (" + device + ")";
      el.qwen3TtsStatus.style.color = "#4caf50";
    } catch (err) {
      clearTimeout(timeoutId);
      state.runtime.ttsQwen3Available = false;
      el.qwen3TtsStatus.textContent = "接続失敗 — サーバが起動していません";
      el.qwen3TtsStatus.style.color = "#f44336";
    }
  }

  // --- Markdown Export ---
  function exportCurrentSessionAsMarkdown() {
    if (!state.history.length) {
      alert("エクスポートする会話がありません。");
      return;
    }

    const session = state.sessions.find((s) => s.id === state.currentSessionId);
    const title = session ? session.title : "会話";
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    let md = `# ${title}\n\n`;
    md += `> エクスポート日時: ${now}\n`;
    md += `> モデル: ${state.settings.model || "未選択"}\n\n---\n\n`;

    for (const msg of state.history) {
      if (msg.role === "user") {
        md += `## User\n\n${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        md += `## Assistant\n\n${msg.content}\n\n`;
        if (msg.metrics) {
          const m = msg.metrics;
          const parts = [];
          if (m.totalTokens) parts.push(`${m.totalTokens} tokens`);
          if (m.tokensPerSecond) parts.push(`${m.tokensPerSecond.toFixed(1)} t/s`);
          if (m.elapsedMs) parts.push(`${(m.elapsedMs / 1000).toFixed(1)}秒`);
          if (parts.length) md += `> *${parts.join(" / ")}*\n\n`;
        }
      } else if (msg.role === "compare") {
        md += `## Compare\n\n### ${msg.modelA}\n\n${msg.contentA}\n\n### ${msg.modelB}\n\n${msg.contentB}\n\n`;
      } else if (msg.role === "system") {
        md += `> *System: ${msg.content}*\n\n`;
      }
      md += "---\n\n";
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===================================================================
  // Section 6: Model Handling
  // ===================================================================

  function isEmbeddingModel(id) {
    const lower = asString(id).toLowerCase();
    return EMBEDDING_KEYWORDS.some((k) => lower.includes(k));
  }

  function isVisionModel(id) {
    const lower = asString(id).toLowerCase();
    return VISION_KEYWORDS.some((k) => lower.includes(k));
  }

  function getVisibleModelsForSelectors() {
    const models = state.availableModels;
    if (state.settings.visibleModels === null) return models;

    const visibleSet = new Set(state.settings.visibleModels);
    return models.filter((model) => visibleSet.has(model.id));
  }

  function reconcileVisibleModelsWithAvailable() {
    if (state.settings.visibleModels === null) return;

    const allIds = new Set(state.availableModels.map((model) => model.id));
    const filtered = state.settings.visibleModels.filter((id) => allIds.has(id));

    let next = filtered;
    if (filtered.length === state.availableModels.length && state.availableModels.length > 0) {
      next = null;
    }

    const changed =
      next === null
        ? state.settings.visibleModels !== null
        : state.settings.visibleModels.length !== next.length ||
          state.settings.visibleModels.some((id, idx) => id !== next[idx]);

    if (!changed) return;
    state.settings.visibleModels = next;
    persistSettings();
  }

  function renderModelVisibilityManager() {
    if (!el.modelVisibilityList || !el.modelVisibilityCount) return;

    const models = state.availableModels;
    el.modelVisibilityList.innerHTML = "";

    if (models.length === 0) {
      const empty = document.createElement("p");
      empty.className = "model-visibility-list-empty";
      empty.textContent = "モデル一覧が未取得です。上部の「モデル更新」を押してください。";
      el.modelVisibilityList.appendChild(empty);
      el.modelVisibilityCount.textContent = "表示対象: 0 / 0";
      return;
    }

    const useAll = state.settings.visibleModels === null;
    const visibleSet = new Set(state.settings.visibleModels || []);
    let selectedCount = 0;

    for (const model of models) {
      const row = document.createElement("label");
      row.className = "model-visibility-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.modelId = model.id;
      checkbox.checked = useAll || visibleSet.has(model.id);
      if (checkbox.checked) selectedCount += 1;

      const text = document.createElement("span");
      text.textContent = model.displayLabel;

      row.appendChild(checkbox);
      row.appendChild(text);
      el.modelVisibilityList.appendChild(row);
    }

    if (useAll) {
      el.modelVisibilityCount.textContent = `表示対象: ${selectedCount} / ${models.length} (全表示)`;
    } else {
      el.modelVisibilityCount.textContent = `表示対象: ${selectedCount} / ${models.length}`;
    }
  }

  function getMemoryCategoryLabel(category) {
    switch (category) {
      case "profile":
        return "プロフィール";
      case "preference":
        return "好み";
      case "goal":
        return "目標";
      case "context":
        return "文脈";
      default:
        return "メモ";
    }
  }

  function renderMemoryList() {
    if (!el.memoryList || !el.memoryCount) return;

    const memories = state.memories;
    el.memoryList.innerHTML = "";
    el.memoryCount.textContent = `保存メモリー: ${memories.length}件`;

    if (!state.settings.memoryEnabled) {
      const disabled = document.createElement("p");
      disabled.className = "memory-list-empty";
      disabled.textContent = "メモリー機能はOFFです。";
      el.memoryList.appendChild(disabled);
      return;
    }

    if (memories.length === 0) {
      const empty = document.createElement("p");
      empty.className = "memory-list-empty";
      empty.textContent = "保存されたメモリーはありません。";
      el.memoryList.appendChild(empty);
      return;
    }

    for (const item of memories) {
      const row = document.createElement("div");
      row.className = "memory-item";

      const header = document.createElement("div");
      header.className = "memory-item-header";

      const badge = document.createElement("span");
      badge.className = "memory-item-category";
      badge.textContent = getMemoryCategoryLabel(item.category);

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn ghost icon-btn icon-only";
      removeBtn.type = "button";
      removeBtn.dataset.memoryId = item.id;
      removeBtn.setAttribute("data-tooltip", "削除");
      removeBtn.setAttribute("aria-label", "削除");
      removeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>';

      header.appendChild(badge);
      header.appendChild(removeBtn);

      const fact = document.createElement("p");
      fact.className = "memory-item-fact";
      fact.textContent = item.fact;

      row.appendChild(header);
      row.appendChild(fact);
      el.memoryList.appendChild(row);
    }
  }

  function applyVisibleModelsSetting(nextVisibleModels) {
    const allIds = state.availableModels.map((model) => model.id);
    const allIdSet = new Set(allIds);

    let normalized = null;
    if (nextVisibleModels !== null) {
      const requested = normalizeStringArray(nextVisibleModels);
      normalized = requested.filter((id) => allIdSet.has(id));
      if (normalized.length === allIds.length && allIds.length > 0) {
        normalized = null;
      }
    }

    state.settings.visibleModels = normalized;
    persistSettings();
    renderModelVisibilityManager();
    renderModelSelectsFromVisibleSetting();
  }

  function renderModelSelectsFromVisibleSetting() {
    const models = getVisibleModelsForSelectors();
    state.modelsById = new Map(models.map((model) => [model.id, model]));

    el.modelSelect.innerHTML = '<option value="">モデルを選択</option>';
    for (const model of models) {
      const opt = document.createElement("option");
      opt.value = model.id;
      opt.textContent = model.displayLabel;
      el.modelSelect.appendChild(opt);
    }

    if (state.settings.model && state.modelsById.has(state.settings.model)) {
      el.modelSelect.value = state.settings.model;
    } else {
      if (state.settings.model) {
        state.settings.model = "";
        persistSettings();
      }
      el.modelSelect.value = "";
    }

    renderCompareModelSelects(models);
  }

  function renderCompareModelSelects(models) {
    const currentA = state.compare.modelA;
    const currentB = state.compare.modelB;
    el.compareModelASelect.innerHTML = "";
    el.compareModelBSelect.innerHTML = "";

    for (const model of models) {
      const optA = document.createElement("option");
      optA.value = model.id;
      optA.textContent = model.id;
      el.compareModelASelect.appendChild(optA);

      const optB = document.createElement("option");
      optB.value = model.id;
      optB.textContent = model.id;
      el.compareModelBSelect.appendChild(optB);
    }

    if (models.length === 0) {
      state.compare.modelA = "";
      state.compare.modelB = "";
      return;
    }

    state.compare.modelA = models.some((m) => m.id === currentA) ? currentA : models[0].id;
    state.compare.modelB =
      models.some((m) => m.id === currentB) && currentB !== state.compare.modelA
        ? currentB
        : (models.find((m) => m.id !== state.compare.modelA) || models[0]).id;

    el.compareModelASelect.value = state.compare.modelA;
    el.compareModelBSelect.value = state.compare.modelB;
  }

  async function fetchModels() {
    const now = Date.now();
    if (now - state.runtime.lastModelRefreshAt < 3000) return;
    state.runtime.lastModelRefreshAt = now;

    const base = getApiBaseUrl();
    let models = [];

    try {
      const res = await fetch(`${base}/models`, { headers: getReadHeaders() });
      if (res.ok) {
        const data = await res.json();
        models = Array.isArray(data.data) ? data.data : [];
      }
    } catch {
      // ignore models fetch failures; UI keeps current state
    }

    const lmStudioStates = await syncLoadedModelStateFromLmStudio({ force: true, minIntervalMs: 0 });

    models = models
      .filter((m) => !isEmbeddingModel(m.id))
      .sort((a, b) => asString(a.id).localeCompare(asString(b.id)));

    const seenModelKeys = new Set();
    models = models.filter((model) => {
      const key = toModelKey(model.id);
      if (!key || seenModelKeys.has(key)) return false;
      seenModelKeys.add(key);
      return true;
    });

    state.availableModels = models.map((model) => {
      const ext = lmStudioStates.get(model.id);
      const stateIcon = isModelLoadedInfo(ext) ? "●" : "○";
      const vision = isVisionModel(model.id) ? " [Vision]" : "";
      const quant = ext?.quantization?.name || ext?.quantization || "";
      const quantLabel = quant ? ` (${quant})` : "";
      return {
        ...model,
        displayLabel: `${stateIcon} ${model.id}${vision}${quantLabel}`
      };
    });

    reconcileVisibleModelsWithAvailable();
    renderModelVisibilityManager();
    renderModelSelectsFromVisibleSetting();
  }

  async function maybeUnloadPreviousModel(prevModel, nextModel, options = {}) {
    const prev = toModelId(prevModel);
    const prevKey = toModelKey(prev);
    const next = toModelId(nextModel);
    const nextKey = toModelKey(next);
    const keepModels = normalizeStringArray(options.keepModels || []).map((m) => toModelKey(m));
    if (!state.settings.autoUnload || !prev || prevKey === nextKey) return;
    if (keepModels.includes(prevKey)) return;
    const nativeAvailable = await isLmStudioNativeModelApiAvailable();
    if (!nativeAvailable) return;

    const lmStudioStates = await syncLoadedModelStateFromLmStudio();
    const unloadTargets = [];
    for (const [id, info] of lmStudioStates.entries()) {
      if (toModelKey(id) !== prevKey) continue;
      if (!isModelLoadedInfo(info)) continue;
      unloadTargets.push(id);
    }
    if (!unloadTargets.length) return;

    for (const id of unloadTargets) {
      const ok = await unloadModelInstanceOnLmStudio(id);
      if (ok) {
        state.runtime.loadedModelIds.delete(id);
        state.runtime.loadingModelIds.delete(id);
      }
    }
    await syncLoadedModelStateFromLmStudio();
    state.runtime.loadedModelKeys.delete(prevKey);
    state.runtime.loadingModelKeys.delete(prevKey);
    state.runtime.modelLoadCooldownUntil.delete(prevKey);
  }

  async function maybeLoadModel(modelId, options = {}) {
    const { force = false } = options;
    const model = toModelId(modelId);
    const modelKey = toModelKey(model);

    if (!model) {
      setModelLoadStatus();
      return false;
    }

    const lmRoot = getLmStudioRoot();
    if (!lmRoot) {
      setModelLoadStatus("モデル読み込み先に接続できません。", "error", 3000);
      return false;
    }
    const nativeAvailable = await isLmStudioNativeModelApiAvailable();
    if (!nativeAvailable) {
      setModelLoadStatus();
      return true;
    }

    if (state.runtime.loadedModelIds.has(model) || state.runtime.loadedModelKeys.has(modelKey)) {
      return true;
    }

    const inflightTask = state.runtime.modelLoadTasks.get(modelKey);
    if (inflightTask) return inflightTask;

    const loadTask = (async () => {
      let alreadyLoaded = false;
      try {
        const lmStudioStates = await syncLoadedModelStateFromLmStudio({ force: true, minIntervalMs: 0 });
        if (state.runtime.lmStudioNativeApiAvailable === false) {
          setModelLoadStatus();
          return true;
        }
        alreadyLoaded = hasModelWithKeyByPredicate(lmStudioStates, model, isModelLoadedInfo);
        if (!alreadyLoaded && hasModelWithKeyByPredicate(lmStudioStates, model, isModelLoadingInfo)) {
          setModelLoadStatus("loading", "loading");
          const waited = await waitForModelLoaded(model, { timeoutMs: 120000, intervalMs: 2000 });
          if (waited) {
            state.runtime.loadedModelIds.add(model);
            state.runtime.loadedModelKeys.add(modelKey);
            await cleanupDuplicateLoadedInstancesByKey(modelKey);
            setModelLoadStatus("モデルの読み込みが完了しました。", "success", 1800);
          } else {
            setModelLoadStatus("モデルの読み込みに失敗しました。", "error", 3000);
          }
          return waited;
        }
      } catch {
        alreadyLoaded =
          state.runtime.loadedModelIds.has(model) || state.runtime.loadedModelKeys.has(modelKey);
      }
      if (alreadyLoaded) {
        state.runtime.loadedModelIds.add(model);
        state.runtime.loadedModelKeys.add(modelKey);
        await cleanupDuplicateLoadedInstancesByKey(modelKey);
        return true;
      }

      if (state.runtime.lmStudioNativeApiAvailable === false) {
        setModelLoadStatus();
        return true;
      }

      const now = Date.now();
      const cooldownUntil = Number(state.runtime.modelLoadCooldownUntil.get(modelKey) || 0);
      if (!force && cooldownUntil > now) return false;

      state.runtime.loadingModelIds.add(model);
      state.runtime.loadingModelKeys.add(modelKey);
      state.runtime.modelLoadCooldownUntil.set(modelKey, now + 20000);

      const requestId = state.runtime.modelLoadRequestId + 1;
      state.runtime.modelLoadRequestId = requestId;
      setModelLoadStatus("loading", "loading");

      try {
        const res = await fetch(`${lmRoot}/api/v1/models/load`, {
          method: "POST",
          headers: getJsonHeaders(),
          body: JSON.stringify({ model })
        });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }

        const loaded = await waitForModelLoaded(model, { timeoutMs: 45000, intervalMs: 2000 });
        if (!loaded) throw new Error("LOAD_TIMEOUT");

        state.runtime.loadedModelIds.add(model);
        state.runtime.loadedModelKeys.add(modelKey);
        await cleanupDuplicateLoadedInstancesByKey(modelKey);
        if (requestId === state.runtime.modelLoadRequestId) {
          setModelLoadStatus("モデルの読み込みが完了しました。", "success", 1800);
        }
        return true;
      } catch (err) {
        const status = Number(err?.status || 0);
        const recoverTimeoutMs = status === 400 || status === 409 || status === 423 ? 120000 : 15000;
        const recovered = await waitForModelLoaded(model, { timeoutMs: recoverTimeoutMs, intervalMs: 2000 });
        if (recovered) {
          state.runtime.loadedModelIds.add(model);
          state.runtime.loadedModelKeys.add(modelKey);
          if (requestId === state.runtime.modelLoadRequestId) {
            setModelLoadStatus("モデルの読み込みが完了しました。", "success", 1800);
          }
          return true;
        }

        state.runtime.modelLoadCooldownUntil.delete(modelKey);
        state.runtime.loadedModelIds.delete(model);
        state.runtime.loadedModelKeys.delete(modelKey);
        if (requestId === state.runtime.modelLoadRequestId) {
          setModelLoadStatus("モデルの読み込みに失敗しました。", "error", 3000);
        }
        return false;
      } finally {
        state.runtime.loadingModelIds.delete(model);
        state.runtime.loadingModelKeys.delete(modelKey);
      }
    })();

    state.runtime.modelLoadTasks.set(modelKey, loadTask);
    try {
      return await loadTask;
    } finally {
      if (state.runtime.modelLoadTasks.get(modelKey) === loadTask) {
        state.runtime.modelLoadTasks.delete(modelKey);
      }
    }
  }

  async function ensureModelReady(modelId) {
    const model = toModelId(modelId);
    const modelKey = toModelKey(model);
    if (!model) return false;

    if (state.runtime.loadedModelIds.has(model) || state.runtime.loadedModelKeys.has(modelKey)) {
      return true;
    }
    const inflightTask = state.runtime.modelLoadTasks.get(modelKey);
    if (inflightTask) {
      const loadedInFlight = await inflightTask;
      if (loadedInFlight) return true;
    }

    const lmRoot = getLmStudioRoot();
    if (!lmRoot) return true;
    const nativeAvailable = await isLmStudioNativeModelApiAvailable();
    if (!nativeAvailable) return true;

    try {
      if (await isModelLoadedOnLmStudio(model)) return true;
    } catch {
      // continue with active load attempt
    }

    const loaded = await maybeLoadModel(model, { force: true });
    if (loaded) return true;

    try {
      return await isModelLoadedOnLmStudio(model);
    } catch {
      return state.runtime.loadedModelIds.has(model) || state.runtime.loadedModelKeys.has(modelKey);
    }
  }

  // ===================================================================
  // Section 7: Attachments
  // ===================================================================

  function fileTooLarge(file, mb) {
    return file.size > mb * 1024 * 1024;
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(file);
    });
  }

  function compressImageIfNeeded(dataUrl, maxBytes, maxDim) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;
        const dataSize = dataUrl.length * 0.75;

        if (dataSize <= maxBytes && origW <= maxDim && origH <= maxDim) {
          resolve({ dataUrl, resized: false });
          return;
        }

        let w = origW;
        let h = origH;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        const qualities = [0.85, 0.7, 0.5, 0.3];
        for (const q of qualities) {
          const compressed = canvas.toDataURL("image/jpeg", q);
          if (compressed.length * 0.75 <= maxBytes) {
            resolve({ dataUrl: compressed, resized: true, width: w, height: h, quality: q });
            return;
          }
        }

        const finalUrl = canvas.toDataURL("image/jpeg", 0.2);
        resolve({ dataUrl: finalUrl, resized: true, width: w, height: h, quality: 0.2 });
      };
      img.onerror = () => resolve({ dataUrl, resized: false });
      img.src = dataUrl;
    });
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsText(file);
    });
  }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) {
      return `[PDF: ${file.name}] pdf.js未読込のためテキスト抽出をスキップ`;
    }

    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => item.str).join(" "));
    }

    return pages.join("\n");
  }

  function renderAttachments() {
    el.attachmentList.innerHTML = "";

    state.attachments.forEach((attachment, idx) => {
      const item = document.createElement("span");
      item.className = "attachment-item";

      if (attachment.kind === "image" && attachment.dataUrl) {
        const thumb = document.createElement("img");
        thumb.src = attachment.dataUrl;
        thumb.alt = attachment.name;
        thumb.className = "attachment-thumb";
        item.appendChild(thumb);
      }

      const label = document.createElement("span");
      label.className = "attachment-label";
      label.textContent = attachment.name;
      item.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn ghost icon-btn icon-only";
      removeBtn.setAttribute("data-tooltip", "添付削除");
      removeBtn.setAttribute("aria-label", "添付削除");
      removeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>';
      removeBtn.addEventListener("click", () => {
        state.attachments.splice(idx, 1);
        renderAttachments();
      });

      item.appendChild(removeBtn);
      el.attachmentList.appendChild(item);
    });
  }

  async function addFiles(files) {
    for (const file of files) {
      const mime = file.type || "";

      if (mime.startsWith("image/")) {
        const rawDataUrl = await readAsDataURL(file);
        const maxBytes = LIMITS.IMAGE_MB * 1024 * 1024;
        const result = await compressImageIfNeeded(rawDataUrl, maxBytes, LIMITS.IMAGE_MAX_DIMENSION);

        if (result.resized) {
          const origMB = (file.size / (1024 * 1024)).toFixed(1);
          const newMB = (result.dataUrl.length * 0.75 / (1024 * 1024)).toFixed(1);
          appendSystem(`画像「${file.name}」を自動圧縮しました（${origMB}MB → ${newMB}MB, ${result.width}x${result.height}px, quality=${result.quality}）。`);
        }

        state.attachments.push({ kind: "image", name: file.name, dataUrl: result.dataUrl });
        continue;
      }

      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (fileTooLarge(file, LIMITS.PDF_MB)) {
          appendSystem("PDFサイズ上限(10MB)を超えています。");
          continue;
        }

        const text = await extractPdfText(file);
        state.attachments.push({ kind: "text", name: file.name, text: text.slice(0, 40000) });
        continue;
      }

      if (fileTooLarge(file, LIMITS.TEXT_MB)) {
        appendSystem("テキストファイルサイズ上限(2MB)を超えています。");
        continue;
      }

      const text = await readAsText(file);
      state.attachments.push({ kind: "text", name: file.name, text: text.slice(0, 40000) });
    }

    renderAttachments();
  }

  // ===================================================================
  // Section 8: Conversation Building (Phase 2)
  // ===================================================================

  function getResponseStyleInstruction() {
    switch (state.settings.responseStyle) {
      case "concise":
        return "要点のみを簡潔に回答してください。箇条書きを優先してください。";
      case "detailed":
        return "背景、理由、具体例を含めて詳細に説明してください。";
      case "professional":
        return "技術的正確性を重視し、専門家向けの表現で回答してください。";
      case "standard":
      default:
        return "";
    }
  }

  function getUserProfileInstruction() {
    const rows = [];

    if (state.settings.userLevel) rows.push(`- 専門レベル: ${state.settings.userLevel}`);
    if (state.settings.userProfession) rows.push(`- 職業/専門分野: ${state.settings.userProfession}`);
    if (state.settings.userInterests) rows.push(`- 興味・関心: ${state.settings.userInterests}`);
    if (state.settings.userDisplayName) rows.push(`- 呼び名: ${state.settings.userDisplayName}`);

    const chunks = [];
    if (rows.length) chunks.push(`以下はあなたの会話相手（ユーザー）の情報です。あなた自身の情報ではありません。\n${rows.join("\n")}\nユーザーへの回答時に上記を考慮してください。自己紹介を求められた場合、この情報を自分のものとして述べないでください。`);
    if (state.settings.userDisplayName) {
      chunks.push(
        `ユーザーへの呼びかけが必要な場合は「${state.settings.userDisplayName}」という呼称を優先して使用してください。`
      );
    }
    return chunks.join("\n\n");
  }

  function getModeInstructions() {
    const chunks = [];

    if (state.featureFlags.deepDive) {
      chunks.push("深掘りモード: 重要な論点を分解し、検討すべき代替案・限界・次の確認事項も示してください。");
    }

    if (state.featureFlags.helpMode) {
      chunks.push(
        "ヘルプモード: アプリ操作に関する質問では、操作対象のUI要素名を明記し、番号付き手順で短く案内してください。操作質問でない場合のみ通常回答してください。"
      );
      chunks.push(
        `以下のアプリマニュアルに基づいて、画面に存在する要素名を優先して案内してください。\n\n${APP_MANUAL_CONTENT}`
      );
    }

    return chunks.join("\n");
  }

  function applyModeDirectivesToUserText(text) {
    let out = text || "";

    if (state.featureFlags.helpMode) {
      const helpDirective =
        "【ヘルプモード指示】この質問がアプリ操作に関する場合は、UI名を明記した番号付き手順（1.,2.,3.）で回答し、最後に確認ポイントを1行で示してください。";
      out = `${helpDirective}\n\n${out}`;
    }

    return out;
  }

  function pickMemoriesForPrompt(userText, maxItems = 12) {
    if (!state.settings.memoryEnabled || state.memories.length === 0) return [];

    const query = asString(userText).toLowerCase().trim();
    const queryTokens = query
      .split(/[\s、。,.!?！？]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 12);

    return state.memories
      .map((item, idx) => {
        let score = item.priority * 10 - idx;
        const factLower = item.fact.toLowerCase();
        if (query && (query.includes(factLower) || factLower.includes(query))) score += 60;
        for (const token of queryTokens) {
          if (factLower.includes(token)) score += 12;
        }
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map((entry) => entry.item);
  }

  function buildMemoryInstruction(userText) {
    const selected = pickMemoriesForPrompt(userText, 12);
    if (!selected.length) return "";

    const rows = selected.map((item) => `- (${getMemoryCategoryLabel(item.category)}) ${item.fact}`);
    return `以下はユーザーに関する保存済みメモリーです（あなた自身の情報ではありません）:\n${rows.join("\n")}\nユーザーへの回答に必要な範囲で参考にしてください。これらの情報をあなた自身の属性として述べないでください。`;
  }

  function buildSystemPrompt(userText = "", searchContext = "") {
    const chunks = [state.settings.systemPrompt.trim()];

    const responseStyleInstruction = getResponseStyleInstruction();
    if (responseStyleInstruction) chunks.push(responseStyleInstruction);

    const userProfileInstruction = getUserProfileInstruction();
    if (userProfileInstruction) chunks.push(userProfileInstruction);

    const modeInstructions = getModeInstructions();
    if (modeInstructions) chunks.push(modeInstructions);

    const memoryInstruction = buildMemoryInstruction(userText);
    if (memoryInstruction) chunks.push(memoryInstruction);

    if (searchContext) chunks.push(searchContext);

    return chunks.join("\n\n");
  }

  function buildApiMessages(
    userText,
    attachments,
    modelId = state.settings.model,
    options = { currentUserAlreadyInHistory: false, searchContext: "" }
  ) {
    const normalizedUserText = userText || "(添付のみ)";
    let historyItems = state.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.trim())
      .slice(-LIMITS.MAX_HISTORY_FOR_API * 2);

    // sendMessage() では先にユーザー発話を履歴へ追加するため、
    // 最新ユーザー入力と同一ならAPI履歴側から除外して二重投入を防ぐ。
    if (options.currentUserAlreadyInHistory && historyItems.length) {
      const tail = historyItems[historyItems.length - 1];
      if (tail.role === "user" && tail.content.trim() === normalizedUserText.trim()) {
        historyItems = historyItems.slice(0, -1);
      }
    }

    const historyForApi = historyItems.map((m) => ({ role: m.role, content: m.content }));

    let composedUserText = applyModeDirectivesToUserText(userText);

    const textAttachments = attachments
      .filter((a) => a.kind === "text")
      .map((a) => `\n[添付: ${a.name}]\n${a.text}`)
      .join("\n");

    if (textAttachments) {
      composedUserText += textAttachments;
    }

    const messages = [{ role: "system", content: buildSystemPrompt(userText, options.searchContext || "") }, ...historyForApi];

    const images = attachments.filter((a) => a.kind === "image");
    if (images.length && isVisionModel(modelId)) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: composedUserText || "(添付のみ)" },
          ...images.map((img) => ({ type: "image_url", image_url: { url: img.dataUrl } }))
        ]
      });
      return messages;
    }

    if (images.length) {
      composedUserText += `\n\n(画像 ${images.length} 枚添付。Vision対応モデルで解析可能)`;
    }

    messages.push({ role: "user", content: composedUserText || "(添付のみ)" });
    return messages;
  }

  function extractLogprobEntries(choice) {
    const entries = choice?.logprobs?.content;
    if (!Array.isArray(entries)) return [];

    return entries
      .map((entry) => ({
        token: asString(entry?.token).replace(/\n/g, "\\n"),
        logprob: Number.isFinite(entry?.logprob) ? Number(entry.logprob) : null,
        alternatives: Array.isArray(entry?.top_logprobs)
          ? entry.top_logprobs
              .slice(0, 3)
              .map((cand) => `${asString(cand?.token).replace(/\n/g, "\\n")} (${Number(cand?.logprob).toFixed(2)})`)
              .join(", ")
          : ""
      }))
      .filter((item) => item.token);
  }

  function parseJsonObjectFromText(text) {
    const raw = asString(text).trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // continue
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  function upsertMemories(saveList = [], removeList = []) {
    const removeSet = new Set(normalizeStringArray(removeList).map((s) => s.toLowerCase()));
    const byFact = new Map(state.memories.map((m) => [m.fact.toLowerCase(), m]));

    for (const key of removeSet) {
      byFact.delete(key);
    }

    for (const raw of saveList) {
      if (!raw || typeof raw !== "object") continue;
      const fact = asString(raw.fact).trim().replace(/\s+/g, " ");
      if (!fact || fact.length < 4 || fact.length > 220) continue;

      const lower = fact.toLowerCase();
      const now = new Date().toISOString();
      const existing = byFact.get(lower);
      const next = {
        id: existing?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        fact,
        category: ["profile", "preference", "goal", "context"].includes(raw.category) ? raw.category : "other",
        priority: Math.min(5, Math.max(1, Number(raw.priority) || existing?.priority || 3)),
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      byFact.set(lower, next);
    }

    state.memories = normalizeMemories(Array.from(byFact.values()));
    persistMemories();
    renderMemoryList();
  }

  async function maybeAutoGenerateTitle(modelId) {
    if (!state.settings.autoTitleEnabled || !modelId) return;

    const session = state.sessions.find((s) => s.id === state.currentSessionId);
    if (!session) return;
    if (session.autoTitled === false) return;

    const userMsgs = session.history.filter((m) => m.role === "user");
    const assistantMsgs = session.history.filter((m) => m.role === "assistant" && asString(m.content).trim());
    if (userMsgs.length !== 1 || assistantMsgs.length !== 1) return;

    const userText = asString(userMsgs[0].content).trim().slice(0, 500);
    const assistantText = asString(assistantMsgs[0].content).trim().slice(0, 500);
    if (!userText || userText === "(添付のみ)") return;

    try {
      const payload = {
        model: modelId,
        temperature: 0.3,
        max_tokens: 60,
        stream: false,
        messages: [
          { role: "system", content: "あなたはチャットタイトル生成器です。会話の内容から簡潔なタイトルを1行だけ出力してください。15〜25文字の日本語で、句読点・引用符・改行なし。タイトルのみを出力。" },
          { role: "user", content: "以下の会話にタイトルをつけてください:\nユーザー: " + userText + "\nアシスタント: " + assistantText }
        ]
      };

      const response = await fetch(getApiBaseUrl() + "/chat/completions", {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload)
      });
      if (!response.ok) return;

      const data = await response.json();
      let title = asString(data?.choices?.[0]?.message?.content).trim();
      if (!title || title.length < 3) return;

      title = title.replace(/^["「『]|["」』]$/g, "").replace(/\n/g, " ").trim().slice(0, 50);
      if (title.length < 3) return;

      const currentSession = state.sessions.find((s) => s.id === state.currentSessionId);
      if (!currentSession || currentSession.autoTitled === false) return;

      currentSession.title = title;
      currentSession.autoTitled = true;
      persistSessionStore();
      renderSessionList();
    } catch {
      // Auto-title failure should not affect chat flow
    }
  }

  async function maybeExtractMemoryFromTurn(userText, assistantText, modelId) {
    if (!state.settings.memoryEnabled) return;
    if (state.runtime.memoryExtracting) return;
    if (!modelId) return;

    const user = asString(userText).trim().slice(0, 2400);
    const assistant = asString(assistantText).trim().slice(0, 3200);
    if (!user || !assistant) return;

    state.runtime.memoryExtracting = true;
    try {
      const payload = {
        model: modelId,
        temperature: 0.1,
        max_tokens: 700,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "あなたは会話メモリー抽出器です。永続的に役立つユーザー情報だけを抽出してください。出力はJSONのみ。形式: {\"save\":[{\"fact\":\"...\",\"category\":\"profile|preference|goal|context|other\",\"priority\":1-5}],\"remove\":[\"...\"]}。一時的・推測・機微情報は保存しない。"
          },
          {
            role: "user",
            content: `ユーザー発話:\n${user}\n\nアシスタント応答:\n${assistant}`
          }
        ]
      };

      const res = await fetch(`${getApiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) return;

      const data = await res.json();
      const content = asString(data?.choices?.[0]?.message?.content);
      const parsed = parseJsonObjectFromText(content);
      if (!parsed || typeof parsed !== "object") return;

      const saveList = Array.isArray(parsed.save) ? parsed.save : [];
      const removeList = Array.isArray(parsed.remove) ? parsed.remove : [];
      upsertMemories(saveList, removeList);
    } catch {
      // memory extraction failure should not affect chat flow
    } finally {
      state.runtime.memoryExtracting = false;
    }
  }

  // ===================================================================
  // Section 9: Streaming / Send
  // ===================================================================

  function applyReasoningToPayload(payload) {
    const effort = state.settings.reasoningEffort;
    if (effort) payload.reasoning = { effort };
  }

  async function streamChatCompletion(payload, signal, onDelta) {
    const response = await fetch(`${getApiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payloadLine = line.slice(5).trim();
        if (payloadLine === "[DONE]") continue;

        try {
          const chunk = JSON.parse(payloadLine);
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content || "";
          const reasoning = choice?.delta?.reasoning || "";
          onDelta(delta, choice, reasoning);
        } catch {
          // Skip malformed chunks.
        }
      }
    }
  }

  async function fetchChatCompletionText(payload) {
    const response = await fetch(`${getApiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({ ...payload, stream: false })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return asString(data?.choices?.[0]?.message?.content);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function resetInputAfterSend() {
    state.attachments = [];
    renderAttachments();
    el.messageInput.value = "";
    saveToStorage(STORAGE_KEYS.DRAFT, { text: "" });
    resizeInput();
  }

  function appendUserMessage(inputText, attachmentSnapshot) {
    const previewImage = attachmentSnapshot.find((a) => a.kind === "image");
    const userMessage = {
      role: "user",
      content: inputText || "(添付のみ)",
      imageData: previewImage?.dataUrl,
      timestamp: new Date().toISOString()
    };
    state.history.push(userMessage);
    appendMessage(userMessage, state.history.length - 1);
  }

  function applyEditRollbackIfNeeded() {
    if (Number.isInteger(state.runtime.editingIndex) && state.runtime.editingIndex >= 0) {
      state.history = state.history.slice(0, state.runtime.editingIndex);
      state.runtime.editingIndex = null;
      persistHistory();
      renderHistory();
      updateSendKeyHint();
    }
  }

  async function searchWithSearXNG(query) {
    if (!state.featureFlags.webSearch) return null;
    const baseUrl = asString(state.settings.webSearchUrl, DEFAULT_SETTINGS.webSearchUrl).replace(/\/$/, "");
    const maxResults = state.settings.webSearchResults || 5;
    const categories = asString(state.settings.webSearchCategories, DEFAULT_SETTINGS.webSearchCategories) || "general";
    const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=${encodeURIComponent(categories)}&language=ja`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`SearXNG HTTP ${response.status}`);
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results.slice(0, maxResults) : [];
      if (results.length === 0) return null;
      return results.map((r, i) => ({
        index: i + 1,
        title: asString(r.title).trim(),
        url: asString(r.url).trim(),
        content: asString(r.content).trim()
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("[WebSearch] SearXNG query failed:", err.message);
      return null;
    }
  }

  function formatSearchResultsForPrompt(results) {
    if (!results || results.length === 0) return "";
    const lines = results.map(
      (r) => `[${r.index}] ${r.title}\n    URL: ${r.url}\n    ${r.content}`
    );
    return `【Web検索結果】以下はSearXNGから取得した最新のWeb検索結果です。回答に活用してください。\n各情報源を引用する際は必ず [番号](URL) の形式でMarkdownリンクとして記載してください。例: [1](https://example.com)\n\n${lines.join("\n\n")}`;
  }

  async function sendSingleModelMessage(inputText, attachmentSnapshot) {
    const selectedModel = el.modelSelect.value;
    if (!selectedModel) {
      alert("モデルを選択してください。");
      return;
    }

    const modelReady = await ensureModelReady(selectedModel);
    if (!modelReady) {
      throw new Error(`モデル読み込みに失敗しました: ${selectedModel}`);
    }

    state.settings.model = selectedModel;
    persistSettings();

    // --- Web Search ---
    let searchContext = "";
    if (state.featureFlags.webSearch && inputText) {
      const searchIndicator = document.createElement("div");
      searchIndicator.className = "web-search-indicator";
      searchIndicator.innerHTML = getThinkingIndicatorHtml("Web検索中...");
      el.chatContainer.appendChild(searchIndicator);
      smartScrollToBottom();
      const results = await searchWithSearXNG(inputText);
      searchIndicator.remove();
      if (results) {
        searchContext = formatSearchResultsForPrompt(results);
      } else {
        appendSystem("⚠ SearXNG に接続できませんでした。Web検索なしで応答します。");
      }
    }

    const apiMessages = buildApiMessages(inputText, attachmentSnapshot, selectedModel, {
      currentUserAlreadyInHistory: true,
      searchContext: searchContext
    });
    const payload = {
      model: selectedModel,
      messages: apiMessages,
      temperature: state.settings.temperature,
      max_tokens: state.settings.maxTokens,
      stream: true
    };
    if (state.featureFlags.showLogprobs) {
      payload.logprobs = true;
      payload.top_logprobs = 5;
    }
    applyReasoningToPayload(payload);

    const assistantMessage = {
      role: "assistant",
      content: "",
      reasoning: "",
      logprobs: [],
      interrupted: false,
      resumeModel: selectedModel,
      thinking: true,
      timestamp: new Date().toISOString()
    };
    state.history.push(assistantMessage);
    appendMessage(assistantMessage, state.history.length - 1);
    const assistantIndex = state.history.length - 1;

    state.runtime.abortController = new AbortController();

    // Initialize streaming metrics
    const sm = state.runtime.streamMetrics;
    sm.startTime = performance.now();
    sm.tokenCount = 0;
    sm.firstTokenTime = 0;
    sm.lastTokenTime = 0;

    try {
      await streamChatCompletion(payload, state.runtime.abortController.signal, (delta, choice, reasoning) => {
        if (reasoning) {
          state.history[assistantIndex].reasoning = (state.history[assistantIndex].reasoning || "") + reasoning;
          sm.tokenCount++;
          const now = performance.now();
          if (!sm.firstTokenTime) sm.firstTokenTime = now;
          sm.lastTokenTime = now;
          updateReasoningBlock(assistantIndex, state.history[assistantIndex].reasoning, true);
        }
        if (delta) {
          state.history[assistantIndex].content += delta;
          sm.tokenCount++;
          const now = performance.now();
          if (!sm.firstTokenTime) sm.firstTokenTime = now;
          sm.lastTokenTime = now;

          const node = el.chatContainer.querySelector(`article[data-index="${assistantIndex}"] > div`);
          if (node) node.innerHTML = renderMarkdown(state.history[assistantIndex].content);

          // Update live metrics display
          const elapsed = (now - sm.startTime) / 1000;
          const tps = elapsed > 0 ? sm.tokenCount / elapsed : 0;
          const wrap = el.chatContainer.querySelector(`article[data-index="${assistantIndex}"]`);
          if (wrap) {
            let live = wrap.querySelector(".msg-metrics-live");
            if (!live) {
              live = document.createElement("div");
              live.className = "msg-metrics-live";
              wrap.appendChild(live);
            }
            live.textContent = `${tps.toFixed(1)} t/s | ${sm.tokenCount} tokens | ${elapsed.toFixed(1)}秒`;
          }
        }

        if (state.featureFlags.showLogprobs) {
          const entries = extractLogprobEntries(choice);
          if (entries.length) {
            const current = state.history[assistantIndex].logprobs || [];
            state.history[assistantIndex].logprobs = current.concat(entries).slice(-120);
          }
        }

        smartScrollToBottom();
      });
      state.history[assistantIndex].interrupted = false;
      state.history[assistantIndex].thinking = false;

      // Finalize reasoning block label
      if (state.history[assistantIndex].reasoning) {
        updateReasoningBlock(assistantIndex, state.history[assistantIndex].reasoning, false);
      }

      // Save final metrics
      const finalElapsed = sm.lastTokenTime - sm.startTime;
      const tps = finalElapsed > 0 ? (sm.tokenCount / (finalElapsed / 1000)) : 0;
      state.history[assistantIndex].metrics = {
        totalTokens: sm.tokenCount,
        elapsedMs: Math.round(finalElapsed),
        tokensPerSecond: Math.round(tps * 10) / 10,
        timeToFirstTokenMs: Math.round(sm.firstTokenTime - sm.startTime)
      };
    } catch (err) {
      state.history[assistantIndex].interrupted = true;
      state.history[assistantIndex].thinking = false;
      throw err;
    }

    return { selectedModel, assistantIndex };
  }

  async function resumeAssistantAt(index) {
    if (state.runtime.streaming) return;
    let target = state.history[index];
    if (!target || target.role !== "assistant") return;
    if (!asString(target.content).trim()) return;

    const modelId = asString(target.resumeModel) || el.modelSelect.value || state.settings.model;
    if (!modelId) {
      alert("モデルを選択してください。");
      return;
    }

    const modelReady = await ensureModelReady(modelId);
    if (!modelReady) {
      appendSystem(`再開エラー: モデル読み込みに失敗しました (${modelId})`);
      return;
    }

    const historyForApi = state.history
      .slice(0, index + 1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    if (historyForApi.length === 0) return;

    target.interrupted = false;
    target.resumeModel = modelId;
    persistHistory();
    target = state.history[index];
    if (!target || target.role !== "assistant") return;
    target.thinking = true;
    renderHistory();

    state.runtime.streaming = true;
    el.sendBtn.disabled = true;
    el.stopBtn.disabled = false;
    state.runtime.abortController = new AbortController();

    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: buildSystemPrompt("") },
        ...historyForApi,
        {
          role: "user",
          content: "直前の回答の続きを、そのまま自然に続けてください。既に出力した文は繰り返さないでください。"
        }
      ],
      temperature: state.settings.temperature,
      max_tokens: state.settings.maxTokens,
      stream: true
    };
    applyReasoningToPayload(payload);

    try {
      await streamChatCompletion(payload, state.runtime.abortController.signal, (delta, _choice, reasoning) => {
        if (reasoning) {
          target.reasoning = (target.reasoning || "") + reasoning;
          updateReasoningBlock(index, target.reasoning, true);
        }
        if (!delta) return;
        target.content += delta;
        const node = el.chatContainer.querySelector(`article[data-index="${index}"] > div`);
        if (node) node.innerHTML = renderMarkdown(target.content);
        smartScrollToBottom();
      });
      target.interrupted = false;
      target.thinking = false;
    } catch (err) {
      target.interrupted = true;
      target.thinking = false;
      if (err?.name !== "AbortError") {
        appendSystem(`再開エラー: ${err.message}`);
      }
    } finally {
      persistHistory();
      renderHistory();
      state.runtime.streaming = false;
      state.runtime.abortController = null;
      state.runtime.compareAbortControllers = [];
      updateSendKeyHint();
      el.sendBtn.disabled = false;
      el.stopBtn.disabled = true;
    }
  }

  async function sendCompareMessage(inputText, attachmentSnapshot) {
    const modelA = el.compareModelASelect.value;
    const modelB = el.compareModelBSelect.value;
    const modelAKey = toModelKey(modelA);
    const modelBKey = toModelKey(modelB);
    if (!modelA || !modelB) {
      alert("比較モデルを2つ選択してください。");
      return;
    }
    if (modelAKey && modelBKey && modelAKey === modelBKey) {
      alert("Model A と Model B は異なるモデルを選択してください。");
      return;
    }

    const [readyA, readyB] = await Promise.all([ensureModelReady(modelA), ensureModelReady(modelB)]);

    state.compare.modelA = modelA;
    state.compare.modelB = modelB;

    // --- Web Search ---
    let searchContext = "";
    if (state.featureFlags.webSearch && inputText) {
      const searchIndicator = document.createElement("div");
      searchIndicator.className = "web-search-indicator";
      searchIndicator.innerHTML = getThinkingIndicatorHtml("Web検索中...");
      el.chatContainer.appendChild(searchIndicator);
      smartScrollToBottom();
      const results = await searchWithSearXNG(inputText);
      searchIndicator.remove();
      if (results) {
        searchContext = formatSearchResultsForPrompt(results);
      } else {
        appendSystem("⚠ SearXNG に接続できませんでした。Web検索なしで応答します。");
      }
    }

    const compareMessage = {
      role: "compare",
      modelA,
      modelB,
      contentA: readyA ? "" : `[エラー] モデル読み込みに失敗しました (${modelA})`,
      contentB: readyB ? "" : `[エラー] モデル読み込みに失敗しました (${modelB})`,
      thinkingA: readyA,
      thinkingB: readyB,
      timestamp: new Date().toISOString()
    };
    state.history.push(compareMessage);
    appendMessage(compareMessage, state.history.length - 1);
    const compareIndex = state.history.length - 1;

    const payloadA = {
      model: modelA,
      messages: buildApiMessages(inputText, attachmentSnapshot, modelA, {
        currentUserAlreadyInHistory: true,
        searchContext: searchContext
      }),
      temperature: state.settings.temperature,
      max_tokens: state.settings.maxTokens,
      stream: true
    };
    applyReasoningToPayload(payloadA);
    const payloadB = {
      model: modelB,
      messages: buildApiMessages(inputText, attachmentSnapshot, modelB, {
        currentUserAlreadyInHistory: true,
        searchContext: searchContext
      }),
      temperature: state.settings.temperature,
      max_tokens: state.settings.maxTokens,
      stream: true
    };
    applyReasoningToPayload(payloadB);

    const ctrlA = new AbortController();
    const ctrlB = new AbortController();
    state.runtime.compareAbortControllers = [ctrlA, ctrlB];

    const setCompareThinking = (side, thinking) => {
      const key = side === "a" ? "thinkingA" : "thinkingB";
      state.history[compareIndex][key] = thinking;
      const indicator = el.chatContainer.querySelector(
        `article[data-index="${compareIndex}"] .compare-${side} .thinking-indicator`
      );
      if (indicator) {
        indicator.remove();
      }
    };

    const runA = readyA
      ? streamChatCompletion(payloadA, ctrlA.signal, (delta) => {
          state.history[compareIndex].contentA += delta;
          updateCompareMessageCell(compareIndex, "a", state.history[compareIndex].contentA);
          smartScrollToBottom();
        }).finally(() => {
          setCompareThinking("a", false);
        })
      : Promise.resolve();

    const runB = readyB
      ? streamChatCompletion(payloadB, ctrlB.signal, (delta) => {
          state.history[compareIndex].contentB += delta;
          updateCompareMessageCell(compareIndex, "b", state.history[compareIndex].contentB);
          smartScrollToBottom();
        }).finally(() => {
          setCompareThinking("b", false);
        })
      : Promise.resolve();

    const [resultA, resultB] = await Promise.allSettled([runA, runB]);
    state.runtime.compareAbortControllers = [];

    const recoverCompareSide = async (side, payload, result) => {
      const key = side === "a" ? "contentA" : "contentB";
      if (asString(state.history[compareIndex][key]).trim()) return;
      if (result.status === "rejected" && result.reason?.name === "AbortError") return;

      let lastErr = result.status === "rejected" ? result.reason : null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const recovered = await fetchChatCompletionText(payload);
          if (asString(recovered).trim()) {
            state.history[compareIndex][key] = recovered;
            return;
          }
        } catch (err) {
          lastErr = err;
          const statusError = /HTTP\s+5\d\d/.test(asString(err?.message));
          if (!statusError || attempt === 1) break;
          await wait(450 * (attempt + 1));
        }
      }

      const errorMessage = asString(lastErr?.message || "unknown");
      if (errorMessage) {
        state.history[compareIndex][key] = `[エラー] ${errorMessage}`;
      } else {
        state.history[compareIndex][key] = "[応答を取得できませんでした。]";
      }
    };

    await recoverCompareSide("a", payloadA, resultA);
    await recoverCompareSide("b", payloadB, resultB);

    updateCompareMessageCell(compareIndex, "a", state.history[compareIndex].contentA);
    updateCompareMessageCell(compareIndex, "b", state.history[compareIndex].contentB);
  }

  async function sendMessage() {
    if (state.runtime.streaming) return;
    stopSpeaking();

    const inputText = el.messageInput.value.trim();
    const attachmentSnapshot = state.attachments.map((a) => ({ ...a }));
    if (!inputText && attachmentSnapshot.length === 0) return;

    const hasImages = attachmentSnapshot.some((a) => a.kind === "image");
    if (hasImages) {
      const modelsToCheck = isCompareModeActive()
        ? [el.compareModelASelect.value, el.compareModelBSelect.value].filter(Boolean)
        : [el.modelSelect.value].filter(Boolean);
      const nonVision = modelsToCheck.filter((id) => !isVisionModel(id));
      if (nonVision.length === modelsToCheck.length && modelsToCheck.length > 0) {
        appendSystem("⚠ 画像を解析するには Vision 対応モデルを選択してください（例: llava, qwen2-vl, gemma-3 など）。");
        return;
      }
    }

    applyEditRollbackIfNeeded();

    state.runtime.streaming = true;
    el.sendBtn.disabled = true;
    el.stopBtn.disabled = false;

    appendUserMessage(inputText, attachmentSnapshot);
    persistHistory();
    smartScrollToBottom(true);

    try {
      let singleResult = null;
      if (isCompareModeActive()) {
        await sendCompareMessage(inputText, attachmentSnapshot);
      } else {
        singleResult = await sendSingleModelMessage(inputText, attachmentSnapshot);
      }
      persistHistory();

      if (singleResult && state.settings.memoryEnabled) {
        const assistantMsg = state.history[singleResult.assistantIndex];
        if (assistantMsg?.role === "assistant" && asString(assistantMsg.content).trim()) {
          void maybeExtractMemoryFromTurn(inputText, assistantMsg.content, singleResult.selectedModel);
        }
      }

      if (singleResult) {
        void maybeAutoGenerateTitle(singleResult.selectedModel);
      }

      if (singleResult && state.featureFlags.ttsAutoRead) {
        const assistantMsg = state.history[singleResult.assistantIndex];
        if (assistantMsg?.role === "assistant" && asString(assistantMsg.content).trim()) {
          speakText(assistantMsg.content, singleResult.assistantIndex);
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        appendSystem(`送信エラー: ${err.message}`);
      }
      persistHistory();
    } finally {
      state.runtime.streaming = false;
      state.runtime.abortController = null;
      state.runtime.compareAbortControllers = [];
      state.runtime.editingIndex = null;
      updateSendKeyHint();
      el.sendBtn.disabled = false;
      el.stopBtn.disabled = true;
      resetInputAfterSend();
      renderHistory();
    }
  }

  function stopStreaming() {
    if (state.runtime.abortController) state.runtime.abortController.abort();
    for (const controller of state.runtime.compareAbortControllers) {
      controller.abort();
    }
    state.runtime.compareAbortControllers = [];
  }

  async function regenerateAssistantAt(index) {
    if (state.runtime.streaming || index <= 0) return;

    const prevUser = state.history[index - 1];
    if (!prevUser || prevUser.role !== "user") return;

    state.history = state.history.slice(0, index - 1);
    state.runtime.editingIndex = null;
    updateSendKeyHint();
    persistHistory();
    renderHistory();

    el.messageInput.value = prevUser.content === "(添付のみ)" ? "" : prevUser.content;
    resizeInput();

    await sendMessage();
  }

  function startNewTopic() {
    state.runtime.editingIndex = null;
    updateSendKeyHint();

    // Insert styled topic separator instead of system message
    const sep = document.createElement("div");
    sep.className = "topic-separator";
    sep.innerHTML = '<span class="separator-line"></span><span class="separator-text">新しい話題</span><span class="separator-line"></span>';
    el.chatContainer.appendChild(sep);
    smartScrollToBottom(true);

    // Still record as system message for history persistence
    const msg = { role: "system", content: "--- 新しい話題 ---" };
    state.history.push(msg);
    persistHistory();

    maybeAutoGreetForNewConversation({ force: true });
  }

  function maybeAutoGreetForNewConversation(options = {}) {
    const { force = false } = options;
    if (!state.settings.autoGreetingOnNewTopic) return false;
    const modelId = el.modelSelect.value || state.settings.model;
    if (!modelId) return false;
    if (!force && state.runtime.pendingAutoGreetingModelId !== modelId) return false;

    // consume once per model switch
    state.runtime.pendingAutoGreetingModelId = "";
    void sendAutoGreetingForNewTopic();
    return true;
  }

  async function sendAutoGreetingForNewTopic() {
    if (state.runtime.streaming) return;

    const modelId = el.modelSelect.value || state.settings.model;
    if (!modelId) return;
    const modelReady = await ensureModelReady(modelId);
    if (!modelReady) {
      setModelLoadStatus("モデル読み込みに失敗しました。", "error", 3000);
      return;
    }

    state.runtime.streaming = true;
    el.sendBtn.disabled = true;
    el.stopBtn.disabled = false;

    const assistantMessage = { role: "assistant", content: "", thinking: true };
    state.history.push(assistantMessage);
    appendMessage(assistantMessage, state.history.length - 1);
    const assistantIndex = state.history.length - 1;

    const payload = {
      model: modelId,
      temperature: Math.min(1, Math.max(0.2, state.settings.temperature)),
      max_tokens: Math.min(220, state.settings.maxTokens),
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt("") },
        {
          role: "user",
          content:
            "新規チャットが始まりました。ユーザーへ日本語で短く自然に挨拶し、続けて相談しやすい一言を添えてください。120文字以内。"
        }
      ]
    };

    state.runtime.abortController = new AbortController();
    try {
      await streamChatCompletion(payload, state.runtime.abortController.signal, (delta) => {
        if (!delta) return;
        state.history[assistantIndex].content += delta;
        const node = el.chatContainer.querySelector(`article[data-index="${assistantIndex}"] > div`);
        if (node) node.innerHTML = renderMarkdown(state.history[assistantIndex].content);
        smartScrollToBottom();
      });
      state.history[assistantIndex].thinking = false;
      persistHistory();
    } catch (err) {
      state.history[assistantIndex].thinking = false;
      if (err?.name !== "AbortError") {
        state.history[assistantIndex].content = "挨拶メッセージの生成に失敗しました。";
        persistHistory();
        renderHistory();
      }
    } finally {
      state.runtime.streaming = false;
      state.runtime.abortController = null;
      state.runtime.compareAbortControllers = [];
      updateSendKeyHint();
      el.sendBtn.disabled = false;
      el.stopBtn.disabled = true;
    }
  }

  function startFreshConversation() {
    if (state.runtime.streaming) return;
    createNewConversationSession({ activate: true });
  }

  function showTermCheckModal(checkResult) {
    let contentHtml = "";
    if (checkResult.issues && checkResult.issues.length > 0) {
      contentHtml = '<ul style="margin:0;padding-left:20px">';
      for (const issue of checkResult.issues) {
        contentHtml += `<li style="margin-bottom:8px">
          <strong style="color:#dc3545">${escapeHtml(issue.original || "")}</strong> &rarr;
          <strong style="color:#28a745">${escapeHtml(issue.suggested || "")}</strong>
          ${issue.reason ? `<br><small style="opacity:0.7">${escapeHtml(issue.reason)}</small>` : ""}
        </li>`;
      }
      contentHtml += "</ul>";
    } else {
      contentHtml = '<p style="color:#28a745;margin:0">AI応答の医学用語に問題は見つかりませんでした。</p>';
    }

    if (el.termCheckContent) el.termCheckContent.innerHTML = contentHtml;
    if (el.termCheckModal) el.termCheckModal.hidden = false;
  }

  async function runMedicalTermCheck(index) {
    if (state.runtime.streaming) return;

    const target = state.history[index];
    if (!target || target.role !== "assistant" || !target.content.trim()) return;

    const modelId = el.modelSelect.value || state.settings.model;
    if (!modelId) {
      alert("モデルを選択してください。");
      return;
    }

    appendSystem("医学用語をチェック中...");

    const checkPrompt = `あなたは医学用語の専門家です。以下のAI応答に含まれる医学用語をチェックし、誤りがあれば指摘してください。

AI応答テキスト:
"""
${target.content}
"""

以下のJSON形式で回答してください（他の文章は不要）:
{
  "hasIssues": true/false,
  "issues": [
    {
      "original": "誤った用語または表現",
      "suggested": "正しい用語または表現",
      "reason": "理由"
    }
  ]
}

注意:
- 明らかな誤りのみ指摘してください
- 医学的に不正確な記述や誤解を招く表現を重点的にチェック
- 問題がなければ hasIssues: false を返してください
- 必ず有効なJSONのみを返してください`;

    try {
      const res = await fetch(`${getApiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
          model: modelId,
          temperature: 0.3,
          max_tokens: 1024,
          stream: false,
          messages: [{ role: "user", content: checkPrompt }]
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const content = asString(data?.choices?.[0]?.message?.content);

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      const jsonStart = jsonStr.indexOf("{");
      const jsonEnd = jsonStr.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
      }

      const checkResult = JSON.parse(jsonStr);

      // Also store in history for persistence
      target.termCheck = checkResult.hasIssues
        ? checkResult.issues.map((i) => `${i.original} → ${i.suggested}: ${i.reason || ""}`).join("\n")
        : "重大な問題なし";

      showTermCheckModal(checkResult);
    } catch (err) {
      target.termCheck = `チェック失敗: ${err.message}`;
      appendSystem(`医学用語チェック失敗: ${err.message}`);
    }

    persistHistory();
  }

  // ===================================================================
  // Section 10: Events
  // ===================================================================

  function bindEvents() {
    el.settingsTabBasic.addEventListener("click", () => setSettingsTab("basic"));
    el.settingsTabPresets.addEventListener("click", () => setSettingsTab("presets"));
    el.settingsTabData.addEventListener("click", () => setSettingsTab("data"));
    el.settingsTabWebSearch.addEventListener("click", () => setSettingsTab("websearch"));
    el.settingsTabVoice.addEventListener("click", () => setSettingsTab("voice"));

    el.settingsBtn.addEventListener("click", () => {
      closePresetPopover();
      openSettings("basic");
    });
    el.closeSettingsBtn.addEventListener("click", closeSettings);
    el.overlay.addEventListener("click", closeSettings);

    const settingsChangeControls = [
      el.baseUrlInput,
      el.apiKeyInput,
      el.temperatureInput,
      el.maxTokensInput,
      el.sendKeySelect,
      el.autoGreetingOnNewTopicInput,
      el.responseStyleSelect,
      el.userLevelSelect,
      el.memoryEnabledInput,
      el.darkModeInput,
      el.autoUnloadInput,
      el.showLogprobsInput,
      el.deepDiveInput,
      el.helpModeInput,
      el.webSearchEnabledInput,
      el.webSearchCategoriesSelect,
      el.reasoningEffortSelect,
      el.hideThinkingInput,
      el.autoTitleInput,
      el.ttsEnabledInput,
      el.ttsAutoReadInput,
      el.ttsVoiceSelect,
      el.ttsBackendSelect,
      el.qwen3TtsSpeakerSelect,
      el.ttsSummarizeInput
    ];
    settingsChangeControls.forEach((control) => {
      if (!control) return;
      control.addEventListener("change", () => {
        saveSettingsFromUI();
        if (control === el.baseUrlInput || control === el.apiKeyInput) {
          fetchModels();
        }
      });
    });

    const settingsInputControls = [
      el.baseUrlInput,
      el.apiKeyInput,
      el.temperatureInput,
      el.maxTokensInput,
      el.systemPromptInput,
      el.userProfessionInput,
      el.userInterestsInput,
      el.userDisplayNameInput,
      el.webSearchUrlInput,
      el.webSearchResultsInput,
      el.qwen3TtsUrlInput
    ];
    settingsInputControls.forEach((control) => {
      if (!control) return;
      control.addEventListener("input", () => {
        scheduleSettingsSave();
      });
    });

    if (el.ttsBackendSelect) {
      el.ttsBackendSelect.addEventListener("change", () => {
        updateTtsBackendVisibility();
        if (state.settings.ttsBackend === "qwen3") {
          checkQwen3TtsStatus();
        }
      });
    }

    el.deepDiveBtn.addEventListener("click", () => {
      setDeepDiveEnabled(!state.settings.deepDive, { persist: true, reflectUI: true });
    });

    el.helpModeBtn.addEventListener("click", () => {
      setHelpModeEnabled(!state.settings.helpMode, { persist: true, reflectUI: true });
    });

    if (el.webSearchBtn) {
      el.webSearchBtn.addEventListener("click", () => {
        setWebSearchEnabled(!state.settings.webSearchEnabled, { persist: true, reflectUI: true });
      });
    }

    if (el.ttsAutoBtn) {
      el.ttsAutoBtn.addEventListener("click", () => {
        setTtsAutoReadEnabled(!state.settings.ttsAutoRead, { persist: true, reflectUI: true });
      });
    }

    if (el.ttsRateInput) {
      el.ttsRateInput.addEventListener("input", () => {
        if (el.ttsRateValue) el.ttsRateValue.textContent = el.ttsRateInput.value;
      });
    }

    el.compareModeBtn.addEventListener("click", () => {
      setCompareModeEnabled(!state.compare.enabled);
    });

    el.compareModelASelect.addEventListener("change", async () => {
      const prev = state.compare.modelA;
      const next = el.compareModelASelect.value;
      state.compare.modelA = next;
      if (prev === next) return;

      await maybeUnloadPreviousModel(prev, next, {
        keepModels: [state.compare.modelB, el.modelSelect.value || state.settings.model]
      });
      await maybeLoadModel(next);
    });
    el.compareModelBSelect.addEventListener("change", async () => {
      const prev = state.compare.modelB;
      const next = el.compareModelBSelect.value;
      state.compare.modelB = next;
      if (prev === next) return;

      await maybeUnloadPreviousModel(prev, next, {
        keepModels: [state.compare.modelA, el.modelSelect.value || state.settings.model]
      });
      await maybeLoadModel(next);
    });

    el.presetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePresetPopover();
    });

    el.openPresetManagerBtn.addEventListener("click", () => {
      closePresetPopover();
      openSettings("presets");
    });

    el.presetManageSelect.addEventListener("change", syncPresetManagerFieldsFromSelect);
    el.presetManageNewBtn.addEventListener("click", startNewPresetDraft);
    el.presetManageSaveBtn.addEventListener("click", saveManagedPreset);
    el.presetManageDeleteBtn.addEventListener("click", deleteManagedPreset);
    el.presetManageResetBtn.addEventListener("click", resetCustomPresets);

    el.systemPromptApplyBtn.addEventListener("click", applySelectedSystemPromptPreset);
    el.systemPromptSaveBtn.addEventListener("click", saveCurrentAsSystemPromptPreset);
    el.systemPromptDeleteBtn.addEventListener("click", deleteSelectedSystemPromptPreset);
    el.systemPromptPresetSelect.addEventListener("change", applySelectedSystemPromptPreset);

    if (el.exportHistoryBtn) {
      el.exportHistoryBtn.addEventListener("click", exportHistoryData);
    }

    if (el.importBtn) {
      el.importBtn.addEventListener("click", importHistory);
    }

    if (el.importInput) {
      el.importInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleImportFile(file);
      });
    }

    if (el.resetSettingsBtn) {
      el.resetSettingsBtn.addEventListener("click", resetSettings);
    }

    if (el.clearAllDataBtn) {
      el.clearAllDataBtn.addEventListener("click", clearAllData);
    }

    // Temperature slider realtime value display
    if (el.temperatureInput && el.tempValue) {
      el.temperatureInput.addEventListener("input", () => {
        el.tempValue.textContent = el.temperatureInput.value;
      });
    }

    // Term check modal close
    if (el.termCheckCloseBtn) {
      el.termCheckCloseBtn.addEventListener("click", () => {
        if (el.termCheckModal) el.termCheckModal.hidden = true;
      });
    }
    if (el.termCheckModal) {
      el.termCheckModal.addEventListener("click", (e) => {
        if (e.target === el.termCheckModal) el.termCheckModal.hidden = true;
      });
    }

    if (el.createSessionBtn) {
      el.createSessionBtn.addEventListener("click", startFreshConversation);
    }

    if (el.sessionList) {
      el.sessionList.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const actionBtn = target.closest("button[data-session-action][data-session-id]");
        if (!actionBtn) return;

        const action = actionBtn.getAttribute("data-session-action");
        const sessionId = actionBtn.getAttribute("data-session-id");
        if (!sessionId) return;

        if (action === "open") {
          switchConversationSession(sessionId);
          return;
        }
        if (action === "delete") {
          deleteConversationSession(sessionId);
        }
      });
    }

    if (el.clearMemoriesBtn) {
      el.clearMemoriesBtn.addEventListener("click", () => {
        if (!confirm("保存メモリーをすべて削除しますか？")) return;
        state.memories = [];
        persistMemories();
        renderMemoryList();
      });
    }

    if (el.memoryList) {
      el.memoryList.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest("button[data-memory-id]");
        if (!btn) return;

        const memoryId = btn.getAttribute("data-memory-id");
        if (!memoryId) return;
        state.memories = state.memories.filter((item) => item.id !== memoryId);
        persistMemories();
        renderMemoryList();
      });
    }

    if (el.modelVisibilityList) {
      el.modelVisibilityList.addEventListener("change", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;

        const modelId = target.dataset.modelId;
        if (!modelId) return;

        const allIds = state.availableModels.map((model) => model.id);
        const selectedSet = new Set(state.settings.visibleModels === null ? allIds : state.settings.visibleModels);
        if (target.checked) {
          selectedSet.add(modelId);
        } else {
          selectedSet.delete(modelId);
        }

        applyVisibleModelsSetting(Array.from(selectedSet));
      });
    }

    if (el.modelVisibilitySelectAllBtn) {
      el.modelVisibilitySelectAllBtn.addEventListener("click", () => {
        applyVisibleModelsSetting(null);
      });
    }

    if (el.modelVisibilityClearBtn) {
      el.modelVisibilityClearBtn.addEventListener("click", () => {
        applyVisibleModelsSetting([]);
      });
    }

    el.refreshModelsBtn.addEventListener("click", fetchModels);
    el.modelSelect.addEventListener("mousedown", fetchModels);
    el.modelSelect.addEventListener("change", async () => {
      const prev = state.settings.model;
      const next = el.modelSelect.value;
      await maybeUnloadPreviousModel(prev, next, {
        keepModels: [state.compare.modelA, state.compare.modelB]
      });
      await maybeLoadModel(next);

      state.settings.model = next;
      persistSettings();

      if (prev !== next) {
        state.runtime.pendingAutoGreetingModelId = next || "";
      }
    });

    el.sendBtn.addEventListener("click", sendMessage);
    el.stopBtn.addEventListener("click", stopStreaming);
    el.newTopicBtn.addEventListener("click", startNewTopic);
    if (el.newChatBtn) {
      el.newChatBtn.addEventListener("click", startFreshConversation);
    }
    if (el.sessionLogsBtn) {
      el.sessionLogsBtn.addEventListener("click", () => {
        closePresetPopover();
        openSettings("data");
      });
    }

    el.messageInput.addEventListener("input", () => {
      resizeInput();
      scheduleDraftSave();
      updateTokenEstimate();
    });

    el.messageInput.addEventListener("compositionstart", () => {
      state.runtime.composingText = true;
    });

    el.messageInput.addEventListener("compositionend", () => {
      state.runtime.composingText = false;
    });

    el.messageInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      // IME変換確定のEnterでは送信しない
      if (e.isComposing || state.runtime.composingText || e.keyCode === 229) return;
      const enterSends = state.settings.sendKey === "enter-send";

      if (enterSends && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
      }

      if (!enterSends && e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // --- v2.0 Event Bindings ---

    // Search
    if (el.searchBtn) {
      el.searchBtn.addEventListener("click", openSearchBar);
    }
    if (el.searchCloseBtn) {
      el.searchCloseBtn.addEventListener("click", closeSearchBar);
    }
    if (el.searchInput) {
      el.searchInput.addEventListener("input", performSearch);
      el.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSearchBar();
      });
    }

    // Scroll-to-bottom button
    if (el.scrollBottomBtn) {
      el.scrollBottomBtn.addEventListener("click", () => {
        smartScrollToBottom(true);
        state.runtime.unreadCount = 0;
        updateScrollBottomButton();
      });
    }
    if (el.chatMain) {
      el.chatMain.addEventListener("scroll", updateScrollBottomButton);
    }

    // Markdown export
    if (el.exportMarkdownBtn) {
      el.exportMarkdownBtn.addEventListener("click", exportCurrentSessionAsMarkdown);
    }

    // Shortcuts modal
    if (el.shortcutsCloseBtn) {
      el.shortcutsCloseBtn.addEventListener("click", () => {
        if (el.shortcutsModal) el.shortcutsModal.hidden = true;
      });
    }
    if (el.shortcutsModal) {
      el.shortcutsModal.addEventListener("click", (e) => {
        if (e.target === el.shortcutsModal) el.shortcutsModal.hidden = true;
      });
    }

    // Bookmark modal
    if (el.bookmarkCloseBtn) {
      el.bookmarkCloseBtn.addEventListener("click", () => {
        if (el.bookmarkModal) el.bookmarkModal.hidden = true;
      });
    }
    if (el.bookmarkModal) {
      el.bookmarkModal.addEventListener("click", (e) => {
        if (e.target === el.bookmarkModal) el.bookmarkModal.hidden = true;
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePresetPopover();
        closeSettings();
        if (state.runtime.searchActive) closeSearchBar();
        if (el.shortcutsModal && !el.shortcutsModal.hidden) el.shortcutsModal.hidden = true;
        if (el.bookmarkModal && !el.bookmarkModal.hidden) el.bookmarkModal.hidden = true;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        startFreshConversation();
      }

      // Cmd/Ctrl+F: Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearchBar();
      }

      // Cmd/Ctrl+/: Shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        toggleShortcutsOverlay();
      }

      // Cmd/Ctrl+,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        openSettings("basic");
      }

      // Cmd/Ctrl+Shift+D: Dark mode toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (el.darkModeInput) {
          el.darkModeInput.checked = !el.darkModeInput.checked;
          saveSettingsFromUI();
        }
      }

      // Cmd/Ctrl+Shift+C: Compare mode toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCompareModeEnabled(!state.compare.enabled);
      }

      // Cmd/Ctrl+Shift+W: Web search toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        setWebSearchEnabled(!state.settings.webSearchEnabled, { persist: true, reflectUI: true });
      }

      // Cmd/Ctrl+Shift+B: Bookmark list
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleBookmarkModal();
      }

      // Cmd/Ctrl+Shift+T: TTS auto-read toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setTtsAutoReadEnabled(!state.settings.ttsAutoRead, { persist: true, reflectUI: true });
      }
    });

    el.fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      await addFiles(files);
      e.target.value = "";
    });

    document.addEventListener("paste", async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);

      if (imageFiles.length) await addFiles(imageFiles);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
      });
    });

    window.addEventListener("drop", async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) await addFiles(files);
    });

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const insidePopover = el.presetPopover.contains(target);
      const clickedPresetBtn = el.presetBtn.contains(target);
      if (!insidePopover && !clickedPresetBtn) {
        closePresetPopover();
      }

      // Global code block copy handler (for compare mode and streamed content)
      if (target instanceof Element) {
        const copyBtn = target.closest(".code-header__copy");
        if (copyBtn) {
          const pre = copyBtn.closest(".md-code");
          const codeEl = pre?.querySelector("code");
          if (codeEl) {
            navigator.clipboard.writeText(codeEl.textContent || "").then(() => {
              copyBtn.textContent = "Copied!";
              setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
            });
          }
        }
      }
    });
  }

  // ===================================================================
  // Section 11: Init
  // ===================================================================

  function init() {
    loadSettings();
    loadPresetMaps();
    loadMemories();
    loadConversationSessions();

    const draft = loadWithLegacyFallback(STORAGE_KEYS.DRAFT, LEGACY_STORAGE_KEYS.DRAFT, { text: "" });

    applySettingsToUI();
    setSettingsTab("basic");
    renderHistory();
    renderPresetUI();
    closePresetPopover();

    el.messageInput.value = asString(draft?.text, "");
    resizeInput();

    bindEvents();
    fetchModels();

    populateTtsVoiceSelect();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { populateTtsVoiceSelect(); };
    }
    updateTtsBackendVisibility();
    if (state.settings.ttsBackend === "qwen3") {
      checkQwen3TtsStatus();
    }

    if (state.history.length === 0) {
      appendSystem("ローカルLLMチャットへようこそ。モデルを選択して開始してください。");
    } else {
      renderSessionList();
    }
  }

  init();
})();
