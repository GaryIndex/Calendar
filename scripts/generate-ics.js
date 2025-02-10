// **处理数据**
import { loadAllJsonData, logInfo, logError } from '/scripts/utils/utils.js'; // 确保路径正确

(async () => {
  try {
    logInfo("📂 开始加载所有 JSON 数据");
    const jsonData = await loadAllJsonData();
    logInfo("✅ 成功加载所有 JSON 数据");
    console.log(jsonData);
  } catch (error) {
    logError(`❌ 加载 JSON 数据失败: ${error.message}`);
  }
})();

 // **数据处理器**
const processors = {
  /**
   * **处理节假日数据**
   */
  holidays: (data, allEvents) => {
    logInfo("🛠️ 处理节假日数据...");
    if (!Array.isArray(data.Reconstruction)) return logError("❌ Reconstruction 数据不存在！");

    data.Reconstruction.forEach(entry => {
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([date, entries]) => {
        entries.forEach(holiday => {
          const { name, isOffDay } = holiday;
          if (!name || isOffDay === undefined) {
            logError(`❌ 缺少必要字段: ${JSON.stringify(holiday)}`);
            return;
          }
          const descParts = Object.entries(holiday)
            .filter(([k]) => !['name', 'isOffDay'].includes(k))
            .map(([_, v]) => `${v}`)
            .join(" | ");
          allEvents.push(createEvent({
            date,
            title: `${isOffDay ? "[休]" : "[班]"} ${name}`,
            isAllDay: true,
            description: descParts
          }));
          logInfo(`✅ 添加节假日事件: ${date} - ${name}`);
        });
      });
    });
  },

  /**
   * **处理节气数据**
   */
  jieqi: (data, allEvents) => {
    logInfo("🛠️ 处理节气数据...");
    if (!Array.isArray(data.Reconstruction)) return logError("❌ Reconstruction 数据不存在！");

    data.Reconstruction.forEach(entry => {
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([date, entries]) => {
        entries.forEach(event => {
          if (!event.time || !event.name) {
            logError(`❌ 缺少 name 或 time: ${JSON.stringify(event)}`);
            return;
          }
          allEvents.push(createEvent({
            date,
            title: event.name,
            startTime: event.time.split(" ")[1] || "", // 仅保留时间部分
            isAllDay: false,
            description: `节气: ${event.name}`
          }));
        });
      });
    });
  },

  /**
   * **处理天文数据**
   */
  astro: (data, allEvents) => {
    logInfo("🛠️ 处理天文数据...");
    if (!Array.isArray(data.Reconstruction)) return logError("❌ Reconstruction 数据不存在！");

    data.Reconstruction.forEach(entry => {
      if (!entry || typeof entry !== "object" || !entry.data?.range) return;

      const [start, end] = entry.data.range.split("-").map(date => `2025-${date.replace(".", "-")}`);
      let currentDate = new Date(start);
      const endDate = new Date(end);

      while (currentDate <= endDate) {
        const description = Object.entries(entry.data)
          .filter(([key]) => key !== "range")
          .map(([_, value]) => `${value}`)
          .join(" | ");

        allEvents.push(createEvent({
          date: currentDate.toISOString().split("T")[0],
          title: entry.data.name || "天文事件",
          isAllDay: true,
          description
        }));

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
  },

  /**
   * **处理时辰数据**
   */
  shichen: (data, allEvents) => {
    logInfo("🛠️ 处理时辰数据...");
    if (!Array.isArray(data.Reconstruction)) return logError("❌ Reconstruction 数据不存在！");

    data.Reconstruction.forEach(entry => {
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([date, entries]) => {
        entries.forEach(event => {
          if (!event.hour || !event.hours) {
            logError(`❌ 缺少 hour 或 hours: ${JSON.stringify(event)}`);
            return;
          }

          let [startTime, endTime] = event.hours.split("-");
          if (startTime.length === 4) startTime = "0" + startTime; // 修正 `1:00` 为 `01:00`
          if (endTime.length === 4) endTime = "0" + endTime;

          const description = ["yi", "ji", "chong", "sha", "nayin", "jiuxing"]
            .map(key => event[key] ? `${key}: ${event[key]}` : "")
            .filter(Boolean)
            .join(" | ");

          allEvents.push(createEvent({
            date,
            title: event.hour,
            startTime,
            endTime,
            isAllDay: false,
            description
          }));
        });
      });
    });
  },

  /**
   * **处理万年历数据**
   */
  calendar: (data, allEvents) => {
    logInfo("🛠️ 处理万年历数据...");
    if (!Array.isArray(data.Reconstruction)) return logError("❌ Reconstruction 数据不存在！");

    data.Reconstruction.forEach(entry => {
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([date, entries]) => {
        entries.forEach(event => {
          const description = Object.entries(event)
            .filter(([key]) => !["errno", "errmsg", "festivals", "solarTerms", "cnWeek"].includes(key))
            .map(([_, value]) => (Array.isArray(value) ? value.join(" | ") : value))
            .join(" | ");

          let title = event.cnWeek || "万年历信息";
          if (event.festivals) title += ` ${event.festivals}`;

          allEvents.push(createEvent({
            date,
            title,
            description,
            isAllDay: true
          }));
        });
      });
    });
  }
};
/**
 * **处理所有数据**
 */
