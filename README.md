# prettier-plugin-abap

> An opinionated `ABAP` formatter plugin for [Prettier][]

Prettier is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing, taking various rules into account.

This plugin adds support for `ABAP` code formatting using the same rules as [abap-cleaner][].

## Notice

This plugin is still under development, its formatter just wraps [abap-cleaner][]'s default formatting logic.
Of course it should just work, but may not match [prettier][]'s format sometimes.

## Requirements

`prettier-plugin-abap` is an ABAP-focused module. This module requires an [LTS](https://github.com/nodejs/Release) Node version (v16.0.0+).

## Install

Using npm:

```sh
# npm
npm i -D prettier prettier-plugin-abap

# yarn
yarn add -D prettier prettier-plugin-abap
```

## Usage

Once installed, [Prettier plugins](https://prettier.io/docs/en/plugins.html) must be added to `.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-abap"]
}
```

Then:

```sh
# npx
npx prettier --write foo.abap

# yarn
yarn prettier --write foo.abap
```

## Configuration

Standard Prettier options work with ABAP files:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2
}
```

Plugin-specific options that map to abap-cleaner rules:

- `abapKeywordCase`: `"upper"` (default) or `"lower"` keyword casing.
- `abapSpaceBeforePeriod`: keep a space before statement periods and chain commas.
- `abapSpaceBeforeCommentSign`: ensure a space before inline `"` comments.
- `abapSpaceAfterCommentSign`: insert a space after the `"` comment sign (skips pseudo comments).
- `abapChainFormatting`: `"preserve"` (default) or `"expand"` colon chains.
