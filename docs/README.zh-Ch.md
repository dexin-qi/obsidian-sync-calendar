# Obsidian x Calendar

一款 [Obsidian](https://obsidian.md/) 插件，用于在 Obsidian 笔记中实现 [Google 日历](https://calendar.google.com/) 事件的可视化。

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/dustinksi/obsidian-sync-calendar/release.yml?style=shield) ![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/dustinksi/obsidian-sync-calendar?display_name=tag)


**注意**：
1. 我们的任务格式借鉴了 tasks，但我们**目前不支持重复任务**。
2. 要将任务从 Obsidian 同步到日历中，您需要将开始时间元素附加到任务上（即 🛫 YYYY-MM-DD），然后单击同步图标或调用“Sync with Calendar”命令。
3. 我们的任务同步是**以日历事件为中心**的，这意味着在将任务从 Obsidian 同步到日历后，在 Obsidian 中对任务进行的修改不会同步到日历中。要进一步修改日程安排，您需要直接在日历中进行修改。稍后，对日历中进行的更改将自动同步回 Obsidian。
4. 此插件仍处于早期 alpha 版本，随时可能更改！
5. 我很清楚 google calendar 在国内的使用体验不佳，但是 Microsoft 提供的接口真的一言难尽...

![RELEASE DEMO](https://upic-openaccess.oss-cn-beijing.aliyuncs.com/picgo/README_DEMO.gif)

## 安装和使用

### 首先

- 您需要一个 Google 日历凭据文件。您可以自己申请（放轻松，很简单～）：
    - 参考[Google 的指南](https://developers.google.com/workspace/guides/create-project)创建 Google Cloud 项目
    - 参考[启用 API 指南](https://developers.google.com/workspace/guides/enable-apis)启用您的 Google 日历 API。
    - [配置 OA 屏幕](https://console.cloud.google.com/apis/credentials/consent?)
    - [准备获取您的 OA 凭据](https://console.cloud.google.com/apis/credentials/oauthclient)
      - 选择“桌面应用程序”
      - 为此 OA 应用程序输入名称。
      - 下载 OAClient 凭据文件。
- 将凭据文件放置在 `VaultFolder/.obsidian/calendar.sync.credentials.json` 中

### 手动安装插件

- 从[发布页面](https://github.com/dustinksi/obsidian-sync-calendar/releases)下载 `main.js`、`styles.css` 和 `manifest.json`。
- 将下载的文件复制到 `VaultFolder/.obsidian/plugins/your-plugin-id/`。

**注意**：您也可以自己编译此插件：
- 克隆此存储库。
- 运行 `npm i` 或 `yarn` 安装依赖项。
- 运行 `npm run dev` 以启动监视模式下的编译。

### 从 Obsidian 社区插件浏览器安装插件（目前不可用）

- 通过 Obsidian 的社区插件浏览器安装插件.
- 在 Obsidian 中启用插件。

### 使用此插件
- 在任何笔记中放置以下代码块：
   ````markdown
   ```calendar-sync
   name: "{numberTodo} todos @ Apr. 21",
   timeMin: "2023-04-21"
   timeMax: "2023-04-22"
   ```
   ````
- 切换到预览模式，插件将使用查询结果替换此代码块。

如果您正在同步您的 vault，出于安全原因，我建议您明确忽略 `VaultFolder/.obsidian/calendar.sync.token.json` 文件（如果可能）。

## 输入参数

以下是此插件的输入参数：

| Name | Type | Description | Default |
| ------------- | ---- | -------- | ------- |
| `name` | string | 查询的标题。您可以使用 `{numberTodos}` 模板，该模板将被查询返回的待办事项数量替换。 | "{numberTodos} todos in calendar" |
| `timeMin` | string | 符合 moment.js 格式的字符串，事件的最小时间（包括 `timeMin`）。 | 基于查询时间向前四周 |
| `timeMax` | string | 符合 moment.js 格式的字符串，事件的最大时间（不包括 `timeMax`）。 | null |

**Note**: `sort`，`filter`，`group` 将在下一个版本推出，同时非常欢迎您提交 Pull Request。
## 命令

目前，仅支持一个命令，用于手动触发从Obsidian到Calendar的任务同步。

`Sync with Calendar`:

此命令将获取Obsidian中具有startDate（即🛫 YYYY-MM-DD）的任务。

## 小小支持我一下

代码虽然不多，但也花了我近两周的时间，今天分享给大家。如果您能提供一瓶阔乐的赞助，就是我持续更新的动力和赞赏！

<style>
  .img-container {
    display: flex;
    justify-content: space-between;
  }

  .img-container img {
    max-width: 50%;
    height: auto;
  }
</style>

<div class="img-container">
  <img src="https://upic-openaccess.oss-cn-beijing.aliyuncs.com/picgo/17272207-36BA-4959-A858-B413CD6D55F4.jpeg" alt="alipay" style="margin:10px">
  <img src="https://upic-openaccess.oss-cn-beijing.aliyuncs.com/picgo/89A3DC7F-50F3-4F41-B1B1-E8D38DE40572.jpeg" alt="wePay" style="margin:10px">
</div>