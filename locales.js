/* Quiet Shelf（暗格）—— 界面字符串表。
   含命令、右键菜单、两个弹窗、Notice 与设置页的全部界面文字。 */

"use strict";

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

module.exports = { LOCALES: buildLocales() };

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
