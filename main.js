/* Quiet Shelf（暗格）
   两个功能，都只改「左侧文件浏览器里显不显示」，绝不移动或改动任何文件：

   1. 暗格 —— 把归档、索引类文件从文件树里收起来。
      物理位置不变、知识图谱不变、搜索与双向链接全部照常，
      只是左侧列表里看不见。支持手动移入，也支持按文件名自动收
      （readme / inbox …），且被手动放回过的文件不会被再次自动收起。

   2. 聚焦 —— 跨层级多选文件夹 / 文件，只留下你此刻要看的这一组，
      其余临时隐藏；可存成命名组合，一键切回。退出即完全恢复。

   实现路线：纯 DOM。
   Obsidian 文件树的每个节点都带 data-path 属性，我们只加一个 .qs-hidden 类，
   由 CSS 负责 display:none。不去碰 fileItems / setCollapsed 那类私有 API ——
   immersive-folder 走的正是那条路，跨版本容易挂，而且「只折叠不隐藏」的机制
   天生做不了跨层级多选。
*/

"use strict";

const {
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  Modal,
} = require("obsidian");


/* ============================================================
   【内联模块 · 自动生成，请勿手改这一段】
   ------------------------------------------------------------
   以下三段来自仓库里的 locales.js / i18n.js / sponsor.js，
   由打包脚本 bundle-inline.js 拼接到此（脚本在 _scratch/_i18n/）。

   为什么不写 require("./locales")：
   Obsidian 注入的 require 是白名单函数，只认 obsidian / @codemirror /
   @lezer 与 Electron 的 window.require，**不解析插件的相对路径** ——
   require("./x") 会返回 undefined，插件直接加载失败。

   改动流程：改源文件 → node bundle-inline.js <插件目录> → 跑 sync-plugins.ps1
   ============================================================ */

/* ---------- 来自 locales.js ---------- */
/* Quiet Shelf（暗格）—— 界面字符串表。
   含命令、右键菜单、两个弹窗、Notice 与设置页的全部界面文字。 */

const COMMON = {
  zh: {
    "settings.language.name": "界面语言",
    "settings.language.desc":
      "设置页、命令与提示的显示语言。「跟随 Obsidian」会随界面语言自动切换。",
    "sponsor.title": "赞助支持",
    "sponsor.body":
      "这些插件都是独立开发并免费开源的，没有任何商业绑定。如果它确实省下了时间，可以通过 GitHub Sponsors 支持后续维护。",
    "meta.version": "版本",
    "meta.repository": "仓库",
    "common.reset": "恢复默认",
    "common.reset.done": "已恢复默认设置",
    "common.clear": "清除",
    "common.open": "打开",
  },
  en: {
    "settings.language.name": "Interface language",
    "settings.language.desc":
      'Language for this settings page, commands and notices. "Follow Obsidian" tracks the app language.',
    "sponsor.title": "Sponsorship",
    "sponsor.body":
      "These plugins are built independently and released free and open-source, with no commercial tie-in. If one of them saves you time, you can support ongoing maintenance via GitHub Sponsors.",
    "meta.version": "Version",
    "meta.repository": "Repository",
    "common.reset": "Restore defaults",
    "common.reset.done": "Settings restored to defaults",
    "common.clear": "Clear",
    "common.open": "Open",
  },
};