const processAllData = (jsonData, allEvents) => {
  logInfo("📌 正在处理所有数据...");
  // **先处理 Reconstruction**
  Object.entries(jsonData).forEach(([source, data]) => {
    if (data.Reconstruction) {
      Object.entries(data.Reconstruction).forEach(([date, entries]) => {
        entries.forEach(entry => {
          const event = createEvent({
            date,
            title: entry.name || "无标题",
            description: Object.entries(entry)
              .map(([_, v]) => `${v}`)
              .join(" | "),
            isAllDay: true
          });
          allEvents.push(event);
        });
      });
    }
  });
  // **再执行 processors**
  Object.entries(jsonData).forEach(([source, data]) => {
    if (processors[source]) processors[source](data, allEvents);
  });
  logInfo(`✅ 处理完成，共生成 ${allEvents.length} 个事件`);
};
/**
 * **主流程**
 */
const main = async () => {
  const allEvents = [];
  const jsonData = await loadAllJsonData();
  processAllData(jsonData, allEvents);
  logInfo("🎉 所有数据处理完成！");
};
// **执行 `main()`**
await main();
// **处理数据**
/**
 * **生成 ICS 文件**
 */
const generateICS = async (events) => {
  const icsData = events.map(event => `
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date.replace(/-/g, '')}T${event.startTime ? event.startTime.replace(/:/g, '') + '00' : '000000'}
DTEND:${event.date.replace(/-/g, '')}T${event.endTime ? event.endTime.replace(/:/g, '') + '00' : '235959'}
DESCRIPTION:${typeof event.description === 'string' ? event.description : JSON.stringify(event.description)}
END:VEVENT`).join("\n");

  //await fs.promises.writeFile(icsFilePath, `BEGIN:VCALENDAR\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
  const icsFilePath = path.join(__dirname, 'calendar.ics');
  logInfo(`✅ ICS 文件生成成功: ${icsFilePath}`);
};

// **执行流程**
(async () => {
  const allEvents = [];
  //const [holidays, jieqi, astro, shichen, calendar] = await Promise.all(Object.values(dataPaths).map(readJsonData));
  const jsonDataArray = await Promise.all(Object.values(dataPaths).map(async file => await readJsonData(file)));
  const jsonDatajust = Object.fromEntries(Object.keys(dataPaths).map((key, i) => [key, jsonDataArray[i]]));
  //Object.values(processors).forEach(fn => fn({ Reconstruction: holidays }, allEvents));
  const jsonDataand = await loadAllJsonData();
  processAllData(jsonData, allEvents);
  await generateICS(allEvents);
})();