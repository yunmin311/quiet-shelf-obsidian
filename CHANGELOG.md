# Changelog

All notable changes to this plugin are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## 0.3.0

- Auto-shelve rules now support wildcards. `*` is a wildcard and its position
  decides the match, so one rule can express exactly what you mean:
  - `index` — the file name is exactly `index`
  - `index*` — the file name starts with `index` (e.g. `index-old`)
  - `*index` — the file name ends with `index` (e.g. `_Aesthetic Index`)
  - `*index*` — the file name contains `index` anywhere
  All four are case-insensitive. Without `*` the previous exact-match behaviour
  is unchanged, so existing rules keep working.

> ### Please read before upgrading: what a bare rule does and does not match
>
> **A rule with no `*` matches the file name exactly — it is not a substring
> match.** This matters because it is easy to assume the opposite:
>
> - A rule of `hub` matches **only** a file called `hub`. It does **not** match
>   `github.md`, `GitHub.md`, `github-notes.md` or `my-github.md` — all of those
>   are left alone, which is what most people want.
> - If you *do* want to catch everything containing a word, write `*word*`.
>   But be aware of the consequence: **`*hub*` will also catch `github`**,
>   because `github` contains `hub`. Same for `*read*` catching `AlreadyRead`.
>
> The wildcard is opt-in for exactly this reason: the three positions let you
> say which you mean, instead of one behaviour having to guess. No action is
> needed when upgrading — existing rules behave as they did before.

## 0.2.2

- Sponsorship now points at GitHub Sponsors only; the previous
  international/China split (Ko-fi, 爱发电) has been removed.

## 0.2.1

- **Fixed: the plugin failed to load in Obsidian.** 0.2.0 split the code into
  sibling modules and pulled them in with `require("./i18n")`. Obsidian injects
  a whitelist `require` that resolves *only* `obsidian`, `@codemirror/*` and
  `@lezer/*`; anything else falls through to Electron's `window.require`, which
  resolves relative paths against Obsidian's install directory rather than the
  plugin folder. The call returned `undefined` and the plugin threw
  `Cannot destructure property 'bindI18n' of 'require(...)' as it is undefined.`
  The three modules are now inlined into `main.js`, which is self-contained.
  The readable sources are still shipped as `i18n.js` / `locales.js` /
  `sponsor.js` and are inlined by a packaging step.

## 0.2.0

- Bilingual interface: settings page, commands, context-menu items, both modals
  and every notice now ship in Chinese and English, with an in-settings
  language selector (`Auto` / `简体中文` / `English`). `Auto` follows
  Obsidian's own language. A further language is a pure data change in
  `locales.js`.
- Settings page footer with version and repository link, plus a sponsorship
  block listing international and China-friendly options.
- Restore-defaults button, which keeps the language choice (that preference is
  about the page itself).

## 0.1.0

- Initial release.
- Shelve files and folders out of the file explorer without moving them.
- Auto-shelve readme / inbox files by filename; manually restored items are exempt.
- Focus mode: multi-select folders and files across the tree, save named sets.
