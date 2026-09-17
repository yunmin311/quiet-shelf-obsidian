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
};

class QuietShelfPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, (await this.loadData()) || {});

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
      name: "打开暗格",
      callback: () => new ShelfModal(this.app, this).open(),
    });

    this.addCommand({
      id: "batch-manage",
      name: "批量移入 / 移出暗格",
      callback: () => new BatchModal(this.app, this).open(),
    });

    this.addCommand({
      id: "toggle-shelve",
      name: "把当前文件移入 / 移出暗格",
      callback: () => this.toggleShelveActiveFile(),
    });

    this.addCommand({
      id: "toggle-focus",
      name: "切换聚焦模式",
      callback: () => this.toggleFocus(),
    });

    this.addCommand({
      id: "focus-active-folder",
      name: "聚焦当前文件所在文件夹",
      callback: () => this.addFocusActiveFolder(),
    });

    this.addCommand({
      id: "clear-focus",
      name: "退出聚焦（恢复全部）",
      callback: () => this.clearFocus(),
    });

    this.addCommand({
      id: "save-focus-set",
      name: "把当前聚焦存为组合",
      callback: () => this.saveFocusSet(),
    });

    this.addSettingTab(new QuietShelfSettingTab(this.app, this));
  }

  onunload() {
    this.teardownObserver();
    this.stripAllMarks();
  }

  /* ---------- 判定 ---------- */

  /** 命中自动规则吗（按名字精确匹配，去掉 .md 后缀，大小写不敏感） */
  matchesAutoRule(path) {
    if (!this.settings.autoEnabled) return false;
    const name = String(path).split("/").pop() || "";
    const base = name.replace(/\.md$/i, "").toLowerCase();
    return (this.settings.autoRules || []).some((rule) => {
      const key = String(rule).trim().toLowerCase();
      return key && base === key;
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
    if (this.applyTimer) return;
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = null;
      this.apply();
    }, APPLY_DELAY_MS);
  }

  apply() {
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
    const shelved = this.settings.shelved.filter((p) => p !== path);
    const revealed = this.settings.revealed.includes(path)
      ? this.settings.revealed
      : this.settings.revealed.concat(path);
    this.settings.shelved = shelved;
    this.settings.revealed = revealed;
    await this.save();
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
    for (const p of paths) {
      shelved.delete(p);
      revealed.add(p);
    }
    this.settings.shelved = Array.from(shelved);
    this.settings.revealed = Array.from(revealed);
    await this.save();
    this.apply();
    return paths.length;
  }

  /** 手动放回 = 加进 revealed，既撤掉当前的，也挡住自动规则 */
  async toggleShelve(path) {
    if (this.isShelved(path)) {
      await this.reveal(path);
      new Notice("已从暗格放回：" + path);
    } else {
      await this.shelve(path);
      new Notice("已移入暗格：" + path);
    }
    this.apply();
  }

  toggleShelveActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("当前没有打开的文件");
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
    if (f && f.children) return "文件夹";
    if (f) return "文件";
    return "已失效";
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
        out.push({ path, kind: f.children ? "文件夹" : "文件", auto: true });
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
      new Notice("聚焦清单是空的 —— 先对文件夹用「加入聚焦」");
      return;
    }
    this.settings.focusActive = true;
    await this.save();
    this.apply();
    new Notice("已进入聚焦：" + this.settings.focusTargets.length + " 项");
  }

  async clearFocus() {
    this.settings.focusActive = false;
    await this.save();
    this.apply();
    new Notice("已退出聚焦");
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
    new Notice("已加入聚焦：" + path);
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
      new Notice("当前没有打开的文件");
      return;
    }
    const dir = file.parent && file.parent.path;
    this.addFocusTarget(dir && dir !== "/" ? dir : file.path);
  }

  async saveFocusSet() {
    const targets = this.settings.focusTargets || [];
    if (!targets.length) {
      new Notice("聚焦清单是空的，没什么可存的");
      return;
    }
    const name = window.prompt("给这组聚焦起个名字", "组合 " + (this.settings.savedSets.length + 1));
    if (!name) return;
    this.settings.savedSets = this.settings.savedSets
      .filter((s) => s.name !== name)
      .concat({ name, targets: targets.slice() });
    await this.save();
    new Notice("已保存组合：" + name);
  }

  async applyFocusSet(name) {
    const set = (this.settings.savedSets || []).find((s) => s.name === name);
    if (!set) return;
    this.settings.focusTargets = (set.targets || []).slice();
    this.settings.focusActive = true;
    await this.save();
    this.apply();
    new Notice("已切换到组合：" + name);
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
        .setTitle(shelved ? "从暗格放回" : "移入暗格")
        .setIcon("archive")
        .onClick(() => this.toggleShelve(file.path))
    );

    if (file.children) {
      const inFocus = this.settings.focusTargets.includes(file.path);
      menu.addItem((item) =>
        item
          .setTitle(inFocus ? "从聚焦移除" : "加入聚焦")
          .setIcon("focus")
          .onClick(() =>
            inFocus ? this.removeFocusTarget(file.path) : this.addFocusTarget(file.path)
          )
      );
    }
  }

  /* ---------- 存取 ---------- */

  async save() {
    await this.saveData(this.settings);
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
    contentEl.empty();

    const items = this.plugin.listShelved();
    contentEl.createEl("h4", { text: "暗格 · " + items.length + " 项" });
    contentEl.createDiv({
      cls: "qs-modal-hint",
      text: "这里的文件只是左侧不显示，位置、知识图谱、搜索都不受影响。点「放回」即恢复显示。",
    });

    if (!items.length) {
      contentEl.createDiv({ cls: "qs-modal-empty", text: "暗格是空的。" });
      return;
    }

    const list = contentEl.createDiv({ cls: "qs-modal-list" });
    for (const it of items) {
      const row = list.createDiv({ cls: "qs-modal-row" });
      row.createSpan({ cls: "qs-modal-kind", text: it.kind });
      row.createSpan({ cls: "qs-modal-path", text: it.path });
      if (it.auto) row.createSpan({ cls: "qs-modal-tag", text: "自动" });
      const btn = row.createEl("button", { text: "放回" });
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
    contentEl.empty();

    contentEl.createEl("h4", { text: "批量管理" });
    contentEl.createDiv({
      cls: "qs-modal-hint",
      text: "勾选文件夹或文件，然后一次移入暗格或放回。只影响左侧文件树的显示，不动任何文件。",
    });

    const bar = contentEl.createDiv({ cls: "qs-batch-bar" });
    const search = bar.createEl("input", {
      type: "search",
      placeholder: "筛选路径…",
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
    mkBtn("展开全部", () => {
      this.expanded = new Set(this.allFolderPaths());
      this.renderTree();
    });
    mkBtn("折叠全部", () => {
      this.expanded.clear();
      this.renderTree();
    });
    mkBtn("选中当前结果", () => {
      for (const n of this.allPaths()) this.selected.add(n);
      this.renderTree();
    });
    mkBtn("清空选择", () => {
      this.selected.clear();
      this.renderTree();
    });

    this.treeEl = contentEl.createDiv({ cls: "qs-batch-tree" });
    this.renderTree();

    const foot = contentEl.createDiv({ cls: "qs-batch-foot" });
    this.countEl = foot.createSpan({ cls: "qs-batch-count" });
    const bShelve = foot.createEl("button", { text: "移入暗格", cls: "mod-cta" });
    const bReveal = foot.createEl("button", { text: "从暗格放回" });
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
    const root = { path: "", name: "（整个 vault）", isFolder: true, children: [] };
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
        tree.createDiv({ cls: "qs-modal-empty", text: "没有匹配的路径。" });
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
      row.createSpan({ cls: "qs-modal-tag", text: "已在暗格" });
    }
  }

  updateCount() {
    if (!this.countEl) return;
    const n = this.selected.size;
    this.countEl.setText(n ? "已选 " + n + " 项" : "还没勾选任何项");
  }

  async run(mode) {
    const paths = Array.from(this.selected);
    if (!paths.length) {
      new Notice("先勾选要处理的项目");
      return;
    }
    const n =
      mode === "shelve"
        ? await this.plugin.shelveMany(paths)
        : await this.plugin.revealMany(paths);
    new Notice((mode === "shelve" ? "已移入暗格 " : "已从暗格放回 ") + n + " 项");
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
    containerEl.empty();

    containerEl.createEl("h3", { text: "暗格" });

    new Setting(containerEl)
      .setName("自动收起的文件名")
      .setDesc(
        "每行一个关键词，按文件名精确匹配（不含 .md 后缀，不区分大小写）。" +
          "比如 readme、inbox、index。被手动放回过的文件不会再被自动收起。"
      )
      .addTextArea((t) => {
        t.setValue((s.autoRules || []).join("\n")).onChange(async (v) => {
          s.autoRules = v
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          await this.plugin.save();
          this.plugin.apply();
        });
        t.inputEl.rows = 4;
      });

    new Setting(containerEl)
      .setName("启用自动规则")
      .setDesc("关掉后只保留手动移入暗格的项目。")
      .addToggle((t) =>
        t.setValue(s.autoEnabled).onChange(async (v) => {
          s.autoEnabled = v;
          await this.plugin.save();
          this.plugin.apply();
        })
      );

    new Setting(containerEl)
      .setName("打开暗格清单")
      .setDesc("查看当前所有被收起的项目，并可逐个放回。")
      .addButton((b) =>
        b.setButtonText("打开").onClick(() => new ShelfModal(this.app, this.plugin).open())
      );

    new Setting(containerEl)
      .setName("批量管理")
      .setDesc(
        "把整个 vault 摊成可勾选的列表，一次把多个文件夹或文件移入暗格 / 放回。" +
          "带筛选框，也可以「选中当前结果」一次性处理某个路径下的全部内容。"
      )
      .addButton((b) =>
        b.setButtonText("打开").onClick(() => new BatchModal(this.app, this.plugin).open())
      );

    /* ---- 聚焦 ---- */
    containerEl.createEl("h3", { text: "聚焦" });

    new Setting(containerEl)
      .setName("当前聚焦清单（" + (s.focusTargets || []).length + " 项）")
      .setDesc(
        (s.focusTargets || []).join("　·　") ||
          "空。在文件上右键选「加入聚焦」，或先打开一篇笔记再用命令「聚焦当前文件所在文件夹」。"
      )
      .addButton((b) =>
        b.setButtonText("清空").onClick(async () => {
          s.focusTargets = [];
          s.focusActive = false;
          await this.plugin.save();
          this.plugin.apply();
          this.display();
        })
      );

    if ((s.savedSets || []).length) {
      containerEl.createEl("h4", { text: "已保存的组合" });
      for (const set of s.savedSets) {
        new Setting(containerEl)
          .setName(set.name)
          .setDesc((set.targets || []).join("  ·  "))
          .addButton((b) =>
            b.setButtonText("切换").onClick(async () => {
              await this.plugin.applyFocusSet(set.name);
              this.display();
            })
          )
          .addButton((b) =>
            b.setButtonText("删除").onClick(async () => {
              await this.plugin.deleteFocusSet(set.name);
              this.display();
            })
          );
      }
    }
  }
}

module.exports = QuietShelfPlugin;
