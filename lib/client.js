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
    var PLUGIN_VERSION = "1.1.0"; // keep in sync with package.json

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
      "empty": "该分类下暂无风格。",
      "update.version": "插件版本",
      "update.checkNow": "检查更新",
      "update.checking": "检查中…",
      "update.upToDate": "已是最新版本",
      "update.available": "发现新版本",
      "update.update": "更新",
      "update.ignore": "忽略本版本",
      "update.later": "稍后提醒",
      "update.ignoreRestore": "恢复提醒",
      "update.ignored": "已忽略版本",
      "update.dialogTitle": "发现新版本",
      "update.current": "当前版本",
      "update.latest": "最新版本",
      "update.changelog": "更新内容",
      "update.changelogLoading": "加载中…",
      "update.changelogFail": "更新内容加载失败，可前往 GitHub 查看",
      "update.changelogLink": "查看完整更新日志",
      "update.majorWarning": "这是重大版本更新，可能包含不兼容变更，请先阅读更新内容",
      "update.stepInstall": "下载并安装",
      "update.stepVerify": "验证安装",
      "update.installing": "正在更新，请勿关闭页面…",
      "update.log": "安装日志",
      "update.done": "更新完成",
      "update.doneText": "已更新到 v{0}，重启 dsh web 后生效",
      "update.restartNow": "立即重启",
      "update.restartLater": "稍后重启",
      "update.restartConfirm": "重启将重新加载当前页面，确定继续？",
      "update.restarting": "正在重启，页面即将自动重连…",
      "update.restartManual": "请手动重启：在终端停止并重新运行 `dsh web`",
      "update.failed": "更新失败",
      "update.failedText": "更新未能完成：{0}",
      "update.retry": "重试",
      "update.rollback": "回滚",
      "update.rollbackConfirm": "将回滚到上一个版本，确定？",
      "update.cancel": "取消",
      "update.close": "关闭",
      "update.availableToast": "dsh-theme-manager 有新版本 v{0}",
      "update.pill": "主题管理器有新版本 v{0} · 查看",
      "update.view": "查看",
      "update.doneToast": "dsh-theme-manager 已更新到 v{0}",
      "update.notSupport": "当前安装方式不支持一键更新",
      "update.linkSource": "当前为开发链接安装（link:）：请在源码目录更新源码后重启 dsh web",
      "update.noHost": "更新服务不可用（host 未加载），可手动执行安装：",
      "update.updateFailed": "更新未生效",
      "update.updateFailedText": "上次更新到 v{0} 未生效，可能未真正重启或安装被覆盖",
      "update.pendingRestart": "更新已安装，重启后生效"
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
      "empty": "No styles in this category yet.",
      "update.version": "Plugin version",
      "update.checkNow": "Check for updates",
      "update.checking": "Checking…",
      "update.upToDate": "You are up to date",
      "update.available": "New version available",
      "update.update": "Update",
      "update.ignore": "Ignore this version",
      "update.later": "Remind me later",
      "update.ignoreRestore": "Restore reminders",
      "update.ignored": "Ignored versions",
      "update.dialogTitle": "New version available",
      "update.current": "Current version",
      "update.latest": "Latest version",
      "update.changelog": "What's new",
      "update.changelogLoading": "Loading…",
      "update.changelogFail": "Could not load the changelog — see GitHub instead",
      "update.changelogLink": "Full changelog",
      "update.majorWarning": "This is a major release and may contain breaking changes — please review the changelog first",
      "update.stepInstall": "Download & install",
      "update.stepVerify": "Verify install",
      "update.installing": "Updating… please keep this page open",
      "update.log": "Install log",
      "update.done": "Update complete",
      "update.doneText": "Updated to v{0} — restart dsh web to apply",
      "update.restartNow": "Restart now",
      "update.restartLater": "Restart later",
      "update.restartConfirm": "Restarting will reload this page. Continue?",
      "update.restarting": "Restarting… the page will reconnect automatically",
      "update.restartManual": "Please restart manually: stop and re-run `dsh web`",
      "update.failed": "Update failed",
      "update.failedText": "The update could not be completed: {0}",
      "update.retry": "Retry",
      "update.rollback": "Roll back",
      "update.rollbackConfirm": "Roll back to the previous version?",
      "update.cancel": "Cancel",
      "update.close": "Close",
      "update.availableToast": "dsh-theme-manager has a new version v{0}",
      "update.pill": "Theme Manager has a new version v{0} · View",
      "update.view": "View",
      "update.doneToast": "dsh-theme-manager updated to v{0}",
      "update.notSupport": "One-click update is not supported for this install type",
      "update.linkSource": "Development install (link:): update the source in its directory, then restart dsh web",
      "update.noHost": "Update service unavailable (host not loaded). Install manually:",
      "update.updateFailed": "Update did not take effect",
      "update.updateFailedText": "The update to v{0} did not take effect — the app may not have restarted, or the install was overwritten",
      "update.pendingRestart": "Update installed — restart to apply"
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
.tm-updater-root { position: fixed; inset: 0; pointer-events: none; z-index: 9999; font-family: var(--dsw-alias-font-family, inherit); }
.tm-toast { position: fixed; right: 16px; bottom: 64px; display: flex; align-items: center; gap: 10px; max-width: min(420px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l3); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2); pointer-events: auto; animation: tm-rise 0.25s ease; }
.tm-toast-btn { flex: none; }
.tm-pill { position: fixed; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15); cursor: pointer; pointer-events: auto; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); animation: tm-rise 0.3s ease; }
.tm-pill:hover { border-color: var(--dsw-alias-brand-primary); }
.tm-pill-x { color: var(--dsw-alias-label-tertiary); padding: 0 2px; }
.tm-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; pointer-events: auto; animation: tm-fade 0.18s ease; }
.tm-dialog { width: min(460px, calc(100vw - 32px)); max-height: min(80vh, 720px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3); overflow: hidden; }
.tm-dlg-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.tm-dlg-title { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.tm-dlg-x { border: 0; background: transparent; color: var(--dsw-alias-label-tertiary); font-size: 18px; cursor: pointer; padding: 0 4px; }
.tm-dlg-body { padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.tm-version-row { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.tm-version-old { color: var(--dsw-alias-label-tertiary); text-decoration: line-through; }
.tm-version-arrow { color: var(--dsw-alias-label-dimmed); }
.tm-version-new { font-weight: 700; color: var(--dsw-alias-brand-primary); }
.tm-major-warn { background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 18px; }
.tm-dlg-section { display: flex; flex-direction: column; gap: 6px; }
.tm-dlg-sub { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.tm-changelog { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; max-height: 30vh; overflow: auto; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; }
.tm-dlg-link { font-size: 12px; color: var(--dsw-alias-brand-primary); text-decoration: none; }
.tm-dlg-actions { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--dsw-alias-border-l1); }
.tm-steps { display: flex; flex-direction: column; gap: 8px; }
.tm-step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.tm-step .tm-step-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--dsw-alias-border-l3); flex: none; }
.tm-step.on .tm-step-dot { border-color: var(--dsw-alias-brand-primary); animation: tm-pulse 1s ease-in-out infinite; }
.tm-step.done .tm-step-dot { border-color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-primary); }
.tm-step.done .tm-step-dot::after { content: "✓"; color: var(--dsw-alias-label-primary-foreground); font-size: 9px; line-height: 10px; display: block; text-align: center; }
.tm-log-box { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: pre-wrap; max-height: 18vh; overflow: auto; background: var(--dsw-alias-bg-layer-3); border-radius: 8px; padding: 8px 10px; display: none; }
.tm-log-box.open { display: block; }
.tm-dlg-msg { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.tm-dlg-msg.err { color: var(--dsw-alias-state-error-primary); }
.tm-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--dsw-alias-border-l3); border-top-color: var(--dsw-alias-brand-primary); animation: tm-spin 0.8s linear infinite; flex: none; }
.tm-update { margin-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.tm-update-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tm-update-row .tm-sub { flex: 1; min-width: 0; }
.tm-update-warn { background: var(--dsw-alias-state-warn-tertiary); border-radius: 8px; padding: 8px 10px; }
.tm-update-avail { background: var(--dsw-alias-interactive-bg-hover-accent); border-radius: 8px; padding: 8px 10px; }
@keyframes tm-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes tm-spin { to { transform: rotate(360deg); } }
`;

    /* ------------------------------ updater ------------------------------ */

    var UPDATE_KEYS = {
      ignored: "dsh.themeManager.update.ignored",
      dismissed: "dsh.themeManager.update.dismissed",
      lastCheck: "dsh.themeManager.update.lastCheck",
      pending: "dsh.themeManager.update.pending",
      toastSeen: "dsh.themeManager.update.toastSeen"
    };

    function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function lsSet(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } }
    function lsDel(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

    function readIgnored() {
      try { var v = JSON.parse(lsGet(UPDATE_KEYS.ignored) || "[]"); return Array.isArray(v) ? v : []; }
      catch { return []; }
    }
    function writeIgnored(list) { lsSet(UPDATE_KEYS.ignored, JSON.stringify(list)); }
    function isIgnored(version) { return readIgnored().indexOf(String(version)) !== -1; }
    function addIgnored(version) {
      var list = readIgnored();
      if (list.indexOf(String(version)) === -1) { list.push(String(version)); writeIgnored(list); }
    }
    function clearIgnored() { lsDel(UPDATE_KEYS.ignored); }
    function pruneIgnored(upToVersion) {
      var list = readIgnored().filter(function (v) { return isNewer(v, upToVersion); });
      writeIgnored(list);
    }

    function readDismissed() {
      try { var v = JSON.parse(lsGet(UPDATE_KEYS.dismissed) || "{}"); return v && typeof v === "object" ? v : {}; }
      catch { return {}; }
    }
    function dismissedUntil(version) { var v = readDismissed()[String(version)]; return typeof v === "number" ? v : 0; }
    function dismissVersion(version) {
      var v = readDismissed();
      v[String(version)] = Date.now() + 24 * 60 * 60 * 1000;
      lsSet(UPDATE_KEYS.dismissed, JSON.stringify(v));
    }

    function readPending() { return lsGet(UPDATE_KEYS.pending); }
    function writePending(version) { lsSet(UPDATE_KEYS.pending, String(version)); }
    function clearPending() { lsDel(UPDATE_KEYS.pending); }

    function readToastSeen(version) {
      try { var v = JSON.parse(lsGet(UPDATE_KEYS.toastSeen) || "{}"); return !!v[String(version)]; }
      catch { return false; }
    }
    function markToastSeen(version) {
      var v = {};
      try { v = JSON.parse(lsGet(UPDATE_KEYS.toastSeen) || "{}"); } catch { /* ignore */ }
      v[String(version)] = true;
      lsSet(UPDATE_KEYS.toastSeen, JSON.stringify(v));
    }

    function readLastCheck() {
      try { var v = JSON.parse(lsGet(UPDATE_KEYS.lastCheck) || "null"); return v; }
      catch { return null; }
    }
    function writeLastCheck(version) {
      lsSet(UPDATE_KEYS.lastCheck, JSON.stringify({ at: Date.now(), version: version }));
    }

    function parseSemver(v) {
      var m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(v).trim());
      if (!m) return null;
      return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
    }
    /** 1 = a newer, -1 = a older, 0 = equal; null when either side is unparseable. */
    function compareSemver(a, b) {
      var pa = parseSemver(a), pb = parseSemver(b);
      if (!pa || !pb) return null;
      var keys = ["major", "minor", "patch"];
      for (var i = 0; i < keys.length; i++) {
        if (pa[keys[i]] !== pb[keys[i]]) return pa[keys[i]] > pb[keys[i]] ? 1 : -1;
      }
      var preA = pa.pre === null ? 0 : 1;
      var preB = pb.pre === null ? 0 : 1;
      if (preA !== preB) return preA < preB ? 1 : -1; // release > prerelease
      if (pa.pre === null) return 0;
      return pa.pre === pb.pre ? 0 : (pa.pre > pb.pre ? 1 : -1);
    }
    function isNewer(a, b) { var c = compareSemver(a, b); return c !== null && c > 0; }
    function isMajorBump(a, b) {
      var pa = parseSemver(a), pb = parseSemver(b);
      return !!(pa && pb && pa.major !== pb.major);
    }

    /** Resolve a host API path against the page's mount directory (like dsh-market). */
    function apiPath(path) {
      var relative = String(path).replace(/^\/+/, "");
      if (typeof document === "undefined") return "/" + relative;
      return new URL(relative, document.baseURI).pathname;
    }

    function fetchJson(url, timeoutMs, asText) {
      if (typeof fetch !== "function") return Promise.reject(new Error("fetch unavailable"));
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller && timeoutMs ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
      return fetch(url, { signal: controller ? controller.signal : undefined, cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return asText ? res.text() : res.json();
        })
        .finally(function () { if (timer) clearTimeout(timer); });
    }

    var boundT = null;
    function tf(key, args) {
      var s = boundT ? boundT(key) : key;
      if (args) {
        for (var i = 0; i < args.length; i++) s = String(s).split("{" + i + "}").join(String(args[i]));
      }
      return s;
    }

    var updater = {
      info: null,          // host /info payload, or null when the host half is absent
      latest: null,        // latest version seen on the registry (or cached)
      checking: false,
      lastError: null,
      updateFailed: null,  // pending version that did not take effect after a restart
      pendingVersion: readPending(),
      state: "idle",       // idle | installing | done | error | restarting
      stateVersion: null,
      stateMessage: null,
      stepIndex: 0,
      logs: [],
      listeners: [],
      subscribe: function (fn) {
        updater.listeners.push(fn);
        return function () {
          updater.listeners = updater.listeners.filter(function (f) { return f !== fn; });
        };
      },
      emit: function () {
        for (var i = 0; i < updater.listeners.length; i++) {
          try { updater.listeners[i](updater); } catch { /* ignore */ }
        }
      }
    };

    function hasUpdateAvailable() {
      return updater.latest !== null && isNewer(updater.latest, PLUGIN_VERSION);
    }

    function fetchHostInfo() {
      return fetchJson(apiPath("/dsh-theme-manager/api/v1/info"), 6000).catch(function () { return null; });
    }

    function fetchLatestVersion() {
      return fetchJson("https://registry.npmjs.org/dsh-theme-manager/latest", 8000).then(function (doc) {
        return doc && typeof doc.version === "string" ? doc.version : null;
      });
    }

    function checkNow() {
      if (updater.checking) return Promise.resolve(false);
      updater.checking = true;
      updater.lastError = null;
      updater.emit();
      return fetchHostInfo()
        .then(function (info) { updater.info = info; return fetchLatestVersion(); })
        .then(function (latest) {
          updater.checking = false;
          if (latest !== null) { updater.latest = latest; writeLastCheck(latest); }
          updater.emit();
          return hasUpdateAvailable();
        })
        .catch(function (err) {
          updater.checking = false;
          updater.lastError = err && err.message ? err.message : String(err);
          updater.emit();
          return false;
        });
    }

    function afterCheck(promise) {
      promise.then(function (isNew) {
        if (!isNew) return;
        var version = updater.latest;
        if (isIgnored(version)) return;
        if (dismissedUntil(version) > Date.now()) return;
        showPill(version);
        if (!readToastSeen(version)) {
          markToastSeen(version);
          showToast(tf("update.availableToast", [version]));
        }
      });
    }

    function bootUpdater() {
      var pending = readPending();
      if (pending) {
        if (!isNewer(pending, PLUGIN_VERSION)) {
          // Target reached (updated, or rolled back to or past it): celebrate once.
          clearPending();
          pruneIgnored(PLUGIN_VERSION);
          showToast(tf("update.doneToast", [PLUGIN_VERSION]));
        } else {
          // Update installed but the running bundle is still older.
          updater.updateFailed = pending;
        }
        updater.emit();
      }
      var cached = readLastCheck();
      if (cached && cached.version && Date.now() - cached.at < 6 * 60 * 60 * 1000) {
        updater.latest = cached.version;
      }
      setTimeout(function () { afterCheck(checkNow()); }, 2000);
      setInterval(function () { checkNow(); }, 6 * 60 * 60 * 1000);
    }

    /* ---------------------------- updater UI ---------------------------- */

    var updaterRoot = null;
    var toastEl = null;
    var pillEl = null;
    var dialogBackdrop = null;
    var dialogBox = null;

    function ensureRoot() {
      if (updaterRoot) return updaterRoot;
      if (typeof document === "undefined") return null;
      updaterRoot = document.createElement("div");
      updaterRoot.className = "tm-updater-root";
      document.body.appendChild(updaterRoot);
      return updaterRoot;
    }

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function showToast(message) {
      var root = ensureRoot(); if (!root) return;
      hideToast();
      toastEl = document.createElement("div");
      toastEl.className = "tm-toast";
      toastEl.innerHTML = '<span class="tm-toast-text">' + esc(message) + "</span>"
        + '<button class="tm-btn tm-toast-btn" type="button">' + esc(tf("update.view")) + "</button>";
      toastEl.querySelector(".tm-toast-btn").addEventListener("click", function () {
        hideToast();
        openUpdateDialog();
      });
      root.appendChild(toastEl);
      var timer = setTimeout(function () { hideToast(); }, 8000);
      toastEl.addEventListener("mouseenter", function () { clearTimeout(timer); });
      toastEl.addEventListener("mouseleave", function () {
        timer = setTimeout(function () { hideToast(); }, 3000);
      });
    }
    function hideToast() {
      if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      toastEl = null;
    }

    function showPill(version) {
      var root = ensureRoot(); if (!root) return;
      hidePill();
      pillEl = document.createElement("button");
      pillEl.type = "button";
      pillEl.className = "tm-pill";
      pillEl.innerHTML = '<span class="tm-pill-text">' + esc(tf("update.pill", [version])) + "</span>"
        + '<span class="tm-pill-x" aria-hidden="true">×</span>';
      pillEl.addEventListener("click", function (ev) {
        if (ev.target.classList.contains("tm-pill-x")) {
          dismissVersion(updater.latest);
          hidePill();
          return;
        }
        openUpdateDialog();
      });
      root.appendChild(pillEl);
    }
    function hidePill() {
      if (pillEl && pillEl.parentNode) pillEl.parentNode.removeChild(pillEl);
      pillEl = null;
    }

    function dialogKeyHandler(e) {
      if (e.key === "Escape") {
        if (updater.state === "installing" || updater.state === "restarting") return; // never abort mid-flight
        closeDialog();
        if (updater.latest && !isIgnored(updater.latest)) dismissVersion(updater.latest);
      }
    }

    function openUpdateDialog() {
      var root = ensureRoot(); if (!root) return;
      if (!hasUpdateAvailable() && !updater.updateFailed) return;
      closeDialog();
      dialogBackdrop = document.createElement("div");
      dialogBackdrop.className = "tm-backdrop";
      dialogBox = document.createElement("div");
      dialogBox.className = "tm-dialog";
      dialogBox.setAttribute("role", "dialog");
      dialogBox.setAttribute("aria-modal", "true");
      dialogBackdrop.appendChild(dialogBox);
      root.appendChild(dialogBackdrop);
      document.addEventListener("keydown", dialogKeyHandler);
      renderDialogBody("available");
    }

    function openRestartDialog() {
      var root = ensureRoot(); if (!root) return;
      closeDialog();
      dialogBackdrop = document.createElement("div");
      dialogBackdrop.className = "tm-backdrop";
      dialogBox = document.createElement("div");
      dialogBox.className = "tm-dialog";
      dialogBox.setAttribute("role", "dialog");
      dialogBox.setAttribute("aria-modal", "true");
      dialogBackdrop.appendChild(dialogBox);
      root.appendChild(dialogBackdrop);
      document.addEventListener("keydown", dialogKeyHandler);
      renderDialogBody("restartConfirm");
    }

    function closeDialog() {
      if (dialogBackdrop && dialogBackdrop.parentNode) dialogBackdrop.parentNode.removeChild(dialogBackdrop);
      dialogBackdrop = null;
      dialogBox = null;
      document.removeEventListener("keydown", dialogKeyHandler);
    }

    function renderDialogBody(state) {
      if (!dialogBox) return;
      var html = "";
      var head = '<div class="tm-dlg-head"><span class="tm-dlg-title">' + esc(tf("update.dialogTitle")) + "</span>"
        + '<button class="tm-dlg-x" type="button" aria-label="' + esc(tf("update.close")) + '">×</button></div>';
      if (state === "available") {
        html = head + '<div class="tm-dlg-body">'
          + '<div class="tm-version-row"><span class="tm-version-old">v' + esc(PLUGIN_VERSION) + '</span><span class="tm-version-arrow">→</span><span class="tm-version-new">v' + esc(updater.latest) + "</span></div>"
          + (isMajorBump(updater.latest, PLUGIN_VERSION) ? '<div class="tm-major-warn">' + esc(tf("update.majorWarning")) + "</div>" : "")
          + '<div class="tm-dlg-section"><div class="tm-dlg-sub">' + esc(tf("update.changelog")) + "</div>"
          + '<div class="tm-changelog" id="tm-changelog">' + esc(tf("update.changelogLoading")) + "</div>"
          + '<a class="tm-dlg-link" href="https://github.com/runcat-tommy/dsh-theme-manager/releases" target="_blank" rel="noreferrer">' + esc(tf("update.changelogLink")) + " ↗</a></div>"
          + "</div>"
          + '<div class="tm-dlg-actions">'
          + '<button class="tm-btn" type="button" data-act="ignore">' + esc(tf("update.ignore")) + "</button>"
          + '<button class="tm-btn" type="button" data-act="later">' + esc(tf("update.later")) + "</button>"
          + '<button class="tm-btn primary" type="button" data-act="update">' + esc(tf("update.update")) + "</button>"
          + "</div>";
      } else if (state === "manual") {
        var reason = "";
        if (!updater.info) {
          reason = esc(tf("update.noHost")) + ' <code>dsh plugin --profile web add dsh-theme-manager@' + esc(updater.latest || "") + "</code>";
        } else if (updater.info.source === "link") {
          reason = esc(tf("update.linkSource"));
        } else {
          reason = esc(tf("update.notSupport"));
        }
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + reason + "</div></div>"
          + '<div class="tm-dlg-actions"><button class="tm-btn primary" type="button" data-act="close">' + esc(tf("update.close")) + "</button></div>";
      } else if (state === "installing") {
        var steps = [tf("update.stepInstall"), tf("update.stepVerify")];
        var stepHtml = '<div class="tm-steps">';
        for (var i = 0; i < steps.length; i++) {
          var cls = "tm-step";
          if (i < updater.stepIndex) cls += " done";
          else if (i === updater.stepIndex) cls += " on";
          stepHtml += '<div class="' + cls + '"><span class="tm-step-dot"></span>' + esc(steps[i]) + "</div>";
        }
        stepHtml += "</div>";
        html = head + '<div class="tm-dlg-body">'
          + '<div class="tm-dlg-msg">' + esc(tf("update.installing")) + "</div>"
          + stepHtml
          + '<button class="tm-dlg-link" type="button" data-act="log">' + esc(tf("update.log")) + " ▾</button>"
          + '<div class="tm-log-box" id="tm-log"></div>'
          + "</div>"
          + '<div class="tm-dlg-actions"><button class="tm-btn" type="button" data-act="close">' + esc(tf("update.close")) + "</button></div>";
      } else if (state === "done") {
        var doneText = updater.stateVersion
          ? tf("update.doneText", [updater.stateVersion])
          : (updater.pendingVersion ? tf("update.doneText", [updater.pendingVersion]) : tf("update.done"));
        var showRestart = updater.info && updater.info.allowRestart;
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + esc(doneText) + "</div></div>"
          + '<div class="tm-dlg-actions">'
          + '<button class="tm-btn" type="button" data-act="laterRestart">' + esc(tf("update.restartLater")) + "</button>"
          + (showRestart
            ? '<button class="tm-btn primary" type="button" data-act="restart">' + esc(tf("update.restartNow")) + "</button>"
            : '<button class="tm-btn primary" type="button" data-act="manualRestart">' + esc(tf("update.restartManual")) + "</button>")
          + "</div>";
      } else if (state === "error") {
        var errText = tf("update.failedText", [updater.stateMessage || "unknown"]);
        var canRollback = !!updater.info && !!updater.info.pendingRestart;
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg err">' + esc(tf("update.failed")) + "：" + esc(errText) + "</div>"
          + '<button class="tm-dlg-link" type="button" data-act="log">' + esc(tf("update.log")) + " ▾</button>"
          + '<div class="tm-log-box" id="tm-log"></div></div>'
          + '<div class="tm-dlg-actions">'
          + (canRollback ? '<button class="tm-btn" type="button" data-act="rollback">' + esc(tf("update.rollback")) + "</button>" : "")
          + '<button class="tm-btn" type="button" data-act="retry">' + esc(tf("update.retry")) + "</button>"
          + '<button class="tm-btn primary" type="button" data-act="close">' + esc(tf("update.close")) + "</button>"
          + "</div>";
      } else if (state === "restartConfirm") {
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + esc(tf("update.restartConfirm")) + "</div></div>"
          + '<div class="tm-dlg-actions">'
          + '<button class="tm-btn" type="button" data-act="close">' + esc(tf("update.cancel")) + "</button>"
          + '<button class="tm-btn primary" type="button" data-act="restart">' + esc(tf("update.restartNow")) + "</button>"
          + "</div>";
      } else if (state === "rollbackConfirm") {
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + esc(tf("update.rollbackConfirm")) + "</div></div>"
          + '<div class="tm-dlg-actions">'
          + '<button class="tm-btn" type="button" data-act="close">' + esc(tf("update.cancel")) + "</button>"
          + '<button class="tm-btn primary" type="button" data-act="rollback">' + esc(tf("update.rollback")) + "</button>"
          + "</div>";
      } else if (state === "restarting") {
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + esc(tf("update.restarting")) + "</div>"
          + '<div class="tm-steps"><div class="tm-step on"><span class="tm-spinner"></span>' + esc(tf("update.restartNow")) + "</div></div></div>";
      } else if (state === "manualRestart") {
        html = head + '<div class="tm-dlg-body"><div class="tm-dlg-msg">' + esc(tf("update.restartManual")) + "</div></div>"
          + '<div class="tm-dlg-actions"><button class="tm-btn primary" type="button" data-act="close">' + esc(tf("update.close")) + "</button></div>";
      }
      dialogBox.innerHTML = html;

      var x = dialogBox.querySelector(".tm-dlg-x");
      if (x) x.addEventListener("click", function () { closeDialog(); });

      var actions = dialogBox.querySelectorAll("[data-act]");
      for (var a = 0; a < actions.length; a++) {
        actions[a].addEventListener("click", function () {
          var act = this.getAttribute("data-act");
          if (act === "ignore") { addIgnored(updater.latest); hidePill(); closeDialog(); updater.emit(); }
          else if (act === "later") { if (updater.latest) dismissVersion(updater.latest); hidePill(); closeDialog(); }
          else if (act === "update") { startUpdate(); }
          else if (act === "retry") { startUpdate(); }
          else if (act === "rollback") { renderDialogBody("rollbackConfirm"); }
          else if (act === "restart") { requestRestart(); }
          else if (act === "laterRestart") { closeDialog(); }
          else if (act === "manualRestart") { renderDialogBody("manualRestart"); }
          else if (act === "log") {
            var box = dialogBox.querySelector("#tm-log");
            if (box) box.classList.toggle("open");
          }
          else if (act === "close") { closeDialog(); }
        });
      }
      if (state === "available") loadChangelog();
      if ((state === "installing" || state === "error") && updater.logs.length) {
        var logBox = dialogBox.querySelector("#tm-log");
        if (logBox) { logBox.textContent = updater.logs.join("\n"); }
      }
    }

    function loadChangelog() {
      var box = dialogBox && dialogBox.querySelector("#tm-changelog");
      if (!box) return;
      var lang = typeof navigator !== "undefined" && /^zh/iu.test(navigator.language || "") ? "CHANGELOG.md" : "CHANGELOG.en.md";
      var url = "https://raw.githubusercontent.com/runcat-tommy/dsh-theme-manager/main/" + lang;
      fetchJson(url, 8000, true).then(function (text) {
        if (!box) return;
        var lines = String(text).split(/\r?\n/u);
        var head = [];
        for (var i = 0; i < lines.length && head.length < 60; i++) {
          head.push(lines[i]);
          if (/^## /u.test(lines[i]) && head.length > 3) break;
        }
        box.textContent = head.join("\n").trim();
      }).catch(function () {
        if (box) box.textContent = tf("update.changelogFail");
      });
    }

    function handleUpdateMessage(line) {
      var msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "log") {
        updater.logs.push(String(msg.line));
        updater.emit();
        var logBox = dialogBox && dialogBox.querySelector("#tm-log");
        if (logBox) logBox.textContent = updater.logs.join("\n");
        return;
      }
      if (msg.type === "step") {
        if (msg.text === "verify") updater.stepIndex = 1;
        else updater.stepIndex = 0;
        updater.emit();
        return;
      }
      if (msg.type === "done") {
        updater.stepIndex = 2;
        if (msg.ok) {
          var v = msg.version || updater.latest;
          writePending(v);
          updater.pendingVersion = v;
          updater.state = "done";
          updater.stateVersion = v;
        } else {
          updater.state = "error";
          updater.stateMessage = "unknown";
        }
        updater.emit();
        if (dialogBox) renderDialogBody(updater.state);
        return;
      }
      if (msg.type === "error") {
        updater.state = "error";
        updater.stateMessage = msg.message || "unknown";
        updater.emit();
        if (dialogBox) renderDialogBody("error");
      }
    }

    function startUpdate() {
      if (!updater.info || !updater.info.canAutoUpdate) { renderDialogBody("manual"); return; }
      if (updater.info.pendingRestart) { renderDialogBody("done"); return; }
      if (!updater.latest) { closeDialog(); return; }
      updater.state = "installing";
      updater.stateVersion = updater.latest;
      updater.stateMessage = null;
      updater.stepIndex = 0;
      updater.logs = [];
      updater.emit();
      renderDialogBody("installing");
      fetch(apiPath("/dsh-theme-manager/api/v1/update"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: updater.latest }),
        cache: "no-store"
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (j) { throw new Error((j && j.error) || ("HTTP " + res.status)); });
        if (!res.body) throw new Error("no response body");
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buffer += decoder.decode(r.value, { stream: true });
            var lines = buffer.split("\n");
            buffer = lines.pop();
            for (var i = 0; i < lines.length; i++) handleUpdateMessage(lines[i]);
            return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        updater.state = "error";
        updater.stateMessage = err && err.message ? err.message : String(err);
        updater.emit();
        if (dialogBox) renderDialogBody("error");
      });
    }

    function startRollback() {
      updater.state = "installing";
      updater.stateMessage = null;
      updater.stepIndex = 0;
      updater.logs = [];
      updater.emit();
      renderDialogBody("installing");
      fetch(apiPath("/dsh-theme-manager/api/v1/rollback"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        cache: "no-store"
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (j) { throw new Error((j && j.error) || ("HTTP " + res.status)); });
        if (!res.body) throw new Error("no response body");
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buffer += decoder.decode(r.value, { stream: true });
            var lines = buffer.split("\n");
            buffer = lines.pop();
            for (var i = 0; i < lines.length; i++) handleUpdateMessage(lines[i]);
            return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        updater.state = "error";
        updater.stateMessage = err && err.message ? err.message : String(err);
        updater.emit();
        if (dialogBox) renderDialogBody("error");
      });
    }

    function requestRestart() {
      if (!updater.info || !updater.info.allowRestart) { renderDialogBody("manualRestart"); return; }
      updater.state = "restarting";
      updater.emit();
      renderDialogBody("restarting");
      fetch(apiPath("/dsh-theme-manager/api/v1/restart"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        cache: "no-store"
      }).catch(function () { /* connection drop is the normal "restart started" signal */ })
        .then(function () {
          setTimeout(function () { try { window.location.reload(); } catch { /* ignore */ } }, 2500);
        });
    }

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
      var [, forceUpdate] = React.useState(0);
      React.useEffect(function () {
        return updater.subscribe(function () { forceUpdate(function (n) { return n + 1; }); });
      }, []);

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
        el("div", { className: "tm-update" },
          el("div", { className: "tm-update-row" },
            el("span", { className: "tm-sub" }, tf("update.version") + " v" + PLUGIN_VERSION),
            updater.checking ? el("span", { className: "tm-sub" }, tf("update.checking")) : null,
            updater.lastError ? el("span", { className: "tm-sub" }, tf("update.changelogFail")) : null,
            el("button", {
              type: "button",
              className: "tm-btn",
              disabled: updater.checking,
              onClick: function () { afterCheck(checkNow()); },
            }, tf("update.checkNow")),
          ),
          updater.updateFailed ? el("div", { className: "tm-update-row tm-update-warn" },
            el("span", { className: "tm-sub" }, tf("update.updateFailed") + "：" + tf("update.updateFailedText", [updater.updateFailed])),
            el("button", { type: "button", className: "tm-btn", onClick: openRestartDialog }, tf("update.restartNow")),
            el("button", { type: "button", className: "tm-btn", onClick: startRollback }, tf("update.rollback")),
          ) : null,
          updater.info && updater.info.pendingRestart ? el("div", { className: "tm-update-row" },
            el("span", { className: "tm-sub" }, tf("update.pendingRestart")),
            el("button", { type: "button", className: "tm-btn primary", onClick: openRestartDialog }, tf("update.restartNow")),
          ) : null,
          hasUpdateAvailable() && !isIgnored(updater.latest) ? el("div", { className: "tm-update-row tm-update-avail" },
            el("span", { className: "tm-sub" }, tf("update.available") + " v" + updater.latest),
            el("button", { type: "button", className: "tm-btn primary", onClick: openUpdateDialog }, tf("update.update")),
            el("button", { type: "button", className: "tm-btn", onClick: function () { addIgnored(updater.latest); updater.emit(); } }, tf("update.ignore")),
          ) : null,
          readIgnored().length ? el("div", { className: "tm-update-row" },
            el("span", { className: "tm-sub" }, tf("update.ignored") + "：" + readIgnored().join(", ")),
            el("button", { type: "button", className: "tm-btn", onClick: function () { clearIgnored(); updater.emit(); } }, tf("update.ignoreRestore")),
          ) : null,
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
      boundT = t;

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

      // Update reminders: verify a pending restart, then check the registry.
      try { bootUpdater(); } catch (err) { console.warn("[dsh-theme-manager] updater boot failed:", err); }
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "theme"];
    return module.exports;
  },
});