const OWN = {
  zh: {
    "meta.desc":
      "把归档与索引类笔记从文件树里收起来（不移动文件），并支持一次只聚焦一组文件夹。",

    "command.openShelf": "打开暗格",
    "command.batch": "批量移入 / 移出暗格",
    "command.toggleShelve": "把当前文件移入 / 移出暗格",
    "command.toggleFocus": "切换聚焦模式",
    "command.focusFolder": "聚焦当前文件所在文件夹",
    "command.clearFocus": "退出聚焦（保留暗格规则）",
    "command.saveSet": "把当前聚焦存为组合",

    "menu.reveal": "从暗格放回",
    "menu.shelve": "移入暗格",
    "menu.unfocus": "从聚焦移除",
    "menu.focus": "加入聚焦",

    "notice.revealed": "已从暗格放回：{path}",
    "notice.shelved": "已移入暗格：{path}",
    "notice.noActiveFile": "当前没有打开的文件",
    "notice.focusEmpty": "聚焦清单是空的 —— 先对文件夹用「加入聚焦」",
    "notice.focusOn": "已进入聚焦：{n} 项",
    "notice.focusOff": "已退出聚焦",
    "notice.restoreExitedFocus": "为显示放回的项目，已退出聚焦；聚焦清单仍保留。",
    "notice.saveFailed": "当前显示已更新，但设置未保存。重启后可能恢复旧状态，请检查配置文件写入权限或同步冲突后重试。",
    "focus.activeHint": "聚焦正在开启：未选中的文件夹和文件会被隐藏。退出聚焦不会清空暗格规则或聚焦清单。",
    "notice.focused": "已加入聚焦：{path}",
    "notice.nothingToSave": "聚焦清单是空的，没什么可存的",
    "notice.setSaved": "已保存组合：{name}",
    "notice.setSwitched": "已切换到组合：{name}",
    "notice.pickFirst": "先勾选要处理的项目",
    "notice.batchDone": "已移入暗格 {n} 项",
    "notice.batchReverted": "已从暗格放回 {n} 项",

    "prompt.setName.title": "给这组聚焦起个名字",
    "prompt.setName.default": "组合 {n}",

    "kind.folder": "文件夹",
    "kind.file": "文件",
    "kind.stale": "已失效",

    "shelf.title": "暗格 · {n} 项",
    "shelf.hint":
      "这里只隐藏文件树，不移动文件。放回时会一并放回挡住它的上级目录；若项目不在聚焦范围，会退出聚焦以恢复显示。",
    "shelf.empty": "暗格是空的。",
    "shelf.tagAuto": "自动",
    "shelf.restore": "放回",

    "batch.title": "批量管理",
    "batch.hint":
      "勾选后批量移入或放回，不改动文件。放回时会解除上级目录的暗格隐藏；若聚焦挡住所选项目，会同时退出聚焦。",
    "batch.filter": "筛选路径…",
    "batch.expandAll": "展开全部",
    "batch.collapseAll": "折叠全部",
    "batch.selectResults": "选中当前结果",
    "batch.clearSelection": "清空选择",
    "batch.shelve": "移入暗格",
    "batch.reveal": "从暗格放回",
    "batch.count": "已选 {n} 项",
    "batch.countNone": "还没勾选任何项",
    "batch.topLevel": "（整个 vault）",
    "batch.noMatch": "没有匹配的路径。",
    "batch.alreadyShelved": "已在暗格",

    "settings.autoRules.name": "自动收起的文件名",
    "settings.autoRules.desc":
      "每行一个关键词（不含 .md 后缀，不区分大小写）。用 * 作通配符：index 精确匹配；index* 以 index 开头；*index 以 index 结尾；*index* 含 index 即收起（如 _Aesthetic Index）。被手动放回过的文件不会再被自动收起。",
    "settings.autoEnabled.name": "启用自动规则",
    "settings.autoEnabled.desc": "关掉后只保留手动移入暗格的项目。",
    "settings.openShelf.name": "打开暗格清单",
    "settings.openShelf.desc": "查看当前所有被收起的项目，并可逐个放回。",
    "settings.batch.name": "批量管理",
    "settings.batch.desc":
      "把整个 vault 摊成可勾选的列表，一次把多个文件夹或文件移入暗格 / 放回。带筛选框，也可以「选中当前结果」一次性处理某个路径下的全部内容。",
    "settings.focus.heading": "聚焦",
    "settings.focusList.name": "当前聚焦清单（{n} 项）",
    "settings.focusList.empty":
      "空。在文件上右键选「加入聚焦」，或先打开一篇笔记再用命令「聚焦当前文件所在文件夹」。",
    "settings.savedSets.heading": "已保存的组合",
    "settings.setSwitch": "切换",
    "settings.setDelete": "删除",
    "settings.reset.name": "恢复默认设置",
    "settings.reset.desc":
      "清掉暗格清单、已放回记录、聚焦目标与已保存组合（自动规则的关键词会回到 readme / inbox）。",
  },

  en: {
    "meta.desc":
      "Tuck archived and index notes out of the file explorer without moving them, and focus on one set of folders at a time.",

    "command.openShelf": "Open shelf",
    "command.batch": "Batch shelve / restore",
    "command.toggleShelve": "Shelve or restore the active file",
    "command.toggleFocus": "Toggle focus mode",
    "command.focusFolder": "Focus the active file's folder",
    "command.clearFocus": "Exit focus (keep shelf rules)",
    "command.saveSet": "Save current focus as a set",

    "menu.reveal": "Restore from shelf",
    "menu.shelve": "Move to shelf",
    "menu.unfocus": "Remove from focus",
    "menu.focus": "Add to focus",

    "notice.revealed": "Restored from shelf: {path}",
    "notice.shelved": "Moved to shelf: {path}",
    "notice.noActiveFile": "No file is open",
    "notice.focusEmpty": 'The focus list is empty — add a folder to focus first',
    "notice.focusOn": "Focus on: {n} item(s)",
    "notice.focusOff": "Focus off",
    "notice.restoreExitedFocus": "Exited focus to show the restored items. Your focus list is kept.",
    "notice.saveFailed": "The view is updated, but settings were not saved. Old settings may return after restart. Check write access or sync conflicts, then retry.",
    "focus.activeHint": "Focus is on: unselected folders and files are hidden. Exiting focus keeps your shelf rules and focus list.",
    "notice.focused": "Added to focus: {path}",
    "notice.nothingToSave": "The focus list is empty, nothing to save",
    "notice.setSaved": "Saved set: {name}",
    "notice.setSwitched": "Switched to set: {name}",
    "notice.pickFirst": "Select something to act on first",
    "notice.batchDone": "Moved {n} item(s) to the shelf",
    "notice.batchReverted": "Restored {n} item(s) from the shelf",

    "prompt.setName.title": "Name this focus set",
    "prompt.setName.default": "Set {n}",

    "kind.folder": "Folder",
    "kind.file": "File",
    "kind.stale": "Missing",

    "shelf.title": "Shelf · {n} item(s)",
    "shelf.hint":
      "Only the file tree is filtered; no files are moved. Restore also restores any shelved ancestors. If focus excludes the item, focus is exited so it can be shown.",
    "shelf.empty": "The shelf is empty.",
    "shelf.tagAuto": "auto",
    "shelf.restore": "Restore",

    "batch.title": "Batch manage",
    "batch.hint":
      "Select items to shelve or restore without changing files. Restore also restores shelved ancestors and exits focus if it excludes any selected item.",
    "batch.filter": "Filter paths…",
    "batch.expandAll": "Expand all",
    "batch.collapseAll": "Collapse all",
    "batch.selectResults": "Select results",
    "batch.clearSelection": "Clear selection",
    "batch.shelve": "Move to shelf",
    "batch.reveal": "Restore from shelf",
    "batch.count": "{n} selected",
    "batch.countNone": "Nothing selected yet",
    "batch.topLevel": "(entire vault)",
    "batch.noMatch": "No matching paths.",
    "batch.alreadyShelved": "on shelf",

    "settings.autoRules.name": "Auto-shelved file names",
    "settings.autoRules.desc":
      "One keyword per line (without the .md extension, case-insensitive). Use * as a wildcard: index matches exactly; index* starts with index; *index ends with index; *index* contains index (e.g. _Aesthetic Index). Anything you restored by hand is never auto-shelved again.",
    "settings.autoEnabled.name": "Enable auto rules",
    "settings.autoEnabled.desc": "With this off, only hand-picked items stay on the shelf.",
    "settings.openShelf.name": "Open the shelf list",
    "settings.openShelf.desc": "Review everything currently shelved and restore items one by one.",
    "settings.batch.name": "Batch manage",
    "settings.batch.desc":
      "Lay the whole vault out as a tickable list and shelve or restore many folders/files at once. Includes a filter box and a \"select results\" shortcut for a whole path.",
    "settings.focus.heading": "Focus",
    "settings.focusList.name": "Current focus list ({n})",
    "settings.focusList.empty":
      'Empty. Right-click a file and choose "Add to focus", or open a note and run "Focus the active file\'s folder".',
    "settings.savedSets.heading": "Saved sets",
    "settings.setSwitch": "Switch",
    "settings.setDelete": "Delete",
    "settings.reset.name": "Restore defaults",
    "settings.reset.desc":
      "Clear the shelf, the restored list, the focus targets and every saved set (auto-rule keywords return to readme / inbox).",
  },
};
const LOCALES = buildLocales();
/** 把公共表与本插件表合并；插件缺某语言时回落到英语。 */
function buildLocales() {
  const out = {};
  const langs = new Set([...Object.keys(COMMON), ...Object.keys(OWN)]);
  for (const lang of langs) {
    out[lang] = Object.assign(
      {},
      COMMON[lang] || COMMON.en,
      OWN[lang] || OWN.en
    );
  }
  return out;
}

