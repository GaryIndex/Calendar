# 苹果日历订阅

这个项目生成一个苹果日历订阅文件（`.ics`），包含每日的万年历、星座、十二时辰、节气和假期信息。通过 GitHub Actions 实现自动更新，每天自动生成新的 `.ics` 文件。

## 项目结构

- `data/`：包含 `data.json` 文件，存储过去和未来的所有抓取数据。
- `scripts/`：包含数据抓取脚本（`fetch-data.js`）和 `.ics` 文件生成脚本（`generate-ics.js`）。
- `.github/workflows/`：包含 GitHub Actions 工作流配置文件（`update-calendar.yml`）。
- `calendar.ics`：生成的 `.ics` 文件，用于苹果日历订阅。

## 安装与配置

1. 克隆这个仓库。
2. 运行 `npm install` 安装项目依赖。

## 脚本说明

- `npm start`：抓取过去五年的数据并存储到 `data/data.json` 文件。
- `npm run generate`：根据 `data.json` 文件生成 `.ics` 格式的日历订阅文件。

## 自动更新

日历将通过 GitHub Actions 每天自动更新。 `.ics` 文件会每天更新并提交到仓库中。

## 许可证

MIT