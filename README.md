# 📅 GitHub Actions 自动更新 Apple 日历订阅

本项目使用 **GitHub Actions** 定期抓取 **万年历、星座、十二时辰、二十四节气、假期** 数据，并生成 **.ics 订阅日历**，支持手动更新。

## **✨ 特性**
- 📆 **自动获取** `2020-01-01` ~ `今日` 的数据
- 🔄 **手动触发** 更新（GitHub Actions `workflow_dispatch`）
- 🛠 **自动生成** `.ics` 文件，可订阅

## **📜 API 源**
- 万年历: [TimelessQ](https://api.timelessq.com)
- 星座: [TimelessQ](https://api.timelessq.com)
- 十二时辰: [TimelessQ](https://api.timelessq.com)
- 二十四节气: [TimelessQ](https://api.timelessq.com)
- 假期: [JieJiaRiAPI](https://api.jiejiariapi.com)

## **🚀 使用**
### **手动更新**
1. 进入 **GitHub Actions**
2. 选择 `Update Calendar Data`
3. 点击 **Run workflow**

### **订阅日历**
- **iPhone / Mac**: 订阅 `calendar.ics` 链接

## **📂 项目结构**
📦 Calendar
├── 📂 .github
│   ├── 📂 workflows
│   │   ├── update-data.yml      # GitHub Actions 任务（手动触发）
├── 📂 scripts
│   ├── fetch-data.js            # 获取日历数据并存储到 data.json
│   ├── generate-ics.js          # 生成 Apple 日历订阅 `.ics`
├── 📂 data
│   ├── data.json                # 存储已获取的日历数据
├── calendar.ics                 # 生成的 `.ics` 订阅日历文件
├── package.json                 # Node.js 依赖配置
├── README.md                    # 项目说明
## **📜 许可证**
MIT