/* ---------- 来自 i18n.js ---------- */
/* i18n —— 多语言运行时。

   为什么不用 Obsidian 的 moment.locale()：moment 只管日期格式化，不提供
   界面字符串表；而且用户在设置页切语言要即时生效，moment 的切换要等界面重建。

   设计约束：
   - t() 永不抛异常：缺键回落到英语，英语也缺就返回键名本身。
     设置页少一行字，好过整页白屏。
   - 支持 {name} 占位符；参数没给就原样保留，方便定位漏传。
   - 界面字符串全部集中在 locales.js，main.js 里不留字面量。

   这份 i18n.js 在四个自研插件里是同一份（各自复制，因为插件是独立仓库、
   不能互相 require）。改动请四处同步。 */

/** 设置页语言下拉框的定义顺序。 */
const LANGUAGE_OPTIONS = [
  { id: "auto", label: "跟随 Obsidian / Follow Obsidian" },
  { id: "zh", label: "简体中文" },
  { id: "en", label: "English" },
];

/**
 * 把偏好解析成实际语言 id。
 * "auto" 时读 Obsidian 的界面语言；任何异常都回落到英语 ——
 * 语言探测失败不值得让设置页打不开。
 */
function resolveLanguage(pref) {
  if (pref && pref !== "auto" && LOCALES[pref]) return pref;
  try {
    const raw =
      window.localStorage.getItem("language") ||
      document.documentElement.lang ||
      "";
    const short = String(raw).toLowerCase().slice(0, 2);
    if (short && LOCALES[short]) return short;
  } catch (e) {
    /* 忽略：回落英语 */
  }
  return "en";
}

function translate(lang, key, vars) {
  const table = LOCALES[lang] || LOCALES.en;
  let s = table[key];
  if (s === undefined) {
    const fb = LOCALES.en[key];
    s = fb === undefined ? key : fb;
  }
  if (!vars) return s;
  return String(s).replace(/\{(\w+)\}/g, (m, name) =>
    vars[name] === undefined ? m : String(vars[name])
  );
}

/** 绑定插件实例：读 settings.language，暴露 t()。 */
function bindI18n(plugin) {
  const current = () =>
    resolveLanguage(plugin && plugin.settings ? plugin.settings.language : "auto");

  plugin.i18n = {
    get resolved() {
      return current();
    },
    t(key, vars) {
      return translate(current(), key, vars);
    },
    options: LANGUAGE_OPTIONS,
  };
  return plugin.i18n;
}

/* ---------- 来自 sponsor.js ---------- */
/* 赞助区块。
 *
 * 刻意做成一个独立小节而不是塞进说明文字里：设置页是用户唯一会认真读的
 * 地方，藏起来等于没有。区块只渲染链接，不引任何外部脚本或图片 ——
 * 插件必须保持零网络请求，否则会在社区市场审核时被质疑。
 *
 * 为什么只有 GitHub Sponsors 一条：
 *   最初国内 / 海外分列（爱发电 + Ko-fi），但 qy 决定统一走 GitHub ——
 *   单一入口便于维护，也避免在插件里出现多个可能失效/需要实名认证的平台。
 *   保留 SPONSORS 数组结构（而不是塌成一个字符串），是为了将来真要加
 *   第二条时改数据即可，不用动渲染代码。
 */

const SPONSORS = [
  { label: "GitHub Sponsors", url: "https://github.com/sponsors/yunmin311" },
];

function linkRow(parent, label, url) {
  const a = parent.createEl("a", { cls: "sp-link", text: label, href: url });
  a.setAttr("target", "_blank");
  a.setAttr("rel", "noopener");
}

