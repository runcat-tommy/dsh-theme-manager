/**
 * dsh-theme-manager, browser half.
 *
 * Two-level theme manager for the DeepSeek Harness Web UI:
 *   layer 1 — culture / scene (中国 / 日本 / 节庆 / 通用氛围)
 *   layer 2 — concrete style   (水墨 / 浮世绘 / 苏州园林 / …)
 *
 * Each style is a real theme registered through the `theme` service
 * (alias-layer `--dsw-alias-*` token overrides over a base palette), so it
 * shows up as an extra selectable theme in the built-in Appearance row too.
 * The two-level picker lives in a dedicated Settings page
 * (`settings.section`). The active style is remembered in localStorage
 * (per-browser) and re-applied on boot; switching to any built-in
 * appearance (light / dark / system) via the Appearance row clears it.
 *
 * Hand-written ModuleLoader bundle (no build step). Locale-aware copy
 * follows the DSH UI language via the `locale` service (zh / en).
 */

window.__ModuleLoader__.load({
  id: "dsh-theme-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");

    var NS = "themeManager";
    var STORAGE_KEY = "dsh.themeManager.active";
    var STORAGE_VERSION = 1;

    /* ----------------------------- palette ----------------------------- */

    /** #rrggbb → rgba(r, g, b, a). */
    function rgba(hex, a) {
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
    }

    /** Linear RGB mix: t = 0 → a, t = 1 → b. Both colors must be #rrggbb. */
    function mix(a, b, t) {
      function ch(i) {
        var from = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16);
        var to = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
        var v = Math.round(from + (to - from) * t);
        return (v < 0 ? 0 : v > 255 ? 255 : v).toString(16).padStart(2, "0");
      }
      return "#" + ch(0) + ch(1) + ch(2);
    }

    /** Mix toward black. */
    function shade(hex, f) { return mix(hex, "#000000", f); }

    /** Mix toward white. */
    function tint(hex, f) { return mix(hex, "#ffffff", f); }

    /**
     * Expand a compact style spec (~30 core colors) into the full alias-token
     * map the theme service expects. Alpha-based tokens are derived from the
     * core colors so every palette stays internally coherent. Token names and
     * semantics follow @deepseek-ai/dsh-client-ui-theme design-platform.css.
     */
    function palette(s) {
      var label1 = s.label1;
      return {
        "--dsw-alias-bg-base": s.base,
        "--dsw-alias-bg-layer-1": s.layer1,
        "--dsw-alias-bg-layer-2": s.layer2,
        "--dsw-alias-bg-layer-3": s.layer3,
        "--dsw-alias-bg-overlay": s.overlay,
        "--dsw-alias-bg-module-platform": s.platform || s.layer2,
        "--dsw-alias-bg-multi-select": s.platform || s.layer2,
        "--dsw-alias-bg-skeleton": rgba(label1, 0.06),
        "--dsw-alias-border-l1": rgba(label1, 0.08),
        "--dsw-alias-border-l2": rgba(label1, 0.15),
        "--dsw-alias-border-l3": rgba(label1, 0.2),
        "--dsw-alias-border-l4": rgba(label1, 0.26),
        "--dsw-alias-border-inverted": "rgba(255, 255, 255, 0.08)",
        "--dsw-alias-border-inverted2": "rgba(255, 255, 255, 0.1)",
        "--dsw-alias-label-primary": label1,
        "--dsw-alias-label-secondary": s.label2,
        "--dsw-alias-label-tertiary": s.label3,
        "--dsw-alias-label-caption": s.label3,
        "--dsw-alias-label-dimmed": s.dimmed,
        "--dsw-alias-label-primary-foreground": s.onDark,
        "--dsw-alias-label-primary-inverted": s.onDark,
        "--dsw-alias-label-primary-bluish": label1,
        "--dsw-alias-label-primary-dimmed": s.label2,
        "--dsw-alias-brand-primary": s.brand,
        "--dsw-alias-brand-primary-invert": s.onDark,
        "--dsw-alias-brand-text": label1,
        "--dsw-alias-button-primary-fill": s.btnPrimary,
        "--dsw-alias-button-primary-hover": s.btnPrimaryHover,
        "--dsw-alias-button-primary-dimmed": s.btnPrimaryDimmed,
        "--dsw-alias-button-info-fill": s.btnInfo,
        "--dsw-alias-button-info-hover": s.btnInfoHover,
        "--dsw-alias-button-contrast-fill": s.label2,
        "--dsw-alias-button-elevated-fill": s.overlay,
        "--dsw-alias-button-floating-fill": s.overlay,
        "--dsw-alias-button-floating-hover": s.layer2,
        "--dsw-alias-button-ghost-active-fill": s.layer3,
        "--dsw-alias-button-ghost-active-hover": s.layer2,
        "--dsw-alias-button-ghost-active-border": s.label3,
        "--dsw-alias-button-tool-bar-fill": rgba(label1, 0.5),
        "--dsw-alias-button-tool-bar-fill-invisible": "rgba(31, 31, 31, 0.36)",
        "--dsw-alias-button-tool-bar-hover": rgba(label1, 0.6),
        "--dsw-alias-interactive-bg-hover": rgba(label1, 0.06),
        "--dsw-alias-interactive-bg-active": rgba(label1, 0.1),
        "--dsw-alias-interactive-bg-hover-accent": rgba(s.brand, 0.12),
        "--dsw-alias-interactive-bg-hover-danger": rgba(s.error, 0.06),
        "--dsw-alias-interactive-bg-hover-solid": s.platform || s.layer2,
        "--dsw-alias-state-business-primary": s.brand,
        "--dsw-alias-state-business-tertiary": s.brandTertiary,
        "--dsw-alias-state-error-primary": s.error,
        "--dsw-alias-state-error-secondary": s.error2,
        "--dsw-alias-state-success-primary": s.success,
        "--dsw-alias-state-success-secondary": s.success2,
        "--dsw-alias-state-success-tertiary": s.success3,
        "--dsw-alias-state-warn-primary": s.warn,
        "--dsw-alias-state-warn-secondary": s.warn2,
        "--dsw-alias-state-warn-tertiary": s.warn3,
        "--dsw-alias-state-warn-label": s.warnLabel,
        "--dsw-alias-markdown-code-block": s.platform || s.layer2,
        "--dsw-alias-markdown-code-block-banner": s.layer3,
        "--dsw-alias-markdown-inline-code": s.layer3,
        "--dsw-alias-markdown-code-segment-selected": s.overlay,
        "--dsw-alias-markdown-code-segment-unselected": s.layer3,
        "--dsw-alias-markdown-citation": s.layer3,
        "--dsw-alias-markdown-placeholder": s.platform || s.layer2,
        "--dsw-alias-markdown-tag": s.layer3,
        "--dsw-specific-bubble": s.bubble,
        "--dsw-specific-bubble-highlight": s.bubbleHi,
        "--dsw-specific-input-major": s.input || s.overlay,
        "--dsw-specific-login-input": s.platform || s.layer2,
        "--dsw-specific-menu": s.overlay,
        "--dsw-specific-selector": s.platform || s.layer2,
        "--dsw-specific-sidebar-fill": s.sidebar,
        "--dsw-specific-sidebar-nav-item-active": s.sidebarActive,
        "--dsw-specific-sidebar-nav-item-active-accent": s.sidebarAccent,
        "--dsw-specific-sidebar-nav-item-hover": s.sidebarHover,
        "--dsw-specific-tip": s.platform || s.layer2,
        "--dsw-alias-toast-bg": s.toast,
        "--dsw-alias-tooltip-bg": s.toast,
        "--dsw-alias-scrollbar-bg-l1": rgba(label1, 0.18),
        "--dsw-alias-scrollbar-bg-l2": rgba(label1, 0.22),
        "--dsw-alias-scrollbar-hover-l1": rgba(label1, 0.32),
        "--dsw-alias-scrollbar-hover-l2": rgba(label1, 0.38)
      };
    }

    /**
     * One style = one registered theme. `spec` is the compact palette spec;
     * `tokens` are derived by palette(). `swatch` mirrors base / layer2 /
     * brand / label1 for the card preview.
     */
    var STYLES = [
      /* ------------------------------ 中国 ------------------------------ */
      {
        id: "ink-wash",
        category: "china",
        colorScheme: "light",
        labelKey: "style.inkWash",
        descKey: "style.inkWashDesc",
        swatch: ["#f6f2e7", "#f3eee0", "#a63c2c", "#2b2926"],
        spec: {
          base: "#f6f2e7", layer1: "#faf7ee", layer2: "#f3eee0", layer3: "#ece5d1", overlay: "#fbf8f0", platform: "#f0ead9",
          label1: "#2b2926", label2: "#514d46", label3: "#79746a", dimmed: "#b0a996", onDark: "#faf7ee",
          brand: "#a63c2c",
          btnPrimary: "#2b2926", btnPrimaryHover: "#45403a", btnPrimaryDimmed: "#e9e2ce",
          btnInfo: "#a63c2c", btnInfoHover: "#bc4a37",
          brandTertiary: "#ecd9c8",
          error: "#a63c2c", error2: "#c05a45",
          success: "#4a6f4d", success2: "#5f8a63", success3: "#e2ead9",
          warn: "#a8762e", warn2: "#c2913f", warn3: "#f0e3c2", warnLabel: "#8a5f1f",
          bubble: "#ece5d1", bubbleHi: "#e0d5b4",
          sidebar: "#f0ead9", sidebarActive: "#e7dfc9", sidebarAccent: "#d8c9a3", sidebarHover: "#ebe4d0",
          toast: "#3a3733"
        }
      },
      {
        id: "suzhou-garden",
        category: "china",
        colorScheme: "light",
        labelKey: "style.suzhouGarden",
        descKey: "style.suzhouGardenDesc",
        swatch: ["#f4f1e8", "#efead9", "#4a7c59", "#2f2f2a"],
        spec: {
          base: "#f4f1e8", layer1: "#faf7ef", layer2: "#efead9", layer3: "#e5dec8", overlay: "#fdfbf4", platform: "#efe9d7",
          label1: "#2f2f2a", label2: "#56544a", label3: "#7d7a6c", dimmed: "#a9a491", onDark: "#faf7ef",
          brand: "#4a7c59",
          btnPrimary: "#2f2f2a", btnPrimaryHover: "#46443c", btnPrimaryDimmed: "#e2dcc6",
          btnInfo: "#4a7c59", btnInfoHover: "#5b8f6a",
          brandTertiary: "#dce6d4",
          error: "#a34a32", error2: "#c05a3e",
          success: "#3f7a4e", success2: "#55906a", success3: "#dce8d2",
          warn: "#a8762e", warn2: "#c2913f", warn3: "#f0e3c2", warnLabel: "#8a5f1f",
          bubble: "#e8e2cf", bubbleHi: "#dcd4b8",
          sidebar: "#eee9d8", sidebarActive: "#e3dcc4", sidebarAccent: "#c6bb97", sidebarHover: "#e9e3cf",
          toast: "#2f2f2a"
        }
      },
      {
        id: "forbidden-city",
        category: "china",
        colorScheme: "light",
        labelKey: "style.forbiddenCity",
        descKey: "style.forbiddenCityDesc",
        swatch: ["#f7f0e2", "#f2e7d2", "#b23a2e", "#3a2f23"],
        spec: {
          base: "#f7f0e2", layer1: "#faf4e8", layer2: "#f2e7d2", layer3: "#ead9ba", overlay: "#fdf8ee", platform: "#f2e9d3",
          label1: "#3a2f23", label2: "#5d5242", label3: "#8a7c66", dimmed: "#b3a68e", onDark: "#fdf8ee",
          brand: "#b23a2e",
          btnPrimary: "#b23a2e", btnPrimaryHover: "#c54a3a", btnPrimaryDimmed: "#eedcc4",
          btnInfo: "#c2913f", btnInfoHover: "#d2a254",
          brandTertiary: "#f0e3d0",
          error: "#a63a2c", error2: "#c2543f",
          success: "#4a7c59", success2: "#5f8a63", success3: "#e2ead9",
          warn: "#b0782e", warn2: "#c8913f", warn3: "#f0e3c2", warnLabel: "#8a5f1f",
          bubble: "#efe2cc", bubbleHi: "#e3d0ac",
          sidebar: "#f4ecd9", sidebarActive: "#eadbc0", sidebarAccent: "#d4b98a", sidebarHover: "#efe5cf",
          toast: "#3a2f23"
        }
      },
      {
        id: "azure-landscape",
        category: "china",
        colorScheme: "light",
        labelKey: "style.azureLandscape",
        descKey: "style.azureLandscapeDesc",
        swatch: ["#f2efe4", "#ece7d6", "#2e5f8e", "#26312e"],
        spec: {
          base: "#f2efe4", layer1: "#f8f5eb", layer2: "#ece7d6", layer3: "#e2dbc4", overlay: "#fbf9f0", platform: "#ebe7d8",
          label1: "#26312e", label2: "#4d5a55", label3: "#76837c", dimmed: "#a3aea6", onDark: "#fbf9f0",
          brand: "#2e5f8e",
          btnPrimary: "#2f6b4f", btnPrimaryHover: "#3d8060", btnPrimaryDimmed: "#dce6d4",
          btnInfo: "#2e5f8e", btnInfoHover: "#3b72a6",
          brandTertiary: "#d8e4dc",
          error: "#a05a2c", error2: "#bd6f3a",
          success: "#3f7a4e", success2: "#55906a", success3: "#dce8d2",
          warn: "#a8762e", warn2: "#c2913f", warn3: "#f0e3c2", warnLabel: "#8a5f1f",
          bubble: "#e5e2d2", bubbleHi: "#d5d6be",
          sidebar: "#eeeadd", sidebarActive: "#e2e0cc", sidebarAccent: "#bcc6a4", sidebarHover: "#e9e6d7",
          toast: "#26312e"
        }
      },
      {
        id: "guochao-neon",
        category: "china",
        colorScheme: "dark",
        labelKey: "style.guochaoNeon",
        descKey: "style.guochaoNeonDesc",
        swatch: ["#140f12", "#281e24", "#e03e2d", "#f5ece6"],
        spec: {
          base: "#140f12", layer1: "#1e171b", layer2: "#281e24", layer3: "#332733", overlay: "#221a20", platform: "#241a1f",
          label1: "#f5ece6", label2: "#cbb9b4", label3: "#9d8b8c", dimmed: "#6e6164", onDark: "#140f12",
          brand: "#e03e2d",
          btnPrimary: "#e03e2d", btnPrimaryHover: "#ff4d3d", btnPrimaryDimmed: "#3d2026",
          btnInfo: "#29d3c3", btnInfoHover: "#3ee6d6",
          brandTertiary: "#4a2630",
          error: "#ff5a4a", error2: "#ff7a68",
          success: "#35c47e", success2: "#4dd99a", success3: "#1d3a33",
          warn: "#ffb347", warn2: "#ffc46b", warn3: "#4a3520", warnLabel: "#ffb347",
          bubble: "#241a1f", bubbleHi: "#33242c",
          sidebar: "#180f13", sidebarActive: "#2a1c22", sidebarAccent: "#8a2e28", sidebarHover: "#221519",
          toast: "#2a1c22"
        }
      },

      /* ------------------------------ 日本 ------------------------------ */
      {
        id: "ukiyo-e",
        category: "japan",
        colorScheme: "light",
        labelKey: "style.ukiyoe",
        descKey: "style.ukiyoeDesc",
        swatch: ["#f2e8cd", "#f0e4c0", "#2e4a8e", "#1f2437"],
        spec: {
          base: "#f2e8cd", layer1: "#f7efd8", layer2: "#f0e4c0", layer3: "#e8d9ae", overlay: "#faf3e0", platform: "#eddfba",
          label1: "#1f2437", label2: "#4a4f63", label3: "#767b8e", dimmed: "#abafbc", onDark: "#f7efd8",
          brand: "#2e4a8e",
          btnPrimary: "#2e4a8e", btnPrimaryHover: "#3b5ca6", btnPrimaryDimmed: "#ddd0a8",
          btnInfo: "#c2503e", btnInfoHover: "#d05f4c",
          brandTertiary: "#d9d4ec",
          error: "#b23a2a", error2: "#cc5844",
          success: "#3f7a4e", success2: "#55906a", success3: "#dce8d2",
          warn: "#c98a2e", warn2: "#d9a441", warn3: "#f2e3b3", warnLabel: "#9a6a1a",
          bubble: "#e8d9ae", bubbleHi: "#dcc78f",
          sidebar: "#eddfba", sidebarActive: "#e2d2a0", sidebarAccent: "#cfb26f", sidebarHover: "#e9dcb4",
          toast: "#1f2437"
        }
      },
      {
        id: "wabi-sabi",
        category: "japan",
        colorScheme: "light",
        labelKey: "style.wabiSabi",
        descKey: "style.wabiSabiDesc",
        swatch: ["#ece8df", "#e8e2d6", "#a9745c", "#3d3a33"],
        spec: {
          base: "#ece8df", layer1: "#f4f0e8", layer2: "#e8e2d6", layer3: "#dcd4c4", overlay: "#f8f4ec", platform: "#e7e1d2",
          label1: "#3d3a33", label2: "#635e53", label3: "#8a8476", dimmed: "#b0aa9a", onDark: "#f8f4ec",
          brand: "#a9745c",
          btnPrimary: "#3d3a33", btnPrimaryHover: "#57524a", btnPrimaryDimmed: "#e0d9c8",
          btnInfo: "#a9745c", btnInfoHover: "#bc8368",
          brandTertiary: "#e8ded2",
          error: "#a05a4a", error2: "#bc6f5e",
          success: "#6d7a5a", success2: "#849471", success3: "#e2e6d6",
          warn: "#a8874e", warn2: "#c09d5f", warn3: "#efe5c8", warnLabel: "#8a6a34",
          bubble: "#e2dccd", bubbleHi: "#d3cab6",
          sidebar: "#e9e4d7", sidebarActive: "#dcd4c0", sidebarAccent: "#b8aa8c", sidebarHover: "#e4ded0",
          toast: "#3d3a33"
        }
      },
      {
        id: "sakura",
        category: "japan",
        colorScheme: "light",
        labelKey: "style.sakura",
        descKey: "style.sakuraDesc",
        swatch: ["#f7eef0", "#f5e6ea", "#d1698a", "#4a3a40"],
        spec: {
          base: "#f7eef0", layer1: "#fcf5f6", layer2: "#f5e6ea", layer3: "#eed7de", overlay: "#fef9fa", platform: "#f4e7eb",
          label1: "#4a3a40", label2: "#6e5a62", label3: "#95808a", dimmed: "#bda9b1", onDark: "#fef9fa",
          brand: "#d1698a",
          btnPrimary: "#b0546e", btnPrimaryHover: "#c4657f", btnPrimaryDimmed: "#f0dce2",
          btnInfo: "#d1698a", btnInfoHover: "#dc7c9b",
          brandTertiary: "#f3e2e8",
          error: "#c25a6a", error2: "#d4707e",
          success: "#6d9a7a", success2: "#84ae92", success3: "#e2ecdd",
          warn: "#c99a5a", warn2: "#d9ab6b", warn3: "#f5e8cd", warnLabel: "#9a6f33",
          bubble: "#f3e4e9", bubbleHi: "#e9d2da",
          sidebar: "#f6eaee", sidebarActive: "#eed7de", sidebarAccent: "#d9a8b8", sidebarHover: "#f2e2e8",
          toast: "#4a3a40"
        }
      },
      {
        id: "edo-night",
        category: "japan",
        colorScheme: "dark",
        labelKey: "style.edoNight",
        descKey: "style.edoNightDesc",
        swatch: ["#12162b", "#232947", "#e88a3a", "#ece7f5"],
        spec: {
          base: "#12162b", layer1: "#1a1f38", layer2: "#232947", layer3: "#2d3457", overlay: "#1e2440", platform: "#1a1f38",
          label1: "#ece7f5", label2: "#c3bcd6", label3: "#958cb0", dimmed: "#6b6488", onDark: "#12162b",
          brand: "#e88a3a",
          btnPrimary: "#e88a3a", btnPrimaryHover: "#f5a055", btnPrimaryDimmed: "#4a3526",
          btnInfo: "#5a6fb8", btnInfoHover: "#6f82c8",
          brandTertiary: "#3a3055",
          error: "#e06a55", error2: "#f07f68",
          success: "#6aa87a", success2: "#7fb98d", success3: "#1f3a2c",
          warn: "#e8b25a", warn2: "#f2c271", warn3: "#4a3a22", warnLabel: "#e8b25a",
          bubble: "#1c2140", bubbleHi: "#262c52",
          sidebar: "#141832", sidebarActive: "#232947", sidebarAccent: "#4a3a66", sidebarHover: "#1a1f3c",
          toast: "#232947"
        }
      },
      {
        id: "tokyo-neon",
        category: "japan",
        colorScheme: "dark",
        labelKey: "style.tokyoNeon",
        descKey: "style.tokyoNeonDesc",
        swatch: ["#0f0f1e", "#1f1f36", "#ff4fa3", "#f0ecf7"],
        spec: {
          base: "#0f0f1e", layer1: "#171729", layer2: "#1f1f36", layer3: "#282845", overlay: "#1b1b30", platform: "#171729",
          label1: "#f0ecf7", label2: "#c8c2d9", label3: "#9a92b3", dimmed: "#6d6587", onDark: "#0f0f1e",
          brand: "#ff4fa3",
          btnPrimary: "#ff4fa3", btnPrimaryHover: "#ff6bb3", btnPrimaryDimmed: "#4a2440",
          btnInfo: "#22d3ee", btnInfoHover: "#4ae0f5",
          brandTertiary: "#452040",
          error: "#ff5a7a", error2: "#ff7a94",
          success: "#34d399", success2: "#4fe0ac", success3: "#12352c",
          warn: "#ffb347", warn2: "#ffc46b", warn3: "#4a3520", warnLabel: "#ffb347",
          bubble: "#191932", bubbleHi: "#242448",
          sidebar: "#111122", sidebarActive: "#1f1f36", sidebarAccent: "#55204a", sidebarHover: "#17172b",
          toast: "#1f1f36"
        }
      },

      /* ------------------------------ 节庆 ------------------------------ */
      {
        id: "festive-red-gold",
        category: "festival",
        colorScheme: "light",
        labelKey: "style.festiveRedGold",
        descKey: "style.festiveRedGoldDesc",
        swatch: ["#faf3e3", "#f6ead0", "#c9302c", "#3a2416"],
        spec: {
          base: "#faf3e3", layer1: "#fdf7ea", layer2: "#f6ead0", layer3: "#efdcb4", overlay: "#fefaf0", platform: "#f5ecd4",
          label1: "#3a2416", label2: "#6b4a2e", label3: "#96734e", dimmed: "#bda98a", onDark: "#fefaf0",
          brand: "#c9302c",
          btnPrimary: "#c9302c", btnPrimaryHover: "#dd4038", btnPrimaryDimmed: "#f2dfc8",
          btnInfo: "#d99a2b", btnInfoHover: "#e6ab3d",
          brandTertiary: "#f5e6d2",
          error: "#b02620", error2: "#cc4a3e",
          success: "#4a7c59", success2: "#5f8a63", success3: "#e2ead9",
          warn: "#c98a2e", warn2: "#d9a441", warn3: "#f2e3b3", warnLabel: "#9a6a1a",
          bubble: "#f4e8ce", bubbleHi: "#ebd8ae",
          sidebar: "#f7efdb", sidebarActive: "#efdfc0", sidebarAccent: "#dfc088", sidebarHover: "#f3e9d2",
          toast: "#3a2416"
        }
      },
      {
        id: "christmas",
        category: "festival",
        colorScheme: "light",
        labelKey: "style.christmas",
        descKey: "style.christmasDesc",
        swatch: ["#f2f4ec", "#eceddd", "#c43a32", "#2f3a2e"],
        spec: {
          base: "#f2f4ec", layer1: "#f9faf3", layer2: "#eceddd", layer3: "#e2e4cc", overlay: "#fcfdf7", platform: "#eceede",
          label1: "#2f3a2e", label2: "#57604e", label3: "#7e8872", dimmed: "#a9b29c", onDark: "#fcfdf7",
          brand: "#c43a32",
          btnPrimary: "#c43a32", btnPrimaryHover: "#d64c42", btnPrimaryDimmed: "#f0e0d4",
          btnInfo: "#2f6b4f", btnInfoHover: "#3d8060",
          brandTertiary: "#f2e4d8",
          error: "#b02f2a", error2: "#cc5044",
          success: "#2f6b4f", success2: "#43805e", success3: "#dcead9",
          warn: "#c99a3a", warn2: "#d9ad4b", warn3: "#f4e8c8", warnLabel: "#96682a",
          bubble: "#e9ebd8", bubbleHi: "#d9ddbc",
          sidebar: "#eef0e0", sidebarActive: "#e2e5cc", sidebarAccent: "#bcc69a", sidebarHover: "#e9ecda",
          toast: "#2f3a2e"
        }
      },
      {
        id: "halloween",
        category: "festival",
        colorScheme: "dark",
        labelKey: "style.halloween",
        descKey: "style.halloweenDesc",
        swatch: ["#151019", "#281e30", "#ff8c1a", "#f0e8e2"],
        spec: {
          base: "#151019", layer1: "#1e1724", layer2: "#281e30", layer3: "#33263c", overlay: "#221a2a", platform: "#1e1724",
          label1: "#f0e8e2", label2: "#cbb9ae", label3: "#a08d85", dimmed: "#75665f", onDark: "#151019",
          brand: "#ff8c1a",
          btnPrimary: "#ff8c1a", btnPrimaryHover: "#ffa03d", btnPrimaryDimmed: "#4a3320",
          btnInfo: "#7b5cc0", btnInfoHover: "#8d6fd0",
          brandTertiary: "#3a2a4a",
          error: "#e0573f", error2: "#f07056",
          success: "#7aa86a", success2: "#8fbb7e", success3: "#24331f",
          warn: "#ff8c1a", warn2: "#ffa03d", warn3: "#4a3320", warnLabel: "#ff8c1a",
          bubble: "#201827", bubbleHi: "#2c2136",
          sidebar: "#17121c", sidebarActive: "#281e30", sidebarAccent: "#5a3d3a", sidebarHover: "#1e1724",
          toast: "#281e30"
        }
      },

      /* ---------------------------- 通用氛围 ---------------------------- */
      {
        id: "cyberpunk",
        category: "general",
        colorScheme: "dark",
        labelKey: "style.cyberpunk",
        descKey: "style.cyberpunkDesc",
        swatch: ["#0b0b12", "#1b1b2c", "#ff2e97", "#ece7f5"],
        spec: {
          base: "#0b0b12", layer1: "#131320", layer2: "#1b1b2c", layer3: "#232338", overlay: "#171724", platform: "#131320",
          label1: "#ece7f5", label2: "#c0b8d4", label3: "#8f86a8", dimmed: "#645c7c", onDark: "#0b0b12",
          brand: "#ff2e97",
          btnPrimary: "#ff2e97", btnPrimaryHover: "#ff4ca8", btnPrimaryDimmed: "#4a1f3c",
          btnInfo: "#00e5d2", btnInfoHover: "#1ff5e2",
          brandTertiary: "#3a1f3c",
          error: "#ff3d5a", error2: "#ff5f77",
          success: "#00d68f", success2: "#1fe5a0", success3: "#0f3529",
          warn: "#ffb020", warn2: "#ffc040", warn3: "#4a3518", warnLabel: "#ffb020",
          bubble: "#141425", bubbleHi: "#1e1e36",
          sidebar: "#0d0d16", sidebarActive: "#1b1b2c", sidebarAccent: "#4a1f3c", sidebarHover: "#131320",
          toast: "#1b1b2c"
        }
      },
      {
        id: "midnight-minimal",
        category: "general",
        colorScheme: "dark",
        labelKey: "style.midnightMinimal",
        descKey: "style.midnightMinimalDesc",
        swatch: ["#0e0e10", "#1e1e21", "#7aa2ff", "#f2f2f2"],
        spec: {
          base: "#0e0e10", layer1: "#161618", layer2: "#1e1e21", layer3: "#26262a", overlay: "#1a1a1d", platform: "#161618",
          label1: "#f2f2f2", label2: "#c4c4c4", label3: "#8f8f8f", dimmed: "#636363", onDark: "#0e0e10",
          brand: "#7aa2ff",
          btnPrimary: "#e8e8e8", btnPrimaryHover: "#ffffff", btnPrimaryDimmed: "#2a2a2e",
          btnInfo: "#7aa2ff", btnInfoHover: "#93b3ff",
          brandTertiary: "#23233a",
          error: "#ff6b6b", error2: "#ff8b8b",
          success: "#63d68a", success2: "#7fe0a0", success3: "#1c3324",
          warn: "#ffb347", warn2: "#ffc46b", warn3: "#4a3520", warnLabel: "#ffb347",
          bubble: "#17171a", bubbleHi: "#202024",
          sidebar: "#101012", sidebarActive: "#1e1e21", sidebarAccent: "#33333a", sidebarHover: "#161618",
          toast: "#1e1e21"
        }
      },
      {
        id: "forest",
        category: "general",
        colorScheme: "light",
        labelKey: "style.forest",
        descKey: "style.forestDesc",
        swatch: ["#f0f2e8", "#e9ecdc", "#5a7d4f", "#2e3528"],
        spec: {
          base: "#f0f2e8", layer1: "#f7f8f0", layer2: "#e9ecdc", layer3: "#dfe3cc", overlay: "#fafbf5", platform: "#e9ecdc",
          label1: "#2e3528", label2: "#59604b", label3: "#81896f", dimmed: "#adb49b", onDark: "#fafbf5",
          brand: "#5a7d4f",
          btnPrimary: "#3f6b3e", btnPrimaryHover: "#518150", btnPrimaryDimmed: "#dde8d6",
          btnInfo: "#5a7d4f", btnInfoHover: "#6b915f",
          brandTertiary: "#dce8d4",
          error: "#a05a3a", error2: "#bd704e",
          success: "#3f7a4e", success2: "#55906a", success3: "#dce8d2",
          warn: "#a8874e", warn2: "#c09d5f", warn3: "#efe5c8", warnLabel: "#8a6a34",
          bubble: "#e6ead6", bubbleHi: "#d6ddc0",
          sidebar: "#ecefe0", sidebarActive: "#dfe4ca", sidebarAccent: "#aab98c", sidebarHover: "#e7ebda",
          toast: "#2e3528"
        }
      },
      {
        id: "ocean",
        category: "general",
        colorScheme: "light",
        labelKey: "style.ocean",
        descKey: "style.oceanDesc",
        swatch: ["#eef4f5", "#e6f0f2", "#2f7f9e", "#24343c"],
        spec: {
          base: "#eef4f5", layer1: "#f6fafb", layer2: "#e6f0f2", layer3: "#dbe9ec", overlay: "#fafdfd", platform: "#e7eef0",
          label1: "#24343c", label2: "#4b6169", label3: "#748b94", dimmed: "#a2b4bb", onDark: "#fafdfd",
          brand: "#2f7f9e",
          btnPrimary: "#2f7f9e", btnPrimaryHover: "#3d93b5", btnPrimaryDimmed: "#d8e8ec",
          btnInfo: "#2e9b8f", btnInfoHover: "#3db0a2",
          brandTertiary: "#d8e8f0",
          error: "#c0564a", error2: "#d46f60",
          success: "#3f8e6a", success2: "#55a67f", success3: "#dcece4",
          warn: "#c99a5a", warn2: "#d9ab6b", warn3: "#f5e8cd", warnLabel: "#9a6f33",
          bubble: "#e3eef0", bubbleHi: "#d0e2e6",
          sidebar: "#eaf1f2", sidebarActive: "#dbe9ec", sidebarAccent: "#9cc2cd", sidebarHover: "#e5eef0",
          toast: "#24343c"
        }
      },
      {
        id: "morandi",
        category: "general",
        colorScheme: "light",
        labelKey: "style.morandi",
        descKey: "style.morandiDesc",
        swatch: ["#eae8e2", "#e6e3db", "#8d94a6", "#4a4742"],
        spec: {
          base: "#eae8e2", layer1: "#f2f0eb", layer2: "#e6e3db", layer3: "#dad6cc", overlay: "#f6f4ef", platform: "#e6e4de",
          label1: "#4a4742", label2: "#6e6a63", label3: "#938e85", dimmed: "#b6b1a7", onDark: "#f6f4ef",
          brand: "#8d94a6",
          btnPrimary: "#6e7278", btnPrimaryHover: "#82868c", btnPrimaryDimmed: "#dfddd6",
          btnInfo: "#a08a92", btnInfoHover: "#b29aa2",
          brandTertiary: "#e2e0da",
          error: "#a86a66", error2: "#bd8078",
          success: "#7d8f7d", success2: "#93a492", success3: "#e4e8e0",
          warn: "#b39a72", warn2: "#c2aa84", warn3: "#efe7d6", warnLabel: "#8a7450",
          bubble: "#e3e1da", bubbleHi: "#d5d2c8",
          sidebar: "#e8e6e0", sidebarActive: "#dad6cc", sidebarAccent: "#b0aba0", sidebarHover: "#e4e2db",
          toast: "#4a4742"
        }
      },
      {
        id: "retro-film",
        category: "general",
        colorScheme: "light",
        labelKey: "style.retroFilm",
        descKey: "style.retroFilmDesc",
        swatch: ["#efe8dc", "#ebe1d0", "#c97b3f", "#3f3628"],
        spec: {
          base: "#efe8dc", layer1: "#f5efe4", layer2: "#ebe1d0", layer3: "#e1d3ba", overlay: "#f8f2e8", platform: "#eae1ce",
          label1: "#3f3628", label2: "#65593f", label3: "#8a7d5e", dimmed: "#b0a689", onDark: "#f8f2e8",
          brand: "#c97b3f",
          btnPrimary: "#8a6a3a", btnPrimaryHover: "#a07c46", btnPrimaryDimmed: "#e6dbc4",
          btnInfo: "#c97b3f", btnInfoHover: "#d88d4f",
          brandTertiary: "#eadfd0",
          error: "#b0653a", error2: "#c77a4a",
          success: "#7a8a4a", success2: "#8fa15a", success3: "#e8ead6",
          warn: "#c99a5a", warn2: "#d9ab6b", warn3: "#f5e8cd", warnLabel: "#9a6f33",
          bubble: "#e9dfc8", bubbleHi: "#dccdb0",
          sidebar: "#ece4d3", sidebarActive: "#e1d3ba", sidebarAccent: "#c2ae82", sidebarHover: "#e8dfcb",
          toast: "#3f3628"
        }
      },
      {
        id: "starry-night",
        category: "general",
        colorScheme: "dark",
        labelKey: "style.starryNight",
        descKey: "style.starryNightDesc",
        swatch: ["#0d1026", "#1d2247", "#f2c94c", "#eae7f7"],
        spec: {
          base: "#0d1026", layer1: "#151936", layer2: "#1d2247", layer3: "#262c59", overlay: "#191e3d", platform: "#151936",
          label1: "#eae7f7", label2: "#c0bade", label3: "#8f88b4", dimmed: "#655f88", onDark: "#0d1026",
          brand: "#f2c94c",
          btnPrimary: "#5a6beb", btnPrimaryHover: "#6f7ef0", btnPrimaryDimmed: "#262b4a",
          btnInfo: "#f2c94c", btnInfoHover: "#f7d669",
          brandTertiary: "#2e3358",
          error: "#e06a8a", error2: "#f07f9e",
          success: "#6ac8a0", success2: "#80d6b2", success3: "#1c3a30",
          warn: "#e8b25a", warn2: "#f2c271", warn3: "#4a3a22", warnLabel: "#e8b25a",
          bubble: "#161a38", bubbleHi: "#20254c",
          sidebar: "#0f1330", sidebarActive: "#1d2247", sidebarAccent: "#3a3f6e", sidebarHover: "#151936",
          toast: "#1d2247"
        }
      }
    ];

    /**
     * Flag palettes: derive a complete spec from a flag's 2–4 signature colors.
     * base = the flag's light ground, field = its dominant strong color,
     * secondary = second accent (button-info fill). Shades/tints fill in the
     * layers, labels, borders and states a 2-color flag cannot provide itself.
     */
    function flagSpec(f) {
      var field = f.field;
      var base = f.base;
      var secondary = f.secondary || field;
      return {
        base: base,
        layer1: tint(mix(base, field, 0.05), 0.55),
        layer2: mix(base, field, 0.07),
        layer3: mix(base, field, 0.13),
        overlay: tint(mix(base, field, 0.03), 0.8),
        platform: mix(base, field, 0.06),
        label1: mix(field, "#1c1c1e", 0.78),
        label2: mix(field, "#4a4a4d", 0.72),
        label3: mix(field, "#7e7e82", 0.66),
        dimmed: mix(field, "#b2b2b5", 0.58),
        onDark: tint(base, 0.9),
        brand: field,
        btnPrimary: field,
        btnPrimaryHover: tint(field, 0.18),
        btnPrimaryDimmed: tint(field, 0.82),
        btnInfo: secondary,
        btnInfoHover: tint(secondary, 0.18),
        brandTertiary: tint(field, 0.86),
        error: mix("#d64541", field, 0.35),
        error2: tint(mix("#d64541", field, 0.35), 0.15),
        success: mix("#3f8e5f", field, 0.25),
        success2: tint(mix("#3f8e5f", field, 0.25), 0.15),
        success3: tint(mix("#3f8e5f", field, 0.25), 0.78),
        warn: mix("#d99a2b", field, 0.3),
        warn2: tint(mix("#d99a2b", field, 0.3), 0.15),
        warn3: tint(mix("#d99a2b", field, 0.3), 0.78),
        warnLabel: shade(mix("#d99a2b", field, 0.3), 0.3),
        bubble: mix(base, field, 0.08),
        bubbleHi: mix(base, field, 0.15),
        sidebar: mix(base, field, 0.05),
        sidebarActive: mix(base, field, 0.11),
        sidebarAccent: tint(mix(field, secondary, 0.5), 0.35),
        sidebarHover: mix(base, field, 0.075),
        toast: mix(field, "#1c1c1e", 0.45)
      };
    }

    /* 20 flag styles — one per country, all light-base. */
    var FLAGS = [
      { id: "flag-usa",          key: "Usa",          base: "#f6f8fb", field: "#3c3b6e", secondary: "#b22234" },
      { id: "flag-china",        key: "China",        base: "#fdf4f0", field: "#de2910", secondary: "#ffde00" },
      { id: "flag-germany",      key: "Germany",      base: "#f6f6f4", field: "#1f1f1f", secondary: "#dd0000", tertiary: "#ffce00" },
      { id: "flag-japan",        key: "Japan",        base: "#fafafa", field: "#bc002d", secondary: "#e04563" },
      { id: "flag-india",        key: "India",        base: "#fdf9f2", field: "#ff9933", secondary: "#138808", tertiary: "#000080" },
      { id: "flag-uk",           key: "Uk",           base: "#f6f8fc", field: "#012169", secondary: "#c8102e" },
      { id: "flag-france",       key: "France",       base: "#f7fafd", field: "#0055a4", secondary: "#ef4135" },
      { id: "flag-italy",        key: "Italy",        base: "#f6faf6", field: "#009246", secondary: "#ce2b37" },
      { id: "flag-canada",       key: "Canada",       base: "#fbfbfb", field: "#d80621", secondary: "#ef5f6e" },
      { id: "flag-brazil",       key: "Brazil",       base: "#f3f9f2", field: "#009c3b", secondary: "#ffdf00", tertiary: "#002776" },
      { id: "flag-russia",       key: "Russia",       base: "#f8fafb", field: "#0039a6", secondary: "#d52b1e" },
      { id: "flag-korea",        key: "Korea",        base: "#fafaf7", field: "#cd2e3a", secondary: "#0047a0", tertiary: "#1a1a1a" },
      { id: "flag-mexico",       key: "Mexico",       base: "#f4f9f4", field: "#006847", secondary: "#ce1126" },
      { id: "flag-australia",    key: "Australia",    base: "#f6f9fc", field: "#00247d", secondary: "#e00000" },
      { id: "flag-spain",        key: "Spain",        base: "#fdf7ec", field: "#aa151b", secondary: "#f1bf00" },
      { id: "flag-indonesia",    key: "Indonesia",    base: "#fafafa", field: "#ce1126", secondary: "#e5424f" },
      { id: "flag-turkey",       key: "Turkey",       base: "#fdf4f1", field: "#e30a17", secondary: "#f2a9ae" },
      { id: "flag-netherlands",  key: "Netherlands",  base: "#fafaf8", field: "#ae1c28", secondary: "#21468b" },
      { id: "flag-saudi",        key: "Saudi",        base: "#f1f8f2", field: "#006c35", secondary: "#1f8a4c" },
      { id: "flag-switzerland",  key: "Switzerland",  base: "#fafafa", field: "#da291c", secondary: "#e64545" }
    ];
    for (var fi = 0; fi < FLAGS.length; fi++) {
      var fl = FLAGS[fi];
      STYLES.push({
        id: fl.id,
        category: "flags",
        colorScheme: "light",
        labelKey: "style.flag" + fl.key,
        descKey: "style.flag" + fl.key + "Desc",
        swatch: [fl.base, fl.field, fl.secondary || fl.field, mix(fl.field, "#1c1c1e", 0.78)],
        tokens: palette(flagSpec(fl))
      });
    }

    var CATEGORIES = [
      { id: "china", labelKey: "cat.china" },
      { id: "japan", labelKey: "cat.japan" },
      { id: "festival", labelKey: "cat.festival" },
      { id: "general", labelKey: "cat.general" },
      { id: "flags", labelKey: "cat.flags" }
    ];

    /* tokens: expand specs once, then drop the raw spec. */
    for (var si = 0; si < STYLES.length; si++) {
      if (!STYLES[si].spec) continue;
      STYLES[si].tokens = palette(STYLES[si].spec);
      delete STYLES[si].spec;
    }

    var STYLE_BY_ID = {};
    for (var sj = 0; sj < STYLES.length; sj++) STYLE_BY_ID[STYLES[sj].id] = STYLES[sj];

    function stylesOf(categoryId) {
      var out = [];
      for (var i = 0; i < STYLES.length; i++) {
        if (STYLES[i].category === categoryId) out.push(STYLES[i]);
      }
      return out;
    }

    /* ------------------------------ locale ------------------------------ */

    var zh = {
      "nav": "主题管理器",
      "section.title": "主题管理器",
      "section.sub": "两级式主题选择：先选文化 / 场景，再选具体风格。切换实时生效，选择保存在本浏览器；恢复默认请用底部按钮或「设置 → 外观」行。",
      "cat.china": "中国",
      "cat.japan": "日本",
      "cat.festival": "节庆",
      "cat.general": "通用氛围",
      "cat.flags": "国旗",
      "style.flagUsa": "美国",
      "style.flagUsaDesc": "星条旗：海军蓝 · 星条红 · 白",
      "style.flagChina": "中国",
      "style.flagChinaDesc": "五星红旗：中国红 · 金黄",
      "style.flagGermany": "德国",
      "style.flagGermanyDesc": "黑 · 红 · 金",
      "style.flagJapan": "日本",
      "style.flagJapanDesc": "日之丸：白 · 红",
      "style.flagIndia": "印度",
      "style.flagIndiaDesc": "藏红 · 白 · 绿 · 靛蓝",
      "style.flagUk": "英国",
      "style.flagUkDesc": "米字旗：深蓝 · 白 · 红",
      "style.flagFrance": "法国",
      "style.flagFranceDesc": "蓝 · 白 · 红",
      "style.flagItaly": "意大利",
      "style.flagItalyDesc": "绿 · 白 · 红",
      "style.flagCanada": "加拿大",
      "style.flagCanadaDesc": "枫叶旗：红 · 白",
      "style.flagBrazil": "巴西",
      "style.flagBrazilDesc": "绿 · 黄 · 蓝",
      "style.flagRussia": "俄罗斯",
      "style.flagRussiaDesc": "白 · 蓝 · 红",
      "style.flagKorea": "韩国",
      "style.flagKoreaDesc": "太极旗：白 · 红 · 蓝 · 黑",
      "style.flagMexico": "墨西哥",
      "style.flagMexicoDesc": "绿 · 白 · 红",
      "style.flagAustralia": "澳大利亚",
      "style.flagAustraliaDesc": "南十字：深蓝 · 白 · 红",
      "style.flagSpain": "西班牙",
      "style.flagSpainDesc": "红 · 金",
      "style.flagIndonesia": "印尼",
      "style.flagIndonesiaDesc": "红 · 白",
      "style.flagTurkey": "土耳其",
      "style.flagTurkeyDesc": "新月：红 · 白",
      "style.flagNetherlands": "荷兰",
      "style.flagNetherlandsDesc": "红 · 白 · 蓝",
      "style.flagSaudi": "沙特阿拉伯",
      "style.flagSaudiDesc": "绿 · 白",
      "style.flagSwitzerland": "瑞士",
      "style.flagSwitzerlandDesc": "十字：红 · 白",
      "style.inkWash": "水墨风格",
      "style.inkWashDesc": "宣纸白底 · 墨黑主色 · 朱砂红点缀",
      "style.suzhouGarden": "苏州园林风格",
      "style.suzhouGardenDesc": "粉墙黛瓦 · 青灰 · 竹绿",
      "style.forbiddenCity": "故宫宫墙风格",
      "style.forbiddenCityDesc": "朱红宫墙 · 鎏金点缀",
      "style.azureLandscape": "青绿山水风格",
      "style.azureLandscapeDesc": "石青 · 石绿 · 赭石（千里江山图）",
      "style.guochaoNeon": "国潮霓虹风格",
      "style.guochaoNeonDesc": "中国红 · 荧光青 · 墨夜",
      "style.ukiyoe": "浮世绘风格",
      "style.ukiyoeDesc": "和纸米底 · 群青主色 · 赭红与芥子黄点缀",
      "style.wabiSabi": "侘寂和风",
      "style.wabiSabiDesc": "低饱和米灰 · 枯山水禅意",
      "style.sakura": "樱花花见风格",
      "style.sakuraDesc": "樱粉 · 素白 · 嫩芽绿",
      "style.edoNight": "江户夜行风格",
      "style.edoNightDesc": "深靛夜空 · 灯笼暖橙",
      "style.tokyoNeon": "东京霓虹风格",
      "style.tokyoNeonDesc": "霓虹粉 · 电光青",
      "style.festiveRedGold": "红黄吉庆风格",
      "style.festiveRedGoldDesc": "中国红 · 金黄 · 金箔",
      "style.christmas": "圣诞风格",
      "style.christmasDesc": "松树绿 · 圣诞红 · 金",
      "style.halloween": "万圣夜风格",
      "style.halloweenDesc": "暗紫 · 南瓜橙 · 黑",
      "style.cyberpunk": "赛博朋克风格",
      "style.cyberpunkDesc": "霓虹粉紫 · 电光青 · 深黑",
      "style.midnightMinimal": "暗夜极简风格",
      "style.midnightMinimalDesc": "纯黑灰 · 高对比",
      "style.forest": "森林自然风格",
      "style.forestDesc": "墨绿 · 苔绿 · 米白",
      "style.ocean": "海洋清凉风格",
      "style.oceanDesc": "海蓝 · 白 · 青",
      "style.morandi": "莫兰迪低饱和",
      "style.morandiDesc": "灰调柔和 · 高级感",
      "style.retroFilm": "复古胶片风格",
      "style.retroFilmDesc": "暖棕 · 褪色黄",
      "style.starryNight": "星空夜色风格",
      "style.starryNightDesc": "深蓝紫 · 星光白",
      "apply": "使用",
      "active": "使用中",
      "restore": "恢复默认外观",
      "done": "完成",
      "current": "当前",
      "current.builtin": "内置外观（浅色 / 深色 / 跟随系统）",
      "empty": "该分类下暂无风格。"
    };

    var en = {
      "nav": "Theme Manager",
      "section.title": "Theme Manager",
      "section.sub": "Two-level theme picker: choose a culture / scene first, then a concrete style. Switches apply live and are remembered in this browser; restore the default with the footer button or the Appearance row under Settings.",
      "cat.china": "China",
      "cat.japan": "Japan",
      "cat.festival": "Festivals",
      "cat.general": "General",
      "cat.flags": "Flags",
      "style.flagUsa": "United States",
      "style.flagUsaDesc": "Stars & Stripes: navy · red · white",
      "style.flagChina": "China",
      "style.flagChinaDesc": "Five-star red flag: red · gold",
      "style.flagGermany": "Germany",
      "style.flagGermanyDesc": "Black · red · gold",
      "style.flagJapan": "Japan",
      "style.flagJapanDesc": "Rising sun: white · red",
      "style.flagIndia": "India",
      "style.flagIndiaDesc": "Saffron · white · green · navy",
      "style.flagUk": "United Kingdom",
      "style.flagUkDesc": "Union Jack: navy · white · red",
      "style.flagFrance": "France",
      "style.flagFranceDesc": "Blue · white · red",
      "style.flagItaly": "Italy",
      "style.flagItalyDesc": "Green · white · red",
      "style.flagCanada": "Canada",
      "style.flagCanadaDesc": "Maple leaf: red · white",
      "style.flagBrazil": "Brazil",
      "style.flagBrazilDesc": "Green · yellow · blue",
      "style.flagRussia": "Russia",
      "style.flagRussiaDesc": "White · blue · red",
      "style.flagKorea": "South Korea",
      "style.flagKoreaDesc": "Taegeukgi: white · red · blue · black",
      "style.flagMexico": "Mexico",
      "style.flagMexicoDesc": "Green · white · red",
      "style.flagAustralia": "Australia",
      "style.flagAustraliaDesc": "Southern Cross: navy · white · red",
      "style.flagSpain": "Spain",
      "style.flagSpainDesc": "Red · gold",
      "style.flagIndonesia": "Indonesia",
      "style.flagIndonesiaDesc": "Red · white",
      "style.flagTurkey": "Turkey",
      "style.flagTurkeyDesc": "Crescent: red · white",
      "style.flagNetherlands": "Netherlands",
      "style.flagNetherlandsDesc": "Red · white · blue",
      "style.flagSaudi": "Saudi Arabia",
      "style.flagSaudiDesc": "Green · white",
      "style.flagSwitzerland": "Switzerland",
      "style.flagSwitzerlandDesc": "Cross: red · white",
      "style.inkWash": "Ink Wash",
      "style.inkWashDesc": "Rice-paper white · ink-black primary · vermilion accents",
      "style.suzhouGarden": "Suzhou Garden",
      "style.suzhouGardenDesc": "White walls & dark tiles · bamboo green",
      "style.forbiddenCity": "Forbidden City",
      "style.forbiddenCityDesc": "Vermilion walls · gilded accents",
      "style.azureLandscape": "Azure Landscape",
      "style.azureLandscapeDesc": "Mineral blue · malachite green · ochre",
      "style.guochaoNeon": "Guochao Neon",
      "style.guochaoNeonDesc": "China red · neon cyan on ink night",
      "style.ukiyoe": "Ukiyo-e",
      "style.ukiyoeDesc": "Washi ivory · ultramarine primary · ochre-red & mustard accents",
      "style.wabiSabi": "Wabi-sabi",
      "style.wabiSabiDesc": "Muted rice-grey · zen minimalism",
      "style.sakura": "Sakura",
      "style.sakuraDesc": "Cherry-blossom pink · white · fresh green",
      "style.edoNight": "Edo Night",
      "style.edoNightDesc": "Indigo night · paper-lantern amber",
      "style.tokyoNeon": "Tokyo Neon",
      "style.tokyoNeonDesc": "Neon pink · electric cyan",
      "style.festiveRedGold": "Festive Red & Gold",
      "style.festiveRedGoldDesc": "China red · gold · gilded",
      "style.christmas": "Christmas",
      "style.christmasDesc": "Pine green · holly red · gold",
      "style.halloween": "Halloween",
      "style.halloweenDesc": "Deep purple · pumpkin orange · black",
      "style.cyberpunk": "Cyberpunk",
      "style.cyberpunkDesc": "Neon magenta · electric cyan on black",
      "style.midnightMinimal": "Midnight Minimal",
      "style.midnightMinimalDesc": "Pure black-grey · high contrast",
      "style.forest": "Forest",
      "style.forestDesc": "Deep green · moss · cream",
      "style.ocean": "Ocean Breeze",
      "style.oceanDesc": "Sea blue · white · teal",
      "style.morandi": "Morandi",
      "style.morandiDesc": "Soft muted greys",
      "style.retroFilm": "Retro Film",
      "style.retroFilmDesc": "Warm brown · faded amber",
      "style.starryNight": "Starry Night",
      "style.starryNightDesc": "Deep blue-violet · starlight",
      "apply": "Apply",
      "active": "Active",
      "restore": "Restore default appearance",
      "done": "Done",
      "current": "Current",
      "current.builtin": "Built-in appearance (Light / Dark / System)",
      "empty": "No styles in this category yet."
    };

    /* ---------------------------- config store ---------------------------- */

    function loadActive() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || parsed.version !== STORAGE_VERSION || typeof parsed.id !== "string") return null;
        return parsed.id;
      } catch (err) {
        return null;
      }
    }

    function saveActive(id) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, id: id }));
      } catch (err) { /* storage unavailable: keep in-memory behavior */ }
    }

    function clearActive() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) { /* ignore */ }
    }

    /* ------------------------------- styles ------------------------------- */

    var CSS = `
.tm-root { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.tm-head { display: flex; flex-direction: column; gap: 4px; }
.tm-title { font-size: 16px; font-weight: 600; line-height: 24px; color: var(--dsw-alias-label-primary); margin: 0; }
.tm-sub { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); margin: 0; }
.tm-body { display: flex; gap: 14px; min-height: 0; }
.tm-cats { display: flex; flex-direction: column; gap: 4px; flex: none; width: 148px; border-right: 1px solid var(--dsw-alias-border-l1); padding-right: 12px; }
.tm-cat { font: inherit; text-align: left; color: var(--dsw-alias-label-secondary); background: transparent; border: none; border-radius: 8px; padding: 9px 12px; font-size: 13px; line-height: 20px; cursor: pointer; }
.tm-cat:hover { background: var(--dsw-alias-interactive-bg-hover); }
.tm-cat.on { background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); font-weight: 600; }
.tm-styles { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; align-content: start; }
.tm-card { display: flex; flex-direction: column; gap: 8px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 14px; }
.tm-card:hover { border-color: var(--dsw-alias-border-l2); }
.tm-card.on { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
.tm-swatches { display: flex; gap: 6px; }
.tm-swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); }
.tm-card-name { font-size: 14px; font-weight: 600; line-height: 22px; color: var(--dsw-alias-label-primary); }
.tm-card-desc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.tm-card-btn { margin-top: 4px; align-self: flex-start; }
.tm-footer { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 12px; flex-wrap: wrap; }
.tm-current { font-size: 12px; color: var(--dsw-alias-label-tertiary); flex: 1; min-width: 0; }
.tm-btn { font: inherit; color: var(--dsw-alias-label-primary); background: transparent; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px 14px; font-size: 13px; line-height: 20px; cursor: pointer; }
.tm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.tm-btn:disabled { opacity: 0.45; cursor: default; }
.tm-btn.primary { background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary)); border-color: transparent; color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); }
.tm-btn.primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-label-secondary)); }
`;

    /* --------------------------- section component --------------------------- */

    function el(type, props) {
      var rest = Array.prototype.slice.call(arguments, 2);
      return React.createElement.apply(React, [type, props].concat(rest));
    }

    function ThemeManagerSection(props) {
      var t = props.t;
      var themeStore = props.themeStore;
      var [snap, setSnap] = React.useState(function () { return themeStore.getSnapshot(); });
      React.useEffect(function () {
        return themeStore.subscribe(function () { setSnap(themeStore.getSnapshot()); });
      }, []);
      var [catId, setCatId] = React.useState(CATEGORIES[0].id);

      var activeId = snap.preference;
      var activeStyle = STYLE_BY_ID[activeId] || null;
      var currentLabel = activeStyle ? t(activeStyle.labelKey) : t("current.builtin");

      function applyStyle(id) {
        props.theme.setTheme(id);
        saveActive(id);
      }

      function restore() {
        props.theme.setTheme("system");
        clearActive();
      }

      var styles = stylesOf(catId);

      return el("div", { className: "tm-root" },
        el("div", { className: "tm-head" },
          el("h2", { className: "tm-title" }, t("section.title")),
          el("p", { className: "tm-sub" }, t("section.sub")),
        ),
        el("div", { className: "tm-body" },
          el("div", { className: "tm-cats", role: "listbox", "aria-label": t("section.title") },
            CATEGORIES.map(function (cat) {
              return el("button", {
                key: cat.id,
                type: "button",
                role: "option",
                "aria-selected": cat.id === catId ? "true" : "false",
                className: "tm-cat" + (cat.id === catId ? " on" : ""),
                onClick: function () { setCatId(cat.id); },
              }, t(cat.labelKey));
            }),
          ),
          el("div", { className: "tm-styles" },
            styles.length === 0
              ? el("div", { className: "tm-sub" }, t("empty"))
              : styles.map(function (style) {
                  var isActive = style.id === activeId;
                  return el("div", { key: style.id, className: "tm-card" + (isActive ? " on" : "") },
                    el("div", { className: "tm-swatches" },
                      style.swatch.map(function (color) {
                        return el("span", { key: color, className: "tm-swatch", style: { background: color } });
                      }),
                    ),
                    el("div", { className: "tm-card-name" }, t(style.labelKey)),
                    el("div", { className: "tm-card-desc" }, t(style.descKey)),
                    el("button", {
                      type: "button",
                      className: "tm-btn tm-card-btn" + (isActive ? " primary" : ""),
                      disabled: isActive,
                      onClick: function () { applyStyle(style.id); },
                    }, isActive ? t("active") : t("apply")),
                  );
                }),
          ),
        ),
        el("div", { className: "tm-footer" },
          el("span", { className: "tm-current" }, t("current") + "："),
          el("span", { className: "tm-current" }, currentLabel),
          el("button", { type: "button", className: "tm-btn", onClick: restore }, t("restore")),
          el("button", { type: "button", className: "tm-btn primary", onClick: props.close }, t("done")),
        ),
      );
    }

    /* ------------------------------ apply ------------------------------ */

    function apply(ctx) {
      var styleEl = null;
      if (typeof document !== "undefined") {
        styleEl = document.createElement("style");
        styleEl.textContent = CSS;
        document.head.appendChild(styleEl);
      }

      ctx.effect(function () {
        ctx.locale.register(NS, { zh: zh, en: en });
      }, "dsh-theme-manager: dictionaries");
      var t = ctx.locale.bind(NS);

      var disposers = [];
      ctx.effect(function () {
        for (var i = 0; i < STYLES.length; i++) {
          var style = STYLES[i];
          try {
            disposers.push(ctx.theme.register({
              id: style.id,
              colorScheme: style.colorScheme,
              tokens: style.tokens
            }));
          } catch (err) {
            console.warn("[dsh-theme-manager] register theme " + style.id + " failed:", err);
          }
        }
        // Restore the remembered style on boot (must run after registration).
        var stored = loadActive();
        if (stored && STYLE_BY_ID[stored] && ctx.theme.getTheme().preference !== stored) {
          try { ctx.theme.setTheme(stored); } catch (err) { /* ignore */ }
        }
        return function () {
          for (var d = 0; d < disposers.length; d++) {
            try { disposers[d](); } catch (err) { /* ignore */ }
          }
        };
      }, "dsh-theme-manager: theme registration + boot restore");

      ctx.effect(function () {
        return ctx.on("theme/change", function (snap) {
          if (STYLE_BY_ID[snap.preference]) saveActive(snap.preference);
          else clearActive();
        });
      }, "dsh-theme-manager: preference sync");

      ctx.slots.inject("settings.section", function () {
        var themeStore = {
          subscribe: function (cb) { return ctx.on("theme/change", cb); },
          getSnapshot: function () { return ctx.theme.getTheme(); }
        };
        return ctx.slots.register({
          name: "settings.section",
          id: "theme-manager",
          order: 40,
          label: function () { return t("nav"); },
          locale: NS,
          inject: function () { return { t: t }; }
        }, function (slotProps) {
          return el(ThemeManagerSection, {
            t: t,
            close: slotProps.close,
            theme: ctx.theme,
            themeStore: themeStore
          });
        });
      });

      ctx.effect(function () {
        return function () {
          if (styleEl !== null && styleEl.parentNode !== null) styleEl.parentNode.removeChild(styleEl);
        };
      });
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "theme"];
    return module.exports;
  },
});
