# Quiet Shelf 0.3.1

## 中文

本版修复文件树的恢复路径，不移动、删除或改写任何笔记。

- 放回项目时，会一并放回挡住它的上级目录；若聚焦仍挡住该项目，会退出聚焦。
- 聚焦目标、已保存组合及其他单独移入暗格的项目均保留。放回上级目录后，其中未被单独隐藏的内容也可能重新显示。
- 恢复显示不再等待配置写盘；保存失败会明确提示，避免界面停留在旧的过滤状态。
- 插件禁用后，延迟回调和未完成操作不能再次隐藏文件树。
- 暗格清单、批量管理和设置页新增双语聚焦状态提示及退出入口。
- “退出聚焦”保留暗格规则，不再误称会显示所有已收起项目。

验证：13 项回归测试、语法检查、严格加载检查通过；Windows / Obsidian 1.13.7 实机检查了退出聚焦、放回、禁用再启用和重启。移动端未做实机验证。

手动更新：下载 `main.js`、`manifest.json`、`styles.css`，放入 `.obsidian/plugins/quiet-shelf/`，然后重启或重新启用插件。保留自己的 `data.json`。其余三个 JS 附件是可读源码，运行所需内容已内联到 `main.js`。

## English

This maintenance release repairs file-tree recovery without moving, deleting or editing notes.

- Restore also restores blocking shelved ancestors and exits focus if it excludes the restored item.
- Focus targets, saved sets and unrelated explicit shelf entries are kept. Restoring an ancestor can also reveal its other non-shelved contents.
- Display recovery no longer waits for settings writes; failures show an explicit persistence warning.
- Late callbacks and pending operations cannot hide the tree again after the plugin is disabled.
- The shelf panel, batch manager and settings show a bilingual focus-status explanation and exit control. Exiting focus keeps shelf rules.

Verified with 13 regression tests, syntax and strict-load checks, plus live Windows / Obsidian 1.13.7 checks for restore, exit focus, disable/re-enable and restart. Mobile was not tested on a device.

For manual updates, install `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/quiet-shelf/`, keeping your `data.json`, then restart or re-enable the plugin. The remaining JS assets are readable companion sources already inlined into `main.js`.