/** 在 parent 里渲染赞助区块。t 是当前语言的取词函数。 */
function renderSponsor(parent, t) {
  const box = parent.createDiv({ cls: "sp-box" });
  box.createDiv({ cls: "sp-title", text: t("sponsor.title") });
  box.createDiv({ cls: "sp-body", text: t("sponsor.body") });

  const row = box.createDiv({ cls: "sp-row" });
  for (const l of SPONSORS) linkRow(row, l.label, l.url);
}

/* ======================== 内联模块结束 ======================== */
const HIDDEN_CLASS = "qs-hidden";
const EXPLORER_SELECTOR = ".nav-files-container";
const APPLY_DELAY_MS = 32;

const DEFAULTS = {
  shelved: [],
  revealed: [],
  autoRules: ["readme", "inbox"],
  autoEnabled: true,
  focusActive: false,
  focusTargets: [],
  savedSets: [],
  // 界面语言：auto / zh / en（见 i18n.js）。
  language: "auto",
};

class QuietShelfPlugin extends Plugin {
  async onload() {
    this._unloaded = false;
    this.settings = Object.assign({}, DEFAULTS, (await this.loadData()) || {});
    if (this._unloaded) return;

    bindI18n(this);
    const t = (k, v) => this.i18n.t(k, v);

    this.app.workspace.onLayoutReady(() => this.setupObserver());

    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.setupObserver())
    );

    // 文件被重命名 / 删除 / 新建时，隐藏清单里的旧路径要跟着走
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.renamePath(oldPath, file.path);
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.buildFileMenu(menu, file);
      })
    );

    this.addCommand({
      id: "open-shelf",
      name: t("command.openShelf"),
      callback: () => new ShelfModal(this.app, this).open(),
    });

    this.addCommand({
      id: "batch-manage",
      name: t("command.batch"),
      callback: () => new BatchModal(this.app, this).open(),
    });

    this.addCommand({
      id: "toggle-shelve",
      name: t("command.toggleShelve"),
      callback: () => this.toggleShelveActiveFile(),
    });

    this.addCommand({
      id: "toggle-focus",
      name: t("command.toggleFocus"),
      callback: () => this.toggleFocus(),
    });

    this.addCommand({
      id: "focus-active-folder",
      name: t("command.focusFolder"),
      callback: () => this.addFocusActiveFolder(),
    });

    this.addCommand({
      id: "clear-focus",
      name: t("command.clearFocus"),
      callback: () => this.clearFocus(),
    });

    this.addCommand({
      id: "save-focus-set",
      name: t("command.saveSet"),
      callback: () => this.saveFocusSet(),
    });

    this.addSettingTab(new QuietShelfSettingTab(this.app, this));
  }

  onunload() {
    // onLayoutReady and pending save continuations may outlive this instance.
    this._unloaded = true;
    this.teardownObserver();
    this.stripAllMarks();
  }

  /* ---------- 判定 ---------- */

  /**
   * 命中自动规则吗（按文件名匹配，去掉 .md 后缀，大小写不敏感）
   *
   * 四种写法，`*` 是通配符，位置决定匹配方式：
   *   index     精确 —— 文件名正好是 "index"
   *   index*    开头 —— 文件名以 "index" 开头（如 index-old）
   *   *index    结尾 —— 文件名以 "index" 结尾（如 _Aesthetic Index）
   *   *index*   包含 —— 文件名里含 "index"（如 my-index-old）
   *
   * 为什么不干脆都做成「包含」：规则里的 "hub" 若一律包含匹配，
   * 会把 "github" 一起收进去。三种写法并存，才能精确表达意图。
   */
  matchesAutoRule(path) {
    if (!this.settings.autoEnabled) return false;
    const name = String(path).split("/").pop() || "";
    const base = name.replace(/\.md$/i, "").toLowerCase();
    return (this.settings.autoRules || []).some((rule) => {
      const key = String(rule).trim().toLowerCase();
      if (!key) return false;

      const head = key.startsWith("*");
      const tail = key.endsWith("*");
      if (!head && !tail) return base === key;

      // 去掉两端的 `*` 取词干。注意 `*index*` 两边都要剥。
      const needle = key.slice(head ? 1 : 0, tail ? -1 : undefined).trim();
      // 光写一个 `*`（或 `**`）没意义，视为无效规则，不收任何东西
      if (!needle) return false;

      if (head && tail) return base.includes(needle);
      if (tail) return base.startsWith(needle);
      return base.endsWith(needle);
    });
  }

  /** 是否该进暗格 */
  isShelved(path) {
    if (this.settings.revealed.includes(path)) return false;
    if (this.settings.shelved.includes(path)) return true;
    return this.matchesAutoRule(path);
  }

  /** 是否被聚焦模式排除在外（选中的那一组、它们的祖先与后代都保留） */
  isFocusedOut(path) {
    if (!this.settings.focusActive) return false;
    const targets = this.settings.focusTargets || [];
    if (!targets.length) return false;
    return !targets.some(
      (t) =>
        path === t ||
        path.startsWith(t + "/") || // path 在目标里面
        t.startsWith(path + "/") // path 是目标的父级（得留着才能走到目标）
    );
  }

  shouldHide(path) {
    return this.isShelved(path) || this.isFocusedOut(path);
  }

  /* ---------- DOM 打标 ---------- */

  setupObserver() {
    if (this._unloaded) return;
    const container = document.querySelector(EXPLORER_SELECTOR);
    if (!container) return;
    if (container === this.observedContainer && this.observer) {
      this.apply();
      return;
    }

    this.teardownObserver();
    this.observedContainer = container;

    // 只监听节点增删：我们改的是 class，不会触发自己，不存在回环
    this.observer = new MutationObserver(() => this.scheduleApply());
    this.observer.observe(container, { childList: true, subtree: true });

    this.apply();
  }

  teardownObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observedContainer = null;
    if (this.applyTimer) {
      window.clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
  }

  scheduleApply() {
    if (this._unloaded) return;
    if (this.applyTimer) return;
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = null;
      this.apply();
    }, APPLY_DELAY_MS);
  }

  apply() {
    if (this._unloaded) return;
    // data-path 挂在标题行（.tree-item-self）上 —— immersive-folder 用的就是
    // ".tree-item-self[data-path]"；但也有版本把它放在外层 .tree-item 上。
    // 这里同时兼容：先抓所有带 data-path 的元素，再统一往上取所属的 .tree-item，
    // 因为要隐藏的是整个节点（这样才会连带它下面的 .tree-item-children 一起收掉）。
    const containers = document.querySelectorAll(EXPLORER_SELECTOR);
    if (!containers.length) return;

    for (const container of containers) {
      const marked = container.querySelectorAll("[data-path]");
      const seen = new Set();
      for (const el of marked) {
        const path = el.getAttribute("data-path");
        if (!path || seen.has(path)) continue;
        seen.add(path);
        const node = el.closest(".tree-item") || el;
        node.classList.toggle(HIDDEN_CLASS, this.shouldHide(path));
      }
    }
  }

  stripAllMarks() {
    const nodes = document.querySelectorAll("." + HIDDEN_CLASS);
    for (const el of nodes) el.classList.remove(HIDDEN_CLASS);
  }

  /* ---------- 暗格操作 ---------- */

  async shelve(path) {
    if (!path) return;
    const revealed = this.settings.revealed.filter((p) => p !== path);
    const shelved = this.settings.shelved.includes(path)
      ? this.settings.shelved
      : this.settings.shelved.concat(path);
    this.settings.revealed = revealed;
    this.settings.shelved = shelved;
    await this.save();
  }

  async reveal(path) {
    if (!path) return;
    await this.revealMany([path]);
  }

  /** 批量移入暗格 —— 逐个 await 会写盘 N 次，这里合并成一次 */
  async shelveMany(paths) {
    if (!paths || !paths.length) return 0;
    const shelved = new Set(this.settings.shelved);
    const revealed = new Set(this.settings.revealed);
    for (const p of paths) {
      revealed.delete(p);
      shelved.add(p);
    }
    this.settings.shelved = Array.from(shelved);
    this.settings.revealed = Array.from(revealed);
    await this.save();
    this.apply();
    return paths.length;
  }

  /** 批量放回 —— 同样只写一次盘 */
  async revealMany(paths) {
    if (!paths || !paths.length) return 0;
    const shelved = new Set(this.settings.shelved);
    const revealed = new Set(this.settings.revealed);
    const exitFocus = paths.some((p) => this.isFocusedOut(p));
    for (const p of paths) {
      shelved.delete(p);
      revealed.add(p);
      // A restored child is still invisible if an ancestor is shelved. Restore
      // only blocking ancestors, leaving unrelated explicit shelf entries alone.
      const parts = p.split("/");
      while (parts.length > 1) {
        parts.pop();
        const parent = parts.join("/");
        if (this.isShelved(parent)) {
          shelved.delete(parent);
          revealed.add(parent);
        }
      }
    }
    this.settings.shelved = Array.from(shelved);
    this.settings.revealed = Array.from(revealed);
    if (exitFocus) {
      this.settings.focusActive = false;
      new Notice(this.i18n.t("notice.restoreExitedFocus"));
    }
    await this.save();
    this.apply();
    return paths.length;
  }

  /** 手动放回 = 加进 revealed，既撤掉当前的，也挡住自动规则 */
  async toggleShelve(path) {
    if (this.isShelved(path)) {
      await this.reveal(path);
      new Notice(this.i18n.t("notice.revealed", { path }));
    } else {
      await this.shelve(path);
      new Notice(this.i18n.t("notice.shelved", { path }));
    }
    this.apply();
  }

  toggleShelveActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(this.i18n.t("notice.noActiveFile"));
      return;
    }
    this.toggleShelve(file.path);
  }

  /**
   * 文件重命名 / 移动后同步清单里的路径，否则隐藏清单会指向不存在的路径。
   * oldPath 是文件夹时，里面所有子项的路径也要一起改。
   */
  async renamePath(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) return;
    let touched = false;
    const remap = (list) =>
      list.map((p) => {
        if (p === oldPath) {
          touched = true;
          return newPath;
        }
        if (p.startsWith(oldPath + "/")) {
          touched = true;
          return newPath + p.slice(oldPath.length);
        }
        return p;
      });

    this.settings.shelved = remap(this.settings.shelved);
    this.settings.revealed = remap(this.settings.revealed);
    this.settings.focusTargets = remap(this.settings.focusTargets);
    this.settings.savedSets = (this.settings.savedSets || []).map((s) => ({
      name: s.name,
      targets: remap(s.targets || []),
    }));

    if (touched) await this.save();
    this.apply();
  }

  kindOf(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f && f.children) return this.i18n.t("kind.folder");
    if (f) return this.i18n.t("kind.file");
    return this.i18n.t("kind.stale");
  }

  /** 暗格全部内容：手动的 + 自动规则命中的 */
  listShelved() {
    const out = [];
    const seen = new Set();

    for (const path of this.settings.shelved) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({ path, kind: this.kindOf(path), auto: false });
    }

    if (this.settings.autoEnabled) {
      for (const f of this.app.vault.getAllLoadedFiles()) {
        const path = f && f.path;
        if (!path || path === "/" || seen.has(path)) continue;
        if (this.settings.revealed.includes(path)) continue;
        if (!this.matchesAutoRule(path)) continue;
        seen.add(path);
        out.push({
          path,
          kind: f.children ? this.i18n.t("kind.folder") : this.i18n.t("kind.file"),
          auto: true,
        });
      }
    }

    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
  }

  /* ---------- 聚焦 ---------- */

  async toggleFocus() {
    if (this.settings.focusActive) {
      await this.clearFocus();
      return;
    }
    if (!this.settings.focusTargets.length) {
      new Notice(this.i18n.t("notice.focusEmpty"));
      return;
    }
    this.settings.focusActive = true;
    await this.save();
    this.apply();
    new Notice(
      this.i18n.t("notice.focusOn", { n: this.settings.focusTargets.length })
    );
  }

  async clearFocus() {
    this.settings.focusActive = false;
    if (await this.save()) new Notice(this.i18n.t("notice.focusOff"));
  }

  renderFocusStatus(container, refresh) {
    if (!this.settings.focusActive) return;
    const box = container.createDiv({ cls: "qs-focus-status" });
    box.createDiv({ text: this.i18n.t("focus.activeHint") });
    const button = box.createEl("button", { text: this.i18n.t("command.clearFocus") });
    button.addEventListener("click", async () => {
      await this.clearFocus();
      refresh();
    });
  }

  async addFocusTarget(path) {
    if (!path) return;
    if (!this.settings.focusTargets.includes(path)) {
      this.settings.focusTargets = this.settings.focusTargets.concat(path);
      await this.save();
    }
    if (!this.settings.focusActive) {
      this.settings.focusActive = true;
      await this.save();
    }
    this.apply();
    new Notice(this.i18n.t("notice.focused", { path }));
  }

  async removeFocusTarget(path) {
    this.settings.focusTargets = this.settings.focusTargets.filter(
      (p) => p !== path
    );
    if (!this.settings.focusTargets.length) this.settings.focusActive = false;
    await this.save();
    this.apply();
  }

  addFocusActiveFolder() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(this.i18n.t("notice.noActiveFile"));
      return;
    }
    const dir = file.parent && file.parent.path;
    this.addFocusTarget(dir && dir !== "/" ? dir : file.path);
  }

  async saveFocusSet() {
    const targets = this.settings.focusTargets || [];
    if (!targets.length) {
      new Notice(this.i18n.t("notice.nothingToSave"));
      return;
    }
    const name = window.prompt(
      this.i18n.t("prompt.setName.title"),
      this.i18n.t("prompt.setName.default", {
        n: this.settings.savedSets.length + 1,
      })
    );
    if (!name) return;
    this.settings.savedSets = this.settings.savedSets
      .filter((s) => s.name !== name)
      .concat({ name, targets: targets.slice() });
    await this.save();
    new Notice(this.i18n.t("notice.setSaved", { name }));
  }

  async applyFocusSet(name) {
    const set = (this.settings.savedSets || []).find((s) => s.name === name);
    if (!set) return;
    this.settings.focusTargets = (set.targets || []).slice();
    this.settings.focusActive = true;
    await this.save();
    this.apply();
    new Notice(this.i18n.t("notice.setSwitched", { name }));
  }

  async deleteFocusSet(name) {
    this.settings.savedSets = (this.settings.savedSets || []).filter(
      (s) => s.name !== name
    );
    await this.save();
  }

  /* ---------- 菜单 ---------- */

  buildFileMenu(menu, file) {
    if (!file || !file.path) return;
    const shelved = this.isShelved(file.path);

    menu.addItem((item) =>
      item
        .setTitle(
          this.i18n.t(shelved ? "menu.reveal" : "menu.shelve")
        )
        .setIcon("archive")
        .onClick(() => this.toggleShelve(file.path))
    );

    if (file.children) {
      const inFocus = this.settings.focusTargets.includes(file.path);
      menu.addItem((item) =>
        item
          .setTitle(this.i18n.t(inFocus ? "menu.unfocus" : "menu.focus"))
          .setIcon("focus")
          .onClick(() =>
            inFocus ? this.removeFocusTarget(file.path) : this.addFocusTarget(file.path)
          )
      );
    }
  }

  /* ---------- 存取 ---------- */

  async save() {
    // Showing the tree must not wait for (or depend on) a successful disk write.
    // apply() is also guarded against continuations from an unloaded instance.
    this.apply();
    try {
      await this.saveData(this.settings);
      return true;
    } catch (error) {
      console.error("[Quiet Shelf] Settings could not be saved", error);
      if (!this._unloaded) new Notice(this.i18n.t("notice.saveFailed"), 10000);
      return false;
    }
  }
}

class ShelfModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.contentEl.addClass("qs-modal");
    this.render();
  }

  render() {
    const { contentEl } = this;
    const t = (k, v) => this.plugin.i18n.t(k, v);
    contentEl.empty();

    this.plugin.renderFocusStatus(contentEl, () => this.render());
    const items = this.plugin.listShelved();
    contentEl.createEl("h4", { text: t("shelf.title", { n: items.length }) });
    contentEl.createDiv({
      cls: "qs-modal-hint",
      text: t("shelf.hint"),
    });

    if (!items.length) {
      contentEl.createDiv({ cls: "qs-modal-empty", text: t("shelf.empty") });
      return;
    }

    const list = contentEl.createDiv({ cls: "qs-modal-list" });
    for (const it of items) {
      const row = list.createDiv({ cls: "qs-modal-row" });
      row.createSpan({ cls: "qs-modal-kind", text: it.kind });
      row.createSpan({ cls: "qs-modal-path", text: it.path });
      if (it.auto) {
        row.createSpan({ cls: "qs-modal-tag", text: t("shelf.tagAuto") });
      }
      const btn = row.createEl("button", { text: t("shelf.restore") });
      btn.addEventListener("click", async () => {
        await this.plugin.reveal(it.path);
        this.plugin.apply();
        this.render();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** 批量管理：把整个 vault 摊成可勾选的树，一次移入或放回 */
class BatchModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.selected = new Set();
    this.expanded = new Set();
    this.query = "";
  }

  onOpen() {
    this.contentEl.addClass("qs-modal");
    this.contentEl.addClass("qs-batch");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  render() {
    const { contentEl } = this;
    const t = (k, v) => this.plugin.i18n.t(k, v);
    contentEl.empty();

    this.plugin.renderFocusStatus(contentEl, () => this.render());
    contentEl.createEl("h4", { text: t("batch.title") });
    contentEl.createDiv({
      cls: "qs-modal-hint",
      text: t("batch.hint"),
    });

    const bar = contentEl.createDiv({ cls: "qs-batch-bar" });
    const search = bar.createEl("input", {
      type: "search",
      placeholder: t("batch.filter"),
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLowerCase();
      this.renderTree();
    });

    const mkBtn = (label, fn) => {
      const b = bar.createEl("button", { text: label });
      b.addEventListener("click", fn);
    };
    mkBtn(t("batch.expandAll"), () => {
      this.expanded = new Set(this.allFolderPaths());
      this.renderTree();
    });
    mkBtn(t("batch.collapseAll"), () => {
      this.expanded.clear();
      this.renderTree();
    });
    mkBtn(t("batch.selectResults"), () => {
      for (const n of this.allPaths()) this.selected.add(n);
      this.renderTree();
    });
    mkBtn(t("batch.clearSelection"), () => {
      this.selected.clear();
      this.renderTree();
    });

    this.treeEl = contentEl.createDiv({ cls: "qs-batch-tree" });
    this.renderTree();

    const foot = contentEl.createDiv({ cls: "qs-batch-foot" });
    this.countEl = foot.createSpan({ cls: "qs-batch-count" });
    const bShelve = foot.createEl("button", {
      text: t("batch.shelve"),
      cls: "mod-cta",
    });
    const bReveal = foot.createEl("button", { text: t("batch.reveal") });
    bShelve.addEventListener("click", () => this.run("shelve"));
    bReveal.addEventListener("click", () => this.run("reveal"));

    this.updateCount();
  }

  /* ---------- 数据 ---------- */

  loadedFiles() {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f) => f && f.path && f.path !== "/");
  }

  allFolderPaths() {
    return this.loadedFiles()
      .filter((f) => Array.isArray(f.children))
      .map((f) => f.path);
  }

  allPaths() {
    if (this.query) {
      return this.loadedFiles()
        .filter((f) => f.path.toLowerCase().includes(this.query))
        .map((f) => f.path);
    }
    return this.loadedFiles().map((f) => f.path);
  }

  buildTree() {
    const root = {
      path: "",
      name: this.plugin.i18n.t("batch.topLevel"),
      isFolder: true,
      children: [],
    };
    const map = new Map([["", root]]);
    const files = this.loadedFiles().sort((a, b) => a.path.localeCompare(b.path));

    for (const f of files) {
      const parentPath = f.parent && f.parent.path !== "/" ? f.parent.path : "";
      const parent = map.get(parentPath) || root;
      const node = {
        path: f.path,
        name: f.name,
        isFolder: Array.isArray(f.children),
        children: [],
      };
      parent.children.push(node);
      map.set(f.path, node);
    }
    return root;
  }

  /* ---------- 渲染 ---------- */

  renderTree() {
    const tree = this.treeEl;
    if (!tree) return;
    tree.empty();

    if (this.query) {
      // 筛选时摊平：命中即列出，不再按层级折叠
      const hits = this.loadedFiles()
        .filter((f) => f.path.toLowerCase().includes(this.query))
        .sort((a, b) => a.path.localeCompare(b.path));
      if (!hits.length) {
        tree.createDiv({
          cls: "qs-modal-empty",
          text: this.plugin.i18n.t("batch.noMatch"),
        });
      } else {
        for (const f of hits) {
          this.renderRow(tree, {
            path: f.path,
            name: f.path,
            isFolder: Array.isArray(f.children),
            children: [],
          }, 0);
        }
      }
      this.updateCount();
      return;
    }

    const root = this.buildTree();
    for (const child of root.children) this.renderNode(tree, child, 0);
    this.updateCount();
  }

  renderNode(container, node, depth) {
    this.renderRow(container, node, depth);
    if (!node.isFolder || !node.children.length) return;
    if (!this.expanded.has(node.path)) return;
    for (const child of node.children) this.renderNode(container, child, depth + 1);
  }

  renderRow(container, node, depth) {
    const row = container.createDiv({ cls: "qs-batch-row" });
    row.style.paddingLeft = 8 + depth * 16 + "px";

    const hasChildren = node.isFolder && node.children && node.children.length;
    if (hasChildren) {
      const open = this.expanded.has(node.path);
      const toggle = row.createSpan({
        cls: "qs-batch-toggle",
        text: open ? "−" : "+",
      });
      toggle.addEventListener("click", () => {
        if (open) this.expanded.delete(node.path);
        else this.expanded.add(node.path);
        this.renderTree();
      });
    } else {
      row.createSpan({ cls: "qs-batch-toggle is-blank", text: "" });
    }

    const cb = row.createEl("input", { type: "checkbox" });
    cb.checked = this.selected.has(node.path);
    cb.addEventListener("change", () => {
      if (cb.checked) this.selected.add(node.path);
      else this.selected.delete(node.path);
      this.updateCount();
    });

    row.createSpan({
      cls: "qs-batch-name" + (node.isFolder ? " is-folder" : ""),
      text: node.name,
    });

    if (this.plugin.isShelved(node.path)) {
      row.createSpan({
        cls: "qs-modal-tag",
        text: this.plugin.i18n.t("batch.alreadyShelved"),
      });
    }
  }

  updateCount() {
    if (!this.countEl) return;
    const n = this.selected.size;
    this.countEl.setText(
      n
        ? this.plugin.i18n.t("batch.count", { n })
        : this.plugin.i18n.t("batch.countNone")
    );
  }

  async run(mode) {
    const paths = Array.from(this.selected);
    if (!paths.length) {
      new Notice(this.plugin.i18n.t("notice.pickFirst"));
      return;
    }
    const n =
      mode === "shelve"
        ? await this.plugin.shelveMany(paths)
        : await this.plugin.revealMany(paths);
    new Notice(
      this.plugin.i18n.t(
        mode === "shelve" ? "notice.batchDone" : "notice.batchReverted",
        { n }
      )
    );
    this.selected.clear();
    this.render();
  }
}

class QuietShelfSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const t = (k, v) => this.plugin.i18n.t(k, v);
    containerEl.empty();

    containerEl.createEl("h3", { text: "Quiet Shelf" });

    new Setting(containerEl)
      .setName(t("settings.language.name"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((drop) => {
        for (const opt of this.plugin.i18n.options) {
          drop.addOption(opt.id, opt.label);
        }
        drop
          .setValue(s.language || "auto")
          .onChange(async (value) => {
            s.language = value;
            await this.plugin.save();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.autoRules.name"))
      .setDesc(t("settings.autoRules.desc"))
      .addTextArea((txt) => {
        txt.setValue((s.autoRules || []).join("\n")).onChange(async (v) => {
          s.autoRules = v
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          await this.plugin.save();
          this.plugin.apply();
        });
        txt.inputEl.rows = 4;
      });

    new Setting(containerEl)
      .setName(t("settings.autoEnabled.name"))
      .setDesc(t("settings.autoEnabled.desc"))
      .addToggle((tg) =>
        tg.setValue(s.autoEnabled).onChange(async (v) => {
          s.autoEnabled = v;
          await this.plugin.save();
          this.plugin.apply();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.openShelf.name"))
      .setDesc(t("settings.openShelf.desc"))
      .addButton((b) =>
        b
          .setButtonText(t("common.open"))
          .onClick(() => new ShelfModal(this.app, this.plugin).open())
      );

    new Setting(containerEl)
      .setName(t("settings.batch.name"))
      .setDesc(t("settings.batch.desc"))
      .addButton((b) =>
        b
          .setButtonText(t("common.open"))
          .onClick(() => new BatchModal(this.app, this.plugin).open())
      );

    /* ---- 聚焦 ---- */
    containerEl.createEl("h3", { text: t("settings.focus.heading") });
    this.plugin.renderFocusStatus(containerEl, () => this.display());

    new Setting(containerEl)
      .setName(
        t("settings.focusList.name", { n: (s.focusTargets || []).length })
      )
      .setDesc(
        (s.focusTargets || []).join("　·　") ||
          t("settings.focusList.empty")
      )
      .addButton((b) =>
        b.setButtonText(t("common.clear")).onClick(async () => {
          s.focusTargets = [];
          s.focusActive = false;
          await this.plugin.save();
          this.plugin.apply();
          this.display();
        })
      );

    if ((s.savedSets || []).length) {
      containerEl.createEl("h4", { text: t("settings.savedSets.heading") });
      for (const set of s.savedSets) {
        new Setting(containerEl)
          .setName(set.name)
          .setDesc((set.targets || []).join("  ·  "))
          .addButton((b) =>
            b.setButtonText(t("settings.setSwitch")).onClick(async () => {
              await this.plugin.applyFocusSet(set.name);
              this.display();
            })
          )
          .addButton((b) =>
            b.setButtonText(t("settings.setDelete")).onClick(async () => {
              await this.plugin.deleteFocusSet(set.name);
              this.display();
            })
          );
      }
    }

    new Setting(containerEl)
      .setName(t("settings.reset.name"))
      .setDesc(t("settings.reset.desc"))
      .addButton((b) =>
        b.setButtonText(t("common.reset")).onClick(async () => {
          // 语言是「这一页本身」的偏好，恢复默认时刻意保留，
          // 否则中文用户点一下按钮界面就变成英文了。
          const keepLang = s.language;
          this.plugin.settings = Object.assign({}, DEFAULTS, {
            language: keepLang,
          });
          await this.plugin.save();
          this.plugin.apply();
          new Notice(t("common.reset.done"));
          this.display();
        })
      );

    this.renderFooter(containerEl, t);
  }

  /** 版本 + 仓库 + 赞助。四个插件共用同一套结构与文案。 */
  renderFooter(containerEl, t) {
    const wrap = containerEl.createDiv({ cls: "qs-about" });

    const meta = wrap.createDiv({ cls: "qs-about-meta" });
    meta.createSpan({ text: `${t("meta.version")} ${this.plugin.manifest.version}` });
    meta.createSpan({ cls: "qs-about-sep", text: "·" });
    const repo = meta.createEl("a", {
      text: this.plugin.manifest.id,
      href: `https://github.com/yunmin311/${this.plugin.manifest.id}-obsidian`,
    });
    repo.setAttr("target", "_blank");
    repo.setAttr("rel", "noopener");

    renderSponsor(wrap, t);
  }
}

module.exports = QuietShelfPlugin;